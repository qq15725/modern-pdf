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
import { Pdf } from 'modern-pdf'

const pdf = new Pdf({
  // colorSpace: 'cmyk',
  pages: [
    {
      width: 300,
      height: 600,
      children: [
        {
          type: 'image',
          src: '/test.jpg',
          style: {
            rotate: 60,
            width: 50,
            height: 50,
          },
        },
        {
          type: 'text',
          content: 'test',
          style: {
            rotate: 90,
            left: 100,
            top: 100,
            fontSize: 20,
            color: '#FF00FF',
          },
        },
      ],
    },
  ],
})

pdf.save('download.pdf')
```
