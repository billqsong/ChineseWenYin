export class BitWriter {
  private bits: number[] = [];

  write(value: number, width: number): void {
    for (let bit = width - 1; bit >= 0; bit -= 1) {
      this.bits.push((value >> bit) & 1);
    }
  }

  toBytes(): Uint8Array {
    const output = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, index) => {
      output[Math.floor(index / 8)] |= bit << (7 - (index % 8));
    });
    return output;
  }
}
