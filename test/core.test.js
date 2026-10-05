import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  hasBom,
  isUtf16LeBom,
  isUtf16BeBom,
  detectBom,
  addBom,
  removeBom,
  swapByteOrder,
  leToBe,
  beToLe,
} from '../src/index.js';

const LE = new Uint8Array([0xff, 0xfe]);
const BE = new Uint8Array([0xfe, 0xff]);

// "AB" in UTF-16 code units: 0x0041 0x0042.
const LE_BODY = new Uint8Array([0x41, 0x00, 0x42, 0x00]); // UTF-16LE body
const BE_BODY = new Uint8Array([0x00, 0x41, 0x00, 0x42]); // UTF-16BE body

function concat(...parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

test('isUtf16LeBom recognises the LE BOM', () => {
  assert.equal(isUtf16LeBom(concat(LE, LE_BODY)), true);
});

test('isUtf16LeBom rejects the BE BOM', () => {
  assert.equal(isUtf16LeBom(concat(BE, BE_BODY)), false);
});

test('isUtf16BeBom recognises the BE BOM', () => {
  assert.equal(isUtf16BeBom(concat(BE, BE_BODY)), true);
});

test('hasBom is true for either BOM and false without one', () => {
  assert.equal(hasBom(concat(LE, LE_BODY)), true);
  assert.equal(hasBom(concat(BE, BE_BODY)), true);
  assert.equal(hasBom(LE_BODY), false);
});

test('empty and single-byte buffers have no BOM', () => {
  assert.equal(hasBom(new Uint8Array(0)), false);
  assert.equal(hasBom(new Uint8Array([0xff])), false);
  assert.equal(detectBom(new Uint8Array(0)), null);
  assert.equal(detectBom(new Uint8Array([0xff])), null);
});

test('detectBom returns the encoding name or null', () => {
  assert.equal(detectBom(concat(LE, LE_BODY)), 'utf-16le');
  assert.equal(detectBom(concat(BE, BE_BODY)), 'utf-16be');
  assert.equal(detectBom(LE_BODY), null);
});

test('addBom prepends the requested BOM to unmarked data', () => {
  const out = addBom(LE_BODY, 'utf-16le');
  assert.deepEqual(Array.from(out), [0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
});

test('addBom does not duplicate an identical existing BOM', () => {
  const input = concat(LE, LE_BODY);
  const out = addBom(input, 'utf-16le');
  assert.deepEqual(Array.from(out), [0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
});

test('addBom replaces an opposite BOM', () => {
  const input = concat(BE, BE_BODY);
  const out = addBom(input, 'utf-16le');
  assert.deepEqual(Array.from(out), [0xff, 0xfe, 0x00, 0x41, 0x00, 0x42]);
});

test('addBom rejects an unknown bom kind', () => {
  assert.throws(() => addBom(LE_BODY, 'utf-8'), RangeError);
});

test('removeBom strips either BOM', () => {
  assert.deepEqual(Array.from(removeBom(concat(LE, LE_BODY))), [0x41, 0x00, 0x42, 0x00]);
  assert.deepEqual(Array.from(removeBom(concat(BE, BE_BODY))), [0x00, 0x41, 0x00, 0x42]);
});

test('removeBom leaves unmarked data intact', () => {
  assert.deepEqual(Array.from(removeBom(LE_BODY)), [0x41, 0x00, 0x42, 0x00]);
});

test('swapByteOrder turns LE bytes into BE bytes, BOM included', () => {
  const swapped = swapByteOrder(concat(LE, LE_BODY));
  assert.deepEqual(Array.from(swapped), [0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]);
});

test('swapByteOrder is its own inverse', () => {
  const original = concat(LE, LE_BODY);
  const round = swapByteOrder(swapByteOrder(original));
  assert.deepEqual(Array.from(round), Array.from(original));
});

test('swapByteOrder preserves a trailing odd byte', () => {
  const odd = new Uint8Array([0x41, 0x00, 0x99]);
  assert.deepEqual(Array.from(swapByteOrder(odd)), [0x00, 0x41, 0x99]);
});

test('leToBe converts an LE-marked stream to a BE-marked stream', () => {
  const out = leToBe(concat(LE, LE_BODY));
  assert.equal(isUtf16BeBom(out), true);
  assert.deepEqual(Array.from(out), [0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]);
});

test('beToLe converts a BE-marked stream to an LE-marked stream', () => {
  const out = beToLe(concat(BE, BE_BODY));
  assert.equal(isUtf16LeBom(out), true);
  assert.deepEqual(Array.from(out), [0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
});

test('leToBe on unmarked LE data adds the BE BOM', () => {
  const out = leToBe(LE_BODY);
  assert.equal(isUtf16BeBom(out), true);
});

test('functions reject non-Uint8Array input', () => {
  assert.throws(() => hasBom([0xff, 0xfe]), TypeError);
  assert.throws(() => addBom('abc', 'utf-16le'), TypeError);
  assert.throws(() => swapByteOrder(null), TypeError);
});
