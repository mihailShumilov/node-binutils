/// <reference types="node" />

export = binutils;

declare namespace binutils {
    type Endianness = 'big' | 'little';

    class BinaryReader {
        /**
         * Wraps a copy of the input data and consumes it from the front as you read.
         * A `Buffer` input is copied, so the source is never mutated.
         * Throws if `input` is not a `Buffer`, array, or string.
         */
        constructor(
            input: Buffer | ReadonlyArray<number> | string,
            endianness?: Endianness,
            encoding?: BufferEncoding
        );

        /** The remaining unread bytes. Shrinks as `Read*` methods consume it. */
        ByteBuffer: Buffer;
        /** Byte order used by all multi-byte reads. */
        Endianness: Endianness;
        /** Encoding used to turn a string input into bytes. */
        Encoding: BufferEncoding;
        /** Length of the original input in bytes. Never changes as you read. */
        Length: number;
        /** Number of bytes consumed so far. */
        Position: number;

        /** Reads 1 byte. Returns 0 (without advancing) if no bytes remain. */
        ReadUInt8(): number;
        /** Reads 2 bytes. Returns 0 (without advancing) if fewer than 2 bytes remain. */
        ReadUInt16(): number;
        /** Reads 4 bytes. Returns 0 (without advancing) if fewer than 4 bytes remain. */
        ReadUInt32(): number;
        /** Reads 8 bytes as an unsigned BigInt. Returns the number 0 (without advancing) if fewer than 8 bytes remain. */
        ReadUInt64(): bigint | 0;
        /** Reads 1 byte, signed. Returns 0 (without advancing) if no bytes remain. */
        ReadInt8(): number;
        /** Reads 2 bytes, signed. Returns 0 (without advancing) if fewer than 2 bytes remain. */
        ReadInt16(): number;
        /** Reads 4 bytes, signed. Returns 0 (without advancing) if fewer than 4 bytes remain. */
        ReadInt32(): number;
        /** Reads 8 bytes as a signed BigInt. Returns the number 0 (without advancing) if fewer than 8 bytes remain. */
        ReadInt64(): bigint | 0;
        /** Reads 4 bytes as an IEEE-754 single. Returns 0 (without advancing) if fewer than 4 bytes remain. */
        ReadFloat(): number;
        /** Reads 8 bytes as an IEEE-754 double. Returns 0 (without advancing) if fewer than 8 bytes remain. */
        ReadDouble(): number;
        /** Copies `count` bytes into a new Buffer. Returns an empty Buffer (without advancing) if fewer than `count` bytes remain. */
        ReadBytes(count: number): Buffer;
    }

    class BinaryWriter {
        /** Accumulates bytes in an internal buffer that grows with every write. */
        constructor(endianness?: Endianness, encoding?: BufferEncoding);

        /** All bytes written so far. */
        ByteBuffer: Buffer;
        /** Byte order used by all multi-byte writes. */
        Endianness: Endianness;
        /** Stored on the instance; reserved. */
        Encoding: BufferEncoding;
        /** The current length of `ByteBuffer`. */
        Length: number;

        WriteUInt8(value: number): void;
        WriteUInt16(value: number): void;
        WriteUInt32(value: number): void;
        /** Accepts a number or BigInt; the value is coerced with `BigInt(value)`. */
        WriteUInt64(value: number | bigint): void;
        WriteInt8(value: number): void;
        WriteInt16(value: number): void;
        WriteInt32(value: number): void;
        /** Accepts a number or BigInt; the value is coerced with `BigInt(value)`. */
        WriteInt64(value: number | bigint): void;
        WriteFloat(value: number): void;
        WriteDouble(value: number): void;
        /** Strings are written as one byte per character code. Throws on any other input type. */
        WriteBytes(value: Buffer | ReadonlyArray<number> | string): void;
    }
}
