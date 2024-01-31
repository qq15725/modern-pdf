import { FontDescriptor, Stream, ToUnicode } from '../blocks'
import { Ttf } from '../Ttf'
import { Font } from './Font'
import { FontCIDFontType2 } from './FontCIDFontType2'
import type { Writer } from '../Writer'
import type { FontOptions } from './Font'

export interface FontType0Options extends FontOptions {
  toUnicode?: Stream
  descendantFonts?: Array<Font>
  unicodeGlyphIdMap?: Record<number, number>
}

export class FontType0 extends Font {
  toUnicode?: Stream
  descendantFonts?: Array<Font>
  unicodeGlyphIdMap: Record<number, number> = {}

  static async load(name: string, data: ArrayBuffer): Promise<FontType0> {
    const ttf = new Ttf(new DataView(data)).parse()
    const fontFile2 = new Stream({ data, addLength1: true })
    const toUnicode = new ToUnicode({
      cmap: Object.entries(ttf.unicodeGlyphIdMap)
        .reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {}),
    })
    const fontDescriptor = new FontDescriptor({
      descent: ttf.descent,
      capHeight: ttf.sCapHeight,
      stemV: 0,
      fontFile2,
      flags: ttf.flags,
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
    const fontCIDFontType2 = new FontCIDFontType2({
      baseFont: name,
      fontDescriptor,
      w: ttf.hMetrics.flatMap((hMetric, i) => {
        return [i, [hMetric.advanceWidth]]
      }),
      cIDSystemInfoOrdering: '/Identity-H',
    })
    return new FontType0({
      baseFont: name,
      encoding: '/Identity-H',
      toUnicode,
      unicodeGlyphIdMap: ttf.unicodeGlyphIdMap,
      descendantFonts: [fontCIDFontType2],
    })
  }

  constructor(options?: FontType0Options) {
    super()
    options && this.setProperties(options)
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
