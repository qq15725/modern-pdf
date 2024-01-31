import { Element } from './Element'
import type { XObjectImage } from '../resources'
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

  override getSources(): Array<string> {
    return [this.src]
  }

  override async preload(): Promise<void> {
    await Promise.all(
      this.getSources().map(url => this.pdf.asset.addImage(url)),
    )
  }

  override writeTo(writer: Writer) {
    super.writeTo(writer)

    const resource = this.pdf.asset.get(this.src) as XObjectImage

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
