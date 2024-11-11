import type { Asset } from '../Asset'
import type { FontOptions } from './Font'
import { Font } from './Font'

export interface FontType1Options extends FontOptions {
  //
}

export class FontType1 extends Font {
  static defaultFont?: FontType1
  static codePoints = { 338: 140, 339: 156, 352: 138, 353: 154, 376: 159, 381: 142, 382: 158, 402: 131, 710: 136, 732: 152, 8211: 150, 8212: 151, 8216: 145, 8217: 146, 8218: 130, 8220: 147, 8221: 148, 8222: 132, 8224: 134, 8225: 135, 8226: 149, 8230: 133, 8240: 137, 8249: 139, 8250: 155, 8364: 128, 8482: 153 }
  static standardFonts = [
    ['helvetica', 'normal', '/WinAnsiEncoding'],
    ['helvetica', 'bold', '/WinAnsiEncoding'],
    ['helvetica', 'italic', '/WinAnsiEncoding'],
    ['helvetica', 'bolditalic', '/WinAnsiEncoding'],
    ['courier', 'normal', '/WinAnsiEncoding'],
    ['courier', 'bold', '/WinAnsiEncoding'],
    ['courier', 'italic', '/WinAnsiEncoding'],
    ['courier', 'bolditalic', '/WinAnsiEncoding'],
    ['times', 'normal', '/WinAnsiEncoding'],
    ['times', 'bold', '/WinAnsiEncoding'],
    ['times', 'italic', '/WinAnsiEncoding'],
    ['times', 'bolditalic', '/WinAnsiEncoding'],
    ['zapfdingbats', 'normal'],
    ['symbol', 'normal'],
  ]

  static loadStandardFonts(asset: Asset): void {
    this.standardFonts.forEach(([family, style, encoding]) => {
      const resource = new FontType1({
        baseFont: family,
        encoding,
      })
      if (!this.defaultFont) {
        this.defaultFont = resource
      }
      asset.addFont({
        family,
        style,
        resource,
      })
    })
  }

  constructor(options?: FontType1Options) {
    super()
    options && this.setProperties({
      firstChar: 32,
      lastChar: 255,
      ...options,
    })
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/Type1',
    }
  }
}
