import type { Writer } from '../Writer'
import { Block } from './Block'

export class Eof extends Block {
  writeTo(writer: Writer): void {
    super.writeTo(writer)
    writer.write('startxref')
    writer.write(this.pdf._xref.offset)
    writer.write('%%EOF')
  }
}
