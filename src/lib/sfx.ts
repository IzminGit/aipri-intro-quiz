/** 正解・不正解の効果音（音声ファイルなしで Web Audio で鳴らす） */
let ctx: AudioContext | null = null

/** タップ操作の中で一度呼んでおくと、以降の効果音が iOS でも鳴る */
export function unlockSfx() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain = 0.18) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = ctx.currentTime + start
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + duration)
}

export function playCorrect() {
  tone(1318.5, 0, 0.18, 'sine') // ピン
  tone(1760, 0.12, 0.35, 'sine') // ポーン
}

export function playWrong() {
  tone(180, 0, 0.45, 'square', 0.08) // ブブー
}
