export interface ParsedTitle {
  song: string
  /** 歌唱メンバーや OP/ED などの補足 */
  performers: string
}

/** 先頭の飾り（【公式CGライブ】【公式MV】【アニメ】など） */
const PREFIX = /^(?:\s*【[^】]*】\s*)+/u
/** 曲名の直前にある「オープニング」などの区分 */
const KIND = /(?:後期)?(?:オープニング|エンディング|挿入歌)(?:主題歌)?/u

const clean = (s: string) =>
  s
    .replace(/\s+/gu, ' ')
    .replace(/^[\s/／・、]+|[\s/／・、]+$/gu, '')
    .trim()

/**
 * 動画タイトルを「曲名」と「補足」に分ける。
 *
 * - 【公式CGライブ】「曲名」歌唱者
 * - 【アニメ】『作品名』オープニング「曲名」
 * - 【公式MV】曲名（うた：歌唱者）
 * - 【MV】曲名／歌唱者
 */
export function parseTitle(raw: string): ParsedTitle {
  const title = raw.replace(PREFIX, '').trim()

  // 「」があれば最後のものを曲名とみなす（『』は作品名のことが多いので「」を優先）
  const quoted = [...title.matchAll(/「([^「」]+)」/gu)].at(-1) ?? [...title.matchAll(/『([^『』]+)』/gu)].at(-1)
  if (quoted && quoted.index !== undefined) {
    const before = title.slice(0, quoted.index)
    const after = title.slice(quoted.index + quoted[0].length)
    const kind = KIND.exec(before)?.[0]
    return { song: clean(quoted[1]), performers: clean([kind, after].filter(Boolean).join(' ')) }
  }

  const singer = /[（(]うた[：:]([^）)]+)[）)]\s*$/u.exec(title)
  if (singer) return { song: clean(title.slice(0, singer.index)), performers: clean(singer[1]) }

  const slash = title.lastIndexOf('／')
  if (slash > 0) return { song: clean(title.slice(0, slash)), performers: clean(title.slice(slash + 1)) }

  return { song: clean(title) || raw, performers: '' }
}

/** 曲の同一判定用に曲名を正規化する（全角半角・大小文字・空白・記号ゆれを吸収） */
export function songKey(song: string): string {
  return song
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・☆★♡♪!?~〜\-.。、,]/gu, '')
}

/** 補足欄から歌唱キャラの名前を取り出す（OP/ED などの区分は除く） */
export function splitSingers(performers: string): string[] {
  return (
    performers
      .split(/[、,，&＆\s]+/u)
      // 「ひまり・みつき」のような短い名前の並びだけ分ける（「リング・クローバー」は1人）
      .flatMap((s) => {
        const parts = s.split('・')
        return parts.every((p) => p.length <= 4) ? parts : [s]
      })
      .map((s) => s.trim())
      .filter((s) => s && !KIND.test(s))
  )
}

/** 「ひまり」と「青空ひまり」のように、片方がもう片方を含めば同じキャラとみなす */
export function sameSinger(a: string, b: string): boolean {
  return a === b || (a.length >= 2 && b.includes(a)) || (b.length >= 2 && a.includes(b))
}
