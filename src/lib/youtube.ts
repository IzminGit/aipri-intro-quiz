/** YouTube IFrame Player API の必要最小限の型定義 */
export interface YTPlayer {
  loadVideoById(args: { videoId: string; startSeconds?: number }): void
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  unMute(): void
  setVolume(volume: number): void
  getCurrentTime(): number
  getPlayerState(): number
  getVideoData(): { video_id?: string }
  destroy(): void
}

export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: {
      host?: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
        onError?: (e: { data: number; target: YTPlayer }) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | undefined

export function loadYouTubeApi(): Promise<YTNamespace> {
  apiPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPromise = undefined
      reject(new Error('YouTube プレーヤーを読み込めませんでした'))
    }
    document.head.append(script)
  })
  return apiPromise
}

export interface PlayerEvents {
  onStateChange?: (state: number) => void
  onError?: (code: number) => void
}

/**
 * イントロクイズ用のプレーヤー。
 * 映像は隠さずに表示する（YouTube の規約上、プレーヤーを覆ったり音声だけを取り出したりしない）。
 */
export class IntroPlayer {
  private player: YTPlayer | null = null
  private readyPromise: Promise<void>
  events: PlayerEvents = {}

  constructor(el: HTMLElement) {
    this.readyPromise = loadYouTubeApi().then(
      (YT) =>
        new Promise<void>((resolve) => {
          this.player = new YT.Player(el, {
            host: 'https://www.youtube-nocookie.com',
            width: '100%',
            height: '100%',
            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              playsinline: 1,
              rel: 0,
            },
            events: {
              onReady: () => resolve(),
              onStateChange: (e) => this.events.onStateChange?.(e.data),
              onError: (e) => this.events.onError?.(e.data),
            },
          })
        }),
    )
  }

  ready(): Promise<void> {
    return this.readyPromise
  }

  /** 指定位置から再生する（スタート／次へボタンのタップ内で呼ぶと iOS でも音が出る） */
  play(videoId: string, startSeconds: number) {
    if (!this.player) return
    this.player.unMute()
    this.player.setVolume(100)
    if (this.player.getVideoData().video_id === videoId) {
      this.player.seekTo(startSeconds, true)
      this.player.playVideo()
    } else {
      this.player.loadVideoById({ videoId, startSeconds })
    }
  }

  pause() {
    this.player?.pauseVideo()
  }

  currentTime(): number {
    return this.player?.getCurrentTime() ?? 0
  }

  state(): number {
    return this.player?.getPlayerState() ?? PlayerState.UNSTARTED
  }

  videoId(): string | undefined {
    return this.player?.getVideoData().video_id
  }

  destroy() {
    this.player?.destroy()
    this.player = null
  }
}

/** 再生エラーコードの説明 */
export function playerErrorMessage(code: number): string {
  if (code === 101 || code === 150) return 'この動画は埋め込み再生が許可されていません'
  if (code === 100) return '動画が見つかりませんでした'
  return '動画を再生できませんでした'
}
