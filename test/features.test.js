var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

var BinaryReader = binutils.BinaryReader;
var BinaryWriter = binutils.BinaryWriter;

// --- Boolean (#5) ---

test('Boolean round-trips and any non-zero byte reads as true', function() {
    var w = new BinaryWriter();
    w.WriteBoolean(true);
    w.WriteBoolean(false);
    w.WriteBoolean(1);
    w.WriteBoolean('');
    assert.deepEqual(w.ByteBuffer, Buffer.from([1, 0, 1, 0]));

    var r = new BinaryReader([1, 0, 0xFF, 0x02]);
    assert.equal(r.ReadBoolean(), true);
    assert.equal(r.ReadBoolean(), false);
    assert.equal(r.ReadBoolean(), true);
    assert.equal(r.ReadBoolean(), true);
    assert.equal(r.Position, 4);
});

test('ReadBoolean on an empty buffer returns false without advancing', function() {
    var r = new BinaryReader([]);
    assert.equal(r.ReadBoolean(), false);
    assert.equal(r.Position, 0);
});

// --- Uint8Array input (#7) ---

test('BinaryReader accepts a Uint8Array and copies it', function() {
    var s_Source = new Uint8Array([0x12, 0x34]);
    var r = new BinaryReader(s_Source);
    s_Source[0] = 0;
    assert.equal(r.ReadUInt16(), 0x1234);
});

test('BinaryReader accepts a Uint8Array view with an offset', function() {
    var s_Backing = new Uint8Array([9, 9, 0x12, 0x34, 9]);
    var r = new BinaryReader(s_Backing.subarray(2, 4));
    assert.equal(r.Length, 2);
    assert.equal(r.ReadUInt16(), 0x1234);
});

test('WriteBytes accepts a Uint8Array and copies it', function() {
    var s_Source = new Uint8Array([1, 2, 3]);
    var w = new BinaryWriter();
    w.WriteBytes(s_Source);
    s_Source[0] = 99;
    assert.deepEqual(w.ByteBuffer, Buffer.from([1, 2, 3]));
    assert.equal(w.Length, 3);
});

test('other typed arrays and ArrayBuffer are still rejected', function() {
    assert.throws(function() { new BinaryReader(new ArrayBuffer(2)); }, /Invalid buffer input/);
    assert.throws(function() { new BinaryReader(new Uint16Array(2)); }, /Invalid buffer input/);
    assert.throws(function() { new BinaryWriter().WriteBytes(new ArrayBuffer(2)); }, /Invalid Buffer object/);
});

// --- Skip / ReadRemaining (#3) ---

test('Skip advances without returning data, then reads continue', function() {
    var r = new BinaryReader([0, 0, 0, 7]);
    r.Skip(3);
    assert.equal(r.Position, 3);
    assert.equal(r.ByteBuffer.length, 1);
    assert.equal(r.ReadUInt8(), 7);
});

test('Skip past the end, or with an invalid count, does nothing', function() {
    [5, -1, 1.5, NaN, undefined].forEach(function(p_Count) {
        var r = new BinaryReader([1, 2, 3]);
        r.Skip(p_Count);
        assert.equal(r.Position, 0, String(p_Count));
        assert.equal(r.ByteBuffer.length, 3, String(p_Count));
    });
});

test('ReadRemaining returns a copy of the rest and consumes it', function() {
    var r = new BinaryReader([1, 2, 3, 4]);
    r.ReadUInt8();
    var s_Rest = r.ReadRemaining();
    assert.deepEqual(s_Rest, Buffer.from([2, 3, 4]));
    assert.equal(r.Position, r.Length);
    assert.equal(r.ByteBuffer.length, 0);
    assert.deepEqual(r.ReadRemaining(), Buffer.alloc(0));
    assert.equal(r.Position, 4);
});

// --- CString (#2) ---

test('CString round-trips and consumes the terminator', function() {
    var w = new BinaryWriter('big', 'utf8');
    w.WriteCString('héllo');
    w.WriteCString('');
    w.WriteUInt8(7);
    assert.equal(w.Length, Buffer.byteLength('héllo') + 1 + 1 + 1);

    var r = new BinaryReader(w.ByteBuffer, 'big', 'utf8');
    assert.equal(r.ReadCString(), 'héllo');
    assert.equal(r.ReadCString(), '');
    assert.equal(r.ReadUInt8(), 7);
});

test('ReadCString without a terminator returns an empty string without advancing', function() {
    var r = new BinaryReader('abc');
    assert.equal(r.ReadCString(), '');
    assert.equal(r.Position, 0);
    assert.equal(r.ByteBuffer.length, 3);
});

