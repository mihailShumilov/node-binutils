// --- Shared helpers ---------------------------------------------------------

var s_BigZero = BigInt(0);
var s_BigOne = BigInt(1);
var s_BigSeven = BigInt(7);
var s_BigByteMask = BigInt(0x7F);
var s_BigMaxUInt64 = (s_BigOne << BigInt(64)) - s_BigOne;
var s_BigMinInt64 = -(s_BigOne << BigInt(63));
var s_BigMaxInt64 = (s_BigOne << BigInt(63)) - s_BigOne;

function DescribeValue(p_Value) {
    if (p_Value === null) {
        return 'null';
    }
    if (p_Value instanceof Array) {
        return 'array';
    }
    return typeof p_Value;
}

function ResolveEndianness(p_Endianness) {
    if (!p_Endianness) {
        return 'big';
    }
    if (p_Endianness !== 'big' && p_Endianness !== 'little') {
        throw new TypeError("Invalid endianness (" + p_Endianness + "), expected 'big' or 'little'");
    }
    return p_Endianness;
}

function ResolveEncoding(p_Encoding) {
    if (!p_Encoding) {
        return 'ascii';
    }
    if (typeof p_Encoding != 'string' || !Buffer.isEncoding(p_Encoding)) {
        throw new TypeError('Unknown encoding (' + p_Encoding + ')');
    }
    return p_Encoding;
}

function IsByteCount(p_Count) {
    return typeof p_Count == 'number' && p_Count >= 0 && p_Count % 1 === 0;
}

function CheckByteArray(p_Array, p_Method) {
    for (var i = 0; i < p_Array.length; ++i) {
        var s_Byte = p_Array[i];
        if (typeof s_Byte != 'number' || s_Byte % 1 !== 0) {
            throw new TypeError(p_Method + ': array element at index ' + i + ' is not an integer (' + DescribeValue(s_Byte) + ')');
        }
        if (s_Byte < 0 || s_Byte > 0xFF) {
            throw new RangeError(p_Method + ': array element at index ' + i + ' is out of byte range (' + s_Byte + ')');
        }
    }
}

function CheckInteger(p_Value, p_Method) {
    if (typeof p_Value != 'number' || !Number.isInteger(p_Value)) {
        throw new TypeError(p_Method + ': expected an integer number, got ' + DescribeValue(p_Value) + ' (' + p_Value + ')');
    }
}

function CheckNumber(p_Value, p_Method) {
    if (typeof p_Value != 'number') {
        throw new TypeError(p_Method + ': expected a number, got ' + DescribeValue(p_Value));
    }
}

function ToBigInt(p_Value, p_Method) {
    if (typeof p_Value == 'bigint') {
        return p_Value;
    }
    if (typeof p_Value == 'number' && Number.isInteger(p_Value)) {
        return BigInt(p_Value);
    }
    throw new TypeError(p_Method + ': expected an integer number or BigInt, got ' + DescribeValue(p_Value) + ' (' + p_Value + ')');
}

// --- BinaryReader -----------------------------------------------------------

var BinaryReader = function(p_InputBuffer, p_Endianness, p_Encoding, p_Options) {
    if (!(this instanceof BinaryReader)) {
        return new BinaryReader(p_InputBuffer, p_Endianness, p_Encoding, p_Options);
    }

    // Set the endianness and encoding (validated)
    this.Endianness = ResolveEndianness(p_Endianness);
    this.Encoding = ResolveEncoding(p_Encoding);

    // Opt-in strict mode: short reads throw instead of returning a zero value
    this.Strict = !!(p_Options && p_Options.Strict);

    // Copy the input so the caller's data is never shared or mutated
    if (p_InputBuffer instanceof Uint8Array) {
        this._Data = Buffer.from(p_InputBuffer);
    } else if (p_InputBuffer instanceof Array) {
        CheckByteArray(p_InputBuffer, 'BinaryReader');
        this._Data = Buffer.from(p_InputBuffer);
    } else if (typeof p_InputBuffer == 'string') {
        this._Data = Buffer.from(p_InputBuffer, this.Encoding);
    } else {
        throw new Error('Invalid buffer input for BinaryReader (' + DescribeValue(p_InputBuffer) + ')');
    }

    // Internal read offset into _Data (independent of the public Position)
    this._Offset = 0;

    // Set the length
    this.Length = this._Data.length;

    // Set the position to 0
    this.Position = 0;
};

