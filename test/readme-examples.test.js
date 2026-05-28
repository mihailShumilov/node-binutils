var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

// These mirror the worked examples in README.md. If the documented output ever
// changes, the docs and these tests must change together.

test('README reader example', function() {
    var buffer = Buffer.from([1, 0, 2, 0, 0, 0, 3, 1, 2, 3, 4, 5, 6]);
    var reader = new binutils.BinaryReader(buffer);

    assert.equal(reader.ReadUInt8(), 1);
    assert.equal(reader.ReadUInt16(), 2);
    assert.equal(reader.ReadUInt32(), 3);
    assert.deepEqual(Array.from(reader.ReadBytes(6)), [1, 2, 3, 4, 5, 6]);
    assert.equal(reader.Position, 13);
    assert.equal(reader.Length, 13);
});

test('README writer example', function() {
    var writer = new binutils.BinaryWriter();

    writer.WriteUInt16(65535);
    writer.WriteUInt32(0);
    writer.WriteInt32(-1);
    writer.WriteBytes([5, 4, 3, 2, 1]);

    assert.deepEqual(
        Array.from(writer.ByteBuffer),
        [0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 5, 4, 3, 2, 1]
    );
    assert.equal(writer.Length, 15);
});
