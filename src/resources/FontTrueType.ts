import type { Writer } from '../Writer'
import type { FontOptions } from './Font'
import { parse, Ttf } from 'modern-text'
import { FontDescriptor, ObjectBlock, ToUnicode } from '../blocks'
import { Font } from './Font'

export interface FontTrueTypeOptions extends FontOptions {
  toUnicode?: ObjectBlock
  fontDescriptor?: FontDescriptor
  widths?: number[]
}

export class FontTrueType extends Font {
  toUnicode?: ObjectBlock
  fontDescriptor?: FontDescriptor
  widths?: number[]

  static from(name: string, fontData: ArrayBuffer): FontTrueType {
    const sfnt = parse(new DataView(fontData))!.sfnt
    const version = sfnt.os2.version
    const unitsPerEm = sfnt.head.unitsPerEm
    const italicAngle = sfnt.post.italicAngle
    const scaleFactor = 1000.0 / unitsPerEm
    const descent = Math.round(sfnt.hhea.descent * scaleFactor)
    const ascent = Math.round(sfnt.hhea.ascent * scaleFactor)
    const xMin = Math.round(sfnt.head.xMin * scaleFactor)
    const yMin = Math.round(sfnt.head.yMin * scaleFactor)
    const xMax = Math.round(sfnt.head.xMax * scaleFactor)
    const yMax = Math.round(sfnt.head.yMax * scaleFactor)
    const widths = sfnt.hmtx.metrics.map(hMetric => Math.round(hMetric.advanceWidth * scaleFactor))
    const capHeight = version > 1
      ? sfnt.os2.sCapHeight
      : ascent

    const fontFile2 = new ObjectBlock({ data: new Uint8Array(Ttf.from(sfnt).buffer), addLength1: true })
    const toUnicode = new ToUnicode()
    const fontDescriptor = new FontDescriptor({
      descent,
      capHeight,
      stemV: 0,
      fontFile2,
      flags: 96,
      fontBBox: [
        xMin,
        yMin,
        xMax,
        yMax,
      ],
      fontName: name,
      italicAngle,
      ascent,
    })
    return new FontTrueType({
      baseFont: name,
      encoding: '/WinAnsiEncoding',
      toUnicode,
      fontDescriptor,
      widths,
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
