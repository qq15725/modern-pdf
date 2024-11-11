import type { Writer } from '../Writer'
import { Block } from './Block'

export class Trailer extends Block {
  override writeTo(writer: Writer): void {
    super.writeTo(writer)
    writer.write('trailer')
    writer.write({
      '/Size': writer.objects.length + 2,
      '/Root': this.pdf._catalog,
      '/Info': this.pdf._info,
      '/ID': this.pdf.id ? [`<${this.pdf.id}>`, `<${this.pdf.id}>`] : undefined,
    })
  }
}
