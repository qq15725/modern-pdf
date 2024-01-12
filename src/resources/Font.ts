import { Resource } from './Resource'

export interface FontProperties {
  baseFont?: string
  encoding?: string
}

export class Font extends Resource {
  baseFont?: string
  encoding?: string

  constructor(properties?: FontProperties) {
    super()
    properties && this.setProperties(properties)
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/Font',
      '/Subtype': '/Type1',
      '/BaseFont': `/${ this.baseFont }`,
      '/Encoding': `/${ this.encoding }`,
      '/FirstChar': 32,
      '/LastChar': 255,
    }
  }
}
