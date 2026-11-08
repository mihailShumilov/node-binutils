var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

var BinaryReader = binutils.BinaryReader;
var BinaryWriter = binutils.BinaryWriter;

var STRICT = { Strict: true };

// Default mode keeps every 0.3.0 behavior (see test/compat.test.js for the full
// side-by-side comparison). These tests document the notable cases and show that
// strict mode turns each silent coercion into an error.

// --- Reader counts ---

test('default: ReadBytes keeps 0.3.0 count handling (throws where 0.3.0 threw, truncates fractions)', function() {
    [-1, NaN, -Infinity].forEach(function(p_Count) {
        assert.throws(function() { new BinaryReader([1, 2, 3]).ReadBytes(p_Count); }, RangeError, String(p_Count));
    });
    [undefined, null, '2', true].forEach(function(p_Count) {
        assert.throws(function() { new BinaryReader([1, 2, 3]).ReadBytes(p_Count); }, TypeError, String(p_Count));
    });
    var r = new BinaryReader([1, 2, 3, 4]);
    assert.deepEqual(r.ReadBytes(1.5), Buffer.from([1]));
    assert.equal(r.Position, 1, 'Position stays an integer (0.3.0 left it at 1.5)');
    assert.deepEqual(r.ReadBytes(Infinity), Buffer.alloc(0));
    assert.deepEqual(r.ReadBytes('9'), Buffer.alloc(0));
});

test('default: ReadString keeps 0.3.0 count handling', function() {
    var r = new BinaryReader('abcd');
    assert.equal(r.ReadString(), 'abcd', 'no count returns everything left...');
    assert.equal(r.Position, 0, '...without consuming it');
    assert.equal(r.ReadString(null), '');
    assert.equal(r.ReadString(-1), '');
    assert.equal(r.ReadString(NaN), '');
    assert.equal(r.ReadString('2'), 'ab');
    assert.equal(r.Position, 2, 'Position stays a number (0.3.0 made it the string "02")');
    assert.equal(r.ReadString(1.5), 'c');
    assert.equal(r.Position, 3);
});

test('strict: invalid counts throw RangeError without advancing', function() {
    [-1, NaN, 1.5, Infinity, undefined, null, '2', true].forEach(function(p_Count) {
        ['ReadBytes', 'ReadString', 'PeekBytes', 'Skip'].forEach(function(p_Method) {
            var r = new BinaryReader([1, 2, 3, 4], 'big', 'ascii', STRICT);
            assert.throws(function() { r[p_Method](p_Count); }, /invalid byte count/, p_Method + ' ' + String(p_Count));
            assert.equal(r.Position, 0);
        });
    });
});

// --- Constructor input ---

test('default: string input without an encoding is encoded as utf8, as in 0.3.0', function() {
    var r = new BinaryReader('é');
    assert.equal(r.Encoding, 'ascii');
    assert.equal(r.Length, 2);
    assert.deepEqual(r.ByteBuffer, Buffer.from([0xC3, 0xA9]));
});

test('string input honors an explicit encoding', function() {
    var r = new BinaryReader('é', 'big', 'utf8');
    assert.equal(r.Length, 2);
    assert.equal(r.ReadString(2), 'é');
    assert.deepEqual(new BinaryReader('0aff', 'big', 'hex').ByteBuffer, Buffer.from([0x0A, 0xFF]));
});

test('strict: non-ASCII string input without an explicit encoding throws', function() {
    assert.throws(function() { new BinaryReader('é', 'big', undefined, STRICT); }, /pass the encoding explicitly/);
    assert.equal(new BinaryReader('abc', 'big', undefined, STRICT).Length, 3);
    assert.equal(new BinaryReader('é', 'big', 'utf8', STRICT).Length, 2);
});

test('default: invalid endianness is kept and treated as big-endian, as in 0.3.0', function() {
    var r = new BinaryReader([0x01, 0x00], 'LE');
    assert.equal(r.Endianness, 'LE');
    assert.equal(r.ReadUInt16(), 0x0100);
    var w = new BinaryWriter('Little');
    w.WriteUInt16(1);
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x00, 0x01]));
});

