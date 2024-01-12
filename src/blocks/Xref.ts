import { Block } from './Block'
import type { Writer } from '../Writer'

export class Xref extends Block {
  override writeTo(writer: Writer) {
    super.writeTo(writer)
    const objects = writer.objects
    writer.write('xref')
    writer.write(`0 ${ objects.length + 2 }`)
    writer.write('0000000000 65535 f')
    for (let i = 0, len = objects.length; i < len; i++) {
      writer.write(`${ String(objects[i].offset).padStart(10, '0') } 00000 n `)
    }
  }
}
