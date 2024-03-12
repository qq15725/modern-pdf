import { ObjectBlock } from '../blocks/ObjectBlock'
import { XObjectImage } from './XObjectImage'
import { Font } from './Font'
import type { Resource } from './Resource'
import type { Writer } from '../Writer'

export class Resources extends ObjectBlock {
  sources = new Set<Resource>()

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
    this.sources.forEach(resource => {
      if (resource instanceof XObjectImage) {
        xObjects.push(resource)
      } else if (resource instanceof Font) {
        fonts.push(resource)
      }
    })

    writer.writeObj(this, () => {
      writer.write({
        '/ProcSet': ['/PDF', '/Text', '/ImageB', '/ImageC', '/ImageI'],
        '/Font': fonts.length ? this.arrayToDictionary(fonts) : undefined,
        '/Shading': shadingPatterns.length ? this.arrayToDictionary(shadingPatterns) : undefined,
        '/Pattern': tilingPatterns.length ? this.arrayToDictionary(tilingPatterns) : undefined,
        '/ExtGState': extGStates.length ? this.arrayToDictionary(extGStates) : undefined,
        '/XObject': xObjects.length ? this.arrayToDictionary(xObjects) : undefined,
      })
    })
  }
}
