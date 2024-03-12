import { ObjectBlock } from './ObjectBlock'

export class Catalog extends ObjectBlock {
  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/Catalog',
      '/Pages': this.pdf._pages,
      '/PageLayout': this.pdf.pageLayout,
      '/PageMode': this.pdf.pageMode,
      '/MarkInfo': {
        '/Type': '/MarkInfo',
        '/Marked': 'true',
      },
      // /PageLabels
      // /Names
      // /Dests
      // /ViewerPreferences
      // /Outlines
      // /Metadata
    }
  }
}
