import type { NormalizedFill, NormalizedShadow } from 'modern-idoc'
import { colord, extend } from 'colord'
import cmykPlugin from 'colord/plugins/cmyk'

extend([cmykPlugin])

export type ColorSpace = 'rgb' | 'cmyk'

/** Format a number for a PDF content stream (integers stay bare, floats clamp to 4 decimals). */
export function num(value: number): string {
  return Math.abs(value) === ~~value ? String(value) : value.toFixed(4)
}

/**
 * Convert an idoc/CSS color into the PDF color-setting operator.
 * `stroke` selects the stroking variant (`RG`/`K`/`G`) over the non-stroking one (`rg`/`k`/`g`).
 * Alpha is ignored here — opacity needs an ExtGState (see {@link colorAlpha}).
 */
export function colorToPdf(color: string, colorSpace: ColorSpace, stroke = false): string {
  const c = colord(color)
  if (colorSpace === 'cmyk') {
    const { c: cy, m, y, k } = c.toCmyk()
    return `${num(cy / 100)} ${num(m / 100)} ${num(y / 100)} ${num(k / 100)} ${stroke ? 'K' : 'k'}`
  }
  const { r, g, b } = c.toRgb()
  return `${num(r / 255)} ${num(g / 255)} ${num(b / 255)} ${stroke ? 'RG' : 'rg'}`
}

/** Alpha channel of an idoc color in the 0..1 range. */
export function colorAlpha(color: string): number {
  return colord(color).alpha()
}

/** Wrap inner SVG markup into a sized, self-contained `<svg>` document string. */
export function wrapSvg(width: number, height: number, body: string, defs = ''): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`
}

function gradientStopsToSvg(stops: { offset: number, color: string }[]): string {
  return stops
    .map((stop) => {
      const c = colord(stop.color)
      const { r, g, b } = c.toRgb()
      return `<stop offset="${num(stop.offset * 100)}%" stop-color="rgb(${r},${g},${b})" stop-opacity="${num(c.alpha())}"/>`
    })
    .join('')
}

/**
 * Build an SVG document that paints a gradient fill over a `width`×`height` rect,
 * to be rasterized and embedded (PDF axial/radial shadings are not emitted directly).
 * Returns `undefined` when the fill carries no gradient.
 */
export function gradientToSvg(fill: NormalizedFill, width: number, height: number): string | undefined {
  let defs: string
  if (fill.linearGradient) {
    const { angle = 0, stops = [] } = fill.linearGradient
    // CSS gradient angle: 0deg points up, growing clockwise. Project onto the unit box.
    const rad = (angle * Math.PI) / 180
    const dx = Math.sin(rad)
    const dy = -Math.cos(rad)
    const x1 = num(0.5 - dx / 2)
    const y1 = num(0.5 - dy / 2)
    const x2 = num(0.5 + dx / 2)
    const y2 = num(0.5 + dy / 2)
    defs = `<linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${gradientStopsToSvg(stops)}</linearGradient>`
  }
  else if (fill.radialGradient) {
    defs = `<radialGradient id="g" cx="0.5" cy="0.5" r="0.5">${gradientStopsToSvg(fill.radialGradient.stops ?? [])}</radialGradient>`
  }
  else {
    return undefined
  }
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  return wrapSvg(w, h, `<rect width="${w}" height="${h}" fill="url(#g)"/>`, defs)
}

/**
 * Build an SVG document for a blurred box shadow of `width`×`height`. The returned
 * canvas is padded by `blur*3` on every side; {@link NormalizedShadow.offsetX}/`offsetY`
 * positioning is applied by the caller. Approximates the shadow as the element's box.
 */
export function shadowToSvg(shadow: NormalizedShadow, width: number, height: number): { svg: string, pad: number } {
  const blur = shadow.blur ?? 0
  const pad = Math.ceil(blur * 3) + 1
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const { r, g, b } = colord(shadow.color).toRgb()
  const alpha = colord(shadow.color).alpha()
  const filter = blur > 0 ? `<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${num(blur)}"/></filter>` : ''
  const rect = `<rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="rgb(${r},${g},${b})" fill-opacity="${num(alpha)}"${blur > 0 ? ' filter="url(#b)"' : ''}/>`
  return { svg: wrapSvg(w + pad * 2, h + pad * 2, rect, filter), pad }
}

type PathCommand = ReturnType<typeof import('modern-path2d').svgPathDataToCommands>[number]

/**
 * Convert SVG path-data commands into PDF path-construction operators (`m`/`l`/`c`/`h`).
 *
 * `mapX`/`mapY` map a point from the shape's own coordinate space into the PDF box —
 * typically a viewBox scale plus the y-axis flip (PDF origin is bottom-left).
 * Quadratic beziers (Q/T) are promoted to cubics; smooth curves (S/T) reflect the
 * previous control point. Elliptical arcs (A) are not representable as cubics here,
 * so they set `out.hasArc` and the caller should fall back to image rasterization.
 *
 * This routine is PDF-agnostic except for the operator spelling and is a candidate
 * for extraction into modern-idoc as a shared shape→path renderer.
 */
