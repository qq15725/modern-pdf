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
  data?: string
  bitsPerComponent?: number
  decodeParms?: Record<string, any>
  sMask?: boolean
  transparency?: Array<number>
  colorSpace?: ColorSpace
}

export class XObjectImage extends XObject {
  // TODO
  static imageFileTypeHeaders = {
    png: [[0x89, 0x50, 0x4E, 0x47]],
    tiff: [
      [0x4D, 0x4D, 0x00, 0x2A], // Motorola
      [0x49, 0x49, 0x2A, 0x00], // Intel
    ],
    jpeg: [
      [0xFF, 0xD8, 0xFF, 0xE0, undefined, undefined, 0x4A, 0x46, 0x49, 0x46, 0x00], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1, undefined, undefined, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // Exif
      [0xFF, 0xD8, 0xFF, 0xDB], // JPEG RAW
      [0xFF, 0xD8, 0xFF, 0xEE], // EXIF RAW
    ],
    jpeg2000: [[0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20]],
    gif87a: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61]],
    gif89a: [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    webp: [[0x52, 0x49, 0x46, 0x46, undefined, undefined, undefined, undefined, 0x57, 0x45, 0x42, 0x50]],
    bmp: [
      [0x42, 0x4D], // BM - Windows 3.1x, 95, NT, ... etc.
      [0x42, 0x41], // BA - OS/2 struct bitmap array
      [0x43, 0x49], // CI - OS/2 struct color icon
      [0x43, 0x50], // CP - OS/2 const color pointer
      [0x49, 0x43], // IC - OS/2 struct icon
      [0x50, 0x54], // PT - OS/2 pointer
    ],
  }

  width = 0
  height = 0
  data = ''
  bitsPerComponent = 8
  decodeParms?: Record<string, any>
  sMask?: boolean
  transparency?: Array<number>
  colorSpace: ColorSpace = '/DeviceRGB'

  static async load(src: string): Promise<XObjectImage> {
    const bitmap = await fetch(src)
      .then(rep => rep.blob())
      .then(blob => createImageBitmap(blob))
    const canvas = document.createElement('canvas')
    canvas.height = bitmap.height
    canvas.width = bitmap.width
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const jpeg = canvas.toDataURL('image/jpeg')
    return new XObjectImage({
      width: bitmap.width,
      height: bitmap.height,
      data: atob(decodeURIComponent(jpeg).split('base64,').pop()!),
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
    return this.data
  }
}
