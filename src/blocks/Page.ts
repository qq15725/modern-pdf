import { Resources } from '../resources'
import { Contents } from './Contents'
import { ObjectBlock } from './ObjectBlock'
import type { Resource } from '../resources'
import type { Pdf } from '../Pdf'
import type { Pages } from './Pages'
import type { Element } from '../elements'
import type { Writer } from '../Writer'

export interface PageOptions {
  rotate?: number
  left?: number
  top?: number
  width?: number
  height?: number
  cropBox?: Array<number>
  bleedBox?: Array<number>
  trimBox?: Array<number>
  artBox?: Array<number>
  userUnit?: number
}

export class Page extends ObjectBlock {
  rotate?: number
  left = 0
  top = 0
  width = 0
  height = 0
  cropBox?: Array<number>
  bleedBox?: Array<number>
  trimBox?: Array<number>
  artBox?: Array<number>
  userUnit?: number
  children: Array<Element> = []

  _parent?: Pages
  _contents = new Contents()
  _resources = new Resources()

  constructor(options?: PageOptions) {
    super()
    options && this.setProperties(options)
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

  async load(): Promise<Array<Resource>> {
    return (
      await Promise.all(this.children.flatMap(element => {
        return element.load().map(val => {
          return val.catch(error => {
            console.error('Failed to page.load, element: ', element, error)
            return null
          })
        })
      }))
    )
      .filter(source => Boolean(source))
      .flatMap(source => {
        this._resources.sources.add(source as any)
        return source
      }) as any
  }

  override writeTo(writer: Writer): void {
    this.children.forEach(child => child.writeTo(this._contents.writer))
    this._resources.writeTo(writer)
    this._contents.writeTo(writer)
    writer.writeObj(this, () => {
      writer.write({
        '/Type': '/Page',
        '/Parent': this._parent,
        '/Resources': this._resources,
        '/Contents': this._contents,
        '/Rotate': this.rotate,
        '/MediaBox': [this.left, this.top, this.width, this.height],
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
