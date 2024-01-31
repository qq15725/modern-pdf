import type { Page } from '../blocks'
import type { Pdf } from '../Pdf'
import type { Writer } from '../Writer'

export const PI = Math.PI
export const DEG_TO_RAD = PI / 180

export class Element {
  protected _pdf?: Pdf
  get pdf() {
    if (!this._pdf) throw new Error('This element is missing pdf')
    return this._pdf
  }

  protected _page?: Page
  get page() {
    if (!this._page) throw new Error('This element is missing page')
    return this._page
  }

  setPage(page: Page): this {
    this._pdf = page.pdf
    this._page = page
    return this
  }

  getSources(): Array<string> {
    return []
  }

  async preload(): Promise<void> {
    //
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  writeTo(writer: Writer): void {
    //
  }

  protected _writeTransform(
    writer: Writer,
    options: {
      left?: number
      top?: number
      width?: number
      height?: number
      rotate?: number
      skewX?: number
      skewY?: number
      scaleX?: number
      scaleY?: number
      transformOriginX?: number
      transformOriginY?: number
    } = {},
  ): void {
    const {
      left = 0,
      top = 0,
      rotate = 0,
      width = 1,
      height = 1,
      skewX = 0,
      skewY = 0,
      scaleX = 1,
      scaleY = 1,
      transformOriginX = 0.5,
      transformOriginY = 0.5,
    } = options

    const tx = left
    const ty = this.page.height - (top + height)

    if (rotate) {
      const _rotate = rotate * DEG_TO_RAD
      const cx = Math.cos(_rotate + skewY)
      const sx = Math.sin(_rotate + skewY)
      const cy = -Math.sin(_rotate - skewX) // cos, added PI/2
      const sy = Math.cos(_rotate - skewX) // sin, added PI/2
      const a = cx
      const b = cy
      const c = sx
      const d = sy
      const offsetX = transformOriginX * width
      const offsetY = transformOriginY * height
      writer.write(`${ [1, 0, 0, 1, offsetX, offsetY].map(val => val.toFixed(4)).join(' ') } cm`)
      writer.write(`${ [a, b, c, d, tx, ty].map(val => val.toFixed(4)).join(' ') } cm`)
      writer.write(`${ [1, 0, 0, 1, -offsetX, -offsetY].map(val => val.toFixed(4)).join(' ') } cm`)
    } else {
      writer.write(`${ [1, 0, 0, 1, tx, ty].map(val => val.toFixed(4)).join(' ') } cm`)
    }

    if (scaleX !== 1 && scaleY !== 1) {
      writer.write(`${ [scaleX, 0, 0, scaleY, 0, 0].map(val => val.toFixed(4)).join(' ') } cm`)
    }
  }
}
