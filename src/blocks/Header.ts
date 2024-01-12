import { Block } from './Block'
import type { Writer } from '../Writer'

export class Header extends Block {
  override writeTo(writer: Writer): void {
    super.writeTo(writer)
    writer.write('%PDF-1.3')
    writer.write('%\xBA\xDF\xAC\xE0')
  }
}