test('strict: invalid endianness throws in both constructors', function() {
    ['LE', 'Little', 'le', 'little ', 'BE', 'x', 1].forEach(function(p_Endianness) {
        assert.throws(function() { new BinaryReader([1], p_Endianness, undefined, STRICT); }, TypeError, String(p_Endianness));
        assert.throws(function() { new BinaryWriter(p_Endianness, undefined, STRICT); }, TypeError, String(p_Endianness));
    });
    [undefined, null, '', 'big', 'little'].forEach(function(p_Endianness) {
        assert.doesNotThrow(function() { new BinaryReader([1], p_Endianness, undefined, STRICT); });
        assert.doesNotThrow(function() { new BinaryWriter(p_Endianness, undefined, STRICT); });
    });
});

test('default: unknown encodings behave as in 0.3.0', function() {
    assert.throws(function() { new BinaryReader('abc', 'big', 'bogus'); }, TypeError);
    var r = new BinaryReader(Buffer.from('abc'), 'big', 'bogus');
    assert.equal(r.Encoding, 'bogus');
    assert.throws(function() { r.ReadString(1); }, TypeError);
    var w = new BinaryWriter('big', 'bogus');
    assert.throws(function() { w.WriteString('a'); }, TypeError);
});

test('strict: unknown encodings throw in both constructors', function() {
    assert.throws(function() { new BinaryReader(Buffer.from('abc'), 'big', 'bogus', STRICT); }, /unknown encoding/);
    assert.throws(function() { new BinaryWriter('big', 'bogus', STRICT); }, /unknown encoding/);
});

test('extra constructor arguments that 0.3.0 ignored are still ignored', function() {
    [true, 1, 'Strict', function() {}, { a: 1 }, [], { Strict: false, other: 1 }].forEach(function(p_Options) {
        assert.equal(new BinaryReader([1], 'big', 'ascii', p_Options).Strict, false);
        assert.equal(new BinaryWriter('big', 'ascii', p_Options).Strict, false);
    });
});

test('a strict options object must have known keys', function() {
    assert.throws(function() { new BinaryReader([1], 'big', 'ascii', { strict: true }); }, /unknown option 'strict'/);
    assert.throws(function() { new BinaryWriter('big', 'ascii', { Strict: true, Strickt: true }); }, /unknown option 'Strickt'/);
    assert.equal(new BinaryReader([1], 'big', 'ascii', null).Strict, false);
    assert.equal(new BinaryWriter('big', 'ascii', {}).Strict, false);
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

// --- Byte arrays ---

test('default: byte arrays wrap like Buffer.from, as in 0.3.0', function() {
    assert.deepEqual(new BinaryReader([300, -1, 1.5, 'a']).ByteBuffer, Buffer.from([0x2C, 0xFF, 0x01, 0x00]));
    var w = new BinaryWriter();
    w.WriteBytes([256, -1, NaN, {}]);
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x00, 0xFF, 0x00, 0x00]));
});

test('strict: byte arrays must contain integers 0-255', function() {
    assert.throws(function() { new BinaryReader([300], 'big', 'ascii', STRICT); }, RangeError);
    assert.throws(function() { new BinaryReader([-1], 'big', 'ascii', STRICT); }, RangeError);
    assert.throws(function() { new BinaryReader([1.5], 'big', 'ascii', STRICT); }, TypeError);
    assert.throws(function() { new BinaryReader(['a'], 'big', 'ascii', STRICT); }, TypeError);
    var w = new BinaryWriter('big', 'ascii', STRICT);
    assert.throws(function() { w.WriteBytes([256]); }, /array element at index 0 is out of byte range \(256\)/);
    assert.throws(function() { w.WriteBytes([NaN]); }, TypeError);
    assert.throws(function() { w.WriteBytes([[1]]); }, /is not an integer \(array\)/);
    assert.equal(w.Length, 0);
});

// --- WriteBytes / WriteString text ---

