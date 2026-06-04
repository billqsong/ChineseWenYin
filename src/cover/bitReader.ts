export class BitReader {
  private bitOffset = 0;

  constructor(private readonly bytes: Uint8Array, private readonly totalBits = bytes.length * 8) {}

  remaining(): number {
    return this.totalBits - this.bitOffset;
  }

  read(width: number): number {
    let value = 0;
    for (let index = 0; index < width; index += 1) {
      value <<= 1;
      if (this.bitOffset < this.totalBits) {
        const byte = this.bytes[Math.floor(this.bitOffset / 8)];
        value |= (byte >> (7 - (this.bitOffset % 8))) & 1;
      }
      this.bitOffset += 1;
    }
    return value;
  }
}
