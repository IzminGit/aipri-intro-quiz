import { useEffect, useRef, useState } from 'react'
import type { QuizData, QuizVideo } from '../schema.ts'
import { saveLocalIntroStarts } from '../lib/storage.ts'
import { IntroPlayer } from '../lib/youtube.ts'

interface Props {
  data: QuizData
  localStarts: Record<string, number>
  onChange: (starts: Record<string, number>) => void
  onClose: () => void
}

const PREVIEW_MS = 3000
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * イントロ開始位置の調整画面。
 * ここで直した秒数はこのブラウザにすぐ反映され、書き出した JSON を quiz-overrides.json に
 * 貼り付けてコミットすると、みんなの問題にも反映される。
 */
export function Tune({ data, localStarts, onChange, onClose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<IntroPlayer | null>(null)
  const stopTimer = useRef<number | undefined>(undefined)
  const [playing, setPlaying] = useState<string | null>(null)
  const [exportText, setExportText] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const el = document.createElement('div')
    host.append(el)
    const player = new IntroPlayer(el)
    playerRef.current = player
    return () => {
      window.clearTimeout(stopTimer.current)
      player.destroy()
      host.replaceChildren()
    }
  }, [])

  const songTitle = (v: QuizVideo) => data.songs.find((s) => s.id === v.songId)?.title ?? v.songId
  const startOf = (v: QuizVideo) => v.introStart

  const setStart = (id: string, sec: number) => {
    const next = { ...localStarts, [id]: Math.max(0, round1(sec)) }
    saveLocalIntroStarts(next)
    onChange(next)
  }

  const preview = (v: QuizVideo, sec = startOf(v)) => {
    playerRef.current?.play(v.id, sec)
    setPlaying(v.id)
    window.clearTimeout(stopTimer.current)
    stopTimer.current = window.setTimeout(() => playerRef.current?.pause(), PREVIEW_MS + 600)
  }

  const setFromCurrent = (v: QuizVideo) => {
    const p = playerRef.current
    if (!p || p.videoId() !== v.id) return
    setStart(v.id, p.currentTime())
  }

  const resetLocal = () => {
    saveLocalIntroStarts({})
    onChange({})
  }

  const buildExport = () => {
    const videos = Object.fromEntries(
      Object.entries(localStarts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, introStart]) => [id, { introStart }]),
    )
    setExportText(JSON.stringify(videos, null, 2))
  }

  return (
    <main className="page tune">
      <div className="game-bar">
        <button type="button" className="btn btn-text btn-small" onClick={onClose}>
          ← もどる
        </button>
        <span className="game-progress">イントロ開始位置の調整</span>
        <span />
      </div>

      <div className="tune-sticky">
        <div className="player-frame">
          <div ref={hostRef} className="player-host" />
        </div>
        <p className="tune-help">
          「▶ 試聴」でその秒数から{PREVIEW_MS / 1000}秒流れます。ずれていたら秒数を直すか、 動画を再生しながら「⏱
          今の位置」で今の再生位置を開始位置にできます。
        </p>
      </div>

      {data.sets.map((set) => (
        <section key={set.slug} className="card">
          <h2>{set.name}</h2>
          <ul className="tune-list">
            {data.videos
              .filter((v) => v.set === set.slug)
              .map((v) => (
                <li key={v.id} className={playing === v.id ? 'is-playing' : ''}>
                  <span className="tune-title">
                    {songTitle(v)}
                    <small>{v.performers}</small>
                  </span>
                  <label className="tune-input">
                    <span className="visually-hidden">「{songTitle(v)}」の開始秒</span>
                    <input
                      type="number"
                      min={0}
                      max={v.durationSec}
                      step={0.1}
                      inputMode="decimal"
                      value={startOf(v)}
                      onChange={(e) => setStart(v.id, Number(e.target.value))}
                    />
                    秒{v.id in localStarts && <em title="この端末で変更済み">✎</em>}
                  </label>
                  <span className="tune-buttons">
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => preview(v)}>
                      ▶ 試聴
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={playing !== v.id}
                      onClick={() => setFromCurrent(v)}
                    >
                      ⏱ 今の位置
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="card">
        <h2>みんなの問題に反映する</h2>
        <p>
          この画面の変更は<strong>この端末だけ</strong>に保存されています。下のボタンで書き出した内容を、リポジトリの{' '}
          <code>quiz-overrides.json</code> の <code>"videos"</code> に追記してコミットすると、全員に反映されます。
        </p>
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={buildExport}
            disabled={!Object.keys(localStarts).length}
          >
            変更を書き出す（{Object.keys(localStarts).length}件）
          </button>
          <button
            type="button"
            className="btn btn-text"
            onClick={resetLocal}
            disabled={!Object.keys(localStarts).length}
          >
            この端末の変更をリセット
          </button>
        </div>
        {exportText && (
          <>
            <textarea className="export" readOnly value={exportText} rows={10} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void navigator.clipboard?.writeText(exportText)}
            >
              コピー
            </button>
          </>
        )}
      </section>
    </main>
  )
}
