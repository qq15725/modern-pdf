import type { Writer } from '../Writer'
import type { Resource } from './Resource'
import { ObjectBlock } from '../blocks/ObjectBlock'
import { Font } from './Font'
import { XObjectImage } from './XObjectImage'

export class Resources extends ObjectBlock {
  sources = new Set<Resource>()

  protected arrayToDictionary(objects: Resource[]): Record<string, any> {
    return objects.reduce(
      (dictionary, object) => ({ ...dictionary, [object.resourceId]: object }),
      {},
    )
  }

  override writeTo(writer: Writer): void {
    const fonts: Resource[] = []
    const shadingPatterns: Resource[] = []
    const tilingPatterns: Resource[] = []
    const extGStates: Resource[] = []
    const xObjects: Resource[] = []
    this.sources.forEach((resource) => {
      if (resource instanceof XObjectImage) {
        xObjects.push(resource)
      }
      else if (resource instanceof Font) {
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
