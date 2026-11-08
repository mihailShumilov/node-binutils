// Compatibility contract: without { Strict: true }, every call that worked in 0.3.0
// returns the same values and bytes, throws the same errors, and leaves the same
// enumerable shape (Object.keys / JSON.stringify). test/compat.test.js enforces this
// against a copy of 0.3.0. Strict mode only adds errors; it never changes a result.

// --- Shared state and helpers -----------------------------------------------

var BigZero = BigInt(0);
var BigOne = BigInt(1);
var BigSeven = BigInt(7);
var BigTwentyEight = BigInt(28);
var BigByteMask = BigInt(0x7F);
var BigMaxUInt64 = (BigOne << BigInt(64)) - BigOne;
var BigMinInt64 = -(BigOne << BigInt(63));
var BigMaxInt64 = (BigOne << BigInt(63)) - BigOne;

// Encoding area for fixed-width and varint writes (always copied out immediately)
var Scratch = Buffer.alloc(16);
var EmptyBuffer = Buffer.alloc(0);

// Marks the writer's exposed ByteBuffer as stale (null/undefined are valid assigned values)
var NotExposed = {};
// State for objects that cannot take a hidden _S property (frozen or non-extensible copies)
var DetachedState = new WeakMap();

var GlobalObject = (function() { return this; })();

var OptionKeys = { Strict: true };

function DescribeValue(p_Value) {
    if (p_Value === null) {
        return 'null';
    }
    if (p_Value instanceof Array) {
        return 'array';
    }
    return typeof p_Value;
}

// True when a constructor was called as a plain function (no `new`), e.g. BinaryReader(buf)
function IsPlainCall(p_This) {
    return p_This === undefined || p_This === null || p_This === GlobalObject || p_This === module.exports;
}

function DefineHidden(p_Object, p_Name, p_Value) {
    Object.defineProperty(p_Object, p_Name, { value: p_Value, writable: true, configurable: true, enumerable: false });
}

// 0.3.0 ignored extra constructor arguments, so anything that does not ask for strict mode
// is ignored too. Only an options object with a truthy Strict is checked for unknown keys.
function ReadStrictOption(p_Options, p_Class) {
    if (p_Options === null || typeof p_Options != 'object') {
        return false;
    }
    if (!p_Options.Strict) {
        // A mis-cased key ({ strict: true }) can only be a mistake made against the 0.4 API
        for (var s_Name in p_Options) {
            if (Object.prototype.hasOwnProperty.call(p_Options, s_Name) && s_Name !== 'Strict' && s_Name.toLowerCase() === 'strict') {
                throw new TypeError(p_Class + ": unknown option '" + s_Name + "' (supported: Strict)");
            }
        }
        return false;
    }
    for (var s_Key in p_Options) {
        if (Object.prototype.hasOwnProperty.call(p_Options, s_Key) && !OptionKeys[s_Key]) {
            throw new TypeError(p_Class + ": unknown option '" + s_Key + "' (supported: Strict)");
        }
    }
    return true;
}

function CheckEndianness(p_Endianness, p_Class) {
    if (p_Endianness && p_Endianness !== 'big' && p_Endianness !== 'little') {
        throw new TypeError(p_Class + ": invalid endianness (" + p_Endianness + "), expected 'big' or 'little'");
    }
}

