import { ObjectBlock } from '../blocks/ObjectBlock'

export class Resource extends ObjectBlock {
  get resourceId() { return `R${ this.id }` }
}
