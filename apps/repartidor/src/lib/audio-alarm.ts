// Web Audio API — alarma continua para alertas de despacho
// iOS/Safari requiere unlock en primera interacción del usuario

let _audioCtx: AudioContext | null = null
let _alarmRunning = false
let _stopAlarm: (() => void) | null = null

// Llamar en el primer tap/click de la app para desbloquear AudioContext en iOS
export function unlockAudio() {
  if (_audioCtx) return
  try {
    _audioCtx = new AudioContext()
    // Buffer silencioso de 1 sample — desbloquea el contexto en Safari/iOS
    const buf = _audioCtx.createBuffer(1, 1, 22050)
    const src = _audioCtx.createBufferSource()
    src.buffer = buf
    src.connect(_audioCtx.destination)
    src.start(0)
  } catch { /* AudioContext no disponible en este browser */ }
}

// Patrón de dos tonos: 880Hz + 660Hz alternando, con pausa
export function startAlarm(): void {
  if (_alarmRunning || !_audioCtx) return
  _alarmRunning = true

  const ctx  = _audioCtx
  const gain = ctx.createGain()
  gain.connect(ctx.destination)

  let running = true

  async function pulse() {
    while (running) {
      playTone(ctx, gain, 880, 0.35, 0.28)
      await sleep(360)
      if (!running) break
      playTone(ctx, gain, 660, 0.35, 0.28)
      await sleep(420)
    }
  }

  pulse()

  // Vibración táctil (Android) — sin permiso requerido
  if ('vibrate' in navigator) {
    const vibrateLoop = setInterval(() => {
      if (!running) { clearInterval(vibrateLoop); return }
      navigator.vibrate([300, 150, 300])
    }, 1000)
    _stopAlarm = () => {
      running = false
      _alarmRunning = false
      _stopAlarm = null
      clearInterval(vibrateLoop)
      gain.gain.setValueAtTime(0, ctx.currentTime)
    }
  } else {
    _stopAlarm = () => {
      running = false
      _alarmRunning = false
      _stopAlarm = null
      gain.gain.setValueAtTime(0, ctx.currentTime)
    }
  }
}

export function stopAlarm(): void {
  if (_stopAlarm) _stopAlarm()
  if ('vibrate' in navigator) navigator.vibrate(0)
}

export function isAlarmRunning(): boolean {
  return _alarmRunning
}

function playTone(ctx: AudioContext, gain: GainNode, freq: number, vol: number, dur: number) {
  try {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + dur)
  } catch { /* silencioso */ }
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}
