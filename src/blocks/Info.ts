import { ObjectBlock } from './ObjectBlock'

export class Info extends ObjectBlock {
  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Title': this.pdf.title,
      '/Subject': this.pdf.subject,
      '/Keywords': this.pdf.keywords,
      '/Author': this.pdf.author,
      '/CreationDate': this.pdf.creationDate,
      '/ModDate': this.pdf.modDate,
      '/Creator': this.pdf.creator,
      '/Producer': this.pdf.producer,
    }
  }
}
