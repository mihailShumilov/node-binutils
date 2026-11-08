var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

var BinaryReader = binutils.BinaryReader;
var BinaryWriter = binutils.BinaryWriter;

// --- Reader count validation ---

test('ReadBytes with an invalid count returns an empty Buffer without advancing', function() {
    [-1, NaN, 1.5, -Infinity, Infinity, undefined, null, '2', true].forEach(function(p_Count) {
        var r = new BinaryReader([1, 2, 3, 4]);
        var s_Val = r.ReadBytes(p_Count);
        assert.ok(Buffer.isBuffer(s_Val), 'count ' + String(p_Count));
        assert.equal(s_Val.length, 0, 'count ' + String(p_Count));
        assert.equal(r.Position, 0, 'count ' + String(p_Count));
        assert.equal(r.ByteBuffer.length, 4, 'count ' + String(p_Count));
    });
});

test('ReadBytes(0) returns an empty Buffer and does not advance', function() {
    var r = new BinaryReader([1, 2]);
    assert.equal(r.ReadBytes(0).length, 0);
    assert.equal(r.Position, 0);
});

test('ReadString with an invalid count returns an empty string without advancing', function() {
    [-1, NaN, 1.5, Infinity, undefined, null, '2', true].forEach(function(p_Count) {
        var r = new BinaryReader('abcd');
        assert.equal(r.ReadString(p_Count), '', 'count ' + String(p_Count));
        assert.equal(r.Position, 0, 'count ' + String(p_Count));
        assert.equal(r.ByteBuffer.length, 4, 'count ' + String(p_Count));
    });
});

// --- Constructor encoding / endianness ---

test('string input without an encoding uses the default ascii Encoding', function() {
    var r = new BinaryReader('é');
    assert.equal(r.Encoding, 'ascii');
    assert.equal(r.Length, 1);
    assert.deepEqual(r.ByteBuffer, Buffer.from([0xE9]));
});

test('string input honors an explicit encoding', function() {
    var r = new BinaryReader('é', 'big', 'utf8');
    assert.equal(r.Length, 2);
    assert.equal(r.ReadString(2), 'é');
    assert.deepEqual(new BinaryReader('0aff', 'big', 'hex').ByteBuffer, Buffer.from([0x0A, 0xFF]));
});

test('invalid endianness throws in both constructors', function() {
    ['LE', 'Little', 'le', 'little ', 'BE', 'x', 1].forEach(function(p_Endianness) {
        assert.throws(function() { new BinaryReader([1], p_Endianness); }, TypeError, String(p_Endianness));
        assert.throws(function() { new BinaryWriter(p_Endianness); }, TypeError, String(p_Endianness));
    });
});

test('missing or falsy endianness defaults to big', function() {
    [undefined, null, ''].forEach(function(p_Endianness) {
        assert.equal(new BinaryReader([1], p_Endianness).Endianness, 'big');
        assert.equal(new BinaryWriter(p_Endianness).Endianness, 'big');
    });
});

test('invalid encoding throws in both constructors, whatever the input type', function() {
    assert.throws(function() { new BinaryReader('abc', 'big', 'bogus'); }, TypeError);
    assert.throws(function() { new BinaryReader(Buffer.from('abc'), 'big', 'bogus'); }, TypeError);
    assert.throws(function() { new BinaryWriter('big', 'bogus'); }, TypeError);
});

test('Endianness and Encoding changed after construction apply to the next call', function() {
    var r = new BinaryReader([0x01, 0x00, 0x01, 0x00]);
    assert.equal(r.ReadUInt16(), 0x0100);
    r.Endianness = 'little';
    assert.equal(r.ReadUInt16(), 0x0001);

    var w = new BinaryWriter();
    w.Encoding = 'utf16le';
    w.WriteString('A');
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x41, 0x00]));
});

// --- Array input validation ---

test('array input with non-byte elements throws', function() {
    assert.throws(function() { new BinaryReader([300]); }, RangeError);
    assert.throws(function() { new BinaryReader([-1]); }, RangeError);
    assert.throws(function() { new BinaryReader([1.5]); }, TypeError);
    assert.throws(function() { new BinaryReader(['a']); }, TypeError);
    assert.throws(function() { new BinaryWriter().WriteBytes([256]); }, RangeError);
    assert.throws(function() { new BinaryWriter().WriteBytes([NaN]); }, TypeError);
    assert.throws(function() { new BinaryWriter().WriteBytes([{}]); }, TypeError);
});

// --- WriteBytes string path ---

