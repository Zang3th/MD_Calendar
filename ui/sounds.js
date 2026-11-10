window.MDCalendar = window.MDCalendar || /** @type {MDCalendarNamespace} */ ({});

// Completion sound, playback structure adopted from MD_Manager ui/sounds.js.
// The sound is the Arpeggio (docs/ui/DesignSystem.md#completion-sound-arpeggio).
(function (app) {
  /** Frequency in Hz, start, attack, hold and release in seconds, peak gain. */
  const voices = [
    { frequency: 1046.50, start: 0, attack: .004, hold: .020, release: .320, gain: .70 },
    { frequency: 1318.51, start: .055, attack: .004, hold: .020, release: .320, gain: .70 },
    { frequency: 1567.98, start: .110, attack: .004, hold: .040, release: .550, gain: .75 }
  ];
  const masterGain = .09;
  const dryGain = .7;
  const wetGain = .3;

  /** @type {AudioContext | null} */
  let context = null;
  /** @type {OscillatorNode[]} */
  let activeSources = [];
  /** @type {GainNode | null} */
  let activeBus = null;
  /** @type {AudioBuffer | null} */
  let plateImpulse = null;
  /** @type {number | null} */
  let cleanupTimer = null;
  let requestId = 0;
  let muted = false;

  function stopActive() {
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
    if (activeBus && context) {
      activeBus.gain.cancelScheduledValues(context.currentTime);
      activeBus.gain.setValueAtTime(0, context.currentTime);
      activeBus.disconnect();
    }
    activeSources.forEach(source => {
      try { source.stop(); } catch { /* Source already stopped. */ }
      source.disconnect();
    });
    activeSources = [];
    activeBus = null;
  }

  /** The MD_Manager plate: one second, stereo, seeded noise with cubic decay. @param {AudioContext} audio @param {GainNode} bus */
  function createPlate(audio, bus) {
    const plate = audio.createConvolver();
    if (!plateImpulse) {
      plateImpulse = audio.createBuffer(2, audio.sampleRate, audio.sampleRate);
      let seed = 48271;
      for (let channel = 0; channel < plateImpulse.numberOfChannels; channel += 1) {
        const samples = plateImpulse.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) {
          seed = seed * 16807 % 2147483647;
          samples[index] = (seed / 1073741824 - 1) * Math.pow(1 - index / samples.length, 3);
        }
      }
    }
    plate.buffer = plateImpulse;
    plate.connect(bus);
    return plate;
  }

  /** @param {AudioContext} audio @param {GainNode} bus @param {ConvolverNode} plate @param {number} start @param {typeof voices[number]} voice */
  function playVoice(audio, bus, plate, start, voice) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const dry = audio.createGain();
    const wet = audio.createGain();
    const begin = start + voice.start;
    const end = begin + voice.attack + voice.hold + voice.release;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(voice.frequency, begin);
    envelope.gain.setValueAtTime(.0001, begin);
    envelope.gain.exponentialRampToValueAtTime(voice.gain, begin + voice.attack);
    envelope.gain.setValueAtTime(voice.gain, begin + voice.attack + voice.hold);
    envelope.gain.exponentialRampToValueAtTime(.0001, end);
    dry.gain.value = dryGain;
    wet.gain.value = wetGain;
    oscillator.connect(envelope);
    envelope.connect(dry).connect(bus);
    envelope.connect(wet).connect(plate);
    oscillator.start(begin);
    oscillator.stop(end + .02);
    activeSources.push(oscillator);
    oscillator.addEventListener("ended", () => {
      activeSources = activeSources.filter(source => source !== oscillator);
      oscillator.disconnect();
      if (!activeSources.length && activeBus === bus) {
        // Let the reverb tail ring out before releasing the bus.
        cleanupTimer = window.setTimeout(() => {
          cleanupTimer = null;
          if (activeBus !== bus) return;
          bus.disconnect();
          activeBus = null;
        }, 1000);
      }
    }, { once: true });
  }

  async function play() {
    if (muted) return;
    const current = ++requestId;
    if (!context) context = new AudioContext();
    const audio = context;
    await audio.resume();
    if (muted || current !== requestId) return;
    stopActive();
    const bus = audio.createGain();
    bus.gain.value = masterGain;
    bus.connect(audio.destination);
    activeBus = bus;
    const plate = createPlate(audio, bus);
    const start = audio.currentTime + .008;
    voices.forEach(voice => playVoice(audio, bus, plate, start, voice));
  }

  /** @param {boolean} value */
  function setMuted(value) {
    muted = value;
    if (muted) {
      requestId += 1;
      stopActive();
    }
  }

  app.sounds = { play, setMuted, isMuted: () => muted };
})(window.MDCalendar);
