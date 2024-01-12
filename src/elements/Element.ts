import type { Page } from '../blocks'
import type { Pdf } from '../Pdf'
import type { Resources } from '../resources'
import type { Writer } from '../Writer'

export class Element {
  protected _pdf?: Pdf
  protected _page?: Page

  get pdf() {
    if (!this._pdf) throw new Error('This element is missing pdf')
    return this._pdf
  }

  get page() {
    if (!this._page) throw new Error('This element is missing _page')
    return this._page
  }

  setPage(page: Page): this {
    this._pdf = page.pdf
    this._page = page
    return this
  }

  setProperties(properties: Record<string, any>): this {
    for (const key in properties) {
      if (key in properties) {
        (this as any)[key] = (properties as any)[key]
      }
    }
    return this
  }

  getSources(): Array<string> {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  writeTo(writer: Writer, resources: Resources): void {
    //
  }
}
