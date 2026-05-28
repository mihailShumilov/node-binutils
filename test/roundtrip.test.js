var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');
var BinaryReader = binutils.BinaryReader;
var BinaryWriter = binutils.BinaryWriter;

// Write a value with WriteMethod, then read it back with ReadMethod, asserting
// equality across both endiannesses.
function roundTrip(writeMethod, readMethod, value, compare) {
    ['big', 'little'].forEach(function(endian) {
        var w = new BinaryWriter(endian);
        w[writeMethod](value);
        var r = new BinaryReader(w.ByteBuffer, endian);
        var got = r[readMethod]();
        if (compare) {
            compare(got, value, endian);
        } else {
            assert.equal(got, value, writeMethod + '/' + readMethod + ' (' + endian + ')');
        }
    });
}

test('round-trip: UInt8', function() {
    roundTrip('WriteUInt8', 'ReadUInt8', 0);
    roundTrip('WriteUInt8', 'ReadUInt8', 200);
    roundTrip('WriteUInt8', 'ReadUInt8', 255);
});

test('round-trip: Int8', function() {
    roundTrip('WriteInt8', 'ReadInt8', -128);
    roundTrip('WriteInt8', 'ReadInt8', -1);
    roundTrip('WriteInt8', 'ReadInt8', 127);
});

test('round-trip: UInt16', function() {
    roundTrip('WriteUInt16', 'ReadUInt16', 0);
    roundTrip('WriteUInt16', 'ReadUInt16', 0xBEEF);
    roundTrip('WriteUInt16', 'ReadUInt16', 0xFFFF);
});

test('round-trip: Int16', function() {
    roundTrip('WriteInt16', 'ReadInt16', -32768);
    roundTrip('WriteInt16', 'ReadInt16', -1);
    roundTrip('WriteInt16', 'ReadInt16', 32767);
});

test('round-trip: UInt32', function() {
    roundTrip('WriteUInt32', 'ReadUInt32', 0);
    roundTrip('WriteUInt32', 'ReadUInt32', 0xDEADBEEF);
    roundTrip('WriteUInt32', 'ReadUInt32', 0xFFFFFFFF);
});

test('round-trip: Int32', function() {
    roundTrip('WriteInt32', 'ReadInt32', -2147483648);
    roundTrip('WriteInt32', 'ReadInt32', -1);
    roundTrip('WriteInt32', 'ReadInt32', 2147483647);
});

test('round-trip: Float (within single-precision tolerance)', function() {
    roundTrip('WriteFloat', 'ReadFloat', 1.5);
    roundTrip('WriteFloat', 'ReadFloat', 3.14, function(got, want, endian) {
        assert.ok(Math.abs(got - want) < 1e-5, 'Float ~3.14 (' + endian + '), got ' + got);
    });
});

test('round-trip: Double (exact)', function() {
    roundTrip('WriteDouble', 'ReadDouble', Math.PI);
    roundTrip('WriteDouble', 'ReadDouble', -123456.789);
});

test('round-trip: Bytes', function() {
    ['big', 'little'].forEach(function(endian) {
        var payload = [1, 2, 3, 4, 5];
        var w = new BinaryWriter(endian);
        w.WriteBytes(payload);
        var r = new BinaryReader(w.ByteBuffer, endian);
        assert.deepEqual(Array.from(r.ReadBytes(payload.length)), payload);
    });
});

// 64-bit round-trips. The writers accept a Number or a BigInt and emit all 8
// bytes; the reader always returns a BigInt.

test('round-trip: UInt64 (BigInt argument)', function() {
    var value = 0x1234567890ABCDEFn;
    ['big', 'little'].forEach(function(endian) {
        var w = new BinaryWriter(endian);
        w.WriteUInt64(value);
        var r = new BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadUInt64(), value);
    });
});

test('round-trip: UInt64 (Number argument is coerced)', function() {
    ['big', 'little'].forEach(function(endian) {
        var w = new BinaryWriter(endian);
        w.WriteUInt64(123);
        var r = new BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadUInt64(), 123n);
    });
});

test('round-trip: Int64 (BigInt argument)', function() {
    var value = -81985529216486896n;
    ['big', 'little'].forEach(function(endian) {
        var w = new BinaryWriter(endian);
        w.WriteInt64(value);
        var r = new BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadInt64(), value);
    });
});

test('round-trip: Int64 (negative Number argument is coerced)', function() {
    ['big', 'little'].forEach(function(endian) {
        var w = new BinaryWriter(endian);
        w.WriteInt64(-123);
        var r = new BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadInt64(), -123n);
    });
});
