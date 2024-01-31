import { FontType0, XObjectImage } from './resources'
import type { Pdf } from './Pdf'
import type { Resource } from './resources'

export interface FontFace {
  family: string
  source: string
  style?: string
  weight?: string
  encoding?: string
}

export class Asset {
  fonts = new Set<FontFace>()

  protected _loading = new Map<string, Promise<Resource>>()
  loaded = new Map<string, Resource>()

  constructor(
    protected pdf: Pdf,
  ) {
    //
  }

  protected async _load(url: string, load: (response: Response) => Promise<any>): Promise<any> {
    if (this._loading.has(url)) return this._loading.get(url)!
    if (this.loaded.has(url)) return this.loaded.get(url)!
    const promise = fetch(url)
      .then(load)
      .then(resource => {
        resource.setPdf(this.pdf)
        this._loading.delete(url)
        this.loaded.set(url, resource)
        return resource
      })
      .catch(error => console.error(`Failed to Asset.load ${ url }`, error))
    this._loading.set(url, promise)
    return promise
  }

  addImage(url: string): Promise<XObjectImage> {
    if (url.startsWith('data:')) {
      if (this._loading.has(url)) return this._loading.get(url) as any
      if (this.loaded.has(url)) return this.loaded.get(url) as any
      const promise = new Promise(resolve => {
        const img = new Image()
        img.src = url
        img.onload = () => img.decode().finally(() => resolve(img))
      })
        .then(img => createImageBitmap(img as any))
        .then(
          bitmap => XObjectImage.load(bitmap, this.pdf.colorSpace)
            .finally(() => bitmap.close()),
        )
        .then(resource => {
          resource.setPdf(this.pdf)
          this._loading.delete(url)
          this.loaded.set(url, resource)
          return resource
        })
        .catch(error => console.error(`Failed to Asset.load ${ url }`, error))
      this._loading.set(url, promise as any)
      return promise as any
    } else {
      return this._load(url, response => {
        return response.blob()
          .then(blob => createImageBitmap(blob))
          .then(
            bitmap => XObjectImage.load(bitmap, this.pdf.colorSpace)
              .finally(() => bitmap.close()),
          )
      })
    }
  }

  addFont(font: FontFace) {
    this.fonts.add(font)
    return this._load(font.source, response => {
      return response.arrayBuffer().then(buffer => {
        const fontFace = new FontFace(font.family, buffer)
        if (!document.fonts.has(fontFace)) {
          document.fonts.add(fontFace)
        }
        return FontType0.load(font.family, buffer)
      })
    })
  }

  getFont(family: string): FontFace | undefined {
    let result
    this.fonts.forEach(font => {
      if (font.family === family) {
        result = font
      }
    })
    return result
  }

  get(url: string): Resource | undefined {
    return this.loaded.get(url)
  }

  async waitUntilLoad(): Promise<Array<Resource>> {
    await Promise.all(Array.from(this._loading.values()))
    return Array.from(this.loaded.values())
  }
}
