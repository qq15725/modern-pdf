import { Resources } from '../resources/Resources'
import { Contents } from './Contents'
import { ObjectBlock } from './ObjectBlock'
import type { Pdf } from '../Pdf'
import type { Pages } from './Pages'
import type { Element } from '../elements'
import type { Writer } from '../Writer'

export interface PageProperties {
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
  parent?: Pages
  rotate = 0
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

  _contents = new Contents()
  _resources = new Resources()

  constructor(properties?: PageProperties) {
    super()
    properties && this.setProperties(properties)
  }

  override setPdf(pdf: Pdf): this {
    this._contents.setPdf(pdf)
    this._resources.setPdf(pdf)
    return super.setPdf(pdf)
  }

  appendChild(element: Element): Element {
    this.children.push(element.setPage(this))
    element.getSources().forEach(src => this._resources.preload(src))
    return element
  }

  waitUntilLoad() {
    return this._resources.waitUntilLoad()
  }

  override writeTo(writer: Writer): void {
    this.children.forEach(child => {
      child.writeTo(this._contents.writer, this._resources)
    })
    this._resources.writeTo(writer)
    this._contents.writeTo(writer)
    writer.writeObj(this, () => {
      writer.write({
        '/Type': '/Page',
        '/Parent': this.parent,
        '/Resources': this._resources,
        '/Contents': this._contents,
        '/Rotate': this.rotate,
        '/MediaBox': [this.left, this.top, this.width, this.height],
        '/CropBox': this.cropBox,
        '/BleedBox': this.bleedBox,
        '/TrimBox': this.trimBox,
        '/ArtBox': this.artBox,
        '/UserUnit': this.userUnit && this.userUnit !== 1.0 ? this.userUnit : undefined,
      })
    })
  }
}
