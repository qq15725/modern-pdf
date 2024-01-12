import { Block } from './Block'
import type { Writer } from '../Writer'

export class ObjectBlock extends Block {
  static autoIncrementId = 0

  offset = 0

  readonly id = ++ObjectBlock.autoIncrementId

  get objId() { return `${ this.id } 0` }
  get objRefId() { return `${ this.objId } R` }

  getDictionary(): Record<string, any> {
    return {}
  }

  getStream(): string {
    return ''
  }

  override writeTo(writer: Writer): void {
    const dictionary = this.getDictionary()
    const stream = this.getStream()

    writer.writeObj(this, () => {
      writer.write(dictionary)
      stream && writer.writeStream(() => writer.write(stream))
    })
  }
}
