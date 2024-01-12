import { XObject } from './XObject'

export type ColorSpace =
  | '/DeviceRGB'
  | '/DeviceGray'
  | '/DeviceCMYK'
  | '/CalGray'
  | '/CalRGB'
  | '/Lab'
  | '/ICCBased'
  | '/Indexed'
  | '/Pattern'
  | '/Separation'
  | '/DeviceN'

export interface XObjectImageProperties {
  width?: number
  height?: number
  data?: BufferSource
  bitsPerComponent?: number
  decodeParms?: Record<string, any>
  sMask?: boolean
  transparency?: Array<number>
  colorSpace?: ColorSpace
}

export class XObjectImage extends XObject {
  width = 0
  height = 0
  data?: BufferSource
  bitsPerComponent = 8
  decodeParms?: Record<string, any>
  sMask?: boolean
  transparency?: Array<number>
  colorSpace: ColorSpace = '/DeviceRGB'

  static async load(src: string): Promise<XObjectImage> {
    const { width, height } = await new Promise<{ width: number; height: number }>(resolve => {
      const dom = new Image()
      const cb = () => resolve({ width: dom.naturalWidth, height: dom.naturalHeight })
      dom.onload = cb
      dom.onerror = cb
      dom.src = src
    })
    return new XObjectImage({
      width,
      height,
      data: await fetch(src).then(rep => rep.arrayBuffer()),
    })
  }

  constructor(properties?: XObjectImageProperties) {
    super()
    properties && this.setProperties(properties)
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/Image',
      '/Width': this.width,
      '/Height': this.height,
      '/BitsPerComponent': this.bitsPerComponent,
      '/DecodeParms': this.decodeParms,
      '/Mask': this.transparency?.map(val => `${ val } ${ val }`),
      '/SMask': this.sMask ? `${ this.id + 1 } 0 R` : undefined,
      '/ColorSpace': this.colorSpace,
      '/Decode': this.colorSpace === '/DeviceCMYK' ? '[1 0 1 0 1 0 1 0]' : undefined,
      '/Filter': ['/DCTDecode'],
      '/Length': this.getStream().length,
    }
  }

  override getStream(): string {
    let buffer
    if (ArrayBuffer.isView(this.data)) {
      buffer = this.data.buffer
    } else if (this.data instanceof ArrayBuffer) {
      buffer = this.data
    } else {
      return ''
    }
    return new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  }
}
