import type { Fonts } from 'modern-font'
import type { IDOCDocument, IDOCElement } from 'modern-idoc'
import type { PageOptions } from './blocks'
import { Asset } from './Asset'
import { Catalog, Eof, Header, Info, Page, Pages, Trailer, Xref } from './blocks'
import { Element } from './elements'
import { FontType0, FontType1 } from './resources'
import { Writer } from './Writer'

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

export interface PDFOptionMeta {
  id?: string
  colorSpace?: 'rgb' | 'cmyk'
  // catalog
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
}

export interface PDFOptions extends IDOCDocument {
  fonts?: Fonts
  meta?: PDFOptionMeta
  children?: PageOptions[]
}

export class PDF {
  static version = __VERSION__

  fonts?: Fonts
  asset = new Asset(this)
  pages: Page[] = []
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
  creator = `modern-pdf@^${PDF.version}`
  producer = `modern-pdf@^${PDF.version}`

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

  constructor(doc?: PDFOptions) {
    FontType1.loadStandardFonts(this.asset)
    if (doc) {
      const { fonts, children, meta } = doc
      children?.forEach(props => this.addPage(props))
      this.fonts = fonts
      for (const key in meta) {
        if (key in meta) {
          (this as any)[key] = (meta as any)[key]
        }
      }
    }
  }

  addPage(options: PageOptions): Page {
    const { children, ...pageOptions } = options
    const page = new Page(pageOptions).setPdf(this)
    this.activatePage(this.pages.push(page) - 1)
    children?.forEach((elementOptions) => {
      page.appendChild(new Element(elementOptions))
    })
    return page
  }

  activatePage(page: number): this {
    this.currentPage = page
    return this
  }

  addElement(options: IDOCElement): Element {
    const element = new Element(options)
    this.page.appendChild(element)
    return element
  }

  async generate(): Promise<string> {
    const writer = new Writer()
    this._header.writeTo(writer)
    const resources = new Set(
      (await Promise.all(this.pages.map(page => page.load()))).flat(),
    )
    resources.forEach((resource) => {
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

  async toBuffer(): Promise<ArrayBuffer> {
    const data = await this.generate()
    let len = data.length
    const buffer = new ArrayBuffer(len)
    const array = new Uint8Array(buffer)
    while (len--) array[len] = data.charCodeAt(len)
    return buffer
  }

  async toBlob(): Promise<Blob> {
    return new Blob([await this.toBuffer()], { type: 'application/pdf' })
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
