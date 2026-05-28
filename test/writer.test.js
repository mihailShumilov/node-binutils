var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');
var BinaryWriter = binutils.BinaryWriter;

function bytes(writer) {
    return Array.from(writer.ByteBuffer);
}

test('BinaryWriter: constructor defaults', function() {
    var w = new BinaryWriter();
    assert.equal(w.Endianness, 'big');
    assert.equal(w.Encoding, 'ascii');
    assert.equal(w.Length, 0);
    assert.equal(w.ByteBuffer.length, 0);
});

test('BinaryWriter: WriteUInt8', function() {
    var w = new BinaryWriter();
    w.WriteUInt8(200);
    assert.deepEqual(bytes(w), [200]);
    assert.equal(w.Length, 1);
});

test('BinaryWriter: WriteInt8 (signed)', function() {
    var w = new BinaryWriter();
    w.WriteInt8(-1);
    assert.deepEqual(bytes(w), [0xFF]);
    assert.equal(w.Length, 1);
});

test('BinaryWriter: WriteUInt16 honors endianness', function() {
    var big = new BinaryWriter('big');
    big.WriteUInt16(0x1234);
    assert.deepEqual(bytes(big), [0x12, 0x34]);
    assert.equal(big.Length, 2);

    var little = new BinaryWriter('little');
    little.WriteUInt16(0x1234);
    assert.deepEqual(bytes(little), [0x34, 0x12]);
});

test('BinaryWriter: WriteUInt32 honors endianness', function() {
    var big = new BinaryWriter('big');
    big.WriteUInt32(0x12345678);
    assert.deepEqual(bytes(big), [0x12, 0x34, 0x56, 0x78]);
    assert.equal(big.Length, 4);

    var little = new BinaryWriter('little');
    little.WriteUInt32(0x12345678);
    assert.deepEqual(bytes(little), [0x78, 0x56, 0x34, 0x12]);
});

test('BinaryWriter: WriteInt16 / WriteInt32 (signed)', function() {
    var w16 = new BinaryWriter('big');
    w16.WriteInt16(-2);
    assert.deepEqual(bytes(w16), [0xFF, 0xFE]);

    var w32 = new BinaryWriter('little');
    w32.WriteInt32(-1);
    assert.deepEqual(bytes(w32), [0xFF, 0xFF, 0xFF, 0xFF]);
});

test('BinaryWriter: WriteFloat', function() {
    var big = new BinaryWriter('big');
    big.WriteFloat(1.5);
    assert.deepEqual(bytes(big), [0x3F, 0xC0, 0x00, 0x00]);
    assert.equal(big.Length, 4);

    var little = new BinaryWriter('little');
    little.WriteFloat(1.5);
    assert.deepEqual(bytes(little), [0x00, 0x00, 0xC0, 0x3F]);
});

test('BinaryWriter: WriteDouble', function() {
    var w = new BinaryWriter('big');
    w.WriteDouble(1.5);
    assert.deepEqual(bytes(w), [0x3F, 0xF8, 0, 0, 0, 0, 0, 0]);
    assert.equal(w.Length, 8);
});

test('BinaryWriter: WriteBytes accepts an array', function() {
    var w = new BinaryWriter();
    w.WriteBytes([1, 2, 3]);
    assert.deepEqual(bytes(w), [1, 2, 3]);
    assert.equal(w.Length, 3);
});

test('BinaryWriter: WriteBytes accepts a Buffer', function() {
    var w = new BinaryWriter();
    w.WriteBytes(Buffer.from([9, 8, 7]));
    assert.deepEqual(bytes(w), [9, 8, 7]);
    assert.equal(w.Length, 3);
});

test('BinaryWriter: WriteBytes accepts a string (per-char codes)', function() {
    var w = new BinaryWriter();
    w.WriteBytes('ABC');
    assert.deepEqual(bytes(w), [65, 66, 67]);
    assert.equal(w.Length, 3);
});

test('BinaryWriter: WriteBytes rejects non-Buffer/non-Array input', function() {
    assert.throws(function() { new BinaryWriter().WriteBytes(4); }, /Invalid Buffer object/);
    assert.throws(function() { new BinaryWriter().WriteBytes({}); }, /Invalid Buffer object/);
});

test('BinaryWriter: multiple writes accumulate and track Length', function() {
    var w = new BinaryWriter('big');
    w.WriteUInt8(1);
    w.WriteUInt16(0x0203);
    w.WriteUInt32(0x04050607);
    assert.deepEqual(bytes(w), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(w.Length, 7);
});
