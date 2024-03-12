import { Catalog, Eof, Header, Info, Page, Pages, Trailer, Xref } from './blocks'
import { Writer } from './Writer'
import { Image, Text } from './elements'
import { Asset } from './Asset'
import { FontType0, FontType1 } from './resources'
import type { Element, ImageOptions, TextOptions } from './elements'
import type { PageOptions } from './blocks'

export type PageLayout =
  | '/SinglePage'
  | '/OneColumn'
  | '/TwoColumnLeft'
  | '/TwoColumnRight'
  | '/TwoPageLeft'
  | '/TwoPageRight'

export type PageMode =
  | '/UseNone'
  | '/UseOutlines'
  | '/UseThumbs'
  | '/FullScreen'
  | '/UseOC'
  | '/UseAttachments'

export type PageOptionsWithChildren = PageOptions & {
  children?: Array<
    | ({ type: 'image' } & ImageOptions)
    | ({ type: 'text' } & TextOptions)
  >
}

export interface PdfOptions {
  id?: string
  colorSpace?: 'rgb' | 'cmyk'
  // Catalog
  pageLayout?: PageLayout
  pageMode?: PageMode
  // info
  title?: string
  subject?: string
  keywords?: string
  author?: string
  creationDate?: Date
  modDate?: Date
  creator?: string
  producer?: string
  // pages
  pages?: Array<PageOptionsWithChildren>
}

export class Pdf {
  static version = import.meta.env.version

  asset = new Asset(this)
  pages: Array<Page> = []
  currentPage = 0
  get page(): Page { return this.pages[this.currentPage] }

  // custom
  colorSpace: 'rgb' | 'cmyk' = 'rgb'

  // trailer
  id?: string

  // info
  title?: string
  subject?: string
  keywords?: string
  author?: string
  creationDate = new Date()
  modDate = new Date()
  creator = `@bige/pdf@^${ Pdf.version }`
  producer = `@bige/pdf@^${ Pdf.version }`

  // Catalog
  pageLayout?: PageLayout
  pageMode?: PageMode

  // blocks
  _eof = new Eof().setPdf(this)
  _xref = new Xref().setPdf(this)
  _trailer = new Trailer().setPdf(this)
  _catalog = new Catalog().setPdf(this)
  _info = new Info().setPdf(this)
  _pages = new Pages().setPdf(this)
  _header = new Header().setPdf(this)

  constructor(options?: PdfOptions) {
    FontType1.loadStandardFonts(this.asset)
    if (options) {
      const { pages, ...pdfOptions } = options
      pages?.forEach(props => this.addPage(props))
      for (const key in pdfOptions) {
        if (key in pdfOptions) {
          (this as any)[key] = (pdfOptions as any)[key]
        }
      }
    }
  }

  addPage(options: PageOptionsWithChildren): Page {
    const { children, ...pageOptions } = options
    const page = new Page(pageOptions).setPdf(this)
    this.activatePage(this.pages.push(page) - 1)
    children?.forEach(({ type, ...elementOptions }) => {
      page.appendChild(this.createElement(type, elementOptions))
    })
    return page
  }

  activatePage(page: number): this {
    this.currentPage = page
    return this
  }

  createElement(type: string, options: Record<string, any>): Element {
    switch (type) {
      case 'image':
        return new Image(options)
      case 'text':
      default:
        return new Text(options)
    }
  }

  addElement(type: string, options: Record<string, any>): Element {
    const element = this.createElement(type, options)
    this.page.appendChild(element)
    return element
  }

  async generate(): Promise<string> {
    const writer = new Writer()
    this._header.writeTo(writer)
    const resources = new Set((
      await Promise.all(this.pages.map(page => page.load()))
    ).flatMap(v => v))
    resources.forEach(resource => {
      if (resource instanceof FontType0) {
        resource.updateFontData()
      }
    })
    this.pages.forEach(page => page.writeTo(writer))
    this._pages.writeTo(writer)
    resources.forEach(resource => resource.writeTo(writer))
    this._info.writeTo(writer)
    this._catalog.writeTo(writer)
    this._xref.writeTo(writer)
    this._trailer.writeTo(writer)
    this._eof.writeTo(writer)
    return writer.data
  }

  async toArrayBuffer(): Promise<ArrayBuffer> {
    const data = await this.generate()
    let len = data.length
    const buffer = new ArrayBuffer(len)
    const array = new Uint8Array(buffer)
    while (len--) array[len] = data.charCodeAt(len)
    return buffer
  }

  async toBlob(): Promise<Blob> {
    return new Blob([await this.toArrayBuffer()], { type: 'application/pdf' })
  }

  async toUrl(): Promise<string> {
    return URL.createObjectURL(await this.toBlob())
  }

  async openInNewWindow(): Promise<void> {
    const url = URL.createObjectURL(await this.toBlob())
    window.open(url)
    setTimeout(() => url, 4_0000)
  }

  async save(filename = 'download.pdf'): Promise<void> {
    const a = document.createElement('a')
    a.download = filename
    a.href = URL.createObjectURL(await this.toBlob())
    a.rel = 'noopener'
    setTimeout(() => URL.revokeObjectURL(a.href), 4_0000)
    setTimeout(() => a.dispatchEvent(new MouseEvent('click')), 0)
  }
}
