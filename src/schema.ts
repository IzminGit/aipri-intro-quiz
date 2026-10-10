/** quiz.config.json の出題セット（aipri-channel のチャンネル1つに対応） */
export interface QuizSetConfig {
  slug: string
  name: string
  shortName: string
  /** aipri-channel の catalog.json 内のチャンネル slug */
  channelSlug: string
  /** このセットの動画のイントロ開始秒の既定値 */
  defaultIntroStart?: number
}

export interface QuizConfig {
  catalogUrl: string
  defaultIntroStart: number
  sets: QuizSetConfig[]
}

/** quiz-overrides.json の1動画分 */
export interface VideoOverride {
  introStart?: number
  exclude?: boolean
  song?: string
  /** 歌唱者の表記を手で指定（同じ人が歌う動画を同じ選択肢にまとめたいときなど） */
  performers?: string
}

export interface QuizOverrides {
  videos: Record<string, VideoOverride>
}

/** 出題の単位となる曲（ソロ版・デュオ版などの複数動画をまとめたもの） */
export interface Song {
  /** 正規化した曲名（曲の同一判定に使う） */
  id: string
  title: string
  /** この曲を歌っているキャラ（全動画の合算） */
  singers: string[]
}

export interface QuizVideo {
  /** YouTube の動画ID */
  id: string
  songId: string
  set: string
  /** 歌唱メンバーや OP/ED などの補足 */
  performers: string
  introStart: number
  durationSec: number
}

/** public/data/quiz.json（スクリプトが生成し、アプリが読む） */
export interface QuizData {
  generatedAt: string
  sets: { slug: string; name: string; shortName: string }[]
  songs: Song[]
  videos: QuizVideo[]
}
