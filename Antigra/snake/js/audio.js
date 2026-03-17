/**
 * π SNAKE — Web Audio API 사운드 엔진
 * 외부 파일 없이 순수 Web Audio API로 스네이크 사운드 구현
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
    
    function sfxEat() {
        // 짧고 높은 톤 (Pop)
        playTone(600, 'sine', 0.1, 0.4);
        playTone(900, 'sine', 0.1, 0.2, 0.05);
    }

    function sfxDie() {
        // 낮아지는 노이즈성 사운드
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
    }

    function sfxPiEarned() {
        // 비트감 있는 성공음
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => playTone(f, 'triangle', 0.2, 0.3, i * 0.08));
    }

    function sfxPowerUp() {
        // 반짝이는 소리
        for(let i=0; i<5; i++) {
            playTone(800 + i*200, 'sine', 0.1, 0.1, i * 0.05);
        }
    }

    return {
        init, resume, sfxEat, sfxDie, sfxPiEarned, sfxPowerUp,
        setEnabled: (v) => { enabled = v; },
        isEnabled: () => enabled
    };
})();

window.AudioEngine = AudioEngine;
