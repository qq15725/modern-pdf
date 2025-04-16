import type { Fonts as BaseFonts } from 'modern-font'
import type { PDF } from './PDF'
import type { Font, Resource } from './resources'
import { fonts as globalBaseFonts } from 'modern-font'
import { FontType0, FontType1, XObjectImage } from './resources'

export interface AssetResource {
  loading: boolean
  promise: Promise<Resource>
  value?: Resource
}

export class Asset {
  loaded = new Map<string, AssetResource>()

  protected get _fonts(): BaseFonts {
    return this._pdf.fonts ?? globalBaseFonts
  }

  get fallbackFont(): Font | undefined {
    return FontType1.fallbackFont
  }

  constructor(
    protected _pdf: PDF,
  ) {
    //
  }

  protected async _load<T extends Resource>(url: string, handle: () => T | Promise<T>): Promise<T> {
    let assetResource = this.loaded.get(url)
    if (!assetResource) {
      assetResource = {
        loading: true,
        promise: Promise.resolve(handle())
          .then((resource) => {
            resource.setPdf(this._pdf)
            assetResource!.value = resource
            return resource
          })
          .finally(() => {
            assetResource!.loading = false
          }),
        value: undefined,
      }
      this.loaded.set(url, assetResource)
    }
    return assetResource.promise as any
  }

  async fetchImageBitmap(url: string, options?: ImageBitmapOptions): Promise<ImageBitmap> {
    if (url.startsWith('http')) {
      return await fetch(url)
        .then(rep => rep.blob())
        .then((blob) => {
          if (blob.type === 'image/svg+xml') {
            return blob.text().then((text) => {
              return this.fetchImageBitmap(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`, options)
            })
          }
          return createImageBitmap(blob, options)
        })
    }
    else {
      function fixSvg(text: string): string {
        const svgHead = text.match(/^<svg[^>]+>/)?.[0]
        if (svgHead && (!/width=".*"/.test(svgHead) || !/height=".*"/.test(svgHead))) {
          text = text.replace(
            svgHead,
            svgHead
              .replace(/((width)|(height))=".*?"/g, '')
              // eslint-disable-next-line regexp/no-super-linear-backtracking
              .replace(/(viewBox=".+? .+? (.+?) (.+?)")/, '$1 width="$2" height="$3"'),
          )
        }
        return text
      }
      if (url.startsWith('data:image/svg+xml;charset=utf-8,')) {
        url = url.substring('data:image/svg+xml;charset=utf-8,'.length)
        url = decodeURIComponent(url)
        url = fixSvg(url)
        url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(url)}`
      }
      else if (url.startsWith('data:image/svg+xml;base64,')) {
        url = url.substring('data:image/svg+xml;base64,'.length)
        url = atob(url)
        url = fixSvg(url)
        url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(url)}`
      }
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image()
        img.src = url
        img.onload = () => img.decode().finally(() => resolve(img))
      }).then(img => createImageBitmap(img, options))
    }
  }

  addImage(url: string): Promise<XObjectImage> {
    return this._load(url, () => {
      return this.fetchImageBitmap(url).then((bitmap) => {
        const resource = XObjectImage.from(bitmap, this._pdf.colorSpace)
        bitmap.close()
        return resource
      })
    })
  }

  addFont(family: string, resource?: Font): Promise<Font> {
    return this._load(family, () => {
      if (resource) {
        return resource
      }
      else {
        const result = this._fonts.get(family)
        if (!result) {
          throw new Error(`Failed to loadFont: ${family}`)
        }
        return FontType0.from(family, result.buffer)
      }
    })
  }

  async getFont(family: string): Promise<Font> {
    let promise = this.loaded.get(family)?.promise as any
    if (!promise) {
      await this.addFont(family)
      promise = this.loaded.get(family)?.promise as any
    }
    if (!promise) {
      throw new Error(`Failed to loadFont: ${family}`)
    }
    return promise
  }

  get(url: string): Resource | undefined {
    return this.loaded.get(url)?.value
  }

  async waitUntilLoad(): Promise<Resource[]> {
    const assetResources = Array.from(this.loaded.values())
    await Promise.all(
      assetResources
        .filter(assetResource => assetResource.loading)
        .map(assetResource => assetResource.promise),
    )
    return assetResources
      .filter(assetResource => assetResource.value)
      .map(assetResource => assetResource.value!)
  }
}
