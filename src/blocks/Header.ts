import type { Writer } from '../Writer'
import { Block } from './Block'

export class Header extends Block {
  override writeTo(writer: Writer): void {
    super.writeTo(writer)
    writer.write('%PDF-1.4')
    writer.write('%âãÏÓ')
  }
}
