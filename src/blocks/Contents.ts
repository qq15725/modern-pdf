import { Writer } from '../Writer'
import { ObjectBlock } from './ObjectBlock'

export class Contents extends ObjectBlock {
  readonly writer = new Writer()

  constructor() {
    super()
    this.writer.write('1 w')
    this.writer.write('0 G')
  }

  getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Length': this.writer.length,
      // '/Filter': '/FlateDecode',
    }
  }

  getStream(): string {
    return this.writer.data
  }
}
