import { Catalog, Eof, Header, Info, Page, Pages, Trailer, Xref } from './blocks'
import { Writer } from './Writer'
import { Image, Text } from './elements'
import type { Element, ImageProperties, TextProperties } from './elements'
import type { PageProperties } from './blocks'

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

export type PagePropertiesWithChildren = PageProperties & {
  children?: Array<
    | ({ type: 'image' } & ImageProperties)
    | ({ type: 'text' } & TextProperties)
  >
}

export interface PdfProperties {
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
  pages?: Array<PagePropertiesWithChildren>
}

export class Pdf {
  static version = '0.0.0'

  data = ''
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
  creator = `modern-pdf@^${ Pdf.version }`
  producer = `modern-pdf@^${ Pdf.version }`

  // Catalog
  pageLayout: PageLayout = '/SinglePage'
  pageMode: PageMode = '/UseNone'

  // blocks
  _eof = new Eof().setPdf(this)
  _xref = new Xref().setPdf(this)
  _trailer = new Trailer().setPdf(this)
  _catalog = new Catalog().setPdf(this)
  _info = new Info().setPdf(this)
  _pages = new Pages().setPdf(this)
  _header = new Header().setPdf(this)

  constructor(properties?: PdfProperties) {
    if (properties) {
      const { pages, ...pdfProperties } = properties
      pages?.forEach(props => this.addPage(props))
      for (const key in pdfProperties) {
        if (key in pdfProperties) {
          (this as any)[key] = (pdfProperties as any)[key]
        }
      }
    }
  }

  addPage(properties: PagePropertiesWithChildren): Page {
    const { children, ...pageProperties } = properties
    const page = new Page(pageProperties).setPdf(this)
    this.activatePage(this.pages.push(page) - 1)
    children?.forEach(({ type, ...elementProperties }) => {
      page.appendChild(this.createElement(type, elementProperties))
    })
    return page
  }

  activatePage(page: number): this {
    this.currentPage = page
    return this
  }

  createElement(type: string, properties: Record<string, any>): Element {
    switch (type) {
      case 'image':
        return new Image(properties)
      case 'text':
      default:
        return new Text(properties)
    }
  }

  addElement(type: string, properties: Record<string, any>): Element {
    const element = this.createElement(type, properties)
    this.page.appendChild(element)
    return element
  }

  async generate(): Promise<this> {
    await Promise.all(this.pages.map(page => page.waitUntilLoad()))
    const writer = new Writer()
    this._header.writeTo(writer)
    this.pages.forEach(page => page.writeTo(writer))
    this._pages.writeTo(writer)
    this._info.writeTo(writer)
    this._catalog.writeTo(writer)
    this._xref.writeTo(writer)
    this._trailer.writeTo(writer)
    this._eof.writeTo(writer)
    this.data = writer.data
    return this
  }

  toArrayBuffer(): ArrayBuffer {
    const data = this.data
    let len = data.length
    const buffer = new ArrayBuffer(len)
    const array = new Uint8Array(buffer)
    while (len--) array[len] = data.charCodeAt(len)
    return buffer
  }

  toBlob(): Blob {
    return new Blob([this.toArrayBuffer()], { type: 'application/pdf' })
  }

  toUrl(): string {
    return URL.createObjectURL(this.toBlob())
  }

  openInNewWindow() {
    const url = URL.createObjectURL(this.toBlob())
    window.open(url)
    setTimeout(() => url, 4_0000)
  }

  async save(filename = 'download.pdf'): Promise<void> {
    await this.generate()
    const a = document.createElement('a')
    a.download = filename
    a.href = URL.createObjectURL(this.toBlob())
    a.rel = 'noopener'
    setTimeout(() => URL.revokeObjectURL(a.href), 4_0000)
    setTimeout(() => a.dispatchEvent(new MouseEvent('click')), 0)
  }
}
