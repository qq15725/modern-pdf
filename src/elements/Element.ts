import type { Element as IDocElement, NormalizedElement, NormalizedFill } from 'modern-idoc'
import type { Character, MeasureResult } from 'modern-text'
import type { Page } from '../blocks'
import type { Pdf } from '../Pdf'
import type { Font, Resource, XObjectImage } from '../resources'
import type { Writer } from '../Writer'
import { normalizeElement } from 'modern-idoc'
import { BoundingBox, svgPathDataToCommands } from 'modern-path2d'
import { Text } from 'modern-text'
import { FontType0 } from '../resources'
import { colorToPdf, gradientToSvg, num, shadowToSvg, svgCommandsToPdfOps } from './utils'

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
  protected _source?: NormalizedElement
  protected _children: Element[] = []
  /** Page-space offset of this element's origin, accumulated from ancestor boxes. */
  protected _offset = { x: 0, y: 0 }
  protected _image?: XObjectImage
  protected _bgImage?: XObjectImage
  protected _shapeImage?: XObjectImage
  protected _shadowImage?: XObjectImage
  protected _shadowPad = 0
  protected _text = new Text()
  protected _familyToFont = new Map<string, Font>()
  protected _measureResult?: MeasureResult
  protected _pdf?: Pdf
  get pdf(): Pdf {
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
    this._children.forEach(child => child.setPage(page))
    return this
  }

  constructor(options?: IDocElement) {
    if (options) {
      this._source = normalizeElement(options)
      options.children?.forEach(child => this._children.push(new Element(child)))
    }
  }

  setOffset(x: number, y: number): this {
    this._offset = { x, y }
    return this
  }

  load(): Promise<Resource | undefined>[] {
    const items: Promise<Resource | undefined>[] = []

    if (!this._source) {
      return items
    }

    const { foreground, background, shape, shadow, text, style } = this._source
    const box = this._boxStyle()

    const foregroundImage = foreground && this._loadFillImage(foreground, box)
    if (foregroundImage) {
      items.push(foregroundImage.then(v => this._image = v))
    }

    if (background?.enabled) {
      const backgroundImage = this._loadFillImage(background, box)
      if (backgroundImage) {
        items.push(backgroundImage.then(v => this._bgImage = v))
      }
    }

    // Shape with only an svg/preset body (no structured paths) is rasterized.
    if (shape && shape.enabled !== false && shape.svg && !shape.paths?.length) {
      items.push(this.pdf.asset.addSvg(shape.svg).then(v => this._shapeImage = v))
    }

    if (shadow?.enabled && box.width && box.height) {
      const { svg, pad } = shadowToSvg(shadow, box.width, box.height)
      this._shadowPad = pad
      items.push(this.pdf.asset.addSvg(svg).then(v => this._shadowImage = v))
    }

    // Chart/table need a full element→SVG layout renderer, expected from the idoc layer.
    if (this._source.chart) {
      console.warn('[modern-pdf] chart rendering requires an idoc element→SVG renderer; skipped.')
    }
    if (this._source.table) {
      console.warn('[modern-pdf] table rendering requires an idoc element→SVG renderer; skipped.')
    }

    if (text) {
      this._text.fonts = this.pdf.fonts
      this._text.content = text.content
      this._text.style = { ...style }
      this._text.update()
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

    this._children.forEach(child => items.push(...child.load()))

    return items
  }

  /** Resolve a fill's raster image: a direct image, or a gradient rasterized via SVG. */
  protected _loadFillImage(
    fill: NormalizedFill,
    box: { width: number, height: number },
  ): Promise<XObjectImage> | undefined {
    if (fill.image) {
      return this.pdf.asset.addImage(fill.image)
    }
    if ((fill.linearGradient || fill.radialGradient) && box.width && box.height) {
      const svg = gradientToSvg(fill, box.width, box.height)
      if (svg) {
        return this.pdf.asset.addSvg(svg)
      }
    }
    return undefined
  }

  writeTo(writer: Writer): void {
    // Painter's order: shadow and background sit at the bottom, the outline/border on top.
    this._writeShadow(writer)
    this._writeBackground(writer)
    this._writeShape(writer)
    this._writeShapeImage(writer)
    this._writeImage(writer)
    this._writeText(writer)
    this._writeOutline(writer)
    this._writeChildren(writer)
  }

  /** Blurred box shadow (rasterized), painted beneath everything at the shadow offset. */
  protected _writeShadow(writer: Writer): void {
    const resource = this._shadowImage
    if (!resource)
      return
    const { left, top, width, height, rotate } = this._boxStyle()
    const { offsetX = 0, offsetY = 0 } = this._source?.shadow ?? {}
    const pad = this._shadowPad
    this._paintImage(writer, resource, {
      left: left + offsetX - pad,
      top: top + offsetY - pad,
      width: width + pad * 2,
      height: height + pad * 2,
      rotate,
    })
  }

  /** Rasterized shape (svg/preset-only bodies) painted into the element box. */
  protected _writeShapeImage(writer: Writer): void {
    const resource = this._shapeImage
    if (!resource)
      return
    const { left, top, width, height, rotate } = this._boxStyle()
    this._paintImage(writer, resource, { left, top, width, height, rotate })
  }

  /**
   * Render nested children. Each child is positioned relative to this element's
   * top-left corner by accumulating the box offset (page-space). Ancestor
   * rotation/scale is not yet propagated to children — only translation is.
   */
  protected _writeChildren(writer: Writer): void {
    if (!this._children.length)
      return
    const { left, top } = this._boxStyle()
    const offsetX = this._offset.x + left
    const offsetY = this._offset.y + top
    this._children.forEach((child) => {
      child.setOffset(offsetX, offsetY)
      child.writeTo(writer)
    })
  }

  /** Width/height/left/top/rotate of this element's box, coerced to numbers. */
  protected _boxStyle(): { left: number, top: number, width: number, height: number, rotate: number } {
    const { left = 0, top = 0, width = 0, height = 0, rotate = 0 } = this._source?.style ?? {}
    return { left: Number(left), top: Number(top), width: Number(width), height: Number(height), rotate }
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

    const tx = this._offset.x + left
    const ty = (Number(this.page.style.height ?? 0)) - (this._offset.y + top + height)

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

  /** Paint an image XObject into the box [left, top, width, height] (with optional rotation). */
  protected _paintImage(
    writer: Writer,
    resource: XObjectImage,
    box: { left: number, top: number, width: number, height: number, rotate?: number },
  ): void {
    const { left, top, width, height, rotate = 0 } = box
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
    this._paintImage(writer, resource, {
      left: Number(left),
      top: Number(top),
      width: Number(width),
      height: Number(height),
      rotate,
    })
  }

  /** Fill (color/image) painted behind everything else; covers the element box. */
  protected _writeBackground(writer: Writer): void {
    const background = this._source?.background
    if (!background?.enabled)
      return
    const { left, top, width, height, rotate } = this._boxStyle()
    if (!width || !height)
      return

    if (background.color) {
      writer.write('q') // save graphics state
      this._writeTransform(writer, { left, top, width, height, rotate })
      writer.write(colorToPdf(background.color, this.pdf.colorSpace)) // fill color
      writer.write(`0 0 ${num(width)} ${num(height)} re`) // element box
      writer.write('f') // fill
      writer.write('Q') // restore graphics state
    }

    if (this._bgImage) {
      this._paintImage(writer, this._bgImage, { left, top, width, height, rotate })
    }
  }

  /** Border/stroke painted on top, following the element box. */
  protected _writeOutline(writer: Writer): void {
    const outline = this._source?.outline
    if (!outline?.enabled || !outline.color)
      return
    const { left, top, width, height, rotate } = this._boxStyle()
    if (!width || !height)
      return
    const lineWidth = outline.width ?? 1

    writer.write('q') // save graphics state
    this._writeTransform(writer, { left, top, width, height, rotate })
    writer.write(colorToPdf(outline.color, this.pdf.colorSpace, true)) // stroke color
    writer.write(`${num(lineWidth)} w`) // line width
    if (outline.style === 'dashed') {
      writer.write(`[${num(lineWidth * 3)} ${num(lineWidth * 2)}] 0 d`) // dash pattern
    }
    writer.write(`0 0 ${num(width)} ${num(height)} re`) // element box
    writer.write('S') // stroke
    writer.write('Q') // restore graphics state
  }

  /**
   * Vector shape: each ShapePath's SVG path data is mapped from the shape viewBox
   * into the element box (y-flipped) and emitted as PDF path operators. Paths that
   * use elliptical arcs fall back to image rasterization (see {@link _needsRaster}).
   */
  protected _writeShape(writer: Writer): void {
    const shape = this._source?.shape
    // normalizeShape omits `enabled`, so treat a present shape as enabled unless explicitly false.
    if (!shape || shape.enabled === false || !shape.paths?.length)
      return
    const { left, top, width, height, rotate } = this._boxStyle()
    if (!width || !height)
      return

    const [vbX = 0, vbY = 0, vbW = width, vbH = height] = shape.viewBox ?? []
    const scaleX = vbW ? width / vbW : 1
    const scaleY = vbH ? height / vbH : 1
    const mapX = (x: number): number => (x - vbX) * scaleX
    const mapY = (y: number): number => height - (y - vbY) * scaleY // flip to PDF's bottom-left origin

    const colorSpace = this.pdf.colorSpace
    const fill = this._source?.fill
    const elementFill = fill?.enabled ? fill.color : undefined

    writer.write('q') // save graphics state
    this._writeTransform(writer, { left, top, width, height, rotate })

    for (const path of shape.paths) {
      if (!path.data)
        continue
      const out: { hasArc?: boolean } = {}
      const ops = svgCommandsToPdfOps(svgPathDataToCommands(path.data), mapX, mapY, out)
      if (out.hasArc || !ops.length)
        continue // unsupported arc segment -> image fallback

      const fillColor = path.fill === 'none' ? undefined : (path.fill ?? elementFill)
      const strokeColor = path.stroke === 'none' ? undefined : path.stroke
      if (!fillColor && !strokeColor)
        continue

      writer.write('q') // isolate per-path color/line state
      if (fillColor) {
        writer.write(colorToPdf(fillColor, colorSpace))
      }
      if (strokeColor) {
        writer.write(colorToPdf(strokeColor, colorSpace, true))
        writer.write(`${num(path.strokeWidth ?? 1)} w`)
        if (path.strokeDasharray?.length) {
          writer.write(`[${path.strokeDasharray.map(num).join(' ')}] ${num(path.strokeDashoffset ?? 0)} d`)
        }
      }
      ops.forEach(op => writer.write(op))
      const evenOdd = path.fillRule === 'evenodd'
      if (fillColor && strokeColor) {
        writer.write(evenOdd ? 'B*' : 'B') // fill + stroke
      }
      else if (fillColor) {
        writer.write(evenOdd ? 'f*' : 'f') // fill only
      }
      else {
        writer.write('S') // stroke only
      }
      writer.write('Q')
    }

    writer.write('Q') // restore graphics state
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
      left: Number(left),
      top: Number(top),
      width: Number(width),
      height: Number(height),
      rotate,
    })
    writer.write('BT')
    writer.write(`${wordSpacing} Tw`) // word spacing
    // writer.write(`${ 100 } Tz`) // horizontal scale
    // writer.write(`${ 0 } Tr`) // rendering mode

    let group: Character[] = []
    const groups: Character[][] = []
    paragraphs.forEach((p) => {
      p.fragments.forEach((f) => {
        let prevChar: Character | undefined
        f.characters.forEach((c) => {
          if (
            c.isVertical
              ? prevChar?.lineBox.left !== c.lineBox.left
              : prevChar?.lineBox.top !== c.lineBox.top
          ) {
            if (group.length) {
              groups.push(group)
              group = []
            }
          }
          group.push(c)
          prevChar = c
        })
        if (group.length) {
          groups.push(group)
          group = []
        }
      })
    })

    groups.forEach((chars) => {
      const content = chars.reduce((content, v) => content + v.content, '')

      if (!content || !chars.length)
        return

      const inlineBox = BoundingBox.from(
        ...(
          chars
            .map(c => c.inlineBox)
            .filter(Boolean) as BoundingBox[]
        ),
      )

      const glyphBox = BoundingBox.from(
        ...(
          chars
            .map(c => c.glyphBox)
            .filter(Boolean) as BoundingBox[]
        ),
      )

      const char = chars[0]

      const {
        baseline,
        computedStyle: style,
      } = char

      const {
        fontSize,
        // fontWeight, // TODO
        letterSpacing,
        fontFamily,
        fontStyle,
        color,
        textDecoration,
        writingMode,
      } = style

      const tx = glyphBox.left
      const ty = Number(height) - (inlineBox.top + baseline)
      const lineSpacing = glyphBox.height

      let skewY = 0
      if (fontStyle === 'italic') {
        skewY = 0.25
      }

      const textColor = colorToPdf(color as string, this.pdf.colorSpace)
      const strokeColor = colorToPdf(color as string, this.pdf.colorSpace, true)

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
              writer.write(strokeColor) // color
              writer.write(`${(fontSize * 0.1).toFixed(4)} w`)
              writer.write(`${[tx, Number(height) - (glyphBox.top + glyphBox.height)].map(val => val.toFixed(4)).join(' ')} m`)
              writer.write(`${[tx + inlineBox.width + 1, Number(height) - (glyphBox.top + glyphBox.height)].map(val => val.toFixed(4)).join(' ')} l`)
              writer.write('S')
              break
            case 'line-through':
              writer.write(strokeColor) // color
              writer.write(`${(fontSize * 0.1).toFixed(4)} w`)
              writer.write(`${[tx, Number(height) / 2].map(val => val.toFixed(4)).join(' ')} m`)
              writer.write(`${[tx + inlineBox.width + 1, Number(height) / 2].map(val => val.toFixed(4)).join(' ')} l`)
              writer.write('S')
              break
          }
          break
      }
    })

    writer.write('ET')
    writer.write('Q') // restore graphics state
  }
}
