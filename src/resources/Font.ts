import { Resource } from './Resource'

export type Encoding =
  | '/WinAnsiEncoding'
  | '/Identity-H'
  | string

export interface FontOptions {
  baseFont?: string
  encoding?: Encoding
  firstChar?: number
  lastChar?: number
}

export abstract class Font extends Resource {
  baseFont?: string
  encoding?: Encoding
  firstChar?: number
  lastChar?: number

  constructor(options?: FontOptions) {
    super()
    options && this.setProperties(options)
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/Font',
      '/BaseFont': `/${this.baseFont}`,
      '/Encoding': this.encoding,
      '/FirstChar': this.firstChar,
      '/LastChar': this.lastChar,
    }
  }
}
