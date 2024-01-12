import { Block } from './Block'
import type { Writer } from '../Writer'

export class Eof extends Block {
  writeTo(writer: Writer): void {
    super.writeTo(writer)
    writer.write('startxref')
    writer.write(this.pdf._xref.offset)
    writer.write('%%EOF')
  }
}
