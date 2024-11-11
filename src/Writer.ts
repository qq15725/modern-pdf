import { ObjectBlock } from './blocks/ObjectBlock'

export class Writer {
  static EOL = '\n'

  protected _objects: ObjectBlock[] = []
  get objects(): ObjectBlock[] { return this._objects }

  protected _data = ''
  get data(): string { return this._data }

  get length(): number { return this._data.length }

  protected _normalizeName(value: string): string {
    return value[0] === '/' ? value : `/${value.replace(/^\S/, s => s.toUpperCase())}`
  }

  protected _normalizeString(value: string): string {
    return value[0] === '(' || value[0] === '/' || value[0] === '<' ? value : `(${value})`
  }

  protected _normalizeNumber(value: number): string {
    if (Math.abs(value) === ~~value) {
      return value.toString()
    }
    return value.toFixed(4)
  }

  protected _normalizeBoolean(value: boolean): string {
    return value ? 'true' : 'false'
  }

  protected _normalizeDate(value: Date): string {
    const offset = value.getTimezoneOffset()
    return `(${[
      'D:',
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
      String(value.getHours()).padStart(2, '0'),
      String(value.getMinutes()).padStart(2, '0'),
      String(value.getSeconds()).padStart(2, '0'),
      [
        offset < 0 ? '+' : '-',
        String(Math.floor(Math.abs(offset / 60))).padStart(2, '0'),
        '\'',
        String(Math.abs(offset % 60)).padStart(2, '0'),
        '\'',
      ].join(''),
    ].join('')})`
  }

  protected _normalizeDictionary(dictionary: Record<string, any>): string {
    const items: string[] = []
    Object.keys(dictionary).forEach((rawKey) => {
      if (dictionary[rawKey] !== undefined) {
        const key = this._normalizeName(rawKey)
        const value = this._normalize(dictionary[rawKey])
        items.push(`${key} ${value}`)
      }
    })
    return `<<${items.join(Writer.EOL)}>>`
  }

  protected _normalizeArray(value: any[]): string {
    return `[${value.map(val => this._normalize(val)).join(' ')}]`
  }

  protected _normalize(value: any): string {
    switch (typeof value) {
      case 'string':
        return this._normalizeString(value)
      case 'number':
        return this._normalizeNumber(value)
      case 'boolean':
        return this._normalizeBoolean(value)
      case 'object':
        if (Array.isArray(value)) {
          return this._normalizeArray(value)
        }
        else if (value instanceof ObjectBlock) {
          return value.objRefId
        }
        else if (value instanceof Date) {
          return this._normalizeDate(value)
        }
        else if (value) {
          return this._normalizeDictionary(value)
        }
        break
    }
    return 'null'
  }

  write(value: any): void {
    if (typeof value !== 'string') {
      value = this._normalize(value)
    }
    this._data += `${value}${Writer.EOL}`
  }

  writeStream(cb?: () => void): void {
    this.write('stream')
    cb?.()
    this.write('endstream')
  }

  writeObj(object: ObjectBlock, cb?: () => void): void {
    this._objects.push(object)
    object.offset = this.length
    this.write(`${object.objId} obj`)
    cb?.()
    this.write('endobj')
  }
}
