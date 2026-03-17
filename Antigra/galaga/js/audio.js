/**
 * π GALAGA — Web Audio API 사운드 엔진
 * 외부 음원 파일 없이 순수 Web Audio API로 우주 전쟁 사운드 생성
 */
const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let bgmGain = null;
    let bgmInterval = null;
    let enabled = true;

    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(ctx.destination);
        bgmGain = ctx.createGain();
        bgmGain.gain.value = 0.25;
        bgmGain.connect(masterGain);
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function playTone(freq, type, duration, gainVal = 0.3, startDelay = 0, target = masterGain) {
        if (!ctx || !enabled) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime + startDelay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
        osc.connect(gain);
        gain.connect(target);
        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration);
    }

    // ── 효과음 (SFX) ────────────────────────────────────────────────
    function sfxShoot() {
        if (!ctx || !enabled) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }

    function sfxExplosion() {
        if (!ctx || !enabled) return;
        const duration = 0.4;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // 화이트 노이즈
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + duration);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start();
        noise.stop(ctx.currentTime + duration);
    }

    function sfxPiEarned() {
        const notes = [523, 659, 784, 1047, 1318]; // C5 E5 G5 C6 E6
        notes.forEach((f, i) => playTone(f, 'triangle', 0.2, 0.4, i * 0.08));
    }

    function sfxLifeLost() {
        playTone(330, 'sawtooth', 0.15);
        playTone(220, 'sawtooth', 0.2, 0.3, 0.15);
    }

    function sfxGameOver() {
        const notes = [392, 349, 311, 261, 196];
        notes.forEach((f, i) => playTone(f, 'sawtooth', 0.4, 0.4, i * 0.2));
    }

    // ── BGM (심플 우주 테마 루프) ───────────────────────────────
    const BGM_PATTERN = [
        196, 0, 196, 0, 261, 0, 261, 0, // G3, C4
        233, 0, 233, 0, 174, 0, 174, 0  // Bb3, F3
    ];
    let bgmStep = 0;
    function startBGM() {
        if (!ctx || !enabled) return;
        stopBGM();
        bgmStep = 0;
        bgmInterval = setInterval(() => {
            const freq = BGM_PATTERN[bgmStep % BGM_PATTERN.length];
            if (freq > 0) {
                playTone(freq, 'square', 0.2, 0.15, 0, bgmGain);
            }
            bgmStep++;
        }, 180);
    }

    function stopBGM() {
        if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
    }

    return {
        init, resume, sfxShoot, sfxExplosion, sfxPiEarned,
        sfxLifeLost, sfxGameOver, startBGM, stopBGM,
        setEnabled: (v) => { enabled = v; if(!v) stopBGM(); },
        isEnabled: () => enabled
    };
})();

window.AudioEngine = AudioEngine;
