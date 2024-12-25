import type { IElementStyle, IImage } from 'modern-idoc'
import type { Resource, XObjectImage } from '../resources'
import type { Writer } from '../Writer'
import { Element } from './Element'

export interface ImageOptions extends Partial<Omit<IImage, 'type'>> {
  //
}

export class Image extends Element {
  src: string
  style: Partial<IElementStyle>
  protected _xObjectImage?: XObjectImage

  constructor(options: ImageOptions) {
    super()
    const { src = '', style = {} } = options
    this.style = style
    this.src = src
  }

  override load(): Promise<Resource | undefined>[] {
    return [
      this.pdf.asset.addImage(this.src).then(v => this._xObjectImage = v),
    ]
  }

  override writeTo(writer: Writer): void {
    super.writeTo(writer)

    const resource = this._xObjectImage

    if (!resource)
      return

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
    writer.write(`/${resource.resourceId} Do`) // paint Image
    writer.write('Q') // restore graphics state
  }
}
