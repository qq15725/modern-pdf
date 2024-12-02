import type { TextContent as BaseTextContent, TextStyle as BaseTextStyle, MeasureResult } from 'modern-text'
import type { Font, Resource } from '../resources'
import type { Writer } from '../Writer'
import { colord, extend } from 'colord'
import cmykPlugin from 'colord/plugins/cmyk'
import { BoundingBox } from 'modern-path2d'
import { Text as BaseText } from 'modern-text'
import { FontType0 } from '../resources'
import { Element } from './Element'

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
  content?: BaseTextContent
  style?: Partial<TextStyle>
}

export class Text extends Element {
  protected _text = new BaseText()
  content: BaseTextContent
  style: Partial<TextStyle>
  protected _familyToFont = new Map<string, Font>()
  protected _measureResult?: MeasureResult

  constructor(options: TextOptions = {}) {
    super()
    const { content = '', style } = options
    this.content = content
    this.style = {
      left: 0,
      top: 0,
      wordSpacing: 0,
      rotate: 0,
      height: 0,
      width: 0,
      ...style,
    }
  }

  override load(): Promise<Resource | undefined>[] {
    this._text.fonts = this.pdf.fonts
    this._text.content = this.content
    this._text.style = { ...this.style }
    this._text.updateParagraphs()
    const list: Promise<Resource | undefined>[] = []
    this._text.paragraphs.forEach((paragraph) => {
      paragraph.fragments.forEach((fragment) => {
        const content = fragment.content
        const fontFamily = fragment.computedStyle.fontFamily
        if (fontFamily) {
          list.push(
            this.pdf.asset.getFont(fontFamily)
              .then((font) => {
                this._familyToFont.set(fontFamily, font)
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
    list.push(this._text.load().then(() => {
      this._measureResult = this._text.measure()
      return undefined
    }))
    list.push()
    return list
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
  override writeTo(writer: Writer): void {
    super.writeTo(writer)

    if (!this._measureResult) {
      return
    }

    const { paragraphs, boundingBox } = this._measureResult

    const {
      left = 0,
      top = 0,
      width = boundingBox.width,
      height = boundingBox.height,
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
    writer.write(`${wordSpacing} Tw`) // word spacing
    // writer.write(`${ 100 } Tz`) // horizontal scale
    // writer.write(`${ 0 } Tr`) // rendering mode
    paragraphs.forEach((paragraph) => {
      paragraph.fragments.forEach((fragment) => {
        const { content } = fragment

        if (!content || !fragment.characters.length)
          return

        const baseline = fragment.characters[0].baseline
        const inlineBox = fragment.inlineBox
        const glyphBox = BoundingBox.from(
          ...(fragment.characters
            .map(c => c.glyphBox)
            .filter(Boolean) as BoundingBox[]),
        )

        const {
          fontSize,
          // fontWeight, // TODO
          letterSpacing,
          fontFamily,
          fontStyle,
          color,
          textDecoration,
          writingMode,
        } = fragment.computedStyle

        const tx = glyphBox.left
        const ty = height - (inlineBox.top + baseline)
        const lineSpacing = glyphBox.height

        let skewY = 0
        if (fontStyle === 'italic') {
          skewY = 0.25
        }

        let textColor
        switch (this.pdf?.colorSpace) {
          case 'cmyk': {
            const cmyk = colord(color as string).toCmyk()
            textColor = `${cmyk.c / 100} ${cmyk.m / 100} ${cmyk.y / 100} ${cmyk.k / 100} k`
            break
          }
          case 'rgb':
          default: {
            const rgb = colord(color as string).toRgb()
            textColor = `${rgb.r / 255} ${rgb.g / 255} ${rgb.b / 255} rg`
            break
          }
        }

        const font = this._familyToFont.get(fontFamily)
          ?? this.pdf.asset.fallbackFont

        if (!font)
          return

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
        }
        else {
          text = `(${content})`
        }

        writer.write(`/${font.resourceId} ${fontSize.toFixed(4)} Tf`) // font face, style, size
        writer.write(`${lineSpacing.toFixed(4)} TL`) // line spacing
        writer.write(`${letterSpacing.toFixed(4)} Tc`) // char spacing
        writer.write(`${[1, 0, skewY, 1, tx, ty].map(val => val.toFixed(4)).join(' ')} Tm`) // position
        writer.write(textColor) // color
        writer.write(`${text} Tj`) // content

        switch (writingMode) {
          case 'horizontal-tb':
            switch (textDecoration) {
              case 'underline':
                writer.write(textColor.toUpperCase()) // color
                writer.write(`${(fontSize * 0.1).toFixed(4)} w`)
                writer.write(`${[tx, height - (glyphBox.top + glyphBox.height)].map(val => val.toFixed(4)).join(' ')} m`)
                writer.write(`${[tx + inlineBox.width + 1, height - (glyphBox.top + glyphBox.height)].map(val => val.toFixed(4)).join(' ')} l`)
                writer.write('S')
                break
              case 'line-through':
                writer.write(textColor.toUpperCase()) // color
                writer.write(`${(fontSize * 0.1).toFixed(4)} w`)
                writer.write(`${[tx, height / 2].map(val => val.toFixed(4)).join(' ')} m`)
                writer.write(`${[tx + inlineBox.width + 1, height / 2].map(val => val.toFixed(4)).join(' ')} l`)
                writer.write('S')
                break
            }
            break
        }
      })
    })
    writer.write('ET')
    writer.write('Q') // restore graphics state
  }
}
