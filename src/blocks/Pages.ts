import { ObjectBlock } from './ObjectBlock'

export class Pages extends ObjectBlock {
  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/Pages',
      '/Count': this.pdf.pages.length,
      '/Kids': this.pdf.pages,
    }
  }
}
