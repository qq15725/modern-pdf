import type { Pdf } from './Pdf'
import type { Font, Resource } from './resources'
import { FontType0, XObjectImage } from './resources'

export interface FontFace {
  key: string
  family: string
  source?: string | ArrayBuffer
  resource?: Font
  style?: string
  weight?: string
  encoding?: string
}

export interface AssetResource {
  loading: boolean
  promise: Promise<Resource>
  value?: Resource
}

export class Asset {
  fonts = new Set<FontFace>()
  resources = new Map<string, AssetResource>()

  constructor(
    protected pdf: Pdf,
  ) {
    //
  }

  protected async _load<T extends Resource >(url: string, cb: () => T | Promise<T>): Promise<T> {
    let assetResource = this.resources.get(url)
    if (!assetResource) {
      assetResource = {
        loading: true,
        promise: Promise.resolve(cb())
          .then((resource) => {
            resource.setPdf(this.pdf)
            assetResource!.value = resource
            return resource
          })
          .finally(() => {
            assetResource!.loading = false
          }),
        value: undefined,
      }
      this.resources.set(url, assetResource)
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
              return this.fetchImageBitmap(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`, options)
            })
          }
          return createImageBitmap(blob, options)
        })
    }
    else {
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
        const resource = XObjectImage.from(bitmap, this.pdf.colorSpace)
        bitmap.close()
        return resource
      })
    })
  }

  addFont(options: Omit<FontFace, 'key'>): Promise<Font> {
    const key = typeof options.source === 'string'
      ? options.source
      : options.family
    const font = {
      ...options,
      key,
    }
    const from = (buffer: ArrayBuffer): FontType0 => {
      const fontFace = new FontFace(font.family, buffer)
      if (!document.fonts.has(fontFace)) {
        document.fonts.add(fontFace)
      }
      return FontType0.from(font.family, buffer)
    }
    return this._load(key, () => {
      this.fonts.add(font)
      if (font.resource) {
        return font.resource
      }
      else if (typeof font.source === 'string') {
        return fetch(font.source)
          .then(rep => rep.arrayBuffer())
          .then(buffer => from(buffer))
      }
      else {
        return from(font.source!)
      }
    })
  }

  async loadFont(family: string): Promise<Resource> {
    const font = this.getFont(family)
    if (!font) {
      throw new Error(`Failed to loadFont: ${family}`)
    }
    const promise = this.resources.get(font.key)?.promise
    if (!promise) {
      throw new Error(`Failed to loadFont: ${family}`)
    }
    return await promise
  }

  getFont(family: string): FontFace | undefined {
    return Array.from(this.fonts.values()).find(font => font.family === family)
  }

  get(url: string): Resource | undefined {
    return this.resources.get(url)?.value
  }

  async waitUntilLoad(): Promise<Resource[]> {
    const assetResources = Array.from(this.resources.values())
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
