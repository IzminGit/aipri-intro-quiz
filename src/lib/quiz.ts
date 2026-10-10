import type { QuizData, QuizVideo, Song } from '../schema.ts'
import { createRng, shuffle, type Rng } from './rng.ts'
import { sameSinger, splitSingers } from './title.ts'

export interface GameSettings {
  sets: string[]
  count: number
  seed: string
}

/** 選択肢1つ。曲名だけで区別し、同じ曲名の動画（ソロ版・デュオ版など）は1つの選択肢にまとめる */
export interface Choice {
  key: string
  songId: string
  title: string
}

export interface Question {
  video: QuizVideo
  song: Song
  /** 8択（正解を含む）。選べる曲が8曲に満たないときはその数まで */
  choices: Choice[]
  answerIndex: number
}

export const CHOICE_COUNT = 8
/** ダミーに混ぜる「同じキャラが歌う別の曲」の上限 */
const SAME_CHARACTER_MAX = 3
export const COUNT_MIN = 1
export const COUNT_MAX = 40
export const COUNT_DEFAULT = 10
/** 問題数のプリセット */
export const COUNT_PRESETS = [5, 10, 20, 40] as const

/** 問題数を 1〜40 の整数に収める（範囲外・数値でないときは既定値） */
export function normalizeCount(n: unknown): number {
  return typeof n === 'number' && Number.isInteger(n) && n >= COUNT_MIN && n <= COUNT_MAX ? n : COUNT_DEFAULT
}

const toChoice = (s: Song): Choice => ({ key: s.id, songId: s.id, title: s.title })

/** 選んだセットで出題できる曲数（曲名で数える） */
export function availableSongCount(data: QuizData, sets: readonly string[]): number {
  return new Set(data.videos.filter((v) => sets.includes(v.set)).map((v) => v.songId)).size
}

/**
 * 8択を作る。
 * - CGライブは映像でキャラが分かってしまうので、同じキャラが歌う別の曲を優先してダミーに混ぜる
 * - 選んだセットの曲だけで足りないときは、ほかのセットの曲で補う
 */
function buildChoices(
  song: Song,
  video: QuizVideo,
  inSets: readonly Song[],
  allSongs: readonly Song[],
  rng: Rng,
): Choice[] {
  const singers = splitSingers(video.performers)
  const others = shuffle(
    inSets.filter((s) => s.id !== song.id),
    rng,
  )
  const extras = shuffle(
    allSongs.filter((s) => s.id !== song.id && !inSets.includes(s)),
    rng,
  )
  const sameCharacter = others
    .filter((s) => s.singers.some((a) => singers.some((b) => sameSinger(a, b))))
    .slice(0, SAME_CHARACTER_MAX)
  const decoys = [...new Set([...sameCharacter, ...others, ...extras])].slice(0, CHOICE_COUNT - 1)
  return shuffle([song, ...decoys].map(toChoice), rng)
}

/** 設定（セット・問題数・シード）から問題を作る。同じ設定とデータなら必ず同じ問題になる */
export function buildQuestions(data: QuizData, settings: GameSettings): Question[] {
  const rng = createRng(`${settings.seed}|${[...settings.sets].sort().join(',')}|${settings.count}`)
  const videos = data.videos.filter((v) => settings.sets.includes(v.set))
  const songIds = [...new Set(videos.map((v) => v.songId))].sort()
  const songs = new Map(data.songs.map((s) => [s.id, s]))
  const inSets = songIds.map((id) => songs.get(id)!).filter(Boolean)

  // 出題の単位は曲名。同じ曲名の動画（ソロ版・デュオ版など）が複数あれば、どれか1本を流す
  return shuffle(songIds, rng)
    .slice(0, settings.count)
    .map((songId) => {
      const candidates = videos.filter((v) => v.songId === songId)
      const video = candidates[Math.floor(rng() * candidates.length)]
      const song = songs.get(songId)!
      const choices = buildChoices(song, video, inSets, data.songs, rng)
      return { video, song, choices, answerIndex: choices.findIndex((c) => c.key === songId) }
    })
}
