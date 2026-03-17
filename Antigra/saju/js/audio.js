/**
 * π SAJU — Meditative Audio Engine
 */
const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let enabled = true;

    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(ctx.destination);
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    // ── 명상용 힐링 사운드 (Zen Chime) ──
    function sfxChime() {
        if (!ctx || !enabled) return;
        const frequencies = [523.25, 659.25, 783.99]; // C, E, G
        frequencies.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.className = 'sine';
            osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 1.5);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 1.5);
        });
    }

    return { init, resume, sfxChime, setEnabled: (v) => enabled = v };
})();

window.AudioEngine = AudioEngine;