test('WriteBytes(string) writes latin1 bytes and rejects characters above 0xFF', function() {
    var w = new BinaryWriter();
    w.WriteBytes('Aéÿ');
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x41, 0xE9, 0xFF]));
    assert.throws(function() { w.WriteBytes('A€'); }, RangeError);
    assert.throws(function() { w.WriteBytes('😀'); }, RangeError);
    assert.equal(w.Length, 3);
});

test('WriteBytes string, array and Buffer forms produce identical bytes', function() {
    var a = new BinaryWriter();
    var b = new BinaryWriter();
    var c = new BinaryWriter();
    a.WriteBytes('ABC');
    b.WriteBytes([0x41, 0x42, 0x43]);
    c.WriteBytes(Buffer.from('ABC'));
    assert.deepEqual(a.ByteBuffer, b.ByteBuffer);
    assert.deepEqual(b.ByteBuffer, c.ByteBuffer);
});

test('WriteBytes copies its Buffer argument', function() {
    var s_Source = Buffer.from([1, 2, 3]);
    var w = new BinaryWriter();
    w.WriteBytes(s_Source);
    s_Source[0] = 99;
    assert.deepEqual(w.ByteBuffer, Buffer.from([1, 2, 3]));
});

// --- Writer argument validation ---

test('integer writers reject non-integer and non-number values', function() {
    ['WriteUInt8', 'WriteUInt16', 'WriteUInt32', 'WriteInt8', 'WriteInt16', 'WriteInt32'].forEach(function(p_Method) {
        [1.5, NaN, Infinity, undefined, null, '5', true, 5n].forEach(function(p_Value) {
            var w = new BinaryWriter();
            assert.throws(function() { w[p_Method](p_Value); }, TypeError, p_Method + ' ' + String(p_Value));
            assert.equal(w.Length, 0);
        });
    });
});

test('64-bit writers accept integer numbers and BigInts only', function() {
    ['WriteUInt64', 'WriteInt64'].forEach(function(p_Method) {
        [1.5, NaN, undefined, null, '12', true].forEach(function(p_Value) {
            var w = new BinaryWriter();
            assert.throws(function() { w[p_Method](p_Value); }, TypeError, p_Method + ' ' + String(p_Value));
            assert.equal(w.Length, 0);
        });
    });
});

test('float writers reject non-numbers but accept NaN and Infinity', function() {
    ['WriteFloat', 'WriteDouble'].forEach(function(p_Method) {
        ['x', undefined, null, 1n].forEach(function(p_Value) {
            assert.throws(function() { new BinaryWriter()[p_Method](p_Value); }, TypeError);
        });
        var w = new BinaryWriter();
        w[p_Method](NaN);
        w[p_Method](Infinity);
        assert.equal(w.Length, p_Method == 'WriteFloat' ? 8 : 16);
    });
});

test('out-of-range writes throw RangeError and leave the writer unchanged', function() {
    var s_Cases = [
        ['WriteUInt8', 256], ['WriteUInt8', -1], ['WriteInt8', 128], ['WriteInt8', -129],
        ['WriteUInt16', 65536], ['WriteInt16', 32768], ['WriteUInt32', 4294967296], ['WriteInt32', 2147483648],
        ['WriteUInt64', -1], ['WriteUInt64', 1n << 64n], ['WriteInt64', 1n << 63n], ['WriteInt64', -(1n << 63n) - 1n]
    ];
    s_Cases.forEach(function(p_Case) {
        var w = new BinaryWriter();
        w.WriteUInt8(7);
        assert.throws(function() { w[p_Case[0]](p_Case[1]); }, RangeError, p_Case[0] + ' ' + String(p_Case[1]));
        assert.equal(w.Length, 1);
        assert.deepEqual(w.ByteBuffer, Buffer.from([7]));
    });
});

test('error messages name the offending input type', function() {
    assert.throws(function() { new BinaryWriter().WriteBytes(4); }, /Invalid Buffer object provided \(number\)/);
    assert.throws(function() { new BinaryWriter().WriteString(null); }, /Invalid string provided \(null\)/);
});

// --- Constructor ergonomics ---

test('constructor property points at the class', function() {
    assert.equal(new BinaryReader([1]).constructor, BinaryReader);
    assert.equal(new BinaryWriter().constructor, BinaryWriter);
});

test('calling a constructor without new still returns an instance', function() {
    var r = BinaryReader([1, 2], 'little');
    var w = BinaryWriter('little');
    assert.ok(r instanceof BinaryReader);
    assert.ok(w instanceof BinaryWriter);
    assert.equal(r.Endianness, 'little');
    assert.equal(w.Endianness, 'little');
});
