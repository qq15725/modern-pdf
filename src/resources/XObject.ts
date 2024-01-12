import { Resource } from './Resource'

export class XObject extends Resource {
  getDictionary(): Record<string, any> {
    return {
      ...super.getDictionary(),
      '/Type': '/XObject',
    }
  }
}
