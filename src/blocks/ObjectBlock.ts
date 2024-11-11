import type { Writer } from '../Writer'
import { zlibSync } from 'fflate'
import { Block } from './Block'

export type Filter =
  | '/FlateDecode'
  | '/DCTDecode'
  | '/JPXDecode'
  | '/CCITTFaxDecode'
  | '/RunLengthDecode'
  | '/LZWDecode'

export interface ObjectBlockOptions {
  data?: Uint8Array
  filter?: Filter[]
  addLength1?: boolean
}

export class ObjectBlock extends Block {
  static autoIncrementId = 0

  readonly id = ++ObjectBlock.autoIncrementId

  get objId(): string { return `${this.id} 0` }
  get objRefId(): string { return `${this.objId} R` }

  offset = 0

  data?: string | Uint8Array
  filter?: Filter[]
  addLength1?: boolean
  protected _stream?: string

  constructor(options?: ObjectBlockOptions) {
    super()
    options && this.setProperties(options)
  }

  protected _updateData(): void {
    if (!this.data)
      return

    let data: Uint8Array
    if (typeof this.data === 'string') {
      data = new TextEncoder().encode(this.data)
    }
    else {
      data = this.data
    }

    this.filter?.forEach((filter) => {
      switch (filter) {
        case '/FlateDecode':
          data = zlibSync(data)
          break
      }
    })
    this._stream = ''
    for (let i = 0, len = data.length; i < len; i += 4096) {
      this._stream += String.fromCharCode(...data.subarray(i, i + 4096))
    }
  }

  update(): void {
    this._updateData()
  }

  getDictionary(): Record<string, any> {
    return {
      '/Length': this._stream ? this._stream.length : undefined,
      '/addLength1': this._stream && this.addLength1 ? this._stream.length : undefined,
      '/Filter': this._stream ? this.filter : undefined,
    }
  }

  getStream(): string | undefined {
    return this._stream
  }

  override writeTo(writer: Writer): void {
    this.update()
    writer.writeObj(this, () => {
      writer.write(this.getDictionary())
      this.getStream() && writer.writeStream(() => writer.write(this.getStream()))
    })
  }
}
