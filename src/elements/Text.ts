import { colord, extend } from 'colord'
import cmykPlugin from 'colord/plugins/cmyk'
import { Text as BaseText } from 'modern-text'
import { FontType0, FontType1 } from '../resources'
import { Element } from './Element'
import type { TextStyle as BaseTextStyle, Metrics, TextContent } from 'modern-text'
import type { Font, Resource } from '../resources'
import type { Writer } from '../Writer'

extend([cmykPlugin])

export interface TextStyle extends BaseTextStyle {
  left: number
  top: number
  width: number
  height: number
  wordSpacing: number
  rotate: number
}

export interface TextOptions {
  content?: TextContent
  style?: Partial<TextStyle>
}

export class Text extends Element {
  protected _text = new BaseText()
  content: TextContent
  style: TextStyle
  protected _textMetrics?: Metrics
  protected _fontFamilys = new Map<string, Font>()

  constructor(options: TextOptions = {}) {
    super()
    const { content = '', style } = options
    this.content = content
    this.style = {
      left: 0,
      top: 0,
      wordSpacing: 0,
      rotate: 0,
      ...BaseText.defaultStyle,
      height: 0,
      width: 0,
      ...style,
      fontFamily: '',
    }
  }

  override load(): Array<Promise<Resource>> {
    this._text.content = this.content
    this._text.style = this.style as any
    this._textMetrics = this._text.measure()
    const promises: Array<Promise<Resource>> = []
    this._textMetrics.paragraphs.forEach(paragraph => {
      paragraph.fragments.forEach(fragment => {
        const content = fragment.content
        const fontFamily = fragment.style.fontFamily
        if (fontFamily) {
          promises.push(
            this.pdf.asset
              .loadFont(fontFamily)
              .then(font => {
                this._fontFamilys.set(fontFamily, font)
                if (font instanceof FontType0) {
                  for (const char of content) {
                    font.subset.add(char)
                  }
                }
                return font
              }),
          )
        }
      })
    })
    return promises
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
  override writeTo(writer: Writer) {
    super.writeTo(writer)

    const { paragraphs, contentBox } = this._text.measure()

    const {
      left = 0,
      top = 0,
      width = contentBox.width,
      height = contentBox.height,
      wordSpacing = 0,
      rotate = 0,
    } = this.style

    writer.write('q') // save graphics state
    this._writeTransform(writer, {
      left,
      top,
      width,
      height,
      rotate,
    })
    writer.write('BT')
    writer.write(`${ wordSpacing } Tw`) // word spacing
    // writer.write(`${ 100 } Tz`) // horizontal scale
    // writer.write(`${ 0 } Tr`) // rendering mode
    paragraphs.forEach(paragraph => {
      paragraph.fragments.forEach(fragment => {
        const {
          content,
          glyphBox,
          baseline,
        } = fragment

        if (!content) return

        const {
          fontSize,
          // fontWeight, // TODO
          letterSpacing,
          fontFamily,
          fontStyle,
          color,
        } = fragment.style

        const tx = glyphBox.left
        const ty = height - baseline
        const lineSpacing = glyphBox.height

        let skewY = 0
        if (fontStyle === 'italic') {
          skewY = 0.25
        }

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

        const font = this._fontFamilys.get(fontFamily)
          ?? FontType1.defaultFont

        if (!font) return

        let text
        if (font instanceof FontType0) {
          text = '<'
          for (let i = 0, l = content.length; i < l; i++) {
            const unicode = content.charCodeAt(i)
            const glyphId = font.unicodeGlyphIdMap[unicode]
            if (glyphId !== undefined) {
              text += Number(glyphId)
                .toString(16)
                .padStart(4, '0')
            }
          }
          text += '>'
        } else {
          text = `(${ content })`
        }

        writer.write(`/${ font.resourceId } ${ fontSize.toFixed(4) } Tf`) // font face, style, size
        writer.write(`${ lineSpacing.toFixed(4) } TL`) // line spacing
        writer.write(`${ letterSpacing.toFixed(4) } Tc`) // char spacing
        writer.write(`${ [1, 0, skewY, 1, tx, ty].map(val => val.toFixed(4)).join(' ') } Tm`) // position
        writer.write(textColor) // color
        writer.write(`${ text } Tj`) // content
      })
    })
    writer.write('ET')
    writer.write('Q') // restore graphics state
  }
}
