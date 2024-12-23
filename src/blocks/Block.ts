import type { PDF } from '../PDF'
import type { Writer } from '../Writer'

export class Block {
  offset = 0

  protected _pdf?: PDF
  get pdf(): PDF {
    if (!this._pdf)
      throw new Error('This block is missing pdf')
    return this._pdf
  }

  setPdf(pdf: PDF): this {
    this._pdf = pdf
    return this
  }

  setProperties(properties: Record<string, any>): this {
    for (const key in properties) {
      if (key in properties) {
        (this as any)[key] = (properties as any)[key]
      }
    }
    return this
  }

  writeTo(writer: Writer): void {
    this.offset = writer.length
  }
}
