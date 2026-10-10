import { describe, expect, it } from 'vitest'
import type { QuizData } from '../schema.ts'
import { buildQuestions, availableSongCount } from './quiz.ts'
import { createRng, shuffle } from './rng.ts'
import { basePoints, comboBonus, rankFor, scoreAnswer } from './score.ts'
import { settingsFromHash, settingsToHash } from './settings-url.ts'
import { parseTitle, sameSinger, songKey, splitSingers } from './title.ts'

describe('parseTitle', () => {
  it('CGライブ', () => {
    expect(parseTitle('【公式CGライブ】「トキメキ♡ジャンプ！」好実いのり、夢宮あおい')).toEqual({
      song: 'トキメキ♡ジャンプ！',
      performers: '好実いのり、夢宮あおい',
    })
  })
  it('OP/ED は作品名の『』ではなく「」を曲名にする', () => {
    expect(parseTitle('【アニメ】『ひみつのアイプリ』オープニング「ぜんりょくじょしかくめい！」')).toEqual({
      song: 'ぜんりょくじょしかくめい！',
      performers: 'オープニング',
    })
  })
  it('（うた：〇〇）形式', () => {
    expect(parseTitle('【公式MV】レッツ！アイプリ（うた：ひまり）')).toEqual({
      song: 'レッツ！アイプリ',
      performers: 'ひまり',
    })
  })
  it('曲名／歌唱者 形式', () => {
    expect(parseTitle('【MV】ぜんりょくじょしかくめい！／P丸様。')).toEqual({
      song: 'ぜんりょくじょしかくめい！',
      performers: 'P丸様。',
    })
  })
})

describe('歌唱者', () => {
  it('短い名前の並びだけ・で分ける', () => {
    expect(splitSingers('ひまり・みつき・つむぎ')).toEqual(['ひまり', 'みつき', 'つむぎ'])
    expect(splitSingers('鈴風つむぎ、リング・クローバー')).toEqual(['鈴風つむぎ', 'リング・クローバー'])
    expect(splitSingers('オープニング')).toEqual([])
  })
  it('フルネームと名前だけを同じキャラとみなす', () => {
    expect(sameSinger('青空ひまり', 'ひまり')).toBe(true)
    expect(sameSinger('青空ひまり', '星川みつき')).toBe(false)
  })
  it('曲名の表記ゆれを吸収する', () => {
    expect(songKey('ぜんりょくじょしかくめい！')).toBe(songKey('ぜんりょくじょしかくめい!'))
    expect(songKey('TOP POWER')).toBe(songKey('ｔｏｐ　ｐｏｗｅｒ'))
  })
})

describe('乱数', () => {
  it('同じシードなら同じ並び', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], createRng('abc'))
    const b = shuffle([1, 2, 3, 4, 5, 6], createRng('abc'))
    expect(a).toEqual(b)
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })
})

const song = (id: string, singers: string[]) => ({ id, title: id.toUpperCase(), singers })
const data: QuizData = {
  generatedAt: '2026-10-10T00:00:00Z',
  sets: [
    { slug: 'a', name: 'A', shortName: 'A' },
    { slug: 'b', name: 'B', shortName: 'B' },
    { slug: 'c', name: 'C', shortName: 'C' },
  ],
  songs: [
    song('s1', ['ひまり']),
    song('s2', ['ひまり']),
    song('s3', ['みつき']),
    song('s4', ['つむぎ']),
    song('s5', ['サクラ']),
    song('s6', ['ひまり', 'みつき']),
    ...['s7', 's8', 's9', 's10', 's11', 's12'].map((id) => song(id, ['ビビ'])),
  ],
  videos: [
    { id: 'v1', songId: 's1', set: 'a', performers: 'ひまり', introStart: 0, durationSec: 120 },
    { id: 'v1b', songId: 's1', set: 'a', performers: 'ひまり', introStart: 0, durationSec: 120 },
    // s1 は歌唱者ちがいのバージョンがある（v1 と v1b は表記が同じなので1つの選択肢）
    { id: 'v1c', songId: 's1', set: 'a', performers: 'ひまり、みつき', introStart: 0, durationSec: 120 },
    { id: 'v2', songId: 's2', set: 'a', performers: 'ひまり', introStart: 0, durationSec: 120 },
    { id: 'v3', songId: 's3', set: 'a', performers: 'みつき', introStart: 0, durationSec: 120 },
    { id: 'v4', songId: 's4', set: 'a', performers: 'つむぎ', introStart: 0, durationSec: 120 },
    { id: 'v5', songId: 's5', set: 'b', performers: 'サクラ', introStart: 0, durationSec: 120 },
    { id: 'v6', songId: 's6', set: 'b', performers: 'ひまり、みつき', introStart: 0, durationSec: 120 },
    ...['s7', 's8', 's9', 's10', 's11', 's12'].map((songId) => ({
      id: `v-${songId}`,
      songId,
      set: 'c',
      performers: 'ビビ',
      introStart: 0,
      durationSec: 120,
    })),
    // ダミー側にもバージョン違いのある曲
    { id: 'v-s7b', songId: 's7', set: 'c', performers: 'ビビ、チィ', introStart: 0, durationSec: 120 },
  ],
}

