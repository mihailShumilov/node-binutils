var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

var BinaryReader = binutils.BinaryReader;
var BinaryWriter = binutils.BinaryWriter;

function roundTrip(p_Write, p_Read, p_Value, p_Endian) {
    var w = new BinaryWriter(p_Endian);
    w[p_Write](p_Value);
    return new BinaryReader(w.ByteBuffer, p_Endian)[p_Read]();
}

test('64-bit boundaries round-trip in both endiannesses', function() {
    ['big', 'little'].forEach(function(p_Endian) {
        [0n, 1n, (1n << 63n), (1n << 64n) - 1n].forEach(function(p_Value) {
            assert.equal(roundTrip('WriteUInt64', 'ReadUInt64', p_Value, p_Endian), p_Value);
        });
        [-(1n << 63n), -1n, 0n, (1n << 63n) - 1n].forEach(function(p_Value) {
            assert.equal(roundTrip('WriteInt64', 'ReadInt64', p_Value, p_Endian), p_Value);
        });
        assert.equal(roundTrip('WriteUInt64', 'ReadUInt64', Number.MAX_SAFE_INTEGER, p_Endian), BigInt(Number.MAX_SAFE_INTEGER));
    });
});

test('64-bit writes emit 8 bytes with the expected byte order', function() {
    var w = new BinaryWriter('little');
    w.WriteInt64(-2n);
    assert.equal(w.Length, 8);
    assert.equal(w.ByteBuffer.toString('hex'), 'feffffffffffffff');
    var b = new BinaryWriter('big');
    b.WriteUInt64(0x0102030405060708n);
    assert.equal(b.ByteBuffer.toString('hex'), '0102030405060708');
});

test('short 64-bit reads return the number 0, not a BigInt', function() {
    var r = new BinaryReader([1, 2, 3]);
    assert.equal(typeof r.ReadUInt64(), 'number');
    assert.equal(typeof r.ReadInt64(), 'number');
    assert.equal(typeof new BinaryReader(Buffer.alloc(8)).ReadUInt64(), 'bigint');
});

test('Float and Double special values round-trip', function() {
    ['big', 'little'].forEach(function(p_Endian) {
        ['WriteFloat/ReadFloat', 'WriteDouble/ReadDouble'].forEach(function(p_Pair) {
            var s_Methods = p_Pair.split('/');
            assert.ok(Number.isNaN(roundTrip(s_Methods[0], s_Methods[1], NaN, p_Endian)));
            assert.equal(roundTrip(s_Methods[0], s_Methods[1], Infinity, p_Endian), Infinity);
            assert.equal(roundTrip(s_Methods[0], s_Methods[1], -Infinity, p_Endian), -Infinity);
            assert.ok(Object.is(roundTrip(s_Methods[0], s_Methods[1], -0, p_Endian), -0));
        });
    });
});

test('little-endian Double and Int32 emit the expected bytes', function() {
    var w = new BinaryWriter('little');
    w.WriteDouble(1);
    w.WriteInt32(-2);
    assert.equal(w.ByteBuffer.toString('hex'), '000000000000f03f' + 'feffffff');
    var r = new BinaryReader(w.ByteBuffer, 'little');
    assert.equal(r.ReadDouble(), 1);
    assert.equal(r.ReadInt32(), -2);
});

test('WriteString with non-utf8 encodings and the empty string', function() {
    [['latin1', 'é', 'e9'], ['utf16le', 'A', '4100'], ['hex', 'beef', 'beef']].forEach(function(p_Case) {
        var w = new BinaryWriter('big', p_Case[0]);
        w.WriteString(p_Case[1]);
        assert.equal(w.ByteBuffer.toString('hex'), p_Case[2]);
        var r = new BinaryReader(w.ByteBuffer, 'big', p_Case[0]);
        assert.equal(r.ReadString(w.Length), p_Case[1]);
    });
    var e = new BinaryWriter();
    e.WriteString('');
    assert.equal(e.Length, 0);
});

test('mixed stream with 64-bit values round-trips in both endiannesses', function() {
    ['big', 'little'].forEach(function(p_Endian) {
        var w = new BinaryWriter(p_Endian, 'utf8');
        w.WriteUInt8(1);
        w.WriteInt64(-5n);
        w.WriteCString('id');
        w.WriteVarUInt32(300);
        w.WriteDouble(2.5);
        w.WriteBoolean(true);
        var r = new BinaryReader(w.ByteBuffer, p_Endian, 'utf8');
        assert.equal(r.ReadUInt8(), 1);
        assert.equal(r.ReadInt64(), -5n);
        assert.equal(r.ReadCString(), 'id');
        assert.equal(r.ReadVarUInt32(), 300);
        assert.equal(r.ReadDouble(), 2.5);
        assert.equal(r.ReadBoolean(), true);
        assert.equal(r.Position, r.Length);
    });
});