BinaryReader.prototype = {
    constructor: BinaryReader,

    // The remaining unread bytes (a view, not a copy).
    get ByteBuffer() {
        return this._Data.subarray(this._Offset);
    },

    // Replaces the unread data. Position and Length are left untouched.
    set ByteBuffer(p_Value) {
        if (!(p_Value instanceof Buffer)) {
            throw new TypeError('ByteBuffer must be a Buffer (' + DescribeValue(p_Value) + ')');
        }
        this._Data = p_Value;
        this._Offset = 0;
    },

    // Returns true when p_Count bytes remain. Otherwise throws in strict mode, or returns false.
    _Ensure: function(p_Count, p_Method) {
        var s_Remaining = this._Data.length - this._Offset;
        if (p_Count <= s_Remaining) {
            return true;
        }
        if (this.Strict) {
            throw new RangeError(p_Method + ': need ' + p_Count + ' bytes, ' + s_Remaining + ' remaining');
        }
        return false;
    },

    // Returns true for a valid byte count. Otherwise throws in strict mode, or returns false.
    _CheckCount: function(p_Count, p_Method) {
        if (IsByteCount(p_Count)) {
            return true;
        }
        if (this.Strict) {
            throw new RangeError(p_Method + ': invalid byte count (' + p_Count + ')');
        }
        return false;
    },

    _Advance: function(p_Count) {
        this._Offset += p_Count;
        this.Position += p_Count;
    },

    ReadUInt8: function() {
        if (!this._Ensure(1, 'ReadUInt8')) {
            return 0;
        }

        var s_Val = this._Data.readUInt8(this._Offset);
        this._Advance(1);
        return s_Val;
    },

    ReadUInt16: function() {
        if (!this._Ensure(2, 'ReadUInt16')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readUInt16LE(this._Offset) : this._Data.readUInt16BE(this._Offset);
        this._Advance(2);
        return s_Val;
    },

    ReadUInt32: function() {
        if (!this._Ensure(4, 'ReadUInt32')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readUInt32LE(this._Offset) : this._Data.readUInt32BE(this._Offset);
        this._Advance(4);
        return s_Val;
    },

    ReadUInt64: function() {
        if (!this._Ensure(8, 'ReadUInt64')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readBigUInt64LE(this._Offset) : this._Data.readBigUInt64BE(this._Offset);
        this._Advance(8);
        return s_Val;
    },

    ReadInt8: function() {
        if (!this._Ensure(1, 'ReadInt8')) {
            return 0;
        }

        var s_Val = this._Data.readInt8(this._Offset);
        this._Advance(1);
        return s_Val;
    },

    ReadInt16: function() {
        if (!this._Ensure(2, 'ReadInt16')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readInt16LE(this._Offset) : this._Data.readInt16BE(this._Offset);
        this._Advance(2);
        return s_Val;
    },

    ReadInt32: function() {
        if (!this._Ensure(4, 'ReadInt32')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readInt32LE(this._Offset) : this._Data.readInt32BE(this._Offset);
        this._Advance(4);
        return s_Val;
    },

    ReadInt64: function() {
        if (!this._Ensure(8, 'ReadInt64')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readBigInt64LE(this._Offset) : this._Data.readBigInt64BE(this._Offset);
        this._Advance(8);
        return s_Val;
    },

    ReadFloat: function() {
        if (!this._Ensure(4, 'ReadFloat')) {
            return 0.0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readFloatLE(this._Offset) : this._Data.readFloatBE(this._Offset);
        this._Advance(4);
        return s_Val;
    },

    ReadDouble: function() {
        if (!this._Ensure(8, 'ReadDouble')) {
            return 0.0;
        }

        var s_Val = (this.Endianness == 'little') ? this._Data.readDoubleLE(this._Offset) : this._Data.readDoubleBE(this._Offset);
        this._Advance(8);
        return s_Val;
    },

    ReadBoolean: function() {
        if (!this._Ensure(1, 'ReadBoolean')) {
            return false;
        }

        var s_Val = this._Data[this._Offset] !== 0;
        this._Advance(1);
        return s_Val;
    },

    ReadBytes: function(p_Count) {
        if (!this._CheckCount(p_Count, 'ReadBytes') || !this._Ensure(p_Count, 'ReadBytes')) {
            return Buffer.alloc(0);
        }

        var s_Val = Buffer.from(this._Data.subarray(this._Offset, this._Offset + p_Count));
        this._Advance(p_Count);
        return s_Val;
    },

    ReadString: function(p_Count) {
        if (!this._CheckCount(p_Count, 'ReadString') || !this._Ensure(p_Count, 'ReadString')) {
            return '';
        }

        var s_Val = this._Data.toString(this.Encoding, this._Offset, this._Offset + p_Count);
        this._Advance(p_Count);
        return s_Val;
    },

    ReadCString: function() {
        var s_End = this._Data.indexOf(0, this._Offset);
        if (s_End < 0) {
            if (this.Strict) {
                throw new RangeError('ReadCString: no null terminator in the ' + (this._Data.length - this._Offset) + ' remaining bytes');
            }
            return '';
        }

        var s_Val = this._Data.toString(this.Encoding, this._Offset, s_End);
        this._Advance(s_End - this._Offset + 1);
        return s_Val;
    },

    ReadRemaining: function() {
        var s_Val = Buffer.from(this._Data.subarray(this._Offset));
        this._Advance(s_Val.length);
        return s_Val;
    },

    Skip: function(p_Count) {
        if (!this._CheckCount(p_Count, 'Skip') || !this._Ensure(p_Count, 'Skip')) {
            return;
        }

        this._Advance(p_Count);
    },

    // --- Varint (LEB128) ---

    _VarIntFailure: function(p_Method, p_Reason) {
        if (this.Strict) {
            throw new RangeError(p_Method + ': ' + p_Reason + ' varint');
        }
        return 0;
    },

    _ReadVarUInt32: function(p_Method) {
        var s_Result = 0;
        var s_Index = this._Offset;
        for (var i = 0; i < 5; ++i) {
            if (s_Index >= this._Data.length) {
                return { Ok: false, Value: this._VarIntFailure(p_Method, 'truncated') };
            }
            var s_Byte = this._Data[s_Index++];
            // The 5th byte may only carry the top 4 bits of a 32-bit value and no continuation bit
            if (i == 4 && (s_Byte & 0xF0) !== 0) {
                return { Ok: false, Value: this._VarIntFailure(p_Method, 'overlong') };
            }
            s_Result += (s_Byte & 0x7F) * Math.pow(2, 7 * i);
            if ((s_Byte & 0x80) === 0) {
                this._Advance(s_Index - this._Offset);
                return { Ok: true, Value: s_Result };
            }
        }
        return { Ok: false, Value: this._VarIntFailure(p_Method, 'overlong') };
    },

    _ReadVarUInt64: function(p_Method) {
        var s_Result = s_BigZero;
        var s_Index = this._Offset;
        for (var i = 0; i < 10; ++i) {
            if (s_Index >= this._Data.length) {
                return { Ok: false, Value: this._VarIntFailure(p_Method, 'truncated') };
            }
            var s_Byte = this._Data[s_Index++];
            // The 10th byte may only carry the top bit of a 64-bit value and no continuation bit
            if (i == 9 && (s_Byte & 0xFE) !== 0) {
                return { Ok: false, Value: this._VarIntFailure(p_Method, 'overlong') };
            }
            s_Result = s_Result | ((BigInt(s_Byte) & s_BigByteMask) << (s_BigSeven * BigInt(i)));
            if ((s_Byte & 0x80) === 0) {
                this._Advance(s_Index - this._Offset);
                return { Ok: true, Value: s_Result };
            }
        }
        return { Ok: false, Value: this._VarIntFailure(p_Method, 'overlong') };
    },

    ReadVarUInt32: function() {
        return this._ReadVarUInt32('ReadVarUInt32').Value;
    },

    ReadVarInt32: function() {
        var s_Read = this._ReadVarUInt32('ReadVarInt32');
        if (!s_Read.Ok) {
            return s_Read.Value;
        }
        // ZigZag decode
        return (s_Read.Value % 2 === 0) ? s_Read.Value / 2 : -(s_Read.Value + 1) / 2;
    },

    ReadVarUInt64: function() {
        return this._ReadVarUInt64('ReadVarUInt64').Value;
    },

    ReadVarInt64: function() {
        var s_Read = this._ReadVarUInt64('ReadVarInt64');
        if (!s_Read.Ok) {
            return s_Read.Value;
        }
        // ZigZag decode
        return (s_Read.Value >> s_BigOne) ^ -(s_Read.Value & s_BigOne);
    },

    // --- Peek (non-consuming reads) ---

    PeekUInt8: function() {
        if (!this._Ensure(1, 'PeekUInt8')) {
            return 0;
        }
        return this._Data.readUInt8(this._Offset);
    },

    PeekUInt16: function() {
        if (!this._Ensure(2, 'PeekUInt16')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._Data.readUInt16LE(this._Offset) : this._Data.readUInt16BE(this._Offset);
    },

    PeekUInt32: function() {
        if (!this._Ensure(4, 'PeekUInt32')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._Data.readUInt32LE(this._Offset) : this._Data.readUInt32BE(this._Offset);
    },

    PeekUInt64: function() {
        if (!this._Ensure(8, 'PeekUInt64')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._Data.readBigUInt64LE(this._Offset) : this._Data.readBigUInt64BE(this._Offset);
    },

    PeekInt8: function() {
        if (!this._Ensure(1, 'PeekInt8')) {
            return 0;
        }
        return this._Data.readInt8(this._Offset);
    },

    PeekInt16: function() {
        if (!this._Ensure(2, 'PeekInt16')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._Data.readInt16LE(this._Offset) : this._Data.readInt16BE(this._Offset);
    },

    PeekInt32: function() {
        if (!this._Ensure(4, 'PeekInt32')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._Data.readInt32LE(this._Offset) : this._Data.readInt32BE(this._Offset);
    },

    PeekInt64: function() {
        if (!this._Ensure(8, 'PeekInt64')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._Data.readBigInt64LE(this._Offset) : this._Data.readBigInt64BE(this._Offset);
    },

    PeekFloat: function() {
        if (!this._Ensure(4, 'PeekFloat')) {
            return 0.0;
        }
        return (this.Endianness == 'little') ? this._Data.readFloatLE(this._Offset) : this._Data.readFloatBE(this._Offset);
    },

    PeekDouble: function() {
        if (!this._Ensure(8, 'PeekDouble')) {
            return 0.0;
        }
        return (this.Endianness == 'little') ? this._Data.readDoubleLE(this._Offset) : this._Data.readDoubleBE(this._Offset);
    },

    PeekBoolean: function() {
        if (!this._Ensure(1, 'PeekBoolean')) {
            return false;
        }
        return this._Data[this._Offset] !== 0;
    },

    PeekBytes: function(p_Count) {
        if (!this._CheckCount(p_Count, 'PeekBytes') || !this._Ensure(p_Count, 'PeekBytes')) {
            return Buffer.alloc(0);
        }
        return Buffer.from(this._Data.subarray(this._Offset, this._Offset + p_Count));
    }
};

// --- BinaryWriter -----------------------------------------------------------

var BinaryWriter = function(p_Endianness, p_Encoding) {
    if (!(this instanceof BinaryWriter)) {
        return new BinaryWriter(p_Endianness, p_Encoding);
    }

    // Written chunks, concatenated lazily (and cached) when ByteBuffer is read
    this._Chunks = [];
    this._Cache = null;

    // Set the endianness and encoding (validated)
    this.Endianness = ResolveEndianness(p_Endianness);
    this.Encoding = ResolveEncoding(p_Encoding);

    // Set the length to 0
    this.Length = 0;
};

BinaryWriter.prototype = {
    constructor: BinaryWriter,

    // All bytes written so far.
    get ByteBuffer() {
        if (this._Cache === null) {
            this._Cache = Buffer.concat(this._Chunks);
            this._Chunks = [this._Cache];
        }
        return this._Cache;
    },

    // Replaces everything written so far; Length follows the new buffer.
    set ByteBuffer(p_Value) {
        if (!(p_Value instanceof Buffer)) {
            throw new TypeError('ByteBuffer must be a Buffer (' + DescribeValue(p_Value) + ')');
        }
        this._Chunks = [p_Value];
        this._Cache = p_Value;
        this.Length = p_Value.length;
    },

    _Append: function(p_Buffer) {
        this._Chunks.push(p_Buffer);
        this._Cache = null;
        this.Length += p_Buffer.length;
    },

    WriteUInt8: function(p_Value) {
        CheckInteger(p_Value, 'WriteUInt8');
        var s_TempBuffer = Buffer.alloc(1);
        s_TempBuffer.writeUInt8(p_Value, 0);
        this._Append(s_TempBuffer);
    },

    WriteUInt16: function(p_Value) {
        CheckInteger(p_Value, 'WriteUInt16');
        var s_TempBuffer = Buffer.alloc(2);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeUInt16LE(p_Value, 0);
        } else {
            s_TempBuffer.writeUInt16BE(p_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteUInt32: function(p_Value) {
        CheckInteger(p_Value, 'WriteUInt32');
        var s_TempBuffer = Buffer.alloc(4);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeUInt32LE(p_Value, 0);
        } else {
            s_TempBuffer.writeUInt32BE(p_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteUInt64: function(p_Value) {
        var s_Value = ToBigInt(p_Value, 'WriteUInt64');
        var s_TempBuffer = Buffer.alloc(8);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeBigUInt64LE(s_Value, 0);
        } else {
            s_TempBuffer.writeBigUInt64BE(s_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteInt8: function(p_Value) {
        CheckInteger(p_Value, 'WriteInt8');
        var s_TempBuffer = Buffer.alloc(1);
        s_TempBuffer.writeInt8(p_Value, 0);
        this._Append(s_TempBuffer);
    },

    WriteInt16: function(p_Value) {
        CheckInteger(p_Value, 'WriteInt16');
        var s_TempBuffer = Buffer.alloc(2);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeInt16LE(p_Value, 0);
        } else {
            s_TempBuffer.writeInt16BE(p_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteInt32: function(p_Value) {
        CheckInteger(p_Value, 'WriteInt32');
        var s_TempBuffer = Buffer.alloc(4);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeInt32LE(p_Value, 0);
        } else {
            s_TempBuffer.writeInt32BE(p_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteInt64: function(p_Value) {
        var s_Value = ToBigInt(p_Value, 'WriteInt64');
        var s_TempBuffer = Buffer.alloc(8);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeBigInt64LE(s_Value, 0);
        } else {
            s_TempBuffer.writeBigInt64BE(s_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteFloat: function(p_Value) {
        CheckNumber(p_Value, 'WriteFloat');
        var s_TempBuffer = Buffer.alloc(4);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeFloatLE(p_Value, 0);
        } else {
            s_TempBuffer.writeFloatBE(p_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteDouble: function(p_Value) {
        CheckNumber(p_Value, 'WriteDouble');
        var s_TempBuffer = Buffer.alloc(8);
        if (this.Endianness == 'little') {
            s_TempBuffer.writeDoubleLE(p_Value, 0);
        } else {
            s_TempBuffer.writeDoubleBE(p_Value, 0);
        }
        this._Append(s_TempBuffer);
    },

    WriteBoolean: function(p_Value) {
        var s_TempBuffer = Buffer.alloc(1);
        s_TempBuffer[0] = p_Value ? 1 : 0;
        this._Append(s_TempBuffer);
    },

    WriteBytes: function(p_Value) {
        var s_TempBuffer;

        if (typeof p_Value == 'string') {
            // One byte per character code (latin1); wider characters are rejected
            s_TempBuffer = Buffer.alloc(p_Value.length);
            for (var i = 0; i < p_Value.length; ++i) {
                var s_Code = p_Value.charCodeAt(i);
                if (s_Code > 0xFF) {
                    throw new RangeError('WriteBytes: character at index ' + i + ' (U+' + s_Code.toString(16).toUpperCase() +
                        ') does not fit in one byte; use WriteString for encoded text');
                }
                s_TempBuffer[i] = s_Code;
            }
        } else if (p_Value instanceof Uint8Array) {
            // Copy, so later changes to the caller's buffer do not leak in
            s_TempBuffer = Buffer.from(p_Value);
        } else if (p_Value instanceof Array) {
            CheckByteArray(p_Value, 'WriteBytes');
            s_TempBuffer = Buffer.from(p_Value);
        } else {
            throw new Error('Invalid Buffer object provided (' + DescribeValue(p_Value) + ').');
        }

        this._Append(s_TempBuffer);
    },

    WriteString: function(p_Value) {
        if (typeof p_Value != 'string') {
            throw new Error('Invalid string provided (' + DescribeValue(p_Value) + ').');
        }

        this._Append(Buffer.from(p_Value, this.Encoding));
    },

    WriteCString: function(p_Value) {
        if (typeof p_Value != 'string') {
            throw new Error('Invalid string provided (' + DescribeValue(p_Value) + ').');
        }
        // Check the encoded bytes, not the characters: e.g. utf16le or hex output can contain 0x00
        var s_Encoded = Buffer.from(p_Value, this.Encoding);
        if (s_Encoded.indexOf(0) >= 0) {
            throw new RangeError('WriteCString: encoded string contains a 0x00 byte (' + this.Encoding + ')');
        }

        var s_TempBuffer = Buffer.alloc(s_Encoded.length + 1);
        s_Encoded.copy(s_TempBuffer, 0);
        this._Append(s_TempBuffer);
    },

    // --- Varint (LEB128) ---

    WriteVarUInt32: function(p_Value) {
        CheckInteger(p_Value, 'WriteVarUInt32');
        if (p_Value < 0 || p_Value > 0xFFFFFFFF) {
            throw new RangeError('WriteVarUInt32: value out of range 0..4294967295 (' + p_Value + ')');
        }

        var s_Bytes = [];
        var s_Value = p_Value;
        while (s_Value >= 0x80) {
            s_Bytes.push((s_Value % 0x80) | 0x80);
            s_Value = Math.floor(s_Value / 0x80);
        }
        s_Bytes.push(s_Value);
        this._Append(Buffer.from(s_Bytes));
    },

    WriteVarInt32: function(p_Value) {
        CheckInteger(p_Value, 'WriteVarInt32');
        if (p_Value < -0x80000000 || p_Value > 0x7FFFFFFF) {
            throw new RangeError('WriteVarInt32: value out of range -2147483648..2147483647 (' + p_Value + ')');
        }

        // ZigZag encode
        this.WriteVarUInt32(p_Value >= 0 ? p_Value * 2 : -p_Value * 2 - 1);
    },

    WriteVarUInt64: function(p_Value) {
        var s_Value = ToBigInt(p_Value, 'WriteVarUInt64');
        if (s_Value < s_BigZero || s_Value > s_BigMaxUInt64) {
            throw new RangeError('WriteVarUInt64: value out of range 0..2^64-1 (' + s_Value + ')');
        }

        var s_Bytes = [];
        while (s_Value > s_BigByteMask) {
            s_Bytes.push(Number(s_Value & s_BigByteMask) | 0x80);
            s_Value = s_Value >> s_BigSeven;
        }
        s_Bytes.push(Number(s_Value));
        this._Append(Buffer.from(s_Bytes));
    },

    WriteVarInt64: function(p_Value) {
        var s_Value = ToBigInt(p_Value, 'WriteVarInt64');
        if (s_Value < s_BigMinInt64 || s_Value > s_BigMaxInt64) {
            throw new RangeError('WriteVarInt64: value out of range -2^63..2^63-1 (' + s_Value + ')');
        }

        // ZigZag encode
        this.WriteVarUInt64(s_Value >= s_BigZero ? s_Value << s_BigOne : ((-s_Value) << s_BigOne) - s_BigOne);
    }
};

// Export our classes
module.exports = {
    BinaryReader: BinaryReader,
    BinaryWriter: BinaryWriter
};
