# UTF-16 BOM Handler

Detect, add, and remove UTF-16 byte order marks, and convert between UTF-16LE and UTF-16BE byte streams. All functions operate on `Uint8Array` (raw bytes) — they never touch `string`, because BOM handling is a byte-layer concern.

```js
import { hasBom, detectBom, addBom, removeBom, leToBe, beToLe } from './src/index.js';

const le = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]); // UTF-16LE "AB"

hasBom(le);                       // true
detectBom(le);                    // 'utf-16le'

const be = leToBe(le);            // Uint8Array [0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]
detectBom(be);                    // 'utf-16be'

const plain = removeBom(le);      // Uint8Array [0x41, 0x00, 0x42, 0x00]
const remarked = addBom(plain, 'utf-16be');
```

## Why this exists

When you move UTF-16 text between systems that disagree about endianness — a Windows file saved as UTF-16LE read by a BE-leaning parser, or vice versa — the BOM is the only honest signal of which byte order the payload uses. Doing the swap correctly means touching bytes, not code points, and keeping the BOM in step with the payload. This library does exactly that and nothing else: it is a small set of pure functions with no dependencies and no opinions about encodings outside UTF-16.

The trade-off: `leToBe` and `beToLe` always emit a BOM on the output. If you need the payload unmarked afterwards, call `removeBom` on the result. We chose always-marked output over an option flag so the two functions have one behaviour each.

## Edge cases worth knowing

- Buffers shorter than two bytes are treated as having no BOM. `detectBom` returns `null` rather than throwing.
- `swapByteOrder` on a buffer with an odd length preserves the trailing byte verbatim — a lone byte cannot form a code unit, so there is nothing to swap. This matches what tolerant decoders do.
- `addBom` called on data that already carries the opposite BOM will replace that opposite BOM rather than stack a second one. The assumption is that if you ask to mark data as LE, the payload bytes are already LE; a pre-existing BE mark would be contradictory and is overwritten.

## Exports

`isUtf16LeBom(data)`, `isUtf16BeBom(data)`, `hasBom(data)`, `detectBom(data)`, `addBom(data, bom)`, `removeBom(data)`, `swapByteOrder(data)`, `leToBe(data)`, `beToLe(data)` — every function takes a `Uint8Array` and returns a `Uint8Array` (or, for the detectors, a boolean / `'utf-16le' | 'utf-16be' | null`).

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

