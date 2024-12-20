import type { Writer } from '../Writer'
import { ObjectBlock } from './ObjectBlock'

export interface FontDescriptorOptions {
  descent?: number
  capHeight?: number
  stemV?: number
  fontFile2?: ObjectBlock
  flags?: number
  fontName?: string
  fontBBox?: number[]
  italicAngle?: number
  ascent?: number
}

export class FontDescriptor extends ObjectBlock {
  descent?: number
  capHeight?: number
  stemV?: number
  fontFile2?: ObjectBlock
  flags?: number
  fontName?: string
  fontBBox?: number[]
  italicAngle?: number
  ascent?: number

  constructor(options?: FontDescriptorOptions) {
    super()
    options && this.setProperties(options)
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/FontDescriptor',
      '/Descent': this.descent,
      '/CapHeight': this.capHeight,
      '/StemV': this.stemV,
      '/FontFile2': this.fontFile2,
      '/Flags': this.flags,
      '/FontBBox': this.fontBBox,
      '/FontName': `/${this.fontName}`,
      '/ItalicAngle': this.italicAngle,
      '/Ascent': this.ascent,
    }
  }

  override writeTo(writer: Writer): void {
    this.fontFile2?.writeTo(writer)
    super.writeTo(writer)
  }
}
