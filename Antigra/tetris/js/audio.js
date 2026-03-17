/**
 * π TETRIS — Web Audio API 사운드 엔진
 * 외부 파일 없이 순수 Web Audio API로 테트리스 사운드 구현
 */
const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let enabled = true;

    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(ctx.destination);
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function playTone(freq, type, duration, gainVal = 0.2, startDelay = 0) {
        if (!ctx || !enabled) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime + startDelay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration);
    }

    // ── 효과음 (SFX) ────────────────────────────────────────────────
    
    function sfxMove() {
        playTone(200, 'square', 0.05, 0.1);
    }

    function sfxRotate() {
        playTone(400, 'square', 0.05, 0.1);
    }

    function sfxDrop() {
        playTone(100, 'triangle', 0.1, 0.3);
    }

    function sfxLine() {
        // 도-미-솔-도 상행
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => playTone(f, 'sine', 0.3, 0.2, i * 0.08));
    }

    function sfxGameOver() {
        const notes = [440, 415, 392, 349];
        notes.forEach((f, i) => playTone(f, 'sawtooth', 0.5, 0.3, i * 0.2));
    }

    function sfxPiEarned() {
        const notes = [784, 880, 987, 1174];
        notes.forEach((f, i) => playTone(f, 'triangle', 0.2, 0.4, i * 0.1));
    }

    return {
        init, resume, sfxMove, sfxRotate, sfxDrop, sfxLine, sfxGameOver, sfxPiEarned,
        setEnabled: (v) => { enabled = v; },
        isEnabled: () => enabled
    };
})();

window.AudioEngine = AudioEngine;
