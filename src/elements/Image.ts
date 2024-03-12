import { Element } from './Element'
import type { Resource, XObjectImage } from '../resources'
import type { Writer } from '../Writer'

export interface ImaegStyle {
  left: number
  top: number
  width: number
  height: number
  rotate: number
}

export interface ImageOptions {
  src?: string
  style?: Partial<ImaegStyle>
}

export class Image extends Element {
  src = ''
  style: ImaegStyle
  protected _xObjectImage?: XObjectImage

  constructor(options: ImageOptions = {}) {
    super()
    const { src = '', style } = options
    this.style = {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      rotate: 0,
      ...style,
    }
    this.src = src
  }

  override load(): Array<Promise<Resource>> {
    return [
      this.pdf.asset.addImage(this.src).then(v => this._xObjectImage = v),
    ]
  }

  override writeTo(writer: Writer) {
    super.writeTo(writer)

    const resource = this._xObjectImage

    if (!resource) return

    const {
      left = 0,
      top = 0,
      width = resource.width,
      height = resource.height,
      rotate = 0,
    } = this.style

    writer.write('q') // save graphics state
    this._writeTransform(writer, {
      left,
      top,
      width,
      height,
      rotate,
      scaleX: width,
      scaleY: height,
    })
    writer.write(`/${ resource.resourceId } Do`) // paint Image
    writer.write('Q') // restore graphics state
  }
}
