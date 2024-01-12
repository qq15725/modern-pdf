import { ObjectBlock } from './ObjectBlock'

export class Catalog extends ObjectBlock {
  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/Catalog',
      '/Pages': this.pdf._pages,
      '/PageLayout': this.pdf.pageLayout,
      '/PageMode': this.pdf.pageMode,
      // /PageLabels
      // /Names
      // /Dests
      // /ViewerPreferences
      // /Outlines
      // /Metadata
    }
  }
}