test('WriteCString rejects non-strings and embedded null characters', function() {
    var w = new BinaryWriter();
    assert.throws(function() { w.WriteCString(5); }, /Invalid string/);
    assert.throws(function() { w.WriteCString('a\u0000b'); }, RangeError);
    assert.equal(w.Length, 0);
});

test('WriteCString rejects encodings whose output contains 0x00 bytes', function() {
    var u = new BinaryWriter('big', 'utf16le');
    assert.throws(function() { u.WriteCString('Hi'); }, /0x00 byte/);
    var h = new BinaryWriter('big', 'hex');
    assert.throws(function() { h.WriteCString('4100'); }, /0x00 byte/);
    h.WriteCString('4142');
    assert.deepEqual(h.ByteBuffer, Buffer.from([0x41, 0x42, 0x00]));
    assert.equal(u.Length + h.Length, 3);
});

// --- Peek (#4) ---

var s_PeekCases = [
    ['UInt8', 'WriteUInt8', 200],
    ['Int8', 'WriteInt8', -5],
    ['UInt16', 'WriteUInt16', 0xBEEF],
    ['Int16', 'WriteInt16', -1234],
    ['UInt32', 'WriteUInt32', 0xDEADBEEF],
    ['Int32', 'WriteInt32', -123456],
    ['UInt64', 'WriteUInt64', 0x1234567890ABCDEFn],
    ['Int64', 'WriteInt64', -9876543210n],
    ['Float', 'WriteFloat', 1.5],
    ['Double', 'WriteDouble', Math.PI],
    ['Boolean', 'WriteBoolean', true]
];

test('Peek returns the same value as the next Read without consuming', function() {
    ['big', 'little'].forEach(function(p_Endian) {
        s_PeekCases.forEach(function(p_Case) {
            var w = new BinaryWriter(p_Endian);
            w[p_Case[1]](p_Case[2]);
            var r = new BinaryReader(w.ByteBuffer, p_Endian);
            var s_Peeked = r['Peek' + p_Case[0]]();
            assert.equal(r.Position, 0, p_Case[0]);
            assert.equal(r.ByteBuffer.length, w.Length, p_Case[0]);
            assert.equal(s_Peeked, p_Case[2], p_Endian + ' ' + p_Case[0]);
            assert.equal(r['Read' + p_Case[0]](), s_Peeked, p_Case[0]);
        });
    });
});

test('PeekBytes returns a copy without consuming', function() {
    var r = new BinaryReader([1, 2, 3]);
    var s_Peeked = r.PeekBytes(2);
    assert.deepEqual(s_Peeked, Buffer.from([1, 2]));
    s_Peeked[0] = 99;
    assert.equal(r.Position, 0);
    assert.deepEqual(r.ReadBytes(3), Buffer.from([1, 2, 3]));
});

test('short peeks return the zero value', function() {
    var r = new BinaryReader([1]);
    assert.equal(r.PeekUInt16(), 0);
    assert.equal(r.PeekUInt64(), 0);
    assert.equal(r.PeekDouble(), 0);
    assert.equal(new BinaryReader([]).PeekBoolean(), false);
    assert.equal(r.PeekBytes(2).length, 0);
    assert.equal(r.PeekBytes(-1).length, 0);
    assert.equal(r.Position, 0);
});

test('peek enables tag-based dispatch', function() {
    var w = new BinaryWriter();
    w.WriteUInt8(2);
    w.WriteUInt16(513);
    var r = new BinaryReader(w.ByteBuffer);
    var s_Value = r.PeekUInt8() === 2 ? (r.Skip(1), r.ReadUInt16()) : r.ReadUInt8();
    assert.equal(s_Value, 513);
});

// --- Strict mode (#6) ---

var s_StrictReads = [
    ['ReadUInt8', 1], ['ReadInt8', 1], ['ReadBoolean', 1], ['ReadUInt16', 2], ['ReadInt16', 2],
    ['ReadUInt32', 4], ['ReadInt32', 4], ['ReadFloat', 4], ['ReadUInt64', 8], ['ReadInt64', 8], ['ReadDouble', 8],
    ['PeekUInt8', 1], ['PeekInt8', 1], ['PeekBoolean', 1], ['PeekUInt16', 2], ['PeekInt16', 2],
    ['PeekUInt32', 4], ['PeekInt32', 4], ['PeekFloat', 4], ['PeekUInt64', 8], ['PeekInt64', 8], ['PeekDouble', 8]
];

