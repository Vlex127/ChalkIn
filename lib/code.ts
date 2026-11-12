// Uniform 6-digit code. Rejection sampling avoids the slight bias you get
// from taking a random 32-bit number modulo 1,000,000.
export function generateCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return String(x % 1_000_000).padStart(6, '0');
}
