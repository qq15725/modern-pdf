import { FontDescriptor, ObjectBlock, ToUnicode } from '../blocks'
import { Ttf } from '../Ttf'
import { Font } from './Font'
import type { Writer } from '../Writer'
import type { FontOptions } from './Font'

export interface FontTrueTypeOptions extends FontOptions {
  toUnicode?: ObjectBlock
  fontDescriptor?: FontDescriptor
  widths?: Array<number>
}

export class FontTrueType extends Font {
  toUnicode?: ObjectBlock
  fontDescriptor?: FontDescriptor
  widths?: Array<number>

  static from(name: string, fontData: ArrayBuffer): FontTrueType {
    const ttf = new Ttf(new DataView(fontData)).parse()
    const fontFile2 = new ObjectBlock({ data: new Uint8Array(ttf.encode()), addLength1: true })
    const toUnicode = new ToUnicode()
    const fontDescriptor = new FontDescriptor({
      descent: ttf.descent,
      capHeight: ttf.sCapHeight,
      stemV: 0,
      fontFile2,
      flags: 96,
      fontBBox: [
        ttf.xMin,
        ttf.yMin,
        ttf.xMax,
        ttf.yMax,
      ],
      fontName: name,
      italicAngle: ttf.italicAngle,
      ascent: ttf.ascent,
    })
    return new FontTrueType({
      baseFont: name,
      encoding: '/WinAnsiEncoding',
      toUnicode,
      fontDescriptor,
      widths: ttf.hMetrics.map(hMetric => hMetric.advanceWidth),
    })
  }

  constructor(options?: FontTrueTypeOptions) {
    super()
    options && this.setProperties({
      firstChar: 29,
      lastChar: 255,
      ...options,
    })
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/TrueType',
      '/ToUnicode': this.toUnicode,
      '/FontDescriptor': this.fontDescriptor,
      '/Widths': this.widths,
    }
  }

  override writeTo(writer: Writer): void {
    this.toUnicode?.writeTo(writer)
    this.fontDescriptor?.writeTo(writer)
    super.writeTo(writer)
  }
}
