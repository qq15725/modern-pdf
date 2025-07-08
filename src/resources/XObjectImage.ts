import type { ObjectBlockOptions } from '../blocks'
import type { Writer } from '../Writer'
import { colord } from 'colord'
import { XObject } from './XObject'

export type ColorSpace
  = | '/DeviceRGB'
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

export interface XObjectImageOptions extends ObjectBlockOptions {
  width?: number
  height?: number
  bitsPerComponent?: number
  decodeParms?: Record<string, any>
  sMask?: XObjectImage
  transparency?: number[]
  colorSpace?: ColorSpace
}

export class XObjectImage extends XObject {
  width = 0
  height = 0
  bitsPerComponent = 8
  // decodeParms?: Record<string, any>
  sMask?: XObjectImage
  transparency?: number[]
  colorSpace: ColorSpace = '/DeviceRGB'

  static from(bitmap: ImageBitmap, colorSpace: 'rgb' | 'cmyk'): XObjectImage {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    switch (colorSpace) {
      case 'cmyk': {
        const aData = new Uint8Array(imageData.data.length / 4)
        const data = new Uint8Array(imageData.data.length)
        for (let i = 0, aI = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i]
          const g = imageData.data[i + 1]
          const b = imageData.data[i + 2]
          const a = imageData.data[i + 3] / 255
          const cmyk = colord({ r, g, b, a }).toCmyk()
          data[i] = cmyk.c / 100 * 255
          data[i + 1] = cmyk.m / 100 * 255
          data[i + 2] = cmyk.y / 100 * 255
          data[i + 3] = cmyk.k / 100 * 255
          aData[aI++] = cmyk.a * 255
        }
        return new XObjectImage({
          width: bitmap.width,
          height: bitmap.height,
          // decodeParms: {
          //   '/Colors': 4,
          //   '/BitsPerComponent': 8,
          //   '/Columns': bitmap.width,
          // },
          bitsPerComponent: 8,
          colorSpace: '/DeviceCMYK',
          filter: ['/FlateDecode'],
          sMask: new XObjectImage({
            width: bitmap.width,
            height: bitmap.height,
            // decodeParms: {
            //   '/Predictor': 12,
            //   '/Colors': 1,
            //   '/BitsPerComponent': 8,
            //   '/Columns': bitmap.width,
            // },
            bitsPerComponent: 8,
            colorSpace: '/DeviceGray',
            filter: ['/FlateDecode'],
            data: aData,
          }),
          data,
        })
      }
      case 'rgb': {
        const aData = new Uint8Array(imageData.data.length / 4)
        const rgbData = new Uint8Array(imageData.data.length / 4 * 3)
        for (let i = 0, rgbI = 0, aI = 0; i < imageData.data.length; i += 4) {
          rgbData[rgbI++] = imageData.data[i]
          rgbData[rgbI++] = imageData.data[i + 1]
          rgbData[rgbI++] = imageData.data[i + 2]
          aData[aI++] = imageData.data[i + 3]
        }
        return new XObjectImage({
          width: bitmap.width,
          height: bitmap.height,
          // decodeParms: {
          //   '/Colors': 3,
          //   '/BitsPerComponent': 8,
          //   '/Columns': bitmap.width,
          // },
          bitsPerComponent: 8,
          colorSpace: '/DeviceRGB',
          filter: ['/FlateDecode'],
          sMask: new XObjectImage({
            width: bitmap.width,
            height: bitmap.height,
            // decodeParms: {
            //   '/Predictor': 12,
            //   '/Colors': 1,
            //   '/BitsPerComponent': 8,
            //   '/Columns': bitmap.width,
            // },
            bitsPerComponent: 8,
            colorSpace: '/DeviceGray',
            filter: ['/FlateDecode'],
            data: aData,
          }),
          data: rgbData,
        })
      }
    }
  }

  constructor(options?: XObjectImageOptions) {
    super()
    options && this.setProperties(options)
  }

  override getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Subtype': '/Image',
      '/Width': this.width,
      '/Height': this.height,
      '/BitsPerComponent': this.bitsPerComponent,
      // '/DecodeParms': this.decodeParms,
      '/Mask': this.transparency?.map(val => `${val} ${val}`),
      '/SMask': this.sMask,
      '/ColorSpace': this.colorSpace,
      '/Decode': this.colorSpace === '/DeviceCMYK' ? '[0 1 0 1 0 1 0 1]' : undefined,
    }
  }

  override writeTo(writer: Writer): void {
    this.sMask?.writeTo(writer)
    super.writeTo(writer)
  }
}
