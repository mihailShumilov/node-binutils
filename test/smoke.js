// Dependency-free smoke test for old Node.js versions (12+) that lack node:test.
// CI runs it with `node test/smoke.js`; `node --test` also picks it up.
'use strict';

var assert = require('assert');
var binutils = require('../binutils.js');

var w = new binutils.BinaryWriter('little', 'utf8');
w.WriteUInt8(1);
w.WriteInt16(-2);
w.WriteUInt32(0xDEADBEEF);
w.WriteUInt64(BigInt('18446744073709551615'));
w.WriteInt64(-5);
w.WriteFloat(1.5);
w.WriteDouble(Math.PI);
w.WriteBoolean(true);
w.WriteBytes(new Uint8Array([7, 8]));
w.WriteString('hé');
w.WriteCString('id');
w.WriteVarUInt32(300);
w.WriteVarInt64(BigInt(-1));

var r = new binutils.BinaryReader(w.ByteBuffer, 'little', 'utf8');
assert.strictEqual(r.PeekUInt8(), 1);
assert.strictEqual(r.ReadUInt8(), 1);
assert.strictEqual(r.ReadInt16(), -2);
assert.strictEqual(r.ReadUInt32(), 0xDEADBEEF);
assert.strictEqual(r.ReadUInt64(), BigInt('18446744073709551615'));
assert.strictEqual(r.ReadInt64(), BigInt(-5));
assert.strictEqual(r.ReadFloat(), 1.5);
assert.strictEqual(r.ReadDouble(), Math.PI);
assert.strictEqual(r.ReadBoolean(), true);
assert.deepStrictEqual(r.ReadBytes(2), Buffer.from([7, 8]));
assert.strictEqual(r.ReadString(3), 'hé');
assert.strictEqual(r.ReadCString(), 'id');
assert.strictEqual(r.ReadVarUInt32(), 300);
assert.strictEqual(r.ReadVarInt64(), BigInt(-1));
assert.strictEqual(r.Position, r.Length);
assert.strictEqual(r.ReadUInt32(), 0);

var s = new binutils.BinaryReader([1], 'big', 'ascii', { Strict: true });
assert.throws(function() { s.ReadUInt16(); }, RangeError);

console.log('smoke OK on Node ' + process.version);
