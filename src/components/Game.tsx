import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuizData } from '../schema.ts'
import { buildQuestions, type GameSettings, type Question } from '../lib/quiz.ts'
import { formatSec, scoreAnswer, speedLabel, TIME_LIMIT_MS, comboBonus, type Answer } from '../lib/score.ts'
import { playCorrect, playWrong, unlockSfx } from '../lib/sfx.ts'
import type { GameResult } from '../lib/result.ts'
import { totalScore } from '../lib/result.ts'
import { IntroPlayer, PlayerState, playerErrorMessage } from '../lib/youtube.ts'

interface Props {
  data: QuizData
  settings: GameSettings
  onFinish: (result: GameResult) => void
  onQuit: () => void
}

/**
 * standby   … タップ待ち（1問目・エラーで飛ばした直後。iOS は再生にタップが必要）
 * loading   … 再生を指示して、音が鳴り始めるのを待っている
 * answering … 音が鳴っている。ここから計測
 * revealed  … 答え合わせ。動画はそのまま流し続ける（ご褒美タイム）
 */
type Phase = 'standby' | 'loading' | 'answering' | 'revealed'

const TAP_HINT_DELAY_MS = 3500

export function Game({ data, settings, onFinish, onQuit }: Props) {
  const initial = useMemo(() => buildQuestions(data, settings), [data, settings])
  const [questions, setQuestions] = useState<Question[]>(initial)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('standby')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [tapHint, setTapHint] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<IntroPlayer | null>(null)
  const phaseRef = useRef<Phase>('standby')
  const t0Ref = useRef(0)
  const bufferingSinceRef = useRef<number | null>(null)
  const questionRef = useRef<Question | undefined>(undefined)
  const hintTimerRef = useRef<number | undefined>(undefined)

  const question = questions[index] as Question | undefined
  useEffect(() => {
    questionRef.current = question
  }, [question])
  const combo = answers.at(-1)?.combo ?? 0
  const score = totalScore(answers)

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  /** 音が鳴り始めてからの経過時間（バッファリング中は止める） */
  const elapsedNow = () => {
    const now = performance.now()
    const stalled = bufferingSinceRef.current === null ? 0 : now - bufferingSinceRef.current
    return Math.max(0, now - t0Ref.current - stalled)
  }

  const startQuestion = useCallback((q: Question) => {
    unlockSfx()
    questionRef.current = q
    setSelected(null)
    setElapsed(0)
    setTapHint(false)
    bufferingSinceRef.current = null
    setPhaseBoth('loading')
    playerRef.current?.play(q.video.id, q.video.introStart)
    window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'loading') setTapHint(true)
    }, TAP_HINT_DELAY_MS)
  }, [])

  // プレーヤーの用意（YouTube が要素を iframe に置き換えるので、React 管理外の子要素を渡す）
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const el = document.createElement('div')
    host.append(el)
    const player = new IntroPlayer(el)
    playerRef.current = player
    let alive = true
    player
      .ready()
      .then(() => alive && setPlayerReady(true))
      .catch(() => alive && setNotice('YouTube プレーヤーを読み込めませんでした。通信環境を確認してね'))
    return () => {
      alive = false
      window.clearTimeout(hintTimerRef.current)
      player.destroy()
      host.replaceChildren()
      playerRef.current = null
    }
  }, [])

  // 再生状態の変化で計測を始める・止める
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    player.events.onStateChange = (state) => {
      const q = questionRef.current
      if (!q) return
      if (phaseRef.current === 'loading' && state === PlayerState.PLAYING) {
        // シーク位置が少しずれても、イントロ開始からの経過分を差し引いて公平にする
        const offsetMs = Math.max(0, (player.currentTime() - q.video.introStart) * 1000)
        t0Ref.current = performance.now() - Math.min(offsetMs, 1500)
        bufferingSinceRef.current = null
        setTapHint(false)
        setPhaseBoth('answering')
      } else if (phaseRef.current === 'answering') {
        if (state === PlayerState.BUFFERING && bufferingSinceRef.current === null) {
          bufferingSinceRef.current = performance.now()
        } else if (state === PlayerState.PLAYING && bufferingSinceRef.current !== null) {
          t0Ref.current += performance.now() - bufferingSinceRef.current
          bufferingSinceRef.current = null
        }
      }
    }
    player.events.onError = (code) => {
      if (phaseRef.current !== 'loading' && phaseRef.current !== 'answering') return
      const q = questionRef.current
      setNotice(`「${q?.song.title ?? ''}」は飛ばしました（${playerErrorMessage(code)}）`)
      setQuestions((qs) => qs.filter((x) => x !== q))
      setPhaseBoth('standby')
    }
  }, [playerReady])

  const answer = useCallback(
    (choice: number | null) => {
      const q = questionRef.current
      if (phaseRef.current !== 'answering' || !q) return
      const ms = elapsedNow()
      const correct = choice === q.answerIndex
      const result = choice === null ? scoreAnswer(false, null, combo) : scoreAnswer(correct, ms, combo)
      setElapsed(choice === null ? TIME_LIMIT_MS : ms)
      setSelected(choice)
      setAnswers((a) => [...a, result])
      setPhaseBoth('revealed')
      if (result.correct) playCorrect()
      else playWrong()
    },
    [combo],
  )

  // 経過時間の表示と時間切れ判定
  useEffect(() => {
    if (phase !== 'answering') return
    let raf = 0
    const tick = () => {
      const ms = elapsedNow()
      setElapsed(ms)
      if (ms >= TIME_LIMIT_MS) answer(null)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, answer])

  const finished = index >= questions.length
  const isLast = index >= questions.length - 1

  const next = useCallback(() => {
    setNotice(null)
    if (isLast) {
      playerRef.current?.pause()
      onFinish({ questions: questions.slice(0, answers.length), answers })
      return
    }
    const nextQuestion = questions[index + 1]
    setIndex((i) => i + 1)
    startQuestion(nextQuestion)
  }, [isLast, onFinish, questions, answers, index, startQuestion])

  // エラーで全問飛ばしたときなど
  useEffect(() => {
    if (finished && phase === 'standby') onFinish({ questions: questions.slice(0, answers.length), answers })
  }, [finished, phase, onFinish, questions, answers])

  // キーボード操作（1〜8で解答、Enter／スペースで次へ）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (phase === 'answering' && /^[1-9]$/u.test(e.key) && Number(e.key) <= (question?.choices.length ?? 0)) {
        e.preventDefault()
        answer(Number(e.key) - 1)
      } else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        if (phase === 'revealed') {
          e.preventDefault()
          next()
        } else if (phase === 'standby' && playerReady && question) {
          e.preventDefault()
          startQuestion(question)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, answer, next, startQuestion, playerReady, question])

  const last = answers.at(-1)
  const remaining = Math.max(0, 1 - elapsed / TIME_LIMIT_MS)

  return (
    <main className="page game">
      <div className="game-bar">
        <button type="button" className="btn btn-text btn-small" onClick={onQuit}>
          ✕ やめる
        </button>
        <span className="game-progress">
          第<strong>{Math.min(index + 1, Math.max(questions.length, 1))}</strong>問 / {questions.length}問
        </span>
        <span className="game-score" aria-live="polite">
          {score.toLocaleString('ja-JP')}点
        </span>
      </div>

      <div className="player-frame">
        <div ref={hostRef} className="player-host" />
      </div>

      <div className="timer" aria-hidden={phase !== 'answering'}>
        <div className="timer-track">
          <div className="timer-fill" style={{ transform: `scaleX(${phase === 'loading' ? 1 : remaining})` }} />
        </div>
        <span className="timer-sec">{formatSec(phase === 'loading' || phase === 'standby' ? 0 : elapsed)}</span>
        {combo >= 2 && phase !== 'revealed' && <span className="combo">🔥{combo}コンボ中</span>}
      </div>

      {notice && (
        <p className="notice" role="status">
          ⚠ {notice}
        </p>
      )}

      {phase === 'standby' && question && (
        <div className="standby">
          <p>{index === 0 ? '準備OK？ イントロが流れたらすぐ答えてね！' : 'つぎの問題にすすもう'}</p>
          <button
            type="button"
            className="btn btn-primary btn-big"
            disabled={!playerReady}
            onClick={() => startQuestion(question)}
          >
            {playerReady ? `第${index + 1}問 イントロスタート ▶` : 'プレーヤー準備中…'}
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <p className="loading-note" role="status">
          ♪ イントロ準備中… 音が鳴ったら計測スタート！
          {tapHint && <span className="tap-hint">音が出ないときは、上の動画を直接タップして再生してね</span>}
        </p>
      )}

      {(phase === 'answering' || phase === 'revealed') && question && (
        <ol className="choices" aria-label="曲名を選んでね">
          {question.choices.map((c, i) => {
            const isAnswer = i === question.answerIndex
            const isPicked = i === selected
            const state = phase !== 'revealed' ? '' : isAnswer ? 'is-answer' : isPicked ? 'is-wrong' : 'is-dim'
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`choice ${state}`}
                  disabled={phase !== 'answering'}
                  onClick={() => answer(i)}
                >
                  <span className="choice-key" aria-hidden="true">
                    {phase === 'revealed' && isAnswer ? '○' : phase === 'revealed' && isPicked ? '×' : i + 1}
                  </span>
                  <span className="choice-title">{c.title}</span>
                  {phase === 'revealed' && isAnswer && <span className="choice-tag">正解</span>}
                  {phase === 'revealed' && isPicked && !isAnswer && <span className="choice-tag">あなたの答え</span>}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {phase === 'revealed' && question && last && (
        <section className={`reveal ${last.correct ? 'reveal-ok' : 'reveal-ng'}`} aria-live="assertive">
          <p className="reveal-head">
            {last.correct ? (
              <>
                <span className="reveal-mark">⭕</span>
                {speedLabel(last.reactionMs!)}
                <span className="reveal-time">{formatSec(last.reactionMs!)}</span>
              </>
            ) : last.reactionMs === null ? (
              <>
                <span className="reveal-mark">⏰</span>時間切れ！
              </>
            ) : (
              <>
                <span className="reveal-mark">❌</span>ざんねん…
              </>
            )}
          </p>
          <p className="reveal-song">
            「{question.song.title}」
            {question.video.performers && <span className="reveal-performers">{question.video.performers}</span>}
          </p>
          {last.correct && (
            <p className="reveal-points">
              +{last.points.toLocaleString('ja-JP')}点
              {comboBonus(last.combo) > 0 && (
                <span className="reveal-combo">
                  （🔥{last.combo}コンボ +{comboBonus(last.combo)}）
                </span>
              )}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-big" onClick={next}>
            {isLast ? '結果を見る 🏁' : '次の問題 ▶'}
          </button>
        </section>
      )}
    </main>
  )
}