export function svgCommandsToPdfOps(
  commands: PathCommand[],
  mapX: (x: number) => number,
  mapY: (y: number) => number,
  out: { hasArc?: boolean } = {},
): string[] {
  const ops: string[] = []
  let cx = 0
  let cy = 0 // current point, in shape space
  let startX = 0
  let startY = 0 // current subpath start
  let ctrlX = 0
  let ctrlY = 0 // last bezier control point (for S/T reflection)
  let prevType = ''

  const moveTo = (x: number, y: number): void => void ops.push(`${num(mapX(x))} ${num(mapY(y))} m`)
  const lineTo = (x: number, y: number): void => void ops.push(`${num(mapX(x))} ${num(mapY(y))} l`)
  const curveTo = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): void =>
    void ops.push(`${num(mapX(x1))} ${num(mapY(y1))} ${num(mapX(x2))} ${num(mapY(y2))} ${num(mapX(x))} ${num(mapY(y))} c`)

  const afterCubic = (t: string): boolean => t === 'C' || t === 'c' || t === 'S' || t === 's'
  const afterQuad = (t: string): boolean => t === 'Q' || t === 'q' || t === 'T' || t === 't'

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
      case 'm': {
        cx = cmd.type === 'm' ? cx + cmd.x : cmd.x
        cy = cmd.type === 'm' ? cy + cmd.y : cmd.y
        startX = cx
        startY = cy
        moveTo(cx, cy)
        break
      }
      case 'L':
      case 'l': {
        cx = cmd.type === 'l' ? cx + cmd.x : cmd.x
        cy = cmd.type === 'l' ? cy + cmd.y : cmd.y
        lineTo(cx, cy)
        break
      }
      case 'H':
      case 'h': {
        cx = cmd.type === 'h' ? cx + cmd.x : cmd.x
        lineTo(cx, cy)
        break
      }
      case 'V':
      case 'v': {
        cy = cmd.type === 'v' ? cy + cmd.y : cmd.y
        lineTo(cx, cy)
        break
      }
      case 'C':
      case 'c': {
        const rel = cmd.type === 'c'
        const x1 = rel ? cx + cmd.x1 : cmd.x1
        const y1 = rel ? cy + cmd.y1 : cmd.y1
        const x2 = rel ? cx + cmd.x2 : cmd.x2
        const y2 = rel ? cy + cmd.y2 : cmd.y2
        const x = rel ? cx + cmd.x : cmd.x
        const y = rel ? cy + cmd.y : cmd.y
        curveTo(x1, y1, x2, y2, x, y)
        ctrlX = x2
        ctrlY = y2
        cx = x
        cy = y
        break
      }
      case 'S':
      case 's': {
        const rel = cmd.type === 's'
        const x2 = rel ? cx + cmd.x2 : cmd.x2
        const y2 = rel ? cy + cmd.y2 : cmd.y2
        const x = rel ? cx + cmd.x : cmd.x
        const y = rel ? cy + cmd.y : cmd.y
        const x1 = afterCubic(prevType) ? 2 * cx - ctrlX : cx
        const y1 = afterCubic(prevType) ? 2 * cy - ctrlY : cy
        curveTo(x1, y1, x2, y2, x, y)
        ctrlX = x2
        ctrlY = y2
        cx = x
        cy = y
        break
      }
      case 'Q':
      case 'q': {
        const rel = cmd.type === 'q'
        const qx = rel ? cx + cmd.x1 : cmd.x1
        const qy = rel ? cy + cmd.y1 : cmd.y1
        const x = rel ? cx + cmd.x : cmd.x
        const y = rel ? cy + cmd.y : cmd.y
        curveTo(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y)
        ctrlX = qx
        ctrlY = qy
        cx = x
        cy = y
        break
      }
      case 'T':
      case 't': {
        const rel = cmd.type === 't'
        const x = rel ? cx + cmd.x : cmd.x
        const y = rel ? cy + cmd.y : cmd.y
        const qx = afterQuad(prevType) ? 2 * cx - ctrlX : cx
        const qy = afterQuad(prevType) ? 2 * cy - ctrlY : cy
        curveTo(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y)
        ctrlX = qx
        ctrlY = qy
        cx = x
        cy = y
        break
      }
      case 'A':
      case 'a':
        out.hasArc = true
        break
      case 'Z':
      case 'z':
        ops.push('h')
        cx = startX
        cy = startY
        break
    }
    prevType = cmd.type
  }

  return ops
}