test('strict mode: every fixed-width read and peek throws on a short buffer without advancing', function() {
    s_StrictReads.forEach(function(p_Case) {
        var r = new BinaryReader(Buffer.alloc(p_Case[1] - 1), 'big', 'ascii', { Strict: true });
        assert.throws(function() { r[p_Case[0]](); }, function(p_Error) {
            return p_Error instanceof RangeError &&
                p_Error.message === p_Case[0] + ': need ' + p_Case[1] + ' bytes, ' + (p_Case[1] - 1) + ' remaining';
        }, p_Case[0]);
        assert.equal(r.Position, 0, p_Case[0]);
        assert.equal(r.ByteBuffer.length, p_Case[1] - 1, p_Case[0]);
    });
});

test('strict mode: count-based reads throw on short buffers and invalid counts', function() {
    var r = new BinaryReader([1, 2], 'big', 'ascii', { Strict: true });
    assert.throws(function() { r.ReadBytes(3); }, RangeError);
    assert.throws(function() { r.ReadString(3); }, RangeError);
    assert.throws(function() { r.PeekBytes(3); }, RangeError);
    assert.throws(function() { r.Skip(3); }, RangeError);
    assert.throws(function() { r.ReadBytes(-1); }, /invalid byte count/);
    assert.throws(function() { r.ReadString(1.5); }, /invalid byte count/);
    assert.throws(function() { r.ReadCString(); }, /no null terminator/);
    assert.throws(function() { new BinaryReader([0x80], null, null, { Strict: true }).ReadVarUInt32(); }, /truncated varint/);
    assert.throws(function() { new BinaryReader([0xFF, 0xFF, 0xFF, 0xFF, 0x1F], null, null, { Strict: true }).ReadVarUInt32(); }, /overlong varint/);
    assert.equal(r.Position, 0);
});

test('strict mode: successful reads behave normally', function() {
    var r = new BinaryReader([0, 1, 2], 'big', 'ascii', { Strict: true });
    assert.equal(r.Strict, true);
    assert.equal(r.ReadUInt16(), 1);
    assert.equal(r.ReadUInt8(), 2);
    assert.equal(r.ReadRemaining().length, 0);
    assert.equal(r.ReadString(0), '');
});

test('strict mode is off by default', function() {
    var r = new BinaryReader([1]);
    assert.equal(r.Strict, false);
    assert.equal(r.ReadUInt32(), 0);
    assert.equal(new BinaryReader([1], 'big', 'ascii', {}).Strict, false);
});

// --- Varint / LEB128 (#8) ---

test('VarUInt32 round-trips at encoding boundaries with the expected bytes', function() {
    var s_Cases = [
        [0, '00'], [127, '7f'], [128, '8001'], [16383, 'ff7f'], [16384, '808001'], [0xFFFFFFFF, 'ffffffff0f']
    ];
    s_Cases.forEach(function(p_Case) {
        var w = new BinaryWriter('little');
        w.WriteVarUInt32(p_Case[0]);
        assert.equal(w.ByteBuffer.toString('hex'), p_Case[1]);
        var r = new BinaryReader(w.ByteBuffer, 'big');
        assert.equal(r.ReadVarUInt32(), p_Case[0]);
        assert.equal(r.Position, p_Case[1].length / 2);
    });
});

test('VarInt32 uses ZigZag encoding and round-trips', function() {
    var s_Cases = [[0, '00'], [-1, '01'], [1, '02'], [-2, '03'], [2147483647, 'feffffff0f'], [-2147483648, 'ffffffff0f']];
    s_Cases.forEach(function(p_Case) {
        var w = new BinaryWriter();
        w.WriteVarInt32(p_Case[0]);
        assert.equal(w.ByteBuffer.toString('hex'), p_Case[1]);
        assert.equal(new BinaryReader(w.ByteBuffer).ReadVarInt32(), p_Case[0]);
    });
});

test('VarUInt64 and VarInt64 round-trip BigInt boundaries', function() {
    var w = new BinaryWriter();
    var s_Unsigned = [0n, 127n, 128n, (1n << 63n), (1n << 64n) - 1n];
    var s_Signed = [0n, -1n, 1n, -(1n << 63n), (1n << 63n) - 1n];
    s_Unsigned.forEach(function(p_Value) { w.WriteVarUInt64(p_Value); });
    s_Signed.forEach(function(p_Value) { w.WriteVarInt64(p_Value); });
    w.WriteVarUInt64(300);
    var r = new BinaryReader(w.ByteBuffer);
    s_Unsigned.forEach(function(p_Value) { assert.equal(r.ReadVarUInt64(), p_Value); });
    s_Signed.forEach(function(p_Value) { assert.equal(r.ReadVarInt64(), p_Value); });
    assert.equal(r.ReadVarUInt64(), 300n);
    assert.equal(r.ByteBuffer.length, 0);
});

