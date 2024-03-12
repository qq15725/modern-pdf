import { FontDescriptor, ObjectBlock, ToUnicode } from '../blocks'
import { Ttf } from '../Ttf'
import { Font } from './Font'
import { FontCIDFontType2 } from './FontCIDFontType2'
import type { Writer } from '../Writer'
import type { FontOptions } from './Font'

export interface FontType0Options extends FontOptions {
  fontData?: ArrayBuffer
  toUnicode?: ObjectBlock
  descendantFonts?: Array<Font>
  unicodeGlyphIdMap?: Record<number, number>
}

export class FontType0 extends Font {
  fontData?: ArrayBuffer
  toUnicode?: ObjectBlock
  descendantFonts?: Array<Font>
  unicodeGlyphIdMap: Record<number, number> = {}
  subset = new Set<string>()

  static from(name: string, fontData: ArrayBuffer): FontType0 {
    name = name.replace(/,|\s/ig, '')

    return new FontType0({
      fontData,
      baseFont: name,
      encoding: '/Identity-H',
      descendantFonts: [
        new FontCIDFontType2({
          baseFont: name,
          fontDescriptor: new FontDescriptor({
            stemV: 0,
            fontName: name,
          }),
          cIDSystemInfoOrdering: '/Identity-H',
        }),
      ],
    })
  }

  constructor(options?: FontType0Options) {
    super()
    options && this.setProperties(options)
  }

  updateFontData() {
    if (!this.fontData) return
    const fontCIDFontType2 = this.descendantFonts?.[0] as FontCIDFontType2
    if (!fontCIDFontType2) return
    const fontDescriptor = fontCIDFontType2.fontDescriptor
    if (!fontDescriptor) return
    const ttf = new Ttf(new DataView(this.fontData)).parse()
    const fontFile2 = new ObjectBlock({ data: new Uint8Array(ttf.encode()), addLength1: true })
    const toUnicode = new ToUnicode({
      cmap: Object.entries(ttf.unicodeGlyphIdMap)
        .reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {}),
    })
    fontCIDFontType2.w = ttf.hMetrics.flatMap((hMetric, i) => {
      return [i, [hMetric.advanceWidth]]
    })
    fontDescriptor.descent = ttf.descent
    fontDescriptor.capHeight = ttf.sCapHeight
    fontDescriptor.stemV = 0
    fontDescriptor.fontFile2 = fontFile2
    fontDescriptor.flags = ttf.flags
    fontDescriptor.fontBBox = [
      ttf.xMin,
      ttf.yMin,
      ttf.xMax,
      ttf.yMax,
    ]
    fontDescriptor.italicAngle = ttf.italicAngle
    fontDescriptor.ascent = ttf.ascent

    this.toUnicode = toUnicode
    this.unicodeGlyphIdMap = ttf.unicodeGlyphIdMap
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/Type0',
      '/ToUnicode': this.toUnicode,
      '/DescendantFonts': this.descendantFonts,
    }
  }

  override writeTo(writer: Writer): void {
    this.toUnicode?.writeTo(writer)
    this.descendantFonts?.forEach(descendantFont => descendantFont.writeTo(writer))
    super.writeTo(writer)
  }
}
