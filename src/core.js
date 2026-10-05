/**
 * UTF-16 BOM Handler — detect, add, and remove byte order marks,
 * and convert between UTF-16LE and UTF-16BE byte streams.
 *
 * All functions operate on `Uint8Array` (raw bytes). We deliberately do
 * NOT accept or return `string`: the whole point of handling a BOM is to
 * work at the byte layer where you can see the mark, so we stay there.
 */

const BOM_LE_U8 = new Uint8Array([0xff, 0xfe]);
const BOM_BE_U8 = new Uint8Array([0xfe, 0xff]);

/**
 * Compare two 2-byte prefixes for equality. Centralised so every call
 * uses identical semantics — avoiding subtle per-site copy mistakes.
 *
 * Returns false when `data` has fewer than two bytes; an empty or
 * single-byte buffer cannot carry a BOM.
 */
function prefixEquals(data, prefix) {
  if (data.length < 2) return false;
  return data[0] === prefix[0] && data[1] === prefix[1];
}

/**
 * True when `data` begins with the UTF-16LE BOM (0xFF 0xFE).
 */
export function isUtf16LeBom(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('isUtf16LeBom: expected a Uint8Array');
  }
  return prefixEquals(data, BOM_LE_U8);
}

/**
 * True when `data` begins with the UTF-16BE BOM (0xFE 0xFF).
 */
export function isUtf16BeBom(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('isUtf16BeBom: expected a Uint8Array');
  }
  return prefixEquals(data, BOM_BE_U8);
}

/**
 * True when `data` begins with either the UTF-16LE or UTF-16BE BOM.
 */
export function hasBom(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('hasBom: expected a Uint8Array');
  }
  return isUtf16LeBom(data) || isUtf16BeBom(data);
}

/**
 * Describe the BOM at the start of `data`.
 *
 * Returns 'utf-16le', 'utf-16be', or null.
 *
 * We intentionally return null rather than throwing for unmarked data,
 * because the common caller pattern is "if detectBom(data) is null,
 * assume a default endianness" — that assumption is the caller's
 * decision to make, not ours.
 */
export function detectBom(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('detectBom: expected a Uint8Array');
  }
  if (isUtf16LeBom(data)) return 'utf-16le';
  if (isUtf16BeBom(data)) return 'utf-16be';
  return null;
}

/**
 * Prepend the requested BOM to a copy of `data`.
 *
 * If the data already begins with the same BOM, a fresh copy is returned
 * unchanged (we do not stack duplicates). If it begins with the opposite
 * BOM, that opposite BOM is replaced — adding a BOM implies the bytes
 * are already in the requested endianness; an existing opposite BOM
 * would be a contradictory mark and is overwritten.
 *
 * `bom` is 'utf-16le' or 'utf-16be'. Any other value throws.
 */
export function addBom(data, bom) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('addBom: expected a Uint8Array');
  }
  const prefix = bom === 'utf-16le' ? BOM_LE_U8 : bom === 'utf-16be' ? BOM_BE_U8 : null;
  if (!prefix) throw new RangeError(`addBom: unknown bom '${bom}'`);

  const hasExisting = hasBom(data);
  const sameExisting =
    (bom === 'utf-16le' && isUtf16LeBom(data)) ||
    (bom === 'utf-16be' && isUtf16BeBom(data));

  if (hasExisting && sameExisting) {
    // Already marked the way we want; return a clean copy.
    return new Uint8Array(data);
  }

  const start = hasExisting ? 2 : 0; // drop an opposite BOM if present
  const out = new Uint8Array(2 + data.length - start);
  out[0] = prefix[0];
  out[1] = prefix[1];
  out.set(data.subarray(start), 2);
  return out;
}

/**
 * Return a copy of `data` with a leading BOM (either kind) removed.
 *
 * If no BOM is present, returns a clean copy unchanged.
 */
export function removeBom(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('removeBom: expected a Uint8Array');
  }
  if (hasBom(data)) {
    return new Uint8Array(data.subarray(2));
  }
  return new Uint8Array(data);
}

/**
 * Swap the byte order of every code unit in a UTF-16 byte stream.
 *
 * `data` is interpreted as a sequence of 16-bit code units. If the length
 * is odd, the final trailing byte is preserved untouched (a complete
 * code unit cannot be formed from it, so there is nothing meaningful to
 * swap). This mirrors what real-world tolerant decoders do.
 *
 * A leading BOM, if present, is also swapped — so swapping UTF-16LE bytes
 * yields UTF-16BE bytes and vice versa, BOM included. If you want the BOM
 * gone afterwards, call `removeBom` on the result.
 */
export function swapByteOrder(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('swapByteOrder: expected a Uint8Array');
  }
  const out = new Uint8Array(data.length);
  const pairCount = data.length >> 1; // floor(length / 2)
  for (let i = 0; i < pairCount; i++) {
    const lo = i * 2;
    out[lo] = data[lo + 1];
    out[lo + 1] = data[lo];
  }
  if (data.length & 1) {
    // Odd tail: copy the lone byte verbatim.
    out[data.length - 1] = data[data.length - 1];
  }
  return out;
}

/**
 * Convert a UTF-16LE byte stream (BOM optional) to UTF-16BE bytes.
 *
 * The output carries the UTF-16BE BOM. If the input had a UTF-16LE BOM it
 * is consumed as part of the swap; if the input was unmarked, the LE BOM
 * is still added on output so the result is unambiguously BE.
 */
export function leToBe(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('leToBe: expected a Uint8Array');
  }
  return addBom(swapByteOrder(data), 'utf-16be');
}

/**
 * Convert a UTF-16BE byte stream (BOM optional) to UTF-16LE bytes.
 *
 * Symmetric with `leToBe`: the output carries the UTF-16LE BOM.
 */
export function beToLe(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('beToLe: expected a Uint8Array');
  }
  return addBom(swapByteOrder(data), 'utf-16le');
}
