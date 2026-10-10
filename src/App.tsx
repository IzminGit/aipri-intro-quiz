import { useEffect, useMemo, useState } from 'react'
import type { QuizData } from './schema.ts'
import { Game } from './components/Game.tsx'
import { Home } from './components/Home.tsx'
import { Result } from './components/Result.tsx'
import { Tune } from './components/Tune.tsx'
import type { GameSettings } from './lib/quiz.ts'
import { settingsFromHash, settingsToHash } from './lib/settings-url.ts'
import type { GameResult } from './lib/share.ts'
import { applyLocalIntroStarts, loadLocalIntroStarts } from './lib/storage.ts'

type Screen =
  | { name: 'home'; challenge: GameSettings | null }
  | { name: 'game'; settings: GameSettings; round: number }
  | { name: 'result'; settings: GameSettings; result: GameResult }
  | { name: 'tune' }

function screenFromHash(data: QuizData): Screen {
  if (location.hash.startsWith('#/tune')) return { name: 'tune' }
  // 挑戦状リンクで開いたときは、いきなり始めずにホームで条件を見せる（再生にはタップが必要なため）
  return {
    name: 'home',
    challenge: settingsFromHash(
      location.hash,
      data.sets.map((s) => s.slug),
    ),
  }
}

export function App() {
  const [rawData, setRawData] = useState<QuizData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localStarts, setLocalStarts] = useState(loadLocalIntroStarts)
  const [screen, setScreen] = useState<Screen | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/quiz.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<QuizData>
      })
      .then((d) => {
        setRawData(d)
        setScreen(screenFromHash(d))
      })
      .catch(() => setError('問題データを読み込めませんでした。時間をおいて再読み込みしてください。'))
  }, [])

  const data = useMemo(() => rawData && applyLocalIntroStarts(rawData, localStarts), [rawData, localStarts])

  useEffect(() => {
    if (!rawData) return
    const onHash = () => {
      if (location.hash.startsWith('#/tune')) setScreen({ name: 'tune' })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [rawData])

  if (error) return <p className="center-message">{error}</p>
  if (!data || !screen) return <p className="center-message">♪ よみこみ中…</p>

  const start = (settings: GameSettings) => {
    history.replaceState(null, '', settingsToHash(settings))
    setScreen((s) => ({ name: 'game', settings, round: (s && 'round' in s ? s.round : 0) + 1 }))
  }
  const goHome = () => {
    history.replaceState(null, '', '#/')
    setScreen({ name: 'home', challenge: null })
  }

  switch (screen.name) {
    case 'home':
      return <Home data={data} challenge={screen.challenge} onStart={start} />
    case 'game':
      return (
        <Game
          key={screen.round}
          data={data}
          settings={screen.settings}
          onFinish={(result) => setScreen({ name: 'result', settings: screen.settings, result })}
          onQuit={goHome}
        />
      )
    case 'result':
      return <Result settings={screen.settings} result={screen.result} onRetry={start} onHome={goHome} />
    case 'tune':
      return <Tune data={data} localStarts={localStarts} onChange={setLocalStarts} onClose={goHome} />
  }
}