test('default: WriteBytes(string) keeps the low byte of each character code, as in 0.3.0', function() {
    var w = new BinaryWriter();
    w.WriteBytes('Aé€');
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x41, 0xE9, 0xAC]));
});

test('strict: WriteBytes(string) rejects characters above U+00FF', function() {
    var w = new BinaryWriter('big', 'ascii', STRICT);
    w.WriteBytes('Aéÿ');
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x41, 0xE9, 0xFF]));
    assert.throws(function() { w.WriteBytes('A€'); }, /U\+20AC/);
    assert.throws(function() { w.WriteBytes('😀'); }, RangeError);
    assert.equal(w.Length, 3);
});

test('strict: WriteString rejects characters its single-byte encoding would mangle', function() {
    assert.throws(function() { new BinaryWriter('big', 'ascii', STRICT).WriteString('é'); }, /not representable in ascii/);
    assert.throws(function() { new BinaryWriter('big', 'latin1', STRICT).WriteString('€'); }, /not representable in latin1/);
    var w = new BinaryWriter('big', 'utf8', STRICT);
    w.WriteString('€');
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

// --- Writer argument types ---

test('default: writers coerce values exactly as 0.3.0 did', function() {
    var w = new BinaryWriter();
    w.WriteUInt8(1.5);
    w.WriteUInt8('5');
    w.WriteUInt8(NaN);
    w.WriteUInt8(true);
    w.WriteInt32('5');
    w.WriteUInt64('5');
    w.WriteFloat(null);
    assert.equal(w.ByteBuffer.toString('hex'), '01050001' + '00000005' + '0000000000000005' + '00000000');
    assert.throws(function() { w.WriteUInt64(1.5); }, RangeError);
    assert.throws(function() { w.WriteInt64(undefined); }, TypeError);
});

test('strict: integer writers reject non-integer and non-number values', function() {
    ['WriteUInt8', 'WriteUInt16', 'WriteUInt32', 'WriteInt8', 'WriteInt16', 'WriteInt32'].forEach(function(p_Method) {
        [1.5, NaN, Infinity, undefined, null, '5', true, 5n].forEach(function(p_Value) {
            var w = new BinaryWriter('big', 'ascii', STRICT);
            assert.throws(function() { w[p_Method](p_Value); }, TypeError, p_Method + ' ' + String(p_Value));
            assert.equal(w.Length, 0);
        });
    });
});

test('strict: 64-bit writers accept safe integer numbers and BigInts only', function() {
    ['WriteUInt64', 'WriteInt64'].forEach(function(p_Method) {
        [1.5, NaN, undefined, null, '12', true].forEach(function(p_Value) {
            var w = new BinaryWriter('big', 'ascii', STRICT);
            assert.throws(function() { w[p_Method](p_Value); }, TypeError, p_Method + ' ' + String(p_Value));
            assert.equal(w.Length, 0);
        });
        var s = new BinaryWriter('big', 'ascii', STRICT);
        assert.throws(function() { s[p_Method](2 ** 60); }, /pass a BigInt/);
        s[p_Method](Number.MAX_SAFE_INTEGER);
        s[p_Method](2n ** 60n);
        assert.equal(s.Length, 16);
    });
});

test('strict: float writers reject non-numbers but accept NaN and Infinity', function() {
    ['WriteFloat', 'WriteDouble'].forEach(function(p_Method) {
        ['x', undefined, null, 1n].forEach(function(p_Value) {
            assert.throws(function() { new BinaryWriter('big', 'ascii', STRICT)[p_Method](p_Value); }, TypeError);
        });
        var w = new BinaryWriter('big', 'ascii', STRICT);
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
    [undefined, STRICT].forEach(function(p_Options) {
        s_Cases.forEach(function(p_Case) {
            var w = new BinaryWriter('big', 'ascii', p_Options);
            w.WriteUInt8(7);
            var s_Before = w.ByteBuffer;
            assert.throws(function() { w[p_Case[0]](p_Case[1]); }, RangeError, p_Case[0] + ' ' + String(p_Case[1]));
            assert.equal(w.Length, 1);
            assert.equal(w.ByteBuffer, s_Before, 'same Buffer object');
            assert.deepEqual(w.ByteBuffer, Buffer.from([7]));
        });
    });
});

test('error messages keep the 0.3.0 wording', function() {
    assert.throws(function() { new BinaryWriter().WriteBytes(4); }, { name: 'Error', message: 'Invalid Buffer object provided.' });
    assert.throws(function() { new BinaryWriter().WriteString(null); }, { name: 'Error', message: 'Invalid string provided.' });
    assert.throws(function() { new BinaryReader(null); }, { name: 'Error', message: 'Invalid buffer input for BinaryReader (object)' });
});

// --- Shape and constructor ergonomics ---

test('instances keep the 0.3.0 enumerable shape', function() {
    var r = new BinaryReader([1, 2, 3], 'big', 'ascii', STRICT);
    r.ReadUInt8();
    assert.deepEqual(Object.keys(r), ['ByteBuffer', 'Endianness', 'Encoding', 'Length', 'Position']);
    assert.equal(JSON.stringify(r), '{"ByteBuffer":{"type":"Buffer","data":[2,3]},"Endianness":"big","Encoding":"ascii","Length":3,"Position":1}');
    var w = new BinaryWriter();
    w.WriteUInt8(1);
    w.WriteUInt8(2);
    assert.deepEqual(Object.keys(w), ['ByteBuffer', 'Endianness', 'Encoding', 'Length']);
    assert.equal(JSON.stringify(w), '{"ByteBuffer":{"type":"Buffer","data":[1,2]},"Endianness":"big","Encoding":"ascii","Length":2}');
    assert.deepEqual({ ...w }.ByteBuffer, Buffer.from([1, 2]));
});

test('constructor property points at the class and is not enumerable', function() {
    assert.equal(new BinaryReader([1]).constructor, BinaryReader);
    assert.equal(new BinaryWriter().constructor, BinaryWriter);
    assert.equal(Object.keys(BinaryReader.prototype).indexOf('constructor'), -1);
    assert.equal(Object.keys(BinaryReader.prototype).filter(function(p_Key) { return p_Key.charAt(0) === '_'; }).length, 0);
});

test('calling a constructor without new still returns an instance', function() {
    var r = BinaryReader([1, 2], 'little');
    var w = BinaryWriter('little');
    var x = binutils.BinaryWriter('little');
    assert.ok(r instanceof BinaryReader);
    assert.ok(w instanceof BinaryWriter);
    assert.ok(x instanceof BinaryWriter);
    assert.equal(r.Endianness, 'little');
    assert.equal(Object.keys(binutils).length, 2, 'exports object untouched');
});

test('ES5-style subclasses keep working', function() {
    function MyReader(p_Input) {
        BinaryReader.call(this, p_Input, 'little');
    }
    MyReader.prototype = Object.create(BinaryReader.prototype);
    MyReader.prototype.constructor = MyReader;
    var r = new MyReader([1, 0]);
    assert.equal(r.ReadUInt16(), 1);

    class Typed extends BinaryWriter {}
    var w = new Typed('little');
    w.WriteUInt16(1);
    assert.deepEqual(w.ByteBuffer, Buffer.from([1, 0]));
});

test('strict 64-bit varint writers reject unsafe numbers; default mode accepts them', function() {
    var s_Strict = new binutils.BinaryWriter('big', 'ascii', { Strict: true });
    assert.throws(function() { s_Strict.WriteVarUInt64(Math.pow(2, 60)); }, RangeError);
    assert.throws(function() { s_Strict.WriteVarInt64(-Math.pow(2, 60)); }, RangeError);
    assert.equal(s_Strict.Length, 0);
    s_Strict.WriteVarUInt64(BigInt(2) ** BigInt(60));
    var s_Default = new binutils.BinaryWriter();
    s_Default.WriteVarUInt64(Math.pow(2, 60));
    assert.deepEqual(s_Default.ByteBuffer, s_Strict.ByteBuffer);
});
