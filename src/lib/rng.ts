/** 文字列から32bitのハッシュを作る（シードの元） */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type Rng = () => number

/** シード付き乱数（mulberry32）。同じシードなら同じ問題順になる */
export function createRng(seed: string): Rng {
  let a = hashString(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 共有しやすい短いシード（紛らわしい文字を除いた6文字） */
export function newSeed(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  return [...buf].map((n) => chars[n % chars.length]).join('')
}