function CheckEncoding(p_Encoding, p_Class) {
    if (p_Encoding && !Buffer.isEncoding(p_Encoding)) {
        throw new TypeError(p_Class + ': unknown encoding (' + p_Encoding + ')');
    }
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

function CheckMaxCharCode(p_String, p_Max, p_Method, p_Hint) {
    for (var i = 0; i < p_String.length; ++i) {
        var s_Code = p_String.charCodeAt(i);
        if (s_Code > p_Max) {
            throw new RangeError(p_Method + ': character at index ' + i + ' (U+' + s_Code.toString(16).toUpperCase() +
                ') ' + p_Hint);
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
        throw new TypeError(p_Method + ': expected a number, got ' + DescribeValue(p_Value) + ' (' + p_Value + ')');
    }
}

// Strict conversion: BigInt, or an integer Number that is exactly representable
function ToBigIntStrict(p_Value, p_Method) {
    if (typeof p_Value == 'bigint') {
        return p_Value;
    }
    if (typeof p_Value == 'number' && Number.isInteger(p_Value)) {
        if (!Number.isSafeInteger(p_Value)) {
            throw new RangeError(p_Method + ': ' + p_Value + ' is outside the safe integer range (\u00b1Number.MAX_SAFE_INTEGER) and may have lost precision; pass a BigInt');
        }
        return BigInt(p_Value);
    }
    throw new TypeError(p_Method + ': expected an integer number or BigInt, got ' + DescribeValue(p_Value) + ' (' + p_Value + ')');
}

// Lenient conversion used by the new varint writers (integer Number or BigInt)
function ToBigInt(p_Value, p_Method) {
    if (typeof p_Value == 'bigint') {
        return p_Value;
    }
    if (typeof p_Value == 'number' && Number.isInteger(p_Value)) {
        return BigInt(p_Value);
    }
    throw new TypeError(p_Method + ': expected an integer number or BigInt, got ' + DescribeValue(p_Value) + ' (' + p_Value + ')');
}

function ToBuffer(p_View) {
    return (p_View instanceof Buffer) ? p_View : Buffer.from(p_View.buffer, p_View.byteOffset, p_View.byteLength);
}

function CopyOut(p_Source, p_Start, p_End) {
    // An unpooled, exactly-sized ArrayBuffer of its own, as 0.3.0's results had. Every byte
    // is overwritten by the copy below, so skipping the zero-fill exposes nothing.
    var s_Copy = Buffer.allocUnsafeSlow(p_End - p_Start);
    p_Source.copy(s_Copy, 0, p_Start, p_End);
    return s_Copy;
}

function HideMembers(p_Prototype) {
    for (var s_Name in p_Prototype) {
        if (s_Name.charAt(0) === '_' || s_Name === 'constructor') {
            Object.defineProperty(p_Prototype, s_Name, { enumerable: false });
        }
    }
}

// --- BinaryReader -----------------------------------------------------------

// ByteBuffer is an own, enumerable accessor so Object.keys / JSON.stringify match 0.3.0.
var ReaderByteBufferProperty = {
    configurable: true,
    enumerable: true,
    get: function() {
        var s_State = this._S;
        if (s_State === undefined) {
            return undefined;
        }
        if (s_State.Owner !== this) {
            // An object inheriting from a reader (Object.create) sees its parent's data, as in 0.3.0
            return s_State.Owner === null ? s_State.View : ReaderByteBufferProperty.get.call(s_State.Owner);
        }
        if (s_State.ViewOffset !== s_State.Offset) {
            s_State.View = s_State.Data.subarray(s_State.Offset);
            s_State.ViewOffset = s_State.Offset;
        }
        return s_State.View;
    },
    set: function(p_Value) {
        // Like 0.3.0: no copy, Position and Length untouched; the next reads use the new data
        var s_State = ReaderState(this);
        s_State.Data = (p_Value instanceof Uint8Array) ? ToBuffer(p_Value) : EmptyBuffer;
        s_State.Offset = 0;
        s_State.View = p_Value;
        s_State.ViewOffset = 0;
    }
};

var BinaryReader = function(p_InputBuffer, p_Endianness, p_Encoding, p_Options) {
    if (!(this instanceof BinaryReader) && IsPlainCall(this)) {
        return new BinaryReader(p_InputBuffer, p_Endianness, p_Encoding, p_Options);
    }

    var s_Strict = ReadStrictOption(p_Options, 'BinaryReader');
    var s_Data;

    // Instantiate a private copy of the input
    if (p_InputBuffer instanceof Buffer) {
        s_Data = Buffer.from(p_InputBuffer);
    } else if (p_InputBuffer instanceof Uint8Array) {
        s_Data = Buffer.from(p_InputBuffer);
    } else if (p_InputBuffer instanceof Array || typeof p_InputBuffer == 'string') {
        if (s_Strict) {
            CheckEncoding(p_Encoding, 'BinaryReader');
            if (p_InputBuffer instanceof Array) {
                CheckByteArray(p_InputBuffer, 'BinaryReader');
            } else if (!p_Encoding) {
                CheckMaxCharCode(p_InputBuffer, 0x7F, 'BinaryReader',
                    'is not ASCII; pass the encoding explicitly (string input defaults to utf8)');
            }
        }
        s_Data = Buffer.from(p_InputBuffer, p_Encoding);
    } else {
        throw new Error('Invalid buffer input for BinaryReader (' + typeof p_InputBuffer + ')');
    }

    if (s_Strict) {
        CheckEndianness(p_Endianness, 'BinaryReader');
        CheckEncoding(p_Encoding, 'BinaryReader');
    }

    // All private state lives in one hidden object: two defineProperty calls per instance
    // instead of one per field keeps construction cheap.
    Object.defineProperty(this, 'ByteBuffer', ReaderByteBufferProperty);
    DefineHidden(this, '_S', { Owner: this, Data: s_Data, Offset: 0, View: s_Data, ViewOffset: 0, Strict: s_Strict });

    // Set the endianness
    this.Endianness = p_Endianness || 'big';

    // Set the encoding
    this.Encoding = p_Encoding || 'ascii';

    // Set the length
    this.Length = s_Data.length;

    // Set the position to 0
    this.Position = 0;
};

// Private helpers are plain functions taking the instance, so the public methods keep
// working when borrowed onto other objects or mixed in (they did in 0.3.0).

// Gives private state to an object that has none of its own: a copy made with
// Object.assign/spread, an Object.create fork, or a method borrowed with .call. 0.3.0 kept
// all state in public properties, so such objects worked; rebuild from the public ones.
function AdoptReader(p_Self) {
    var s_Value = p_Self.ByteBuffer;
    if (!Object.isExtensible(p_Self)) {
        // Cannot add _S: work from the public ByteBuffer on every call and write progress
        // back to it, as 0.3.0 did (so a frozen copy re-reads the same bytes, like 0.3.0).
        var s_Detached = { Owner: null, Data: (s_Value instanceof Uint8Array) ? ToBuffer(s_Value) : EmptyBuffer,
            Offset: 0, View: s_Value, ViewOffset: 0, Strict: false };
        DetachedState.set(p_Self, s_Detached);
        return s_Detached;
    }
    var s_State = { Owner: p_Self, Data: EmptyBuffer, Offset: 0, View: EmptyBuffer, ViewOffset: 0,
        Strict: p_Self._S !== undefined && p_Self._S.Strict === true };
    DefineHidden(p_Self, '_S', s_State);
    Object.defineProperty(p_Self, 'ByteBuffer', ReaderByteBufferProperty);
    p_Self.ByteBuffer = s_Value;
    return s_State;
}

// The reader's own private state, adopting the object first if it has none.
function ReaderState(p_Self) {
    var s_State = p_Self._S;
    return (s_State !== undefined && s_State.Owner === p_Self) ? s_State : AdoptReader(p_Self);
}

// Returns true when p_Count bytes remain. Otherwise throws in strict mode, or returns false.
function Ensure(p_Self, p_Count, p_Method) {
    ReaderState(p_Self);
    var s_Remaining = p_Self._S.Data.length - p_Self._S.Offset;
    if (p_Count <= s_Remaining) {
        return true;
    }
    if (p_Self._S.Strict) {
        throw new RangeError(p_Method + ': need ' + p_Count + ' bytes, ' + s_Remaining + ' remaining');
    }
    return false;
}

// Resolves a caller-supplied byte count exactly like 0.3.0's ReadBytes: -1 means
// "return the empty value"; a count Buffer.alloc rejects throws the same error.
function ResolveCount(p_Self, p_Count, p_Method) {
    ReaderState(p_Self);
    var s_Remaining = p_Self._S.Data.length - p_Self._S.Offset;
    if (p_Self._S.Strict) {
        if (!IsByteCount(p_Count)) {
            throw new RangeError(p_Method + ': invalid byte count (' + DescribeValue(p_Count) + ' ' + p_Count + ')');
        }
        if (p_Count > s_Remaining) {
            throw new RangeError(p_Method + ': need ' + p_Count + ' bytes, ' + s_Remaining + ' remaining');
        }
        return p_Count;
    }
    if (p_Count > s_Remaining) {
        return -1;
    }
    if (!IsByteCount(p_Count)) {
        // Throws for negative, NaN and non-number counts; truncates fractions
        return Buffer.alloc(p_Count).length;
    }
    return p_Count;
}

// 0.3.0 advanced Position with ++ in ReadUInt8/ReadInt8 and += elsewhere; the difference
// shows when a caller stored a string in Position, so p_Increment keeps it.
function Advance(p_Self, p_Count, p_Increment) {
    var s_State = p_Self._S;
    s_State.Offset += p_Count;
    if (p_Increment) {
        ++p_Self.Position;
    } else {
        p_Self.Position += p_Count;
    }
    if (s_State.Owner === null) {
        p_Self.ByteBuffer = s_State.Data.subarray(s_State.Offset);
    }
}

function VarIntFailure(p_Self, p_Method, p_Reason) {
    if (p_Self._S.Strict) {
        throw new RangeError(p_Method + ': ' + p_Reason + ' varint');
    }
    return -1;
}

// Returns the decoded value, or -1 (non-strict) when truncated or overlong.
function DecodeVarUInt32(p_Self, p_Method) {
    ReaderState(p_Self);
    var s_Result = 0;
    var s_Multiplier = 1;
    var s_Index = p_Self._S.Offset;
    var s_End = p_Self._S.Data.length;
    for (var i = 0; i < 5; ++i) {
        if (s_Index >= s_End) {
            return VarIntFailure(p_Self, p_Method, 'truncated');
        }
        var s_Byte = p_Self._S.Data[s_Index++];
        // The 5th byte may only carry the top 4 bits of a 32-bit value and no continuation bit
        if (i == 4 && s_Byte > 0x0F) {
            return VarIntFailure(p_Self, p_Method, 'overlong');
        }
        s_Result += (s_Byte & 0x7F) * s_Multiplier;
        if (s_Byte < 0x80) {
            Advance(p_Self, s_Index - p_Self._S.Offset);
            return s_Result;
        }
        s_Multiplier *= 0x80;
    }
    return VarIntFailure(p_Self, p_Method, 'overlong');
}

// Returns the decoded BigInt, or -1 (non-strict) when truncated or overlong.
function DecodeVarUInt64(p_Self, p_Method) {
    ReaderState(p_Self);
    // Bytes 0-3 fill 28 low bits, bytes 4-9 at most 36 high bits: both stay exact Numbers
    var s_Low = 0;
    var s_High = 0;
    var s_Multiplier = 1;
    var s_Index = p_Self._S.Offset;
    var s_End = p_Self._S.Data.length;
    for (var i = 0; i < 10; ++i) {
        if (s_Index >= s_End) {
            return VarIntFailure(p_Self, p_Method, 'truncated');
        }
        var s_Byte = p_Self._S.Data[s_Index++];
        // The 10th byte may only carry the top bit of a 64-bit value and no continuation bit
        if (i == 9 && s_Byte > 0x01) {
            return VarIntFailure(p_Self, p_Method, 'overlong');
        }
        if (i == 4) {
            s_Multiplier = 1;
        }
        if (i < 4) {
            s_Low += (s_Byte & 0x7F) * s_Multiplier;
        } else {
            s_High += (s_Byte & 0x7F) * s_Multiplier;
        }
        if (s_Byte < 0x80) {
            Advance(p_Self, s_Index - p_Self._S.Offset);
            return s_High === 0 ? BigInt(s_Low) : (BigInt(s_High) << BigTwentyEight) | BigInt(s_Low);
        }
        s_Multiplier *= 0x80;
    }
    return VarIntFailure(p_Self, p_Method, 'overlong');
}

BinaryReader.prototype = {
    constructor: BinaryReader,

    ReadUInt8: function() {
        if (!Ensure(this, 1, 'ReadUInt8')) {
            return 0;
        }

        var s_Val = this._S.Data.readUInt8(this._S.Offset);
        Advance(this, 1, true);
        return s_Val;
    },

    ReadUInt16: function() {
        if (!Ensure(this, 2, 'ReadUInt16')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readUInt16LE(this._S.Offset) : this._S.Data.readUInt16BE(this._S.Offset);
        Advance(this, 2);
        return s_Val;
    },

    ReadUInt32: function() {
        if (!Ensure(this, 4, 'ReadUInt32')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readUInt32LE(this._S.Offset) : this._S.Data.readUInt32BE(this._S.Offset);
        Advance(this, 4);
        return s_Val;
    },

    ReadUInt64: function() {
        if (!Ensure(this, 8, 'ReadUInt64')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readBigUInt64LE(this._S.Offset) : this._S.Data.readBigUInt64BE(this._S.Offset);
        Advance(this, 8);
        return s_Val;
    },

    ReadInt8: function() {
        if (!Ensure(this, 1, 'ReadInt8')) {
            return 0;
        }

        var s_Val = this._S.Data.readInt8(this._S.Offset);
        Advance(this, 1, true);
        return s_Val;
    },

    ReadInt16: function() {
        if (!Ensure(this, 2, 'ReadInt16')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readInt16LE(this._S.Offset) : this._S.Data.readInt16BE(this._S.Offset);
        Advance(this, 2);
        return s_Val;
    },

    ReadInt32: function() {
        if (!Ensure(this, 4, 'ReadInt32')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readInt32LE(this._S.Offset) : this._S.Data.readInt32BE(this._S.Offset);
        Advance(this, 4);
        return s_Val;
    },

    ReadInt64: function() {
        if (!Ensure(this, 8, 'ReadInt64')) {
            return 0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readBigInt64LE(this._S.Offset) : this._S.Data.readBigInt64BE(this._S.Offset);
        Advance(this, 8);
        return s_Val;
    },

    ReadFloat: function() {
        if (!Ensure(this, 4, 'ReadFloat')) {
            return 0.0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readFloatLE(this._S.Offset) : this._S.Data.readFloatBE(this._S.Offset);
        Advance(this, 4);
        return s_Val;
    },

    ReadDouble: function() {
        if (!Ensure(this, 8, 'ReadDouble')) {
            return 0.0;
        }

        var s_Val = (this.Endianness == 'little') ? this._S.Data.readDoubleLE(this._S.Offset) : this._S.Data.readDoubleBE(this._S.Offset);
        Advance(this, 8);
        return s_Val;
    },

    ReadBoolean: function() {
        if (!Ensure(this, 1, 'ReadBoolean')) {
            return false;
        }

        var s_Val = this._S.Data[this._S.Offset] !== 0;
        Advance(this, 1);
        return s_Val;
    },

    ReadBytes: function(p_Count) {
        var s_Count = ResolveCount(this, p_Count, 'ReadBytes');
        if (s_Count < 0) {
            return Buffer.alloc(0);
        }

        var s_Val = CopyOut(this._S.Data, this._S.Offset, this._S.Offset + s_Count);
        Advance(this, s_Count);
        return s_Val;
    },

    ReadString: function(p_Count) {
        if (ReaderState(this).Strict) {
            var s_Count = ResolveCount(this, p_Count, 'ReadString');
            var s_Text = this._S.Data.toString(this.Encoding, this._S.Offset, this._S.Offset + s_Count);
            Advance(this, s_Count);
            return s_Text;
        }

        // 0.3.0 semantics, including its coercion of unusual counts (e.g. ReadString()
        // returns everything left without consuming it); only Position is kept an integer.
        var s_Remaining = this._S.Data.subarray(this._S.Offset);
        if (p_Count <= 0 || p_Count > s_Remaining.length) {
            return '';
        }

        var s_Val = s_Remaining.toString(this.Encoding, 0, p_Count);
        Advance(this, s_Remaining.length - s_Remaining.slice(p_Count).length);
        return s_Val;
    },

    ReadCString: function() {
        ReaderState(this);
        var s_End = this._S.Data.indexOf(0, this._S.Offset);
        if (s_End < 0) {
            if (ReaderState(this).Strict) {
                throw new RangeError('ReadCString: no null terminator in the ' + (this._S.Data.length - this._S.Offset) + ' remaining bytes');
            }
            return '';
        }

        var s_Val = this._S.Data.toString(this.Encoding, this._S.Offset, s_End);
        Advance(this, s_End - this._S.Offset + 1);
        return s_Val;
    },

    ReadRemaining: function() {
        ReaderState(this);
        var s_Val = CopyOut(this._S.Data, this._S.Offset, this._S.Data.length);
        Advance(this, s_Val.length);
        return s_Val;
    },

    Skip: function(p_Count) {
        var s_Count = ResolveCount(this, p_Count, 'Skip');
        if (s_Count > 0) {
            Advance(this, s_Count);
        }
    },

    // --- Varint (LEB128) ---

    ReadVarUInt32: function() {
        var s_Val = DecodeVarUInt32(this, 'ReadVarUInt32');
        return s_Val < 0 ? 0 : s_Val;
    },

    ReadVarInt32: function() {
        var s_Val = DecodeVarUInt32(this, 'ReadVarInt32');
        if (s_Val < 0) {
            return 0;
        }
        // ZigZag decode
        return (s_Val % 2 === 0) ? s_Val / 2 : -(s_Val + 1) / 2;
    },

    ReadVarUInt64: function() {
        var s_Val = DecodeVarUInt64(this, 'ReadVarUInt64');
        return s_Val === -1 ? 0 : s_Val;
    },

    ReadVarInt64: function() {
        var s_Val = DecodeVarUInt64(this, 'ReadVarInt64');
        if (s_Val === -1) {
            return 0;
        }
        // ZigZag decode
        return (s_Val >> BigOne) ^ -(s_Val & BigOne);
    },

    // --- Peek (non-consuming reads) ---

    PeekUInt8: function() {
        if (!Ensure(this, 1, 'PeekUInt8')) {
            return 0;
        }
        return this._S.Data.readUInt8(this._S.Offset);
    },

    PeekUInt16: function() {
        if (!Ensure(this, 2, 'PeekUInt16')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readUInt16LE(this._S.Offset) : this._S.Data.readUInt16BE(this._S.Offset);
    },

    PeekUInt32: function() {
        if (!Ensure(this, 4, 'PeekUInt32')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readUInt32LE(this._S.Offset) : this._S.Data.readUInt32BE(this._S.Offset);
    },

    PeekUInt64: function() {
        if (!Ensure(this, 8, 'PeekUInt64')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readBigUInt64LE(this._S.Offset) : this._S.Data.readBigUInt64BE(this._S.Offset);
    },

    PeekInt8: function() {
        if (!Ensure(this, 1, 'PeekInt8')) {
            return 0;
        }
        return this._S.Data.readInt8(this._S.Offset);
    },

    PeekInt16: function() {
        if (!Ensure(this, 2, 'PeekInt16')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readInt16LE(this._S.Offset) : this._S.Data.readInt16BE(this._S.Offset);
    },

    PeekInt32: function() {
        if (!Ensure(this, 4, 'PeekInt32')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readInt32LE(this._S.Offset) : this._S.Data.readInt32BE(this._S.Offset);
    },

    PeekInt64: function() {
        if (!Ensure(this, 8, 'PeekInt64')) {
            return 0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readBigInt64LE(this._S.Offset) : this._S.Data.readBigInt64BE(this._S.Offset);
    },

    PeekFloat: function() {
        if (!Ensure(this, 4, 'PeekFloat')) {
            return 0.0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readFloatLE(this._S.Offset) : this._S.Data.readFloatBE(this._S.Offset);
    },

    PeekDouble: function() {
        if (!Ensure(this, 8, 'PeekDouble')) {
            return 0.0;
        }
        return (this.Endianness == 'little') ? this._S.Data.readDoubleLE(this._S.Offset) : this._S.Data.readDoubleBE(this._S.Offset);
    },

    PeekBoolean: function() {
        if (!Ensure(this, 1, 'PeekBoolean')) {
            return false;
        }
        return this._S.Data[this._S.Offset] !== 0;
    },

    PeekBytes: function(p_Count) {
        var s_Count = ResolveCount(this, p_Count, 'PeekBytes');
        if (s_Count < 0) {
            return Buffer.alloc(0);
        }
        return CopyOut(this._S.Data, this._S.Offset, this._S.Offset + s_Count);
    }
};

HideMembers(BinaryReader.prototype);

// --- BinaryWriter -----------------------------------------------------------

// Bytes live in one growable buffer (_S.Buffer, _S.Used bytes in use). Reading ByteBuffer
// trims it to an exact-size Buffer and hands out that same object until the next write,
// which reallocates - so a returned Buffer is a stable snapshot, edits made to it before
// the next write are kept (as in 0.3.0), and later writes never alter it.
var WriterByteBufferProperty = {
    configurable: true,
    enumerable: true,
    get: function() {
        // Hand out an exact-size Buffer with its own ArrayBuffer, like 0.3.0's concat result.
        // When the working buffer is exactly full it is returned as is; otherwise an exact copy
        // is made and the growable working buffer is kept. Either way the same object is
        // returned until the next write.
        var s_State = this._S;
        if (s_State === undefined) {
            return undefined;
        }
        if (s_State.Owner !== this) {
            // An object inheriting from a writer (Object.create) sees its parent's bytes, as in 0.3.0
            return s_State.Owner === null ? s_State.Exposed : WriterByteBufferProperty.get.call(s_State.Owner);
        }
        if (s_State.Exposed === NotExposed) {
            if (s_State.Used > 0 && s_State.Buffer.length === s_State.Used) {
                s_State.Exposed = s_State.Buffer;
            } else {
                s_State.Exposed = CopyOut(s_State.Buffer, 0, s_State.Used);
            }
        }
        return s_State.Exposed;
    },
    set: function(p_Value) {
        // Like 0.3.0: no copy and Length untouched (the next write reconciles them)
        var s_State = WriterState(this);
        s_State.Exposed = p_Value;
        if (p_Value instanceof Uint8Array) {
            s_State.Buffer = ToBuffer(p_Value);
            s_State.Used = p_Value.length;
        } else {
            s_State.Buffer = EmptyBuffer;
            s_State.Used = NaN; // never equals Length, so every write takes the 0.3.0 path
        }
    }
};

var BinaryWriter = function(p_Endianness, p_Encoding, p_Options) {
    if (!(this instanceof BinaryWriter) && IsPlainCall(this)) {
        return new BinaryWriter(p_Endianness, p_Encoding, p_Options);
    }

    var s_Strict = ReadStrictOption(p_Options, 'BinaryWriter');
    if (s_Strict) {
        CheckEndianness(p_Endianness, 'BinaryWriter');
        CheckEncoding(p_Encoding, 'BinaryWriter');
    }

    // All private state lives in one hidden object (see BinaryReader)
    Object.defineProperty(this, 'ByteBuffer', WriterByteBufferProperty);
    DefineHidden(this, '_S', { Owner: this, Buffer: EmptyBuffer, Used: 0, Exposed: NotExposed, ReadStreak: 0, Strict: s_Strict });

    // Set the endianness
    this.Endianness = p_Endianness || 'big';

    // Set the encoding
    this.Encoding = p_Encoding || 'ascii';

    // Set the length to 0
    this.Length = 0;
};

// See AdoptReader.
function AdoptWriter(p_Self) {
    var s_Value = p_Self.ByteBuffer;
    if (!Object.isExtensible(p_Self)) {
        // See AdoptReader: every write takes the 0.3.0 path on the public properties
        var s_Detached = { Owner: null, Buffer: EmptyBuffer, Used: NaN, Exposed: s_Value, ReadStreak: 0, Strict: false };
        DetachedState.set(p_Self, s_Detached);
        return s_Detached;
    }
    var s_State = { Owner: p_Self, Buffer: EmptyBuffer, Used: NaN, Exposed: NotExposed, ReadStreak: 0,
        Strict: p_Self._S !== undefined && p_Self._S.Strict === true };
    DefineHidden(p_Self, '_S', s_State);
    Object.defineProperty(p_Self, 'ByteBuffer', WriterByteBufferProperty);
    p_Self.ByteBuffer = s_Value;
    return s_State;
}

// The writer's own private state, adopting the object first if it has none.
function WriterState(p_Self) {
    var s_State = p_Self._S;
    return (s_State !== undefined && s_State.Owner === p_Self) ? s_State : AdoptWriter(p_Self);
}

// Appends the first p_Count bytes of p_Source.
function Append(p_Self, p_Source, p_Count) {
    WriterState(p_Self);
    if (p_Self.Length !== p_Self._S.Used) {
        // Length was changed by hand or ByteBuffer was assigned: reproduce 0.3.0 exactly
        p_Self.Length += p_Count;
        var s_Result = Buffer.concat([p_Self.ByteBuffer, p_Source.subarray(0, p_Count)], p_Self.Length);
        if (p_Self._S.Owner === null) {
            p_Self.ByteBuffer = s_Result;
            return;
        }
        p_Self._S.Buffer = s_Result;
        p_Self._S.Used = s_Result.length;
        p_Self._S.Exposed = s_Result;
        return;
    }

    var s_Detach = false;
    if (p_Self._S.Exposed === NotExposed) {
        p_Self._S.ReadStreak = 0;
    } else {
        ++p_Self._S.ReadStreak;
        if (p_Self._S.Exposed.buffer === p_Self._S.Buffer.buffer) {
            // The caller holds the working buffer (returned by the getter, assigned, or a
            // legacy-path result). 0.3.0 detached on every write, so never write into it.
            s_Detach = true;
        } else {
            // The caller may have patched the returned copy; in 0.3.0 those bytes carried
            // into the next write. Pull them in once; that copy is never touched again.
            p_Self._S.Exposed.copy(p_Self._S.Buffer, 0, 0, p_Self._S.Used);
        }
    }

    var s_Needed = p_Self._S.Used + p_Count;
    if (s_Needed > p_Self._S.Buffer.length || s_Detach) {
        // Grow geometrically (zeroed slack), except when ByteBuffer is read after every
        // write: then an exact fit, fully overwritten below, lets the getter return the
        // working buffer without copying it.
        var s_Grown = p_Self._S.ReadStreak > 1 ?
            Buffer.allocUnsafeSlow(s_Needed) :
            Buffer.alloc(Math.max(s_Needed, p_Self._S.Buffer.length * 2, 64));
        p_Self._S.Buffer.copy(s_Grown, 0, 0, p_Self._S.Used);
        p_Self._S.Buffer = s_Grown;
    }
    p_Source.copy(p_Self._S.Buffer, p_Self._S.Used, 0, p_Count);
    p_Self._S.Used = s_Needed;
    p_Self.Length = s_Needed;
    p_Self._S.Exposed = NotExposed;
}

// Strict mode: reject characters the single-byte encodings would silently mangle.
function CheckEncodable(p_Self, p_Value, p_Method) {
    var s_Encoding = String(p_Self.Encoding).toLowerCase();
    if (s_Encoding == 'ascii') {
        CheckMaxCharCode(p_Value, 0x7F, p_Method, 'is not representable in ascii');
    } else if (s_Encoding == 'latin1' || s_Encoding == 'binary') {
        CheckMaxCharCode(p_Value, 0xFF, p_Method, 'is not representable in latin1');
    }
}

BinaryWriter.prototype = {
    constructor: BinaryWriter,

    WriteUInt8: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckInteger(p_Value, 'WriteUInt8');
        }
        Scratch.writeUInt8(p_Value, 0);
        Append(this, Scratch, 1);
    },

    WriteUInt16: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckInteger(p_Value, 'WriteUInt16');
        }
        if (this.Endianness == 'little') {
            Scratch.writeUInt16LE(p_Value, 0);
        } else {
            Scratch.writeUInt16BE(p_Value, 0);
        }
        Append(this, Scratch, 2);
    },

    WriteUInt32: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckInteger(p_Value, 'WriteUInt32');
        }
        if (this.Endianness == 'little') {
            Scratch.writeUInt32LE(p_Value, 0);
        } else {
            Scratch.writeUInt32BE(p_Value, 0);
        }
        Append(this, Scratch, 4);
    },

    WriteUInt64: function(p_Value) {
        var s_Value = WriterState(this).Strict ? ToBigIntStrict(p_Value, 'WriteUInt64') : BigInt(p_Value);
        if (this.Endianness == 'little') {
            Scratch.writeBigUInt64LE(s_Value, 0);
        } else {
            Scratch.writeBigUInt64BE(s_Value, 0);
        }
        Append(this, Scratch, 8);
    },

    WriteInt8: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckInteger(p_Value, 'WriteInt8');
        }
        Scratch.writeInt8(p_Value, 0);
        Append(this, Scratch, 1);
    },

    WriteInt16: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckInteger(p_Value, 'WriteInt16');
        }
        if (this.Endianness == 'little') {
            Scratch.writeInt16LE(p_Value, 0);
        } else {
            Scratch.writeInt16BE(p_Value, 0);
        }
        Append(this, Scratch, 2);
    },

    WriteInt32: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckInteger(p_Value, 'WriteInt32');
        }
        if (this.Endianness == 'little') {
            Scratch.writeInt32LE(p_Value, 0);
        } else {
            Scratch.writeInt32BE(p_Value, 0);
        }
        Append(this, Scratch, 4);
    },

    WriteInt64: function(p_Value) {
        var s_Value = WriterState(this).Strict ? ToBigIntStrict(p_Value, 'WriteInt64') : BigInt(p_Value);
        if (this.Endianness == 'little') {
            Scratch.writeBigInt64LE(s_Value, 0);
        } else {
            Scratch.writeBigInt64BE(s_Value, 0);
        }
        Append(this, Scratch, 8);
    },

    WriteFloat: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckNumber(p_Value, 'WriteFloat');
        }
        if (this.Endianness == 'little') {
            Scratch.writeFloatLE(p_Value, 0);
        } else {
            Scratch.writeFloatBE(p_Value, 0);
        }
        Append(this, Scratch, 4);
    },

    WriteDouble: function(p_Value) {
        if (WriterState(this).Strict) {
            CheckNumber(p_Value, 'WriteDouble');
        }
        if (this.Endianness == 'little') {
            Scratch.writeDoubleLE(p_Value, 0);
        } else {
            Scratch.writeDoubleBE(p_Value, 0);
        }
        Append(this, Scratch, 8);
    },

    WriteBoolean: function(p_Value) {
        Scratch[0] = p_Value ? 1 : 0;
        Append(this, Scratch, 1);
    },

    WriteBytes: function(p_Value) {
        var s_TempBuffer;

        if (typeof p_Value == 'string') {
            if (WriterState(this).Strict) {
                CheckMaxCharCode(p_Value, 0xFF, 'WriteBytes', 'does not fit in one byte; use WriteString for encoded text');
            }
            // One byte per character code; like 0.3.0, wider codes keep their low byte
            s_TempBuffer = Buffer.alloc(p_Value.length);
            for (var i = 0; i < p_Value.length; ++i) {
                s_TempBuffer[i] = p_Value.charCodeAt(i);
            }
        } else if (p_Value instanceof Uint8Array) {
            s_TempBuffer = ToBuffer(p_Value);
        } else if (p_Value instanceof Array) {
            if (WriterState(this).Strict) {
                CheckByteArray(p_Value, 'WriteBytes');
            }
            s_TempBuffer = Buffer.from(p_Value);
        } else {
            throw new Error("Invalid Buffer object provided.");
        }

        Append(this, s_TempBuffer, s_TempBuffer.length);
    },

    WriteString: function(p_Value) {
        if (typeof p_Value != 'string') {
            throw new Error("Invalid string provided.");
        }
        if (WriterState(this).Strict) {
            CheckEncodable(this, p_Value, 'WriteString');
        }

        var s_TempBuffer = Buffer.from(p_Value, this.Encoding);
        Append(this, s_TempBuffer, s_TempBuffer.length);
    },

    WriteCString: function(p_Value) {
        if (typeof p_Value != 'string') {
            throw new TypeError('WriteCString: expected a string, got ' + DescribeValue(p_Value));
        }
        if (WriterState(this).Strict) {
            CheckEncodable(this, p_Value, 'WriteCString');
        }

        // Check the encoded bytes, not the characters: e.g. utf16le or hex output can contain 0x00
        var s_Encoded = Buffer.from(p_Value, this.Encoding);
        if (s_Encoded.indexOf(0) >= 0) {
            throw new RangeError('WriteCString: encoded string contains a 0x00 byte (' + this.Encoding + ')');
        }

        Append(this, s_Encoded, s_Encoded.length);
        Scratch[0] = 0;
        Append(this, Scratch, 1);
    },

    // --- Varint (LEB128) ---

    WriteVarUInt32: function(p_Value) {
        CheckInteger(p_Value, 'WriteVarUInt32');
        if (p_Value < 0 || p_Value > 0xFFFFFFFF) {
            throw new RangeError('WriteVarUInt32: value out of range 0..4294967295 (' + p_Value + ')');
        }

        var s_Count = 0;
        var s_Value = p_Value;
        while (s_Value >= 0x80) {
            Scratch[s_Count++] = (s_Value % 0x80) | 0x80;
            s_Value = Math.floor(s_Value / 0x80);
        }
        Scratch[s_Count++] = s_Value;
        Append(this, Scratch, s_Count);
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
        var s_Value = WriterState(this).Strict ? ToBigIntStrict(p_Value, 'WriteVarUInt64') : ToBigInt(p_Value, 'WriteVarUInt64');
        if (s_Value < BigZero || s_Value > BigMaxUInt64) {
            throw new RangeError('WriteVarUInt64: value out of range 0..2^64-1 (' + s_Value + ')');
        }

        var s_Count = 0;
        while (s_Value > BigByteMask) {
            Scratch[s_Count++] = Number(s_Value & BigByteMask) | 0x80;
            s_Value = s_Value >> BigSeven;
        }
        Scratch[s_Count++] = Number(s_Value);
        Append(this, Scratch, s_Count);
    },

    WriteVarInt64: function(p_Value) {
        var s_Value = WriterState(this).Strict ? ToBigIntStrict(p_Value, 'WriteVarInt64') : ToBigInt(p_Value, 'WriteVarInt64');
        if (s_Value < BigMinInt64 || s_Value > BigMaxInt64) {
            throw new RangeError('WriteVarInt64: value out of range -2^63..2^63-1 (' + s_Value + ')');
        }

        // ZigZag encode
        this.WriteVarUInt64(s_Value >= BigZero ? s_Value << BigOne : ((-s_Value) << BigOne) - BigOne);
    }
};

HideMembers(BinaryWriter.prototype);

// Shared members added after the prototypes, all non-enumerable.
var StrictProperty = {
    configurable: true,
    enumerable: false,
    // Reports the mode chosen at construction
    get: function() {
        return this._S === undefined ? undefined : WriterState(this).Strict;
    },
    // In 0.3.0 assigning Strict just stored a value; keep that, without changing the mode
    set: function(p_Value) {
        if (Object.isExtensible(this)) {
            Object.defineProperty(this, 'Strict', { value: p_Value, writable: true, enumerable: true, configurable: true });
        }
    }
};

// util.inspect / console.log print the same plain object as 0.3.0 did
function InspectPlain() {
    var s_Plain = {};
    var s_Keys = Object.keys(this);
    for (var i = 0; i < s_Keys.length; ++i) {
        s_Plain[s_Keys[i]] = this[s_Keys[i]];
    }
    return s_Plain;
}

// Instances carry their own _S; objects that could not take one find it here
var DetachedStateProperty = {
    configurable: true,
    enumerable: false,
    get: function() {
        return DetachedState.get(this);
    }
};

[BinaryReader.prototype, BinaryWriter.prototype].forEach(function(p_Prototype) {
    Object.defineProperty(p_Prototype, '_S', DetachedStateProperty);
    Object.defineProperty(p_Prototype, 'Strict', StrictProperty);
    Object.defineProperty(p_Prototype, Symbol.for('nodejs.util.inspect.custom'),
        { value: InspectPlain, writable: true, configurable: true, enumerable: false });
});

// Export our classes
module.exports = {
    BinaryReader: BinaryReader,
    BinaryWriter: BinaryWriter
};
