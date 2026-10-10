import { describe, expect, it } from 'vitest'
import type { QuizData } from '../schema.ts'
import { buildQuestions, availableSongCount } from './quiz.ts'
import { createRng, shuffle } from './rng.ts'
import { basePoints, comboBonus, rankFor, scoreAnswer } from './score.ts'
import { settingsFromHash, settingsToHash } from './settings-url.ts'
import { buildShareText } from './share.ts'
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
  ],
  songs: [
    song('s1', ['ひまり']),
    song('s2', ['ひまり']),
    song('s3', ['みつき']),
    song('s4', ['つむぎ']),
    song('s5', ['サクラ']),
    song('s6', ['ひまり', 'みつき']),
  ],
  videos: [
    { id: 'v1', songId: 's1', set: 'a', performers: 'ひまり', introStart: 0, durationSec: 120 },
    { id: 'v1b', songId: 's1', set: 'a', performers: 'ひまり', introStart: 0, durationSec: 120 },
    { id: 'v2', songId: 's2', set: 'a', performers: 'ひまり', introStart: 0, durationSec: 120 },
    { id: 'v3', songId: 's3', set: 'a', performers: 'みつき', introStart: 0, durationSec: 120 },
    { id: 'v4', songId: 's4', set: 'a', performers: 'つむぎ', introStart: 0, durationSec: 120 },
    { id: 'v5', songId: 's5', set: 'b', performers: 'サクラ', introStart: 0, durationSec: 120 },
    { id: 'v6', songId: 's6', set: 'b', performers: 'ひまり、みつき', introStart: 0, durationSec: 120 },
  ],
}

describe('buildQuestions', () => {
  const settings = { sets: ['a'], count: 10, seed: 'x1' }
  it('同じ設定なら同じ問題', () => {
    expect(buildQuestions(data, settings)).toEqual(buildQuestions(data, settings))
  })
  it('曲は重複せず、出題数は曲数まで', () => {
    const qs = buildQuestions(data, settings)
    expect(availableSongCount(data, ['a'])).toBe(4)
    expect(qs).toHaveLength(4)
    expect(new Set(qs.map((q) => q.song.id)).size).toBe(4)
  })
  it('4択に正解が1つ・重複なし', () => {
    for (const q of buildQuestions(data, { ...settings, sets: ['a', 'b'] })) {
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices.map((c) => c.id)).size).toBe(4)
      expect(q.choices[q.answerIndex].id).toBe(q.song.id)
    }
  })
  it('同じキャラの別曲をダミーに優先する', () => {
    const q = buildQuestions(data, { sets: ['a', 'b'], count: 6, seed: 'y' }).find((x) => x.song.id === 's1')!
    expect(q.choices.map((c) => c.id)).toEqual(expect.arrayContaining(['s2', 's6']))
  })
  it('セットの曲が4曲未満でも全曲から4択を作る', () => {
    for (const q of buildQuestions(data, { sets: ['b'], count: 5, seed: 'z' })) expect(q.choices).toHaveLength(4)
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

describe('シェア文', () => {
  it('結果記号と挑戦状URLを含む', () => {
    const questions = buildQuestions(data, { sets: ['a'], count: 2, seed: 's' })
    const text = buildShareText(
      { questions, answers: [scoreAnswer(true, 900, 0), scoreAnswer(false, 3000, 1)] },
      'https://example.com/#/play?seed=s',
    )
    expect(text).toContain('⚡❌')
    expect(text).toContain('最速 0.90秒')
    expect(text).toContain('https://example.com/#/play?seed=s')
  })
})
