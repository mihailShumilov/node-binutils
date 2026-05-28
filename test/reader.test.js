var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');
var BinaryReader = binutils.BinaryReader;

function reader(arr, endian) {
    return new BinaryReader(Buffer.from(arr), endian);
}

test('BinaryReader: constructor defaults', function() {
    var r = reader([1, 2, 3]);
    assert.equal(r.Endianness, 'big', 'defaults to big-endian');
    assert.equal(r.Encoding, 'ascii', 'defaults to ascii encoding');
    assert.equal(r.Length, 3, 'Length is the original buffer length');
    assert.equal(r.Position, 0, 'Position starts at 0');
    assert.equal(r.ByteBuffer.length, 3);
});

test('BinaryReader: ReadUInt8', function() {
    var r = reader([200, 5]);
    assert.equal(r.ReadUInt8(), 200);
    assert.equal(r.ReadUInt8(), 5);
});

test('BinaryReader: ReadInt8 (signed)', function() {
    var r = reader([0xFF, 0x80, 0x7F]);
    assert.equal(r.ReadInt8(), -1);
    assert.equal(r.ReadInt8(), -128);
    assert.equal(r.ReadInt8(), 127);
});

test('BinaryReader: ReadUInt16 honors endianness', function() {
    assert.equal(reader([0x12, 0x34], 'big').ReadUInt16(), 0x1234);
    assert.equal(reader([0x12, 0x34], 'little').ReadUInt16(), 0x3412);
});

test('BinaryReader: ReadInt16 (signed)', function() {
    assert.equal(reader([0xFF, 0xFF], 'big').ReadInt16(), -1);
    assert.equal(reader([0x80, 0x00], 'big').ReadInt16(), -32768);
    assert.equal(reader([0x00, 0x80], 'little').ReadInt16(), -32768);
});

test('BinaryReader: ReadUInt32 honors endianness', function() {
    assert.equal(reader([0x12, 0x34, 0x56, 0x78], 'big').ReadUInt32(), 0x12345678);
    assert.equal(reader([0x78, 0x56, 0x34, 0x12], 'little').ReadUInt32(), 0x12345678);
});

test('BinaryReader: ReadInt32 (signed)', function() {
    assert.equal(reader([0xFF, 0xFF, 0xFF, 0xFF], 'big').ReadInt32(), -1);
    assert.equal(reader([0x80, 0x00, 0x00, 0x00], 'big').ReadInt32(), -2147483648);
});

test('BinaryReader: ReadUInt64 returns a BigInt', function() {
    var r = reader([0, 0, 0, 0, 0, 0, 0, 5], 'big');
    var v = r.ReadUInt64();
    assert.equal(typeof v, 'bigint');
    assert.equal(v, 5n);
    assert.equal(reader([5, 0, 0, 0, 0, 0, 0, 0], 'little').ReadUInt64(), 5n);
});

test('BinaryReader: ReadInt64 returns a signed BigInt', function() {
    assert.equal(reader([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], 'big').ReadInt64(), -1n);
});

test('BinaryReader: ReadFloat', function() {
    // 1.5 as IEEE-754 single precision = 0x3FC00000
    assert.equal(reader([0x3F, 0xC0, 0x00, 0x00], 'big').ReadFloat(), 1.5);
    assert.equal(reader([0x00, 0x00, 0xC0, 0x3F], 'little').ReadFloat(), 1.5);
});

test('BinaryReader: ReadDouble', function() {
    // 1.5 as IEEE-754 double precision = 0x3FF8000000000000
    assert.equal(reader([0x3F, 0xF8, 0, 0, 0, 0, 0, 0], 'big').ReadDouble(), 1.5);
});

test('BinaryReader: ReadBytes returns a Buffer of the requested length', function() {
    var r = reader([1, 2, 3, 4, 5, 6]);
    var out = r.ReadBytes(4);
    assert.ok(Buffer.isBuffer(out));
    assert.deepEqual(Array.from(out), [1, 2, 3, 4]);
    assert.equal(r.Position, 4);
    assert.equal(r.ByteBuffer.length, 2);
});

test('BinaryReader: Position advances and Length stays constant; ByteBuffer shrinks', function() {
    var r = reader([1, 2, 3, 4, 5, 6, 7, 8], 'big');

    assert.equal(r.ReadUInt8(), 1);
    assert.equal(r.Position, 1);
    assert.equal(r.Length, 8, 'Length never changes on reads');
    assert.equal(r.ByteBuffer.length, 7, 'ByteBuffer shrinks by consumed bytes');

    assert.equal(r.ReadUInt16(), 0x0203);
    assert.equal(r.Position, 3);
    assert.equal(r.ByteBuffer.length, 5);

    assert.equal(r.ReadUInt32(), 0x04050607);
    assert.equal(r.Position, 7);
    assert.equal(r.ByteBuffer.length, 1);
});

test('BinaryReader: same bytes decode differently per endianness', function() {
    var b = [0x00, 0x00, 0x00, 0x01];
    assert.equal(reader(b, 'big').ReadUInt32(), 1);
    assert.equal(reader(b, 'little').ReadUInt32(), 0x01000000);
});
