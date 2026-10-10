import type { QuizData, QuizVideo, Song } from '../schema.ts'
import { createRng, shuffle, type Rng } from './rng.ts'
import { sameSinger, splitSingers } from './title.ts'

export interface GameSettings {
  sets: string[]
  count: number
  seed: string
}

/**
 * 選択肢1つ。曲名と歌唱者の組み合わせ（バージョン）で区別する。
 * 歌唱者の表記がまったく同じ動画（例：MV とゲームMV）は同じ選択肢として扱う。
 */
export interface Choice {
  key: string
  songId: string
  title: string
  performers: string
}

export interface Question {
  video: QuizVideo
  song: Song
  /** 8択（正解を含む）。同じ曲名のバージョンが8つを超える曲は、全部並べるため8択より多くなる */
  choices: Choice[]
  answerIndex: number
}

export const CHOICE_COUNT = 8
/** ダミーに混ぜる「同じキャラが歌う別の曲」の上限 */
const SAME_CHARACTER_MAX = 3
/** 同じ曲名が並ぶのが正解の曲だけにならないよう、ダミーにもバージョン違いをペアで混ぜる上限 */
const DECOY_PAIR_MAX = 2
export const COUNT_OPTIONS = [5, 10, 15] as const

const choiceKey = (songId: string, performers: string) => `${songId}|${performers}`

/** 選んだセットで出題できる曲数（曲名＋歌唱者の組み合わせで数える） */
export function availableSongCount(data: QuizData, sets: readonly string[]): number {
  return new Set(data.videos.filter((v) => sets.includes(v.set)).map((v) => choiceKey(v.songId, v.performers))).size
}

/**
 * 曲ごとのバージョン（歌唱者の表記ちがい）の一覧を作る。
 * 選んだセットにある動画を優先し、なければ全データから取る。
 */
function versionIndex(data: QuizData, inSetVideos: readonly QuizVideo[]) {
  const songs = new Map(data.songs.map((s) => [s.id, s]))
  const build = (videos: readonly QuizVideo[]) => {
    const map = new Map<string, Choice[]>()
    for (const v of videos) {
      const list = map.get(v.songId) ?? []
      const key = choiceKey(v.songId, v.performers)
      if (!list.some((c) => c.key === key)) {
        list.push({ key, songId: v.songId, title: songs.get(v.songId)?.title ?? v.songId, performers: v.performers })
      }
      map.set(v.songId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.key.localeCompare(b.key))
    return map
  }
  const inSets = build(inSetVideos)
  const all = build(data.videos)
  return (songId: string): Choice[] => inSets.get(songId) ?? all.get(songId) ?? []
}

/**
 * 8択を作る。
 * - 流れた曲に別バージョンがあれば、それを全部選択肢に並べて「誰が歌っているか」まで当てさせる
 * - CGライブは映像でキャラが分かってしまうので、同じキャラが歌う別の曲を優先してダミーに混ぜる
 * - 正解の曲だけ同じ曲名が並ぶと曲名がバレるので、ダミーにもバージョン違いをペアで混ぜる
 */
function buildChoices(
  song: Song,
  video: QuizVideo,
  inSets: readonly Song[],
  allSongs: readonly Song[],
  versionsOf: (songId: string) => Choice[],
  rng: Rng,
): Choice[] {
  const answerKey = choiceKey(song.id, video.performers)
  const answer = versionsOf(song.id).find((c) => c.key === answerKey) ?? {
    key: answerKey,
    songId: song.id,
    title: song.title,
    performers: video.performers,
  }
  const picked: Choice[] = [answer]
  const siblings = shuffle(
    versionsOf(song.id).filter((c) => c.key !== answerKey),
    rng,
  )
  picked.push(...siblings)
  // 同じ曲名のバージョンは必ず全部並べる。8つを超えるときはその問題だけ選択肢を増やす
  const total = Math.max(CHOICE_COUNT, picked.length)

  const singers = splitSingers(video.performers)
  const others = shuffle(
    inSets.filter((s) => s.id !== song.id),
    rng,
  )
  // 選んだセットの曲だけでは足りないときに補う、ほかのセットの曲
  const extras = shuffle(
    allSongs.filter((s) => s.id !== song.id && !inSets.includes(s)),
    rng,
  )
  const sameCharacter = others
    .filter((s) => s.singers.some((a) => singers.some((b) => sameSinger(a, b))))
    .slice(0, SAME_CHARACTER_MAX)
  const order = [...new Set([...sameCharacter, ...others, ...extras])]

  let pairs = 0
  for (const s of order) {
    if (picked.length >= total) break
    const versions = shuffle(versionsOf(s.id), rng)
    if (!versions.length) continue
    picked.push(versions[0])
    const needsDecoy = siblings.length > 0 && pairs < DECOY_PAIR_MAX && versions.length >= 2
    if (needsDecoy && picked.length < total) {
      picked.push(versions[1])
      pairs++
    }
  }
  return shuffle(picked, rng)
}

/** 設定（セット・問題数・シード）から問題を作る。同じ設定とデータなら必ず同じ問題になる */
export function buildQuestions(data: QuizData, settings: GameSettings): Question[] {
  const rng = createRng(`${settings.seed}|${[...settings.sets].sort().join(',')}|${settings.count}`)
  const videos = data.videos.filter((v) => settings.sets.includes(v.set))
  const songIds = [...new Set(videos.map((v) => v.songId))].sort()
  const songs = new Map(data.songs.map((s) => [s.id, s]))
  const inSets = songIds.map((id) => songs.get(id)!).filter(Boolean)
  const versionsOf = versionIndex(data, videos)
  // 出題の単位は「曲名＋歌唱者」。同じ曲でも歌唱者が違えば別の問題として出る
  const versionKeys = [...new Set(videos.map((v) => choiceKey(v.songId, v.performers)))].sort()

  return shuffle(versionKeys, rng)
    .slice(0, settings.count)
    .map((key) => {
      // 表記が同じ動画（MV とゲームMV など）が複数あれば、どれか1本を流す
      const candidates = videos.filter((v) => choiceKey(v.songId, v.performers) === key)
      const video = candidates[Math.floor(rng() * candidates.length)]
      const song = songs.get(video.songId)!
      const choices = buildChoices(song, video, inSets, data.songs, versionsOf, rng)
      return { video, song, choices, answerIndex: choices.findIndex((c) => c.key === key) }
    })
}
