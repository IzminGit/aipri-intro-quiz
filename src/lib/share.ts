import type { Question } from './quiz.ts'
import { answerMark, formatSec, rankFor, type Answer } from './score.ts'

export interface GameResult {
  questions: Question[]
  answers: Answer[]
}

export const totalScore = (answers: readonly Answer[]) => answers.reduce((sum, a) => sum + a.points, 0)

/** 最速で正解した問題 */
export function fastest(result: GameResult): { question: Question; answer: Answer } | null {
  let best: { question: Question; answer: Answer } | null = null
  result.answers.forEach((answer, i) => {
    if (!answer.correct || answer.reactionMs === null) return
    if (!best || answer.reactionMs < best.answer.reactionMs!) best = { question: result.questions[i], answer }
  })
  return best
}

export function buildShareText(result: GameResult, challengeUrl: string): string {
  const total = totalScore(result.answers)
  const rank = rankFor(total, result.questions.length)
  const correct = result.answers.filter((a) => a.correct).length
  const best = fastest(result)
  return [
    `🎀アイプリ イントロクイズ⚡`,
    `${rank.icon}${rank.title}`,
    `スコア ${total.toLocaleString('ja-JP')}点（${correct}/${result.questions.length}問正解）`,
    result.answers.map(answerMark).join(''),
    best ? `最速 ${formatSec(best.answer.reactionMs!)}「${best.question.song.title}」` : '',
    `同じ問題で勝負してね👇`,
    challengeUrl,
    `#アイプリイントロクイズ`,
  ]
    .filter(Boolean)
    .join('\n')
}
