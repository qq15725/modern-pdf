import { Writer } from '../Writer'
import { ObjectBlock } from './ObjectBlock'

export class Contents extends ObjectBlock {
  readonly writer = new Writer()

  constructor() {
    super()
    this.writer.write('1 w')
    this.writer.write('0 G')
  }

  override update(): void {
    this.data = this.writer.data
    this.filter = ['/FlateDecode']
    super.update()
  }
}
