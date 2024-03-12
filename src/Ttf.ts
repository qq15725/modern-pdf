import { unzlibSync } from 'fflate'

export class Ttf {
  constructor(
    public data: DataView,
  ) {
    //
  }

  protected _createReader(uint8Array: Uint8Array) {
    const dataView = new DataView(uint8Array.buffer)
    let cursor = 0

    const getCursor = () => cursor
    const setCursor = (value: number) => cursor = value
    const readBytes = (length: number): Uint8Array => uint8Array.subarray(cursor, cursor += length)
    const readString = (length: number): string => Array.from(readBytes(length)).map(val => String.fromCharCode(val)).join('')
    const readUInt8BE = (): number => uint8Array[cursor++]
    const readInt16BE = (): number => [dataView.getInt16(cursor, false), cursor += 2][0]
    const readUInt24BE = (): number => {
      const [i, j, k] = readBytes(3)
      return (i << 16) + (j << 8) + k
    }
    const readUInt16BE = (): number => [dataView.getUint16(cursor, false), cursor += 2][0]
    const readUInt32BE = (): number => [dataView.getUint32(cursor, false), cursor += 4][0]
    const readFixed = (): number => Math.ceil(readUInt32BE() / 65536.0 * 100000) / 100000
    const readLongDateTime = (): number => [readUInt32BE(), readUInt32BE()][1]

    return {
      getCursor,
      setCursor,

      readBytes,
      readString,
      readUInt8BE,
      readInt16BE,
      readUInt16BE,
      readUInt24BE,
      readUInt32BE,
      readFixed,
      readLongDateTime,
    }
  }

