import { Font } from './Font'
import type { Writer } from '../Writer'
import type { FontDescriptor } from '../blocks'
import type { FontOptions } from './Font'

export interface FontCIDFontType2Options extends FontOptions {
  fontDescriptor?: FontDescriptor
  w?: Array<any>
  cIDSystemInfoOrdering?: string
}

export class FontCIDFontType2 extends Font {
  fontDescriptor?: FontDescriptor
  w?: Array<any>
  cIDSystemInfoOrdering?: string

  constructor(options?: FontCIDFontType2Options) {
    super()
    options && this.setProperties(options)
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/CIDFontType2',
      '/FontDescriptor': this.fontDescriptor,
      '/W': this.w,
      '/CIDToGIDMap': '/Identity',
      '/DW': 1000,
      'CIDSystemInfo': {
        '/Supplement': 0,
        '/Registry': 'Adobe',
        '/Ordering': this.cIDSystemInfoOrdering,
      },
    }
  }

  override writeTo(writer: Writer): void {
    this.fontDescriptor?.writeTo(writer)
    super.writeTo(writer)
  }
}
