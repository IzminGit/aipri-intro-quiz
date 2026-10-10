import type { QuizData } from '../schema.ts'

/** localStorage は使えないことがある（プライベートモードなど）ので必ず try/catch で包む */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 保存できなくても遊べる
  }
}

const OVERRIDES_KEY = 'intro-quiz:intro-starts'
const BEST_KEY = 'intro-quiz:best'
const LAST_SETTINGS_KEY = 'intro-quiz:last-settings'

/** 「開始位置の調整」画面で編集したイントロ開始秒（動画ID → 秒） */
export const loadLocalIntroStarts = () => readStored<Record<string, number>>(OVERRIDES_KEY, {})
export const saveLocalIntroStarts = (v: Record<string, number>) => writeStored(OVERRIDES_KEY, v)

/** 手元で調整した開始位置をデータに反映する（自分のブラウザだけ） */
export function applyLocalIntroStarts(data: QuizData, starts: Record<string, number>): QuizData {
  return {
    ...data,
    videos: data.videos.map((v) => (v.id in starts ? { ...v, introStart: starts[v.id] } : v)),
  }
}

export const loadBestScores = () => readStored<Record<string, number>>(BEST_KEY, {})
export const saveBestScores = (v: Record<string, number>) => writeStored(BEST_KEY, v)

export interface LastSettings {
  sets: string[]
  count: number
}
export const loadLastSettings = () => readStored<LastSettings | null>(LAST_SETTINGS_KEY, null)
export const saveLastSettings = (v: LastSettings) => writeStored(LAST_SETTINGS_KEY, v)
