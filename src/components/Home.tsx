import { useState, type CSSProperties } from 'react'
import type { QuizData } from '../schema.ts'
import {
  availableSongCount,
  COUNT_MAX,
  COUNT_MIN,
  COUNT_PRESETS,
  normalizeCount,
  type GameSettings,
} from '../lib/quiz.ts'
import { newSeed } from '../lib/rng.ts'
import { bestKey } from '../lib/settings-url.ts'
import { loadBestScores, loadLastSettings, saveLastSettings } from '../lib/storage.ts'
import { MAX_POINTS, TIME_LIMIT_MS } from '../lib/score.ts'
import { unlockSfx } from '../lib/sfx.ts'

interface Props {
  data: QuizData
  challenge: GameSettings | null
  onStart: (settings: GameSettings) => void
}

export function Home({ data, challenge, onStart }: Props) {
  const allSets = data.sets.map((s) => s.slug)
  const last = loadLastSettings()
  const [sets, setSets] = useState<string[]>(() => {
    const valid = last?.sets.filter((s) => allSets.includes(s)) ?? []
    return valid.length ? valid : allSets
  })
  const [count, setCount] = useState<number>(() => normalizeCount(last?.count))
  const [showChallenge, setShowChallenge] = useState(challenge !== null)

  const songCount = availableSongCount(data, sets)
  const best = loadBestScores()[bestKey({ sets, count })]
  const toggle = (slug: string) =>
    setSets((cur) =>
      cur.includes(slug) ? cur.filter((s) => s !== slug) : allSets.filter((s) => cur.includes(s) || s === slug),
    )

  const begin = (settings: GameSettings) => {
    unlockSfx()
    onStart(settings)
  }

  return (
    <main className="page home">
      <header className="hero">
        <p className="hero-kicker">アイプリ ファンメイド</p>
        <h1 className="hero-title">
          アイプリ
          <br />
          <span>イントロクイズ</span>
        </h1>
        <p className="hero-mode">⚡ スピードチャレンジ</p>
      </header>

      {showChallenge && challenge ? (
        <section className="card challenge" aria-labelledby="challenge-title">
          <h2 id="challenge-title">💌 挑戦状が届いたよ！</h2>
          <p>
            友達と<strong>まったく同じ問題</strong>で勝負できるよ。スコアで勝てるかな？
          </p>
          <dl className="challenge-terms">
            <dt>出題</dt>
            <dd>{challenge.sets.map((s) => data.sets.find((x) => x.slug === s)?.name).join('、')}</dd>
            <dt>問題数</dt>
            <dd>{Math.min(challenge.count, availableSongCount(data, challenge.sets))}問</dd>
          </dl>
          <button type="button" className="btn btn-primary btn-big" onClick={() => begin(challenge)}>
            挑戦する！
          </button>
          <button type="button" className="btn btn-text" onClick={() => setShowChallenge(false)}>
            自分で条件を決めて遊ぶ
          </button>
        </section>
      ) : (
        <>
          <section className="card rules" aria-labelledby="rules-title">
            <h2 id="rules-title">あそびかた</h2>
            <ol>
              <li>
                イントロが流れたら、8つの中から<strong>曲名</strong>をタップ！ 歌っている人は当てなくてOKだよ
              </li>
              <li>
                音が鳴ってから答えるまでの<strong>はやさ</strong>で点数が決まるよ（最大{MAX_POINTS}点・
                {TIME_LIMIT_MS / 1000}秒で時間切れ）
              </li>
              <li>連続正解でコンボボーナス！ 自己ベストを目指そう</li>
            </ol>
          </section>

          <section className="card" aria-labelledby="sets-title">
            <h2 id="sets-title">出題する曲</h2>
            <div className="chips" role="group" aria-label="出題する曲">
              {data.sets.map((s) => {
                const on = sets.includes(s.slug)
                return (
                  <button key={s.slug} type="button" className="chip" aria-pressed={on} onClick={() => toggle(s.slug)}>
                    <span className="chip-check" aria-hidden="true">
                      {on ? '✔' : '＋'}
                    </span>
                    {s.name}
                    <span className="chip-count">{availableSongCount(data, [s.slug])}曲</span>
                  </button>
                )
              })}
            </div>

            <h2 className="mt" id="count-title">
              問題数
            </h2>
            <div className="count-picker">
              <button
                type="button"
                className="count-step"
                aria-label="1問へらす"
                disabled={count <= COUNT_MIN}
                onClick={() => setCount((c) => Math.max(COUNT_MIN, c - 1))}
              >
                −
              </button>
              <output className="count-value" htmlFor="count-range" aria-live="polite">
                <strong>{count}</strong>問
              </output>
              <button
                type="button"
                className="count-step"
                aria-label="1問ふやす"
                disabled={count >= COUNT_MAX}
                onClick={() => setCount((c) => Math.min(COUNT_MAX, c + 1))}
              >
                ＋
              </button>
            </div>
            <input
              id="count-range"
              className="count-range"
              type="range"
              min={COUNT_MIN}
              max={COUNT_MAX}
              step={1}
              value={count}
              aria-labelledby="count-title"
              style={{ '--pct': `${((count - COUNT_MIN) / (COUNT_MAX - COUNT_MIN)) * 100}%` } as CSSProperties}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <div className="count-scale" aria-hidden="true">
              <span>{COUNT_MIN}</span>
              <span>{COUNT_MAX}</span>
            </div>
            <div className="segmented count-presets" role="radiogroup" aria-label="問題数のプリセット">
              {COUNT_PRESETS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={count === n} onClick={() => setCount(n)}>
                  {n}問
                </button>
              ))}
            </div>

            <p className="home-meta">
              {sets.length ? `${songCount}曲から ${Math.min(count, songCount)}問 出題` : '出題する曲を選んでね'}
              {best !== undefined && <span className="best">🏆 自己ベスト {best.toLocaleString('ja-JP')}点</span>}
            </p>
          </section>

          <button
            type="button"
            className="btn btn-primary btn-big"
            disabled={!sets.length}
            onClick={() => {
              saveLastSettings({ sets, count })
              begin({ sets, count, seed: newSeed() })
            }}
          >
            スタート ▶
          </button>
          <p className="sound-note">🔊 音が出ます。音量に気をつけてね</p>
        </>
      )}

      <footer className="footer">
        <p>非公式のファンメイドです。動画は YouTube の公式チャンネルのものを再生しています。</p>
        <a href="#/tune">イントロ開始位置の調整</a>
      </footer>
    </main>
  )
}
