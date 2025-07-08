import type { Element as IDocElement, StyleDeclaration } from 'modern-idoc'
import type { Element } from '../elements'
import type { Pdf } from '../Pdf'
import type { Resource } from '../resources'
import type { Writer } from '../Writer'
import type { Pages } from './Pages'
import { Resources } from '../resources'
import { Contents } from './Contents'
import { ObjectBlock } from './ObjectBlock'

export interface PageOptionMeta {
  cropBox?: number[]
  bleedBox?: number[]
  trimBox?: number[]
  artBox?: number[]
  userUnit?: number
}

export interface PageOptions extends IDocElement {
  meta?: PageOptionMeta
}

export class Page extends ObjectBlock {
  style: Partial<StyleDeclaration>

  cropBox?: number[]
  bleedBox?: number[]
  trimBox?: number[]
  artBox?: number[]
  userUnit?: number
  children: Element[] = []

  _parent?: Pages
  _contents = new Contents()
  _resources = new Resources()

  constructor(options: PageOptions = {}) {
    super()
    const { style = {}, meta } = options
    this.style = style
    meta && this.setProperties(meta)
  }

  override setPdf(pdf: Pdf): this {
    this._parent = pdf._pages
    this._contents.setPdf(pdf)
    this._resources.setPdf(pdf)
    return super.setPdf(pdf)
  }

  appendChild(element: Element): Element {
    this.children.push(element.setPage(this))
    return element
  }

  async load(): Promise<Resource[]> {
    return (
      await Promise.all(this.children.flatMap((element) => {
        return element.load().map((val) => {
          return val.catch((error) => {
            console.error('Failed to page.load, element: ', element, error)
            return null
          })
        })
      }))
    )
      .filter(source => Boolean(source))
      .flatMap((source) => {
        this._resources.sources.add(source as any)
        return source
      }) as any
  }

  override writeTo(writer: Writer): void {
    const {
      rotate = 0,
      left = 0,
      top = 0,
      width = 0,
      height = 0,
    } = this.style
    this.children.forEach(child => child.writeTo(this._contents.writer))
    this._resources.writeTo(writer)
    this._contents.writeTo(writer)
    writer.writeObj(this, () => {
      writer.write({
        '/Type': '/Page',
        '/Parent': this._parent,
        '/Resources': this._resources,
        '/Contents': this._contents,
        '/Rotate': rotate,
        '/MediaBox': [left, top, width, height],
        '/CropBox': this.cropBox,
        '/BleedBox': this.bleedBox,
        '/TrimBox': this.trimBox,
        '/ArtBox': this.artBox,
        '/UserUnit': this.userUnit && this.userUnit !== 1.0 ? this.userUnit : undefined,
        '/StructParents': 0,
      })
    })
  }
}
