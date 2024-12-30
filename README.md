<h1 align="center">modern-pdf</h1>

<p align="center">
  <a href="https://unpkg.com/modern-pdf">
    <img src="https://img.shields.io/bundlephobia/minzip/modern-pdf" alt="Minzip">
  </a>
  <a href="https://www.npmjs.com/package/modern-pdf">
    <img src="https://img.shields.io/npm/v/modern-pdf.svg" alt="Version">
  </a>
  <a href="https://www.npmjs.com/package/modern-pdf">
    <img src="https://img.shields.io/npm/dm/modern-pdf" alt="Downloads">
  </a>
  <a href="https://github.com/qq15725/modern-pdf/issues">
    <img src="https://img.shields.io/github/issues/qq15725/modern-pdf" alt="Issues">
  </a>
  <a href="https://github.com/qq15725/modern-pdf/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/modern-pdf.svg" alt="License">
  </a>
</p>

## Usage

```ts
import { PDF } from 'modern-pdf'

const pdf = new PDF({
  // meta: {
  //   colorSpace: 'cmyk',
  // },
  children: [
    {
      name: 'page1',
      style: { width: 300, height: 600 },
      children: [
        {
          style: { rotate: 60, width: 50, height: 50 },
          image: '/assets/test.jpg',
        },
        {
          style: { rotate: 40, left: 100, top: 100, fontSize: 20, color: '#FF00FF' },
          text: 'test',
        },
        {
          style: { left: 200, top: 100, width: 100, height: 200, fontSize: 22 },
          text: [
            {
              letterSpacing: 3,
              fragments: [
                { content: 'He', color: '#00FF00', fontSize: 12 },
                { content: 'llo', color: '#000000' },
              ],
            },
            { content: ', ', color: '#FF0000' },
            { content: 'World!', color: '#0000FF' },
          ],
        },
      ],
    },
  ],
})

pdf.save('download.pdf')
```
