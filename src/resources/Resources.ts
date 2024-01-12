import { ObjectBlock } from '../blocks/ObjectBlock'
import { XObjectImage } from './XObjectImage'
import { Font } from './Font'
import type { Resource } from './Resource'
import type { Writer } from '../Writer'

export class Resources extends ObjectBlock {
  protected _loadingResources = new Map<string, Promise<Resource>>()
  protected _loadedResources = new Map<string, Resource>(Object.entries({
    Helvetica: new Font({
      baseFont: 'Helvetica',
      encoding: 'WinAnsiEncoding',
    }),
  }))

  constructor() {
    super()
  }

  preload(src: string): Promise<Resource> {
    let promise = this._loadingResources.get(src)
    if (!promise) {
      this._loadingResources.set(src, promise = XObjectImage.load(src))
      promise.then(res => {
        this._loadedResources.set(src, res)
        return res
      })
    }
    return promise
  }

  get(src: string): Resource | undefined {
    return this._loadedResources.get(src)
  }

  waitUntilLoad(): Promise<Array<Resource>> {
    return Promise.all(Array.from(this._loadingResources.values()))
  }

  protected arrayToDictionary(objects: Array<Resource>) {
    return objects.reduce(
      (dictionary, object) => ({ ...dictionary, [object.resourceId]: object }),
      {},
    )
  }

  override writeTo(writer: Writer): void {
    const fonts: Array<Resource> = []
    const shadingPatterns: Array<Resource> = []
    const tilingPatterns: Array<Resource> = []
    const extGStates: Array<Resource> = []
    const xObjects: Array<Resource> = []
    this._loadedResources.forEach(resource => {
      resource.setPdf(this.pdf)
      if (resource instanceof XObjectImage) {
        xObjects.push(resource)
        resource.writeTo(writer)
      } else if (resource instanceof Font) {
        fonts.push(resource)
        resource.writeTo(writer)
      }
    })

    writer.writeObj(this, () => {
      writer.write({
        '/ProcSet': ['/PDF', '/Text', '/ImageB', '/ImageC', '/ImageI'],
        '/Font': this.arrayToDictionary(fonts),
        '/Shading': shadingPatterns.length ? this.arrayToDictionary(shadingPatterns) : undefined,
        '/Pattern': tilingPatterns.length ? this.arrayToDictionary(tilingPatterns) : undefined,
        '/ExtGState': extGStates.length ? this.arrayToDictionary(extGStates) : undefined,
        '/XObject': this.arrayToDictionary(xObjects),
      })
    })
  }
}
