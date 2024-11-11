import type { Writer } from '../Writer'
import type { FontOptions } from './Font'
import { minify, parse, Ttf } from 'modern-text'
import { FontDescriptor, ObjectBlock, ToUnicode } from '../blocks'
import { Font } from './Font'
import { FontCIDFontType2 } from './FontCIDFontType2'

export interface FontType0Options extends FontOptions {
  fontData?: ArrayBuffer
  toUnicode?: ObjectBlock
  descendantFonts?: Font[]
  unicodeGlyphIdMap?: Record<number, number>
}

export class FontType0 extends Font {
  fontData?: ArrayBuffer
  toUnicode?: ObjectBlock
  descendantFonts?: Font[]
  unicodeGlyphIdMap: Record<number, number> = {}
  subset = new Set<string>()

  static from(name: string, fontData: ArrayBuffer): FontType0 {
    name = name.replace(/,|\s/g, '')

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

  updateFontData(): void {
    if (!this.fontData)
      return
    const fontCIDFontType2 = this.descendantFonts?.[0] as FontCIDFontType2
    if (!fontCIDFontType2)
      return
    const fontDescriptor = fontCIDFontType2.fontDescriptor
    if (!fontDescriptor)
      return
    let fontData
    try {
      let subset = ''
      this.subset.forEach(val => subset += val)
      fontData = minify(this.fontData, subset)
    }
    catch (err) {
      console.error('Failed to minifyFont', err)
      fontData = this.fontData
    }
    const sfnt = parse(new DataView(fontData))!.sfnt
    const version = sfnt.os2.version
    const sFamilyClass = sfnt.os2.sFamilyClass
    const unitsPerEm = sfnt.head.unitsPerEm
    const italicAngle = sfnt.post.italicAngle
    const scaleFactor = 1000.0 / unitsPerEm
    const unicodeToGlyphIndexMap = Object.fromEntries(sfnt.cmap.unicodeToGlyphIndexMap.entries())
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
    const isSerif = [1, 2, 3, 4, 5, 7].includes(sFamilyClass)
    const isScript = sFamilyClass === 10
    let flags = 0
    if (sfnt.post.isFixedPitch)
      flags |= 1 << 0
    if (isSerif)
      flags |= 1 << 1
    if (isScript)
      flags |= 1 << 3
    if (italicAngle !== 0)
      flags |= 1 << 6
    flags |= 1 << 5

    const fontFile2 = new ObjectBlock({ data: new Uint8Array(Ttf.from(sfnt).buffer), addLength1: true })
    const toUnicode = new ToUnicode({
      cmap: Object.entries(unicodeToGlyphIndexMap)
        .reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {}),
    })
    fontCIDFontType2.w = widths.flatMap((advanceWidth, i) => {
      return [i, [advanceWidth]]
    })
    fontDescriptor.descent = descent
    fontDescriptor.capHeight = capHeight
    fontDescriptor.stemV = 0
    fontDescriptor.fontFile2 = fontFile2
    fontDescriptor.flags = flags
    fontDescriptor.fontBBox = [
      xMin,
      yMin,
      xMax,
      yMax,
    ]
    fontDescriptor.italicAngle = italicAngle
    fontDescriptor.ascent = ascent

    this.toUnicode = toUnicode
    this.unicodeGlyphIdMap = unicodeToGlyphIndexMap
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