  protected _readCmap(uint8Array: Uint8Array, numGlyphs: number) {
    const { getCursor, setCursor, readUInt8BE, readUInt16BE, readUInt24BE, readUInt32BE } = this._createReader(uint8Array)

    const cmapCursor = getCursor()
    readUInt16BE() // version
    const numberSubtables = readUInt16BE()

    const tables = [...new Array(numberSubtables)]
      .map(() => ({
        platformID: readUInt16BE(),
        encodingID: readUInt16BE(),
        offset: readUInt32BE(),
      }))
      .map((table: Record<string, any>) => {
        const startOffset = cmapCursor + table.offset

        setCursor(startOffset)

        table.format = readUInt16BE()

        if (table.format === 0) {
          table.length = readUInt16BE()
          table.language = readUInt16BE()
          table.glyphIdArray = [...new Array(table.length - 6)].map(readUInt8BE)
        } else if (table.format === 2) {
          table.length = readUInt16BE()
          table.language = readUInt16BE()
          const subHeadKeys = []
          let maxSubHeadKey = 0
          let maxPos = -1
          for (let i = 0, l = 256; i < l; i++) {
            subHeadKeys[i] = readUInt16BE() / 8
            if (subHeadKeys[i] > maxSubHeadKey) {
              maxSubHeadKey = subHeadKeys[i]
              maxPos = i
            }
          }
          const subHeads = []
          for (let i = 0; i <= maxSubHeadKey; i++) {
            subHeads[i] = {
              firstCode: readUInt16BE(),
              entryCount: readUInt16BE(),
              idDelta: readUInt16BE(),
              idRangeOffset: (readUInt16BE() - (maxSubHeadKey - i) * 8 - 2) / 2,
            }
          }
          const glyphCount = (startOffset + table.length - getCursor()) / 2
          table.subHeadKeys = subHeadKeys
          table.maxPos = maxPos
          table.subHeads = subHeads
          table.glyphs = [...new Array(glyphCount)].map(readUInt16BE)
        } else if (table.format === 4) {
          table.length = readUInt16BE()
          table.language = readUInt16BE()
          table.segCountX2 = readUInt16BE()
          table.searchRange = readUInt16BE()
          table.entrySelector = readUInt16BE()
          table.rangeShift = readUInt16BE()
          const segCount = table.segCountX2 / 2
          table.endCode = [...new Array(segCount)].map(readUInt16BE)
          table.reservedPad = readUInt16BE()
          table.startCode = [...new Array(segCount)].map(readUInt16BE)
          table.idDelta = [...new Array(segCount)].map(readUInt16BE)
          table.idRangeOffsetCursor = getCursor()
          table.idRangeOffset = [...new Array(segCount)].map(readUInt16BE)
          const glyphCount = (table.length - (getCursor() - startOffset)) / 2
          table.glyphIdArrayCursor = getCursor()
          table.glyphIdArray = [...new Array(glyphCount)].map(readUInt16BE)
        } else if (table.format === 6) {
          table.length = readUInt16BE()
          table.language = readUInt16BE()
          table.firstCode = readUInt16BE()
          table.entryCount = readUInt16BE()
          table.glyphIdArrayCursor = getCursor()
          table.glyphIdArray = [...new Array(table.entryCount)].map(readUInt16BE)
        } else if (table.format === 12) {
          table.reserved = readUInt16BE()
          table.length = readUInt32BE()
          table.language = readUInt32BE()
          table.nGroups = readUInt32BE()
          const groups: Record<string, any>[] = []
          const nGroups = table.nGroups
          for (let i = 0; i < nGroups; ++i) {
            const group: Record<string, any> = {}
            group.start = readUInt32BE()
            group.end = readUInt32BE()
            group.startId = readUInt32BE()
            groups.push(group)
          }
          table.groups = groups
        } else if (table.format === 14) {
          table.length = readUInt32BE()
          const numVarSelectorRecords = readUInt32BE()
          const groups = []
          let offset = getCursor()
          for (let i = 0; i < numVarSelectorRecords; i++) {
            setCursor(offset)
            const varSelector = readUInt24BE()
            const defaultUVSOffset = readUInt32BE()
            const nonDefaultUVSOffset = readUInt32BE()
            offset += 11

            if (defaultUVSOffset) {
              setCursor(startOffset + defaultUVSOffset)
              const numUnicodeValueRanges = readUInt32BE()
              for (let j = 0; j < numUnicodeValueRanges; j++) {
                const startUnicode = readUInt24BE()
                const additionalCount = readUInt8BE()
                groups.push({
                  start: startUnicode,
                  end: startUnicode + additionalCount,
                  varSelector,
                })
              }
            }
            if (nonDefaultUVSOffset) {
              setCursor(startOffset + nonDefaultUVSOffset)
              const numUVSMappings = readUInt32BE()
              for (let j = 0; j < numUVSMappings; j++) {
                const unicode = readUInt24BE()
                const glyphId = readUInt16BE()
                groups.push({
                  unicode,
                  glyphId,
                  varSelector,
                })
              }
            }
          }
          table.groups = groups
        }

        return table
      })

    const format0 = tables.find(item => item.format === 0)
    const format12 = tables.find(item => item.platformID === 3 && item.encodingID === 10 && item.format === 12)
    const format4 = tables.find(item => item.platformID === 3 && item.encodingID === 1 && item.format === 4)
    const format2 = tables.find(item => item.platformID === 3 && item.encodingID === 3 && item.format === 2)
    const format14 = tables.find(item => item.platformID === 0 && item.encodingID === 5 && item.format === 14)
    const unicodeGlyphIdMap: Record<number, number> = {}

    if (format0) {
      for (let i = 0, l = format0.glyphIdArray.length; i < l; i++) {
        if (format0.glyphIdArray[i]) {
          unicodeGlyphIdMap[i] = format0.glyphIdArray[i]
        }
      }
    }

    if (format14) {
      for (let i = 0, l = format14.groups.length; i < l; i++) {
        const { unicode, glyphId } = format14.groups[i]
        if (unicode) {
          unicodeGlyphIdMap[unicode] = glyphId
        }
      }
    }

    if (format12) {
      for (let i = 0, l = format12.nGroups; i < l; i++) {
        const group = format12.groups[i]
        let startId = group.startId
        let start = group.start
        const end = group.end
        for (;start <= end;) {
          unicodeGlyphIdMap[start++] = startId++
        }
      }
    } else if (format4) {
      const segCount = format4.segCountX2 / 2
      const graphIdArrayIndexOffset = (format4.glyphIdArrayCursor - format4.idRangeOffsetCursor) / 2

      for (let i = 0; i < segCount; ++i) {
        for (let start = format4.startCode[i], end = format4.endCode[i]; start <= end; ++start) {
          if (format4.idRangeOffset[i] === 0) {
            unicodeGlyphIdMap[start] = (start + format4.idDelta[i]) % 0x10000
          } else {
            const index = i + format4.idRangeOffset[i] / 2
              + (start - format4.startCode[i])
              - graphIdArrayIndexOffset

            const graphId = format4.glyphIdArray[index]
            if (graphId !== 0) {
              unicodeGlyphIdMap[start] = (graphId + format4.idDelta[i]) % 0x10000
            } else {
              unicodeGlyphIdMap[start] = 0
            }
          }
        }
      }

      delete unicodeGlyphIdMap[65535]
    } else if (format2) {
      const subHeadKeys = format2.subHeadKeys
      const subHeads = format2.subHeads
      const glyphs = format2.glyphs
      let index = 0
      for (let i = 0; i < 256; i++) {
        if (subHeadKeys[i] === 0) {
          if (i >= format2.maxPos) {
            index = 0
          } else if (i < subHeads[0].firstCode
            || i >= subHeads[0].firstCode + subHeads[0].entryCount
            || subHeads[0].idRangeOffset + (i - subHeads[0].firstCode) >= glyphs.length) {
            index = 0
            // eslint-disable-next-line no-cond-assign
          } else if ((index = glyphs[subHeads[0].idRangeOffset + (i - subHeads[0].firstCode)]) !== 0) {
            index = index + subHeads[0].idDelta
          }
          if (index !== 0 && index < numGlyphs) {
            unicodeGlyphIdMap[i] = index
          }
        } else {
          const k = subHeadKeys[i]
          for (let j = 0, entryCount = subHeads[k].entryCount; j < entryCount; j++) {
            if (subHeads[k].idRangeOffset + j >= glyphs.length) {
              index = 0
              // eslint-disable-next-line no-cond-assign
            } else if ((index = glyphs[subHeads[k].idRangeOffset + j]) !== 0) {
              index = index + subHeads[k].idDelta
            }

            if (index !== 0 && index < numGlyphs) {
              const unicode = ((i << 8) | (j + subHeads[k].firstCode)) % 0xFFFF
              unicodeGlyphIdMap[unicode] = index
            }
          }
        }
      }
    }

    return unicodeGlyphIdMap
  }

