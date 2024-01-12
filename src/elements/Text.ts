import { colord, extend } from 'colord'
import cmykPlugin from 'colord/plugins/cmyk'
import { Element } from './Element'
import type { AnyColor } from 'colord'
import type { Writer } from '../Writer'
import type { Resources } from '../resources'

extend([cmykPlugin])

export interface TextProperties {
  left?: number
  top?: number
  text?: string
  fontSize?: number
  lineHeight?: number
  rotate?: number
  color?: AnyColor
}

export class Text extends Element {
  left?: number
  top?: number
  text?: string
  fontSize?: number
  lineHeight?: number
  rotate?: number
  color?: AnyColor

  constructor(properties?: TextProperties) {
    super()
    properties && this.setProperties(properties)
  }

  /*
   * BT
   *  /F1 16 Tf % Font name + size
   *  16 TL % How many units down for next line in multiline text
   *  0 g % color
   *  28.35 813.54 Td % position
   *  (line one) Tj
   *  T* (line two) Tj
   *  T* (line three) Tj
   * ET
   */
  override writeTo(writer: Writer, resources: Resources) {
    super.writeTo(writer, resources)

    const {
      left = 0,
      top = 0,
      fontSize = 14,
      lineHeight = 1,
      rotate = 0,
      text = '',
      color = '#000000',
    } = this

    const height = lineHeight * fontSize
    const bottom = this.page.height - (top + height)

    const angle = -rotate * Math.PI / 180
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const sx = c.toFixed(4)
    const shy = s.toFixed(4)
    const shx = -s.toFixed(4)
    const sy = c.toFixed(4)
    const tx = left.toFixed(4)
    const ty = bottom.toFixed(4)

    let textColor
    switch (this.pdf?.colorSpace) {
      case 'cmyk': {
        const cmyk = colord(color).toCmyk()
        textColor = `${ cmyk.c / 100 } ${ cmyk.m / 100 } ${ cmyk.y / 100 } ${ cmyk.k / 100 } k`
        break
      }
      case 'rgb':
      default: {
        const rgb = colord(color).toRgb()
        textColor = `${ rgb.r / 255 } ${ rgb.g / 255 } ${ rgb.b / 255 } rg`
        break
      }
    }

    const font = resources.get('Helvetica')!

    writer.write('BT')
    writer.write(`/${ font.resourceId } ${ fontSize } Tf`) // font face, style, size
    writer.write(`${ height } TL`) // line spacing
    writer.write(`${ sx } ${ shy } ${ shx } ${ sy } ${ tx } ${ ty } Tm`) // position
    writer.write(textColor) // color
    writer.write(`(${ text }) Tj`) // content
    writer.write('ET')
  }
}
