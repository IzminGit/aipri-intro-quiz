/**
 * aipri-channel の catalog.json から出題データ public/data/quiz.json を作る。
 *
 *   npm run build-data                                # quiz.config.json の catalogUrl から取得
 *   CATALOG_SOURCE=../aipri-channel/public/data/catalog.json npm run build-data   # ローカルファイルから
 *
 * - catalog.json は埋め込み不可・非公開の動画を除外済み
 * - 同じ曲のソロ版・デュオ版などは1曲にまとめる（出題時にどれか1本を流す）
 * - quiz-overrides.json で動画ごとにイントロ開始秒・除外・曲名を上書きできる
 * - 内容に変化がなければファイルを書き換えない（無駄なコミットを防ぐ）
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { QuizConfig, QuizData, QuizOverrides, QuizVideo, Song } from '../src/schema.ts'
import { parseTitle, songKey, splitSingers, sameSinger } from '../src/lib/title.ts'

const ROOT = resolve(import.meta.dirname, '..')
const OUT_PATH = resolve(ROOT, 'public/data/quiz.json')

interface Catalog {
  channels: { slug: string; videos: { id: string; title: string; durationSec: number }[] }[]
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(ROOT, path), 'utf8')) as T

async function loadCatalog(source: string): Promise<Catalog> {
  if (/^https?:\/\//u.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`catalog.json を取得できませんでした: ${res.status} ${source}`)
    return (await res.json()) as Catalog
  }
  return readJson<Catalog>(source)
}

export function buildQuizData(
  config: QuizConfig,
  overrides: QuizOverrides,
  catalog: Catalog,
): Omit<QuizData, 'generatedAt'> {
  const songs = new Map<string, Song>()
  const videos: QuizVideo[] = []

  for (const set of config.sets) {
    const channel = catalog.channels.find((c) => c.slug === set.channelSlug)
    if (!channel) {
      console.warn(`⚠ catalog.json にチャンネル ${set.channelSlug} がありません`)
      continue
    }
    for (const v of channel.videos) {
      const ov = overrides.videos[v.id] ?? {}
      if (ov.exclude) continue
      const parsed = parseTitle(v.title)
      const title = ov.song ?? parsed.song
      const id = songKey(title)
      const singers = splitSingers(parsed.performers)

      const song = songs.get(id) ?? { id, title, singers: [] }
      for (const s of singers) if (!song.singers.some((x) => sameSinger(x, s))) song.singers.push(s)
      songs.set(id, song)

      const introStart = ov.introStart ?? set.defaultIntroStart ?? config.defaultIntroStart
      videos.push({
        id: v.id,
        songId: id,
        set: set.slug,
        performers: parsed.performers,
        introStart: Math.min(Math.max(0, introStart), Math.max(0, v.durationSec - 5)),
        durationSec: v.durationSec,
      })
    }
  }

  return {
    sets: config.sets.map(({ slug, name, shortName }) => ({ slug, name, shortName })),
    songs: [...songs.values()],
    videos,
  }
}

async function main() {
  const config = await readJson<QuizConfig>('quiz.config.json')
  const overrides = await readJson<QuizOverrides>('quiz-overrides.json')
  const catalog = await loadCatalog(process.env.CATALOG_SOURCE ?? config.catalogUrl)
  const data = buildQuizData(config, overrides, catalog)

  let previous: QuizData | null = null
  try {
    previous = JSON.parse(await readFile(OUT_PATH, 'utf8')) as QuizData
  } catch {
    // 初回
  }
  if (previous && JSON.stringify({ ...previous, generatedAt: undefined }) === JSON.stringify(data)) {
    console.log('変更なし')
    return
  }

  const out: QuizData = { generatedAt: new Date().toISOString(), ...data }
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`quiz.json を更新しました（${data.songs.length} 曲 / ${data.videos.length} 本）`)
}

if (import.meta.main ?? process.argv[1]?.endsWith('build-quiz-data.ts')) await main()
