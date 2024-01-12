import { XObject } from './XObject'

export class XObjectForm extends XObject {
  x = 0
  y = 0
  width = 0
  height = 0
  matrix: Array<number> = []

  getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/Form',
      '/BBox': [
        this.x,
        this.y,
        this.x + this.width,
        this.y + this.height,
      ],
      '/Matrix': this.matrix,
    }
  }
}
