import { useEffect, useState } from 'react'
import type { GameSettings } from '../lib/quiz.ts'
import { newSeed } from '../lib/rng.ts'
import { answerMark, formatSec, rankFor } from '../lib/score.ts'
import { bestKey } from '../lib/settings-url.ts'
import { fastest, totalScore, type GameResult } from '../lib/result.ts'
import { loadBestScores, saveBestScores } from '../lib/storage.ts'

interface Props {
  settings: GameSettings
  result: GameResult
  onRetry: (settings: GameSettings) => void
  onHome: () => void
}

/** 0 から目標値まで数字を増やす演出 */
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCountUp(target: number, durationMs = 1200) {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  useEffect(() => {
    if (reducedMotion()) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

export function Result({ settings, result, onRetry, onHome }: Props) {
  const total = totalScore(result.answers)
  const shown = useCountUp(total)
  const rank = rankFor(total, result.questions.length)
  const correct = result.answers.filter((a) => a.correct).length
  const best = fastest(result)
  const correctTimes = result.answers.filter((a) => a.correct).map((a) => a.reactionMs!)
  const average = correctTimes.length ? correctTimes.reduce((s, t) => s + t, 0) / correctTimes.length : null

  // 自己ベストの判定（この画面を開いた時点の記録と比べる）と保存
  const [previousBest] = useState(() => loadBestScores()[bestKey(settings)] as number | undefined)
  const isNewBest = result.questions.length > 0 && (previousBest === undefined || total > previousBest)
  useEffect(() => {
    if (isNewBest) saveBestScores({ ...loadBestScores(), [bestKey(settings)]: total })
  }, [isNewBest, settings, total])

  return (
    <main className="page result">
      <section className="card result-hero">
        <p className="result-icon" aria-hidden="true">
          {rank.icon}
        </p>
        <h1 className="result-rank">{rank.title}</h1>
        <p className="result-message">{rank.message}</p>
        <p className="result-score">
          <span className="result-score-num">{shown.toLocaleString('ja-JP')}</span>点
        </p>
        {isNewBest && previousBest !== undefined && (
          <p className="badge">🏆 自己ベスト更新！（前回 {previousBest.toLocaleString('ja-JP')}点）</p>
        )}
        {!isNewBest && previousBest !== undefined && (
          <p className="result-sub">自己ベスト {previousBest.toLocaleString('ja-JP')}点</p>
        )}
        <p className="result-marks" aria-label="1問ごとの結果">
          {result.answers.map(answerMark).join('')}
        </p>
        <dl className="stats">
          <div>
            <dt>正解</dt>
            <dd>
              {correct}/{result.questions.length}問
            </dd>
          </div>
          <div>
            <dt>平均</dt>
            <dd>{average === null ? '—' : formatSec(average)}</dd>
          </div>
          <div>
            <dt>最速</dt>
            <dd>{best ? formatSec(best.answer.reactionMs!) : '—'}</dd>
          </div>
        </dl>
        {best && <p className="result-sub">⚡ いちばん速かった曲「{best.question.song.title}」</p>}
      </section>

      <div className="actions">
        <div className="actions-row">
          <button type="button" className="btn btn-secondary" onClick={() => onRetry(settings)}>
            同じ問題でリベンジ
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onRetry({ ...settings, seed: newSeed() })}>
            新しい問題で遊ぶ
          </button>
        </div>
        <button type="button" className="btn btn-text" onClick={onHome}>
          ホームにもどる
        </button>
      </div>

      <section className="card" aria-labelledby="detail-title">
        <h2 id="detail-title">ふりかえり</h2>
        <ol className="review">
          {result.questions.map((q, i) => {
            const a = result.answers[i]
            return (
              <li key={`${q.video.id}-${i}`}>
                <span
                  className="review-mark"
                  aria-label={a.correct ? '正解' : a.reactionMs === null ? '時間切れ' : '不正解'}
                >
                  {answerMark(a)}
                </span>
                <span className="review-song">
                  <a href={`https://www.youtube.com/watch?v=${q.video.id}`} target="_blank" rel="noreferrer">
                    {q.song.title}
                  </a>
                  {q.video.performers && <small>{q.video.performers}</small>}
                </span>
                <span className="review-time">{a.correct ? formatSec(a.reactionMs!) : '—'}</span>
                <span className="review-points">{a.points.toLocaleString('ja-JP')}点</span>
              </li>
            )
          })}
        </ol>
      </section>
    </main>
  )
}
