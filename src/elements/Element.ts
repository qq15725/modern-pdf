import type { IDOCElement, IDOCElementDeclaration } from 'modern-idoc'
import type { MeasureResult } from 'modern-text'
import type { Page } from '../blocks'
import type { PDF } from '../PDF'
import type { Font, Resource, XObjectImage } from '../resources'
import type { Writer } from '../Writer'
import { colord, extend } from 'colord'
import cmykPlugin from 'colord/plugins/cmyk'
import { normalizeElement } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'
import { Text } from 'modern-text'
import { FontType0 } from '../resources'

extend([cmykPlugin])

export interface TransformOptions {
  left?: number
  top?: number
  width?: number
  height?: number
  rotate?: number
  skewX?: number
  skewY?: number
  scaleX?: number
  scaleY?: number
  transformOriginX?: number
  transformOriginY?: number
}

export const PI = Math.PI
export const DEG_TO_RAD = PI / 180

export class Element {
  protected _source?: IDOCElementDeclaration
  protected _image?: XObjectImage
  protected _text = new Text()
  protected _familyToFont = new Map<string, Font>()
  protected _measureResult?: MeasureResult
  protected _pdf?: PDF
  get pdf(): PDF {
    if (!this._pdf)
      throw new Error('This element is missing pdf')
    return this._pdf
  }

  protected _page?: Page
  get page(): Page {
    if (!this._page)
      throw new Error('This element is missing page')
    return this._page
  }

  setPage(page: Page): this {
    this._pdf = page.pdf
    this._page = page
    return this
  }

  constructor(options?: IDOCElement) {
    if (options) {
      this._source = normalizeElement(options)
    }
  }

  load(): Promise<Resource | undefined>[] {
    const items: Promise<Resource | undefined>[] = []

    if (!this._source) {
      return items
    }

    const { image, text, style } = this._source

    if (image) {
      items.push(
        this.pdf.asset.addImage(image.url).then(v => this._image = v),
      )
    }

    if (text) {
      this._text.fonts = this.pdf.fonts
      this._text.content = text.content
      this._text.style = { ...style }
      this._text.updateParagraphs()
      this._text.paragraphs.forEach((paragraph) => {
        paragraph.fragments.forEach((fragment) => {
          const content = fragment.content
          const fontFamily = fragment.computedStyle.fontFamily
          if (fontFamily) {
            items.push(
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

      items.push(this._text.load().then(() => {
        this._measureResult = this._text.measure(text.measureDom)
        return undefined
      }))
    }

    return items
  }

  writeTo(_writer: Writer): void {
    this._writeImage(_writer)
    this._writeText(_writer)
  }

  protected _writeTransform(
    writer: Writer,
    options: TransformOptions = {},
  ): void {
    const {
      left = 0,
      top = 0,
      rotate = 0,
      width = 1,
      height = 1,
      skewX = 0,
      skewY = 0,
      scaleX = 1,
      scaleY = 1,
      transformOriginX = 0.5,
      transformOriginY = 0.5,
    } = options

    const tx = left
    const ty = (this.page.style.height ?? 0) - (top + height)

    if (rotate) {
      const _rotate = rotate * DEG_TO_RAD
      const cx = Math.cos(_rotate + skewY)
      const sx = Math.sin(_rotate + skewY)
      const cy = -Math.sin(_rotate - skewX) // cos, added PI/2
      const sy = Math.cos(_rotate - skewX) // sin, added PI/2
      const offsetX = transformOriginX * width
      const offsetY = transformOriginY * height
      writer.write(`${[1, 0, 0, 1, offsetX, offsetY].map(val => Number(val).toFixed(4)).join(' ')} cm`)
      writer.write(`${[cx, cy, sx, sy, tx, ty].map(val => Number(val).toFixed(4)).join(' ')} cm`)
      writer.write(`${[1, 0, 0, 1, -offsetX, -offsetY].map(val => Number(val).toFixed(4)).join(' ')} cm`)
    }
    else {
      writer.write(`${[1, 0, 0, 1, tx, ty].map(val => Number(val).toFixed(4)).join(' ')} cm`)
    }

    if (scaleX !== 1 && scaleY !== 1) {
      writer.write(`${[scaleX, 0, 0, scaleY, 0, 0].map(val => Number(val).toFixed(4)).join(' ')} cm`)
    }
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
  protected _writeText(writer: Writer): void {
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
    } = this._source?.style ?? {}

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

  protected _writeImage(writer: Writer): void {
    const resource = this._image
    if (!resource)
      return
    const {
      left = 0,
      top = 0,
      width = resource.width,
      height = resource.height,
      rotate = 0,
    } = this._source?.style ?? {}
    writer.write('q') // save graphics state
    this._writeTransform(writer, {
      left,
      top,
      width,
      height,
      rotate,
      scaleX: width,
      scaleY: height,
    })
    writer.write(`/${resource.resourceId} Do`) // paint Image
    writer.write('Q') // restore graphics state
  }
}