test('max VarUInt64 is 10 bytes', function() {
    var w = new BinaryWriter();
    w.WriteVarUInt64((1n << 64n) - 1n);
    assert.equal(w.ByteBuffer.toString('hex'), 'ffffffffffffffffff01');
});

test('truncated or overlong varints return 0 without advancing', function() {
    [[0x80], [0xFF, 0xFF], [0xFF, 0xFF, 0xFF, 0xFF, 0x10], [0x80, 0x80, 0x80, 0x80, 0x80, 0x00]].forEach(function(p_Bytes) {
        ['ReadVarUInt32', 'ReadVarInt32'].forEach(function(p_Method) {
            var r = new BinaryReader(p_Bytes);
            assert.equal(r[p_Method](), 0, p_Method + ' ' + p_Bytes);
            assert.equal(r.Position, 0);
        });
    });
    var s_Overlong64 = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x02];
    ['ReadVarUInt64', 'ReadVarInt64'].forEach(function(p_Method) {
        var r = new BinaryReader(s_Overlong64);
        assert.equal(r[p_Method](), 0);
        assert.equal(r.Position, 0);
        assert.equal(new BinaryReader([0x80]).ReadVarUInt64(), 0);
    });
});

test('varint writers reject out-of-range values', function() {
    var w = new BinaryWriter();
    assert.throws(function() { w.WriteVarUInt32(-1); }, RangeError);
    assert.throws(function() { w.WriteVarUInt32(0x100000000); }, RangeError);
    assert.throws(function() { w.WriteVarUInt32(1.5); }, TypeError);
    assert.throws(function() { w.WriteVarInt32(2147483648); }, RangeError);
    assert.throws(function() { w.WriteVarInt32(-2147483649); }, RangeError);
    assert.throws(function() { w.WriteVarUInt64(-1n); }, RangeError);
    assert.throws(function() { w.WriteVarUInt64(1n << 64n); }, RangeError);
    assert.throws(function() { w.WriteVarInt64(1n << 63n); }, RangeError);
    assert.throws(function() { w.WriteVarInt64('1'); }, TypeError);
    assert.equal(w.Length, 0);
});

// --- ByteBuffer accessor (#9, #10) ---

test('reader ByteBuffer is the remaining data and can be replaced', function() {
    var r = new BinaryReader([1, 2, 3]);
    r.ReadUInt8();
    assert.deepEqual(r.ByteBuffer, Buffer.from([2, 3]));
    r.ByteBuffer = Buffer.from([9, 8]);
    assert.equal(r.ReadUInt8(), 9);
    assert.equal(r.Position, 2);
    assert.equal(r.Length, 3);
    assert.throws(function() { r.ByteBuffer = [1]; }, TypeError);
});

test('assigning Position does not seek', function() {
    var r = new BinaryReader([1, 2, 3]);
    r.Position = 2;
    assert.equal(r.ReadUInt8(), 1);
});

test('writer ByteBuffer reflects every write and can be replaced', function() {
    var w = new BinaryWriter();
    w.WriteUInt8(1);
    var s_First = w.ByteBuffer;
    assert.equal(w.ByteBuffer, s_First, 'cached between writes');
    w.WriteUInt8(2);
    assert.deepEqual(w.ByteBuffer, Buffer.from([1, 2]));
    w.ByteBuffer = Buffer.from([7]);
    assert.equal(w.Length, 1);
    w.WriteUInt8(8);
    assert.deepEqual(w.ByteBuffer, Buffer.from([7, 8]));
    assert.equal(w.Length, 2);
    assert.throws(function() { w.ByteBuffer = 'x'; }, TypeError);
});

test('writer ByteBuffer is not padded when Length is changed externally', function() {
    var w = new BinaryWriter();
    w.WriteUInt8(1);
    w.Length = 5;
    w.WriteUInt8(2);
    assert.deepEqual(w.ByteBuffer, Buffer.from([1, 2]));
});

test('many small writes stay fast (linear accumulation)', function() {
    var w = new BinaryWriter();
    for (var i = 0; i < 200000; ++i) {
        w.WriteUInt8(i & 0xFF);
    }
    assert.equal(w.Length, 200000);
    assert.equal(w.ByteBuffer.length, 200000);
    assert.equal(w.ByteBuffer[199999], 199999 & 0xFF);
});