describe('buildQuestions', () => {
  const settings = { sets: ['a'], count: 10, seed: 'x1' }
  it('同じ設定なら同じ問題', () => {
    expect(buildQuestions(data, settings)).toEqual(buildQuestions(data, settings))
  })
  it('曲名＋歌唱者の組み合わせは重複せず、出題数はその数まで', () => {
    const qs = buildQuestions(data, settings)
    // s1 は「ひまり」「ひまり、みつき」の2バージョン（v1 と v1b は表記が同じなので1つ）＋ s2〜s4
    expect(availableSongCount(data, ['a'])).toBe(5)
    expect(qs).toHaveLength(5)
    expect(new Set(qs.map((q) => `${q.song.id}|${q.video.performers}`)).size).toBe(5)
    expect(qs.filter((q) => q.song.id === 's1')).toHaveLength(2)
  })
  const all = ['a', 'b', 'c']
  const keyOf = (q: ReturnType<typeof buildQuestions>[number]) => `${q.song.id}|${q.video.performers}`

  it('8択に正解が1つ・重複なし（正解は流れた動画の曲名＋歌唱者）', () => {
    for (const seed of ['s1', 's2', 's3']) {
      for (const q of buildQuestions(data, { sets: all, count: 20, seed })) {
        expect(q.choices).toHaveLength(8)
        expect(new Set(q.choices.map((c) => c.key)).size).toBe(8)
        expect(q.choices[q.answerIndex].key).toBe(keyOf(q))
        expect(q.choices.filter((c) => c.key === keyOf(q))).toHaveLength(1)
      }
    }
  })
  it('同じ曲の別バージョンも選択肢に並べる', () => {
    for (const seed of ['p', 'q', 'r', 's']) {
      const q = buildQuestions(data, { sets: all, count: 20, seed }).find((x) => x.song.id === 's1')!
      const versions = q.choices.filter((c) => c.songId === 's1').map((c) => c.performers)
      expect(versions.sort()).toEqual(['ひまり', 'ひまり、みつき'])
    }
  })
  it('歌唱者の表記が同じ動画は1つの選択肢にまとめる', () => {
    const q = buildQuestions(data, { sets: all, count: 20, seed: 'm' }).find((x) => x.song.id === 's1')!
    expect(q.choices.filter((c) => c.key === 's1|ひまり')).toHaveLength(1)
  })
  it('正解の曲に別バージョンがあるときは、ダミーにもバージョン違いのペアを混ぜる', () => {
    const decoyPaired = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].some((seed) => {
      const q = buildQuestions(data, { sets: all, count: 20, seed }).find((x) => x.song.id === 's1')!
      return q.choices.filter((c) => c.songId === 's7').length === 2
    })
    expect(decoyPaired).toBe(true)
  })
  it('同じ曲名のバージョンは全部並べ、8つを超えるときは選択肢を増やす', () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `キャラ${i + 1}`)
    const withVersions = (n: number): QuizData => ({
      ...data,
      songs: [...data.songs, song('h', names(n))],
      videos: [
        ...data.videos,
        ...names(n).map((p, i) => ({
          id: `h${i}`,
          songId: 'h',
          set: 'c',
          performers: p,
          introStart: 0,
          durationSec: 120,
        })),
      ],
    })
    for (const n of [5, 8, 10]) {
      for (const q of buildQuestions(withVersions(n), { sets: all, count: 40, seed: `v${n}` }).filter(
        (x) => x.song.id === 'h',
      )) {
        expect(
          q.choices
            .filter((c) => c.songId === 'h')
            .map((c) => c.performers)
            .sort(),
        ).toEqual(names(n).sort())
        expect(q.choices).toHaveLength(Math.max(8, n))
        expect(q.choices[q.answerIndex].key).toBe(keyOf(q))
      }
    }
  })
  it('同じキャラの別曲をダミーに優先する', () => {
    const q = buildQuestions(data, { sets: all, count: 20, seed: 'y' }).find((x) => x.song.id === 's3')!
    expect(q.choices.map((c) => c.songId)).toEqual(expect.arrayContaining(['s6']))
  })
  it('セットの曲が足りないときは、セット内の曲を全部使ってからほかのセットで補う', () => {
    for (const q of buildQuestions(data, { sets: ['a'], count: 5, seed: 'z' })) {
      expect(q.choices).toHaveLength(8)
      expect(q.choices.map((c) => c.songId)).toEqual(expect.arrayContaining(['s1', 's2', 's3', 's4']))
    }
  })
})

describe('採点', () => {
  it('早いほど高得点', () => {
    expect(basePoints(0)).toBe(1000)
    expect(basePoints(15000)).toBe(100)
    expect(basePoints(99999)).toBe(100)
    expect(basePoints(1000)).toBeGreaterThan(basePoints(5000))
  })
  it('コンボボーナス', () => {
    expect(comboBonus(1)).toBe(0)
    expect(comboBonus(2)).toBe(50)
    expect(comboBonus(10)).toBe(250)
  })
  it('不正解と時間切れは0点でコンボが切れる', () => {
    expect(scoreAnswer(false, 800, 3)).toMatchObject({ points: 0, combo: 0 })
    expect(scoreAnswer(true, null, 3)).toMatchObject({ points: 0, combo: 0 })
    expect(scoreAnswer(true, 0, 1)).toMatchObject({ points: 1050, combo: 2 })
  })
  it('称号', () => {
    expect(rankFor(9000, 10).title).toContain('クイーン')
    expect(rankFor(0, 10).title).toContain('見習い')
  })
})

describe('挑戦状URL', () => {
  it('往復できる', () => {
    const s = { sets: ['a', 'b'], count: 5, seed: 'ab3kd9' }
    expect(settingsFromHash(settingsToHash(s), ['a', 'b'])).toEqual(s)
  })
  it('知らないセットや不正なシードは無視する', () => {
    expect(settingsFromHash('#/play?sets=zzz&n=5&seed=abc', ['a'])).toBeNull()
    expect(settingsFromHash('#/play?sets=a&n=5&seed=<x>', ['a'])).toBeNull()
    expect(settingsFromHash('#/play?sets=a&n=7&seed=abc', ['a'])?.count).toBe(10)
  })
})
