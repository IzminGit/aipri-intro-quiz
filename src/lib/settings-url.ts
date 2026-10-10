import { normalizeCount, type GameSettings } from './quiz.ts'

/**
 * 「挑戦状」リンク。同じ URL を開いた友達には同じ問題が出る。
 *   #/play?sets=onegai-aipri,himitsu-aipri&n=10&seed=ab3kd9
 */
export function settingsToHash(s: GameSettings): string {
  const q = new URLSearchParams({ sets: s.sets.join(','), n: String(s.count), seed: s.seed })
  return `#/play?${q.toString().replace(/%2C/gu, ',')}`
}

export function settingsFromHash(hash: string, knownSets: readonly string[]): GameSettings | null {
  const m = /^#\/play\?(.*)$/u.exec(hash)
  if (!m) return null
  const q = new URLSearchParams(m[1])
  const sets = (q.get('sets') ?? '').split(',').filter((s) => knownSets.includes(s))
  const n = Number(q.get('n'))
  const seed = q.get('seed') ?? ''
  if (!sets.length || !/^[a-z0-9]{1,32}$/u.test(seed)) return null
  const count = normalizeCount(n)
  return { sets, count, seed }
}

/** 自己ベストの保存キー（同じ条件どうしで比べる） */
export const bestKey = (s: Pick<GameSettings, 'sets' | 'count'>) => `${[...s.sets].sort().join(',')}|${s.count}`
