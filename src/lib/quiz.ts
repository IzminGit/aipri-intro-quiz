import type { QuizData, QuizVideo, Song } from '../schema.ts'
import { createRng, shuffle, type Rng } from './rng.ts'
import { sameSinger, splitSingers } from './title.ts'

export interface GameSettings {
  sets: string[]
  count: number
  seed: string
}

export interface Question {
  video: QuizVideo
  song: Song
  /** 8択（正解を含む） */
  choices: Song[]
  answerIndex: number
}

export const CHOICE_COUNT = 8
/** ダミーに混ぜる「同じキャラが歌う別の曲」の上限 */
const SAME_CHARACTER_MAX = 3
export const COUNT_OPTIONS = [5, 10, 15] as const

/** 選んだセットで出題できる曲数 */
export function availableSongCount(data: QuizData, sets: readonly string[]): number {
  return new Set(data.videos.filter((v) => sets.includes(v.set)).map((v) => v.songId)).size
}

/**
 * ダミー選択肢を選ぶ。
 * CGライブは映像でキャラが分かってしまうので、同じキャラが歌う別の曲を優先して混ぜ、
 * 「キャラは分かっても曲名はイントロを聴かないと当てられない」ようにする。
 */
function pickDistractors(
  answer: Song,
  video: QuizVideo,
  inSets: readonly Song[],
  allSongs: readonly Song[],
  rng: Rng,
): Song[] {
  const singers = splitSingers(video.performers)
  const others = shuffle(
    inSets.filter((s) => s.id !== answer.id),
    rng,
  )
  // 選んだセットの曲だけでは足りないときに補う、ほかのセットの曲
  const extras = shuffle(
    allSongs.filter((s) => s.id !== answer.id && !inSets.includes(s)),
    rng,
  )
  const sameCharacter = others.filter((s) => s.singers.some((a) => singers.some((b) => sameSinger(a, b))))
  const picked = sameCharacter.slice(0, SAME_CHARACTER_MAX)
  for (const s of [...others, ...extras]) {
    if (picked.length >= CHOICE_COUNT - 1) break
    if (!picked.includes(s)) picked.push(s)
  }
  return picked
}

/** 設定（セット・問題数・シード）から問題を作る。同じ設定とデータなら必ず同じ問題になる */
export function buildQuestions(data: QuizData, settings: GameSettings): Question[] {
  const rng = createRng(`${settings.seed}|${[...settings.sets].sort().join(',')}|${settings.count}`)
  const videos = data.videos.filter((v) => settings.sets.includes(v.set))
  const songIds = [...new Set(videos.map((v) => v.songId))].sort()
  const songs = new Map(data.songs.map((s) => [s.id, s]))

  const inSets = songIds.map((id) => songs.get(id)!).filter(Boolean)

  return shuffle(songIds, rng)
    .slice(0, settings.count)
    .map((songId) => {
      const song = songs.get(songId)!
      const candidates = videos.filter((v) => v.songId === songId)
      const video = candidates[Math.floor(rng() * candidates.length)]
      const choices = shuffle([song, ...pickDistractors(song, video, inSets, data.songs, rng)], rng)
      return { video, song, choices, answerIndex: choices.indexOf(song) }
    })
}
