var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

test('String round-trips both endiannesses with default encoding', function() {
    ['big', 'little'].forEach(function(endian) {
        var w = new binutils.BinaryWriter(endian);
        w.WriteString('Hello, world!');
        var r = new binutils.BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadString(13), 'Hello, world!');
    });
});

test('String round-trips multi-byte characters with utf8 encoding', function() {
    var s_Text = 'héllo — π';
    var s_ByteLength = Buffer.byteLength(s_Text, 'utf8');
    var w = new binutils.BinaryWriter('big', 'utf8');
    w.WriteString(s_Text);
    assert.equal(w.Length, s_ByteLength);
    var r = new binutils.BinaryReader(w.ByteBuffer, 'big', 'utf8');
    assert.equal(r.ReadString(s_ByteLength), s_Text);
});

test('WriteString emits the encoded bytes and grows Length', function() {
    var w = new binutils.BinaryWriter();
    w.WriteString('abc');
    assert.equal(w.Length, 3);
    assert.deepEqual(w.ByteBuffer, Buffer.from([0x61, 0x62, 0x63]));
});

test('WriteString throws on non-string input', function() {
    var w = new binutils.BinaryWriter();
    [123, null, undefined, Buffer.from('abc'), ['a'], {}].forEach(function(value) {
        assert.throws(function() {
            w.WriteString(value);
        });
    });
});

test('ReadString advances Position, shrinks ByteBuffer, keeps Length', function() {
    var r = new binutils.BinaryReader('abcdef');
    assert.equal(r.ReadString(4), 'abcd');
    assert.equal(r.Position, 4);
    assert.equal(r.Length, 6);
    assert.equal(r.ByteBuffer.length, 2);
    assert.equal(r.ReadString(2), 'ef');
    assert.equal(r.Position, 6);
});

test('ReadString past the end returns an empty string without advancing', function() {
    var r = new binutils.BinaryReader('abc');
    assert.equal(r.ReadString(4), '');
    assert.equal(r.Position, 0);
    assert.equal(r.ByteBuffer.length, 3);
});

test('ReadString of zero bytes returns an empty string without advancing', function() {
    var r = new binutils.BinaryReader('abc');
    assert.equal(r.ReadString(0), '');
    assert.equal(r.Position, 0);
    assert.equal(r.ByteBuffer.length, 3);
});

test('String mixes with other types in one stream', function() {
    ['big', 'little'].forEach(function(endian) {
        var w = new binutils.BinaryWriter(endian);
        w.WriteUInt16(0xCAFE);
        w.WriteString('mixed');
        w.WriteUInt32(0xDEADBEEF);
        var r = new binutils.BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadUInt16(), 0xCAFE);
        assert.equal(r.ReadString(5), 'mixed');
        assert.equal(r.ReadUInt32(), 0xDEADBEEF);
    });
});
