import { ObjectBlock } from '../blocks/ObjectBlock'

export class Resource extends ObjectBlock {
  get resourceId(): string { return `R${this.id}` }
}
