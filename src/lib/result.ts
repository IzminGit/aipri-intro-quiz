import type { Question } from './quiz.ts'
import type { Answer } from './score.ts'

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
