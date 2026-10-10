/** 1問の制限時間（音が鳴り始めてから） */
export const TIME_LIMIT_MS = 15_000
export const MAX_POINTS = 1000
const MIN_POINTS = 100
const COMBO_STEP = 50
const COMBO_MAX = 250

export interface Answer {
  correct: boolean
  /** 音が鳴り始めてから答えるまでのミリ秒（時間切れは null） */
  reactionMs: number | null
  points: number
  combo: number
}

/** 正解の基本点。0秒で1000点、15秒で100点まで直線的に減る */
export function basePoints(reactionMs: number): number {
  const ratio = Math.min(1, Math.max(0, reactionMs / TIME_LIMIT_MS))
  return Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * ratio)
}

/** 連続正解ボーナス（2連続目から +50、最大 +250） */
export function comboBonus(combo: number): number {
  return combo >= 2 ? Math.min(COMBO_MAX, COMBO_STEP * (combo - 1)) : 0
}

export function scoreAnswer(correct: boolean, reactionMs: number | null, previousCombo: number): Answer {
  if (!correct || reactionMs === null) return { correct: false, reactionMs, points: 0, combo: 0 }
  const combo = previousCombo + 1
  return { correct, reactionMs, points: basePoints(reactionMs) + comboBonus(combo), combo }
}

/** 正解したときの一言 */
export function speedLabel(reactionMs: number): string {
  if (reactionMs < 1000) return '神速！'
  if (reactionMs < 2000) return 'はやい！'
  if (reactionMs < 4000) return 'ナイス！'
  return 'せいかい！'
}

export interface Rank {
  title: string
  icon: string
  message: string
}

/** 合計点から称号を決める */
export function rankFor(total: number, questionCount: number): Rank {
  const ratio = questionCount ? total / (questionCount * MAX_POINTS) : 0
  if (ratio >= 0.85) return { title: '伝説のイントロクイーン', icon: '👑', message: '1音でぜんぶ分かっちゃう！' }
  if (ratio >= 0.7) return { title: 'キラキラ☆イントロスター', icon: '🌟', message: 'アイプリ愛があふれてる！' }
  if (ratio >= 0.5) return { title: 'イントロアイドル', icon: '🎤', message: 'もうひと押しでスター！' }
  if (ratio >= 0.3) return { title: 'イントロ研究生', icon: '🎀', message: 'CGライブを見返してリベンジ！' }
  return { title: 'イントロ見習い', icon: '🌱', message: 'ここからキラキラを目指そう！' }
}

export const formatSec = (ms: number) => `${(ms / 1000).toFixed(2)}秒`

/** 1問ごとの結果を表す記号（色に頼らず形で区別できるようにする） */
export function answerMark(a: Answer): string {
  if (a.reactionMs === null) return '⏰'
  if (!a.correct) return '❌'
  return a.reactionMs < 2000 ? '⚡' : '⭕'
}
