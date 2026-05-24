# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`modern-pdf` is a browser-oriented TypeScript library that **encodes** PDF files from a declarative, DOM-like document description. You hand it a tree of pages and elements (text/images with CSS-like styles) and it serializes a valid PDF byte stream. It is a PDF *writer*, not a parser/renderer. The input document format comes from `modern-idoc`; text layout/measurement from `modern-text`; font parsing/subsetting from `modern-font`; path math from `modern-path2d`; color conversion from `colord`; deflate compression from `fflate`.

## Commands

```bash
pnpm dev          # Vite dev server serving docs/ (live playground, docs/index.html)
pnpm build        # vite build (UMD browser bundle) + unbuild (ESM/CJS + .d.ts) → dist/
pnpm test         # vitest (watch). Run once: pnpm test run. Single file: pnpm test run test/index.test.ts
pnpm lint         # eslint src  (autofix: eslint src --fix)
pnpm typecheck    # tsc --noEmit
```

Package manager is **pnpm@9.9.0**. Node LTS. A `pre-commit` git hook runs `lint-staged` → `eslint src --fix`.

Commits follow the Angular Conventional Commits format enforced by `.github/commit-convention.md` (e.g. `feat(scope): ...`, `fix: ...`); releases are cut with `pnpm release` (bumpp) which tags and pushes.

## Architecture

The whole library is a serialization pipeline orchestrated by `Pdf.generate()` (`src/Pdf.ts`). Read these together to understand the flow:

