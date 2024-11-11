import type { ObjectBlockOptions } from './ObjectBlock'
import { ObjectBlock } from './ObjectBlock'

export interface ToUnicodeOptions extends ObjectBlockOptions {
  cmap?: Record<number, number>
}

export class ToUnicode extends ObjectBlock {
  constructor(options: ToUnicodeOptions = {}) {
    super()
    const cmap = options.cmap ?? {}
    const cmapKeys = Object.keys(cmap)
    this.setProperties({
      data: `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange <0000><ffff> endcodespacerange
${
  cmapKeys.length
    ? `${cmapKeys.length}
beginbfchar
${cmapKeys.map((key) => {
  const key16 = Number(key).toString(16).padStart(4, '0')
  const value16 = Number((cmap as any)[key]).toString(16).padStart(4, '0')
  return `<${key16}> <${value16}>`
}).join('\n')}
endbfchar`
    : ''
}
endcmap CMapName currentdict /CMap defineresource pop end end`,
      addLength1: true,
      ...options,
    })
  }
}
