import { Element } from './Element'
import type { Resources, XObjectImage } from '../resources'
import type { Writer } from '../Writer'

export interface ImageProperties {
  left?: number
  top?: number
  width?: number
  height?: number
  rotate?: number
  src?: string
}

export class Image extends Element {
  left?: number
  top?: number
  width?: number
  height?: number
  rotate?: number
  src = ''

  protected _resource?: XObjectImage

  constructor(properties?: ImageProperties) {
    super()
    properties && this.setProperties(properties)
  }

  override getSources(): Array<string> {
    return [this.src]
  }

  override writeTo(writer: Writer, resources: Resources) {
    super.writeTo(writer, resources)

    const resource = resources.get(this.src) as XObjectImage

    if (!resource) return

    const {
      left = 0,
      top = 0,
      width = resource.width,
      height = resource.height,
      rotate = 0,
    } = this

    const bottom = this.page.height - (top + height)

    const angle = -rotate * Math.PI / 180
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const sx = c.toFixed(4)
    const shy = s.toFixed(4)
    const shx = -s.toFixed(4)
    const sy = c.toFixed(4)
    const tx = left.toFixed(4)
    const ty = bottom.toFixed(4)

    // Save graphics state
    writer.write('q')
    // Translate
    writer.write([1, 0, 0, 1, tx, ty, 'cm'].join(' '))
    // Rotate
    writer.write([sx, shy, shx, sy, 0, 0, 'cm'].join(' '))
    // Scale
    writer.write([width, 0, 0, height, 0, 0, 'cm'].join(' '))
    // Paint Image
    writer.write(`/${ resource.resourceId } Do`)
    // Restore graphics state
    writer.write('Q')
  }
}