**`Pdf`** — the entry point. Constructed from `PDFOptions` (which *extends* `modern-idoc`'s Document): `children` become pages, `meta` maps onto PDF metadata fields (title, colorSpace `rgb|cmyk`, pageLayout, etc.), `fonts` is a `modern-font` `Fonts` instance. The 14 standard Type1 fonts are loaded on construction. Output helpers — `save()`, `toBlob()`, `toBuffer()`, `toUrl()`, `openInNewWindow()` — all funnel through `generate()` and assume a browser DOM.

**`generate()` ordering matters.** It (1) writes the header, (2) `await`s `page.load()` for every page to resolve all async resources (image bitmaps, font subsets), (3) calls `updateFontData()` on each `FontType0` to build the embedded/subsetted font program, then (4) writes pages → `Pages` → resources → info → catalog → xref → trailer → eof. Cross-object references and the xref byte-offset table depend on this exact write order, so don't reorder writes casually.

**`Writer`** (`src/Writer.ts`) — converts JS values into PDF syntax: dictionaries `<<...>>`, arrays `[...]`, names `/Name`, strings `(...)`, dates, and numbers (integers vs. 4-decimal floats). An object passed as a dictionary value that is an `ObjectBlock` is emitted as an indirect reference (`N 0 R`). `writeObj()` records each object's byte offset — that's what the xref table consumes.

**Blocks** (`src/blocks/`) — the PDF object model.
- `Block` → base (holds `pdf` back-ref, byte `offset`, `setProperties`).
- `ObjectBlock` → an indirect object with an auto-increment `id`, optional stream `data`, `filter`s (e.g. `/FlateDecode` via `fflate`'s `zlibSync`), and `getDictionary()`/`getStream()`/`writeTo()`. Most things subclass this.
- Document-structure blocks: `Header`, `Catalog`, `Info`, `Pages`, `Page`, `Contents`, `Xref`, `Trailer`, `Eof`, plus font helpers `FontDescriptor`, `ToUnicode`.
- `Page` extends `ObjectBlock`; it owns its `style` (normalized via `modern-idoc`), child `Element`s, a `Contents` (the content stream), and a `Resources`. `page.load()` resolves element resources and registers them on `Resources`; `page.writeTo()` renders children into the content-stream writer first, then writes resources/contents/page dict.

**Resources** (`src/resources/`) — things referenced from a page's resource dictionary, each with a `resourceId` (`R{id}`).
- Fonts: `Font` base → `FontType0` (composite/CID, used for embedded+subsetted TrueType, tracks a `subset` Set and `unicodeGlyphIdMap`), `FontType1` (the 14 built-in standard fonts + the fallback font), `FontCIDFontType2`, `FontTrueType`.
- XObjects: `XObject` → `XObjectImage` (raster images, built from an `ImageBitmap`), `XObjectForm`.
- `Resources` block buckets sources into `/Font`, `/XObject`, `/Pattern`, etc. dictionaries.

**`Element`** (`src/elements/Element.ts`) — renders one node into content-stream operators. Normalizes its options with `modern-idoc`'s `normalizeElement`, then paints in a fixed painter's order via `writeTo`: shadow → background → shape → shape-image → foreground image → text → outline → children. Supported idoc features:
- **background / foreground** fills: solid color (`re`+`f`), image (`Do`), or gradient (rasterized to SVG, see below).
- **shape**: each `ShapePath`'s SVG path-data is mapped from its viewBox into the element box (y-flipped) and emitted as PDF path operators; helper `svgCommandsToPdfOps` in `src/elements/utils.ts` handles `M/L/H/V/C/S/Q/T/Z` (quadratics promoted to cubics). Elliptical arcs (`A`) and svg/preset-only shapes fall back to SVG rasterization.
- **outline**: box border/stroke (`S`), solid or dashed.
- **shadow**: blurred box shadow, rasterized via `shadowToSvg`.
- **text**: laid out/measured by `modern-text`'s `Text`; per fragment it loads+subsets the font into `FontType0`, then emits `BT…ET` blocks (`Tf`/`TL`/`Tc`/`Tm`/`Tj`).
- **children**: rendered recursively, positioned relative to the parent box via an accumulated page-space offset (`_offset`/`setOffset`). Only translation propagates — ancestor rotation/scale does **not** yet cascade to children.
- **chart / table**: not implemented — they need a full element→SVG layout renderer (expected from the idoc layer); `load()` just warns.

**Conventions/gotchas:** **PDF's origin is bottom-left**, so vertical positions are flipped (`ty = pageHeight - (offsetY + top + height)`); transforms (rotate/skew/scale) are `cm` matrix operators inside `q…Q` guards. Color is emitted as `rg`/`k` (or stroking `RG`/`K`) by `colorToPdf` depending on `pdf.colorSpace` — alpha is dropped (no ExtGState yet). The **rasterization fallback** builds an SVG document string and routes it through `Asset.addSvg` → `addImage` (which already decodes SVG data URLs); the SVG builders (`gradientToSvg`/`shadowToSvg`/`wrapSvg`) and `svgCommandsToPdfOps` are PDF-agnostic and are candidates for extraction into modern-idoc as a shared element renderer. Note: `normalizeShape` does **not** emit `enabled` (unlike background/outline/shadow), so shape code treats a present shape as enabled unless `enabled === false`.

**`Asset`** (`src/Asset.ts`) — a per-`Pdf` resource cache/loader keyed by URL/family. `addImage` fetches and decodes to `ImageBitmap` (with SVG fixups for missing width/height), `addFont` pulls from the `modern-font` registry or an explicit resource. Dedupes concurrent loads via stored promises.

## Conventions & gotchas

- `__VERSION__` is a compile-time global (declared in `src/shims.d.ts`) injected from `package.json` `version` by Vite, unbuild, and the docs Vite config. When running code outside those builds (e.g. ad-hoc), it will be undefined.
- The unbuild config enables `experimentalDecorators`; ESLint uses `@antfu/eslint-config` in `type: 'lib'` mode.
- `dist/` is committed/published (`files: ["dist"]`); `pnpm build` runs both bundlers and `clean: false` in unbuild means it does not wipe the Vite UMD output.
- Tests live in `test/` and are currently minimal (smoke test only). The CI `test` job runs `pnpm build` before `pnpm test`.
