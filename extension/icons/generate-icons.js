// Run once: node generate-icons.js
// Generates simple blue square PNG icons for the extension.
const zlib = require('zlib')
const fs = require('fs')

function createPNG(size) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    // CRC32 over type + data
    const crcBuf = crc32(Buffer.concat([t, data]))
    const crcOut = Buffer.alloc(4)
    crcOut.writeUInt32BE(crcBuf)
    return Buffer.concat([len, t, data, crcOut])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB
  // bytes 10-12 are 0

  // Raw scanlines: filter byte (0) + RGB pixels
  const raw = []
  for (let y = 0; y < size; y++) {
    raw.push(0) // filter None
    for (let x = 0; x < size; x++) {
      raw.push(10, 102, 194) // #0a66c2 (LinkedIn blue)
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw))

  const iend = Buffer.alloc(0)

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', iend)])
}

// CRC32 lookup table
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ -1) >>> 0
}

for (const size of [16, 48, 128]) {
  fs.writeFileSync(`icon${size}.png`, createPNG(size))
  console.log(`icon${size}.png written`)
}
