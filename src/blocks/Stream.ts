import { ObjectBlock } from './ObjectBlock'

export interface StreamOptions {
  data?: string | ArrayBuffer
  addLength1?: boolean
}

export class Stream extends ObjectBlock {
  protected _data = ''

  get data(): string {
    return this._data
  }

  set data(data: string | ArrayBuffer) {
    if (typeof data != 'string') {
      const array = new Uint8Array(data)
      this._data = ''
      for (let i = 0; i < array.length; i++) {
        this._data += String.fromCharCode(array[i])
      }
    } else {
      this._data = data
    }
  }

  addLength1?: boolean

  constructor(options?: StreamOptions) {
    super()
    options && this.setProperties(options)
  }

  getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Length': this.data.length,
      '/addLength1': this.addLength1 ? this.data.length : undefined,
    }
  }

  getStream(): string {
    return this.data
  }
}
