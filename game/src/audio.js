// Synthesized sound effects: every sound is built from oscillators and a noise buffer
// with the Web Audio API, so the game ships no audio files. The context is created lazily
// on the first user gesture (browsers block audio before one) and every call before that
// is a silent no-op.

export function createAudio() {
  let context = null;
  let master = null;
  let noise = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      const length = Math.floor(context.sampleRate * 0.3);
      noise = context.createBuffer(1, length, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
      return false;
    }
    return true;
  }

  function tone({ type, from, to, seconds, gain, delay = 0 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + seconds);
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  function burst({ seconds, gain, frequency, delay = 0 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(80, start + seconds);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  return {
    /** Call from any user gesture so later sounds are allowed to play. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    shoot() {
      tone({ type: 'square', from: 720, to: 380, seconds: 0.07, gain: 0.1 });
    },
    hit() {
      tone({ type: 'triangle', from: 190, to: 120, seconds: 0.05, gain: 0.09 });
    },
    explode() {
      burst({ seconds: 0.28, gain: 0.3, frequency: 2400 });
      tone({ type: 'sine', from: 160, to: 38, seconds: 0.3, gain: 0.28 });
    },
    playerHit() {
      tone({ type: 'sawtooth', from: 150, to: 55, seconds: 0.22, gain: 0.25 });
      burst({ seconds: 0.18, gain: 0.2, frequency: 1200 });
    },
    upgrade() {
      tone({ type: 'sine', from: 523, to: 523, seconds: 0.1, gain: 0.16 });
      tone({ type: 'sine', from: 659, to: 659, seconds: 0.1, gain: 0.16, delay: 0.09 });
      tone({ type: 'sine', from: 784, to: 784, seconds: 0.16, gain: 0.16, delay: 0.18 });
    },
    waveClear() {
      tone({ type: 'sine', from: 880, to: 880, seconds: 0.12, gain: 0.14 });
      tone({ type: 'sine', from: 1318, to: 1318, seconds: 0.2, gain: 0.14, delay: 0.11 });
    },
    gameOver() {
      [392, 311, 233, 175].forEach((frequency, index) => {
        tone({ type: 'triangle', from: frequency, to: frequency * 0.94, seconds: 0.2, gain: 0.18, delay: index * 0.17 });
      });
    },
    click() {
      tone({ type: 'sine', from: 1000, to: 900, seconds: 0.05, gain: 0.1 });
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