  parse() {
    const data = this.data
    const signature = String.fromCharCode(...Array.from({ length: 4 }, (_, i) => data.getUint8(i)))
    const tables = new Map<string, DataView>()

    switch (signature) {
      case '\x00\x01\x00\x00':
      case 'OTTO': {
        for (let len = data.getUint16(4, false), i = 0; i < len; i++) {
          const entryOffset = 12 + i * 16
          const tag = String.fromCharCode(...Array.from({ length: 4 }, (_, i) => data.getUint8(entryOffset + i)))
          const offset = data.getUint32(entryOffset + 8, false)
          const length = data.getUint32(entryOffset + 12, false)
          const end = offset + length
          tables.set(tag, new DataView(data.buffer.slice(offset, end)))
        }
        break
      }
      case 'wOFF': {
        for (let len = data.getUint16(12, false), i = 0; i < len; i++) {
          const entryOffset = 44 + i * 20
          const tag = String.fromCharCode(...Array.from({ length: 4 }, (_, i) => data.getUint8(entryOffset + i)))
          const offset = data.getUint32(entryOffset + 4, false)
          const compLength = data.getUint32(entryOffset + 8, false)
          const origLength = data.getUint32(entryOffset + 12, false)
          const end = offset + compLength
          if (compLength >= origLength) {
            tables.set(tag, new DataView(data.buffer.slice(offset, end)))
          } else {
            tables.set(tag, new DataView(unzlibSync(new Uint8Array(data.buffer.slice(offset, end))).buffer))
          }
        }
        break
      }
    }

    // maxp
    const maxp = tables.get('maxp')!
    const numGlyphs = maxp.getUint16(4, false)

    // head
    const head = tables.get('head')!
    const unitsPerEm = head.getInt16(18, false)
    const xMin = head.getInt16(36, false)
    const yMin = head.getInt16(38, false)
    const xMax = head.getInt16(40, false)
    const yMax = head.getInt16(42, false)

    // hhea
    const hhea = tables.get('hhea')!
    const ascent = hhea.getInt16(4, false)
    const descent = hhea.getInt16(6, false)
    const numOfLongHorMetrics = hhea.getUint16(34, false)

    // OS/2
    const os2 = tables.get('OS/2')
    const version = os2?.getUint16(0, false) ?? 0
    const sFamilyClass = (os2?.getInt16(30, false) ?? 0) >> 8
    const sCapHeight = version > 1
      ? os2!.getInt16(88, false)
      : ascent

    // post
    const post = tables.get('post')
    const italicAngle = post?.getInt32(4, false) ?? 0
    const isFixedPitch = post?.getInt32(12, false) ?? 0

    // hmtx
    const hmtx = tables.get('hmtx')
    let advanceWidth = 0
    let hmtxOffset = 0
    const hMetrics = Array.from({ length: numGlyphs }).map((_, i) => {
      if (i < numOfLongHorMetrics) {
        advanceWidth = hmtx?.getUint16(hmtxOffset, false) ?? 0
        hmtxOffset += 2
      }
      const hMetric = {
        advanceWidth,
        leftSideBearing: hmtx?.getInt16(hmtxOffset, false) ?? 0,
      }
      hmtxOffset += 2
      return hMetric
    })

    const cmap = tables.get('cmap')!
    const unicodeGlyphIdMap = this._readCmap(new Uint8Array(cmap.buffer), numGlyphs)

    const scaleFactor = 1000.0 / unitsPerEm
    const isSerif = [1, 2, 3, 4, 5, 7].includes(sFamilyClass)
    const isScript = sFamilyClass === 10
    let flags = 0
    if (isFixedPitch) flags |= 1 << 0
    if (isSerif) flags |= 1 << 1
    if (isScript) flags |= 1 << 3
    if (italicAngle !== 0) flags |= 1 << 6
    flags |= 1 << 5

    return {
      xMin: Math.round(xMin * scaleFactor),
      yMin: Math.round(yMin * scaleFactor),
      xMax: Math.round(xMax * scaleFactor),
      yMax: Math.round(yMax * scaleFactor),
      ascent: Math.round(ascent * scaleFactor),
      descent: Math.round(descent * scaleFactor),
      sCapHeight,
      italicAngle,
      unicodeGlyphIdMap,
      hMetrics: hMetrics.map(hMetric => {
        return {
          advanceWidth: Math.round(hMetric.advanceWidth * scaleFactor),
          leftSideBearing: Math.round(hMetric.leftSideBearing * scaleFactor),
        }
      }),
      flags,
      encode: () => {
        if (signature !== 'wOFF') {
          return this.data.buffer
        }

        const slice = [].slice

        function checksum(data: Uint8Array) {
          const newData = slice.call(data) as Array<number>
          while (newData.length % 4) newData.push(0)
          const tmp = new DataView(new ArrayBuffer(newData.length))
          let sum = 0
          for (let i = 0, len = newData.length / 4; i < len; i = i += 4) {
            sum += tmp.getUint32(i * 4, false)
          }
          return sum & 0xFFFFFFFF
        }

        const numTables = tables.size
        const headerByteLength = 12
        const tableHeadeByteLength = 16
        const tableHeaderByteLength = numTables * tableHeadeByteLength
        const log2 = Math.log(2)
        const searchRange = Math.floor(Math.log(numTables) / log2) * 16
        const entrySelector = Math.floor(searchRange / log2)
        const rangeShift = tableHeaderByteLength - searchRange
        let tableTotalLength = 0
        tables.forEach(table => tableTotalLength += Math.ceil(table.byteLength / 4) * 4)
        const textEncoder = new TextEncoder()
        const buffer = new ArrayBuffer(headerByteLength + tableHeaderByteLength + tableTotalLength)
        const uint8Array = new Uint8Array(buffer)
        const data = new DataView(buffer)
        data.setUint32(0, 0x00010000, false)
        data.setUint16(4, numTables, false)
        data.setUint16(6, searchRange, false)
        data.setUint16(8, entrySelector, false)
        data.setUint16(10, rangeShift, false)
        let offset = headerByteLength
        let headOffset = 0
        let dataOffset = headerByteLength + tableHeaderByteLength
        tables.forEach((table, tag) => {
          const tagArray = textEncoder.encode(tag)
          tagArray.forEach((val, i) => data.setUint8(offset + i, val))
          const tableUint8Array = new Uint8Array(table.buffer)
          data.setUint32(offset + 4, checksum(tableUint8Array), false)
          data.setUint32(offset + 8, dataOffset, false)
          data.setUint32(offset + 12, table.byteLength, false)
          offset += tableHeadeByteLength
          if (tag === 'head') headOffset = dataOffset
          uint8Array.set(tableUint8Array, dataOffset)
          dataOffset += table.byteLength
          while (dataOffset % 4) {
            dataOffset++
          }
        })
        data.setUint32(headOffset + 8, 0, false)
        data.setUint32(headOffset + 8, 0xB1B0AFBA - checksum(uint8Array), false)
        return buffer
      },
    }
  }
}
