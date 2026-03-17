/**
 * π PAC-MAN — Web Audio API 사운드 엔진
 * 외부 파일 없이 순수 Web Audio API로 팩맨 사운드 구현
 */
const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let bgmGain = null;
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

    // ── 효과음 (SFX) ────────────────────────────────────────────────
    
    // 와카와카 (점 먹기)
    let wakaToggle = false;
    function sfxWaka() {
        if (!ctx || !enabled) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const freq = wakaToggle ? 400 : 600;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        wakaToggle = !wakaToggle;
    }

    // 파워 펠릿 (큰 점)
    function sfxPowerUp() {
        if (!ctx || !enabled) return;
        for(let i=0; i<3; i++) {
            const time = ctx.currentTime + i * 0.1;
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(400 + i*200, time);
            osc.frequency.exponentialRampToValueAtTime(800 + i*200, time + 0.1);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(time); osc.stop(time + 0.1);
        }
    }

    // 고스트 먹기
    function sfxEatGhost() {
        if (!ctx || !enabled) return;
        const notes = [440, 554, 659, 880];
        notes.forEach((f, i) => {
            const time = ctx.currentTime + i * 0.05;
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(f, time);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(time); osc.stop(time + 0.1);
        });
    }

    // 사망 사운드 (점점 낮아지는 소리)
    function sfxDeath() {
        if (!ctx || !enabled) return;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 1.0);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(); osc.stop(ctx.currentTime + 1.0);
    }

    function sfxPiEarned() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
            const time = ctx.currentTime + i * 0.1;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, time);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(time); osc.stop(time + 0.15);
        });
    }

    return {
        init, resume, sfxWaka, sfxPowerUp, sfxEatGhost, sfxDeath, sfxPiEarned,
        setEnabled: (v) => { enabled = v; },
        isEnabled: () => enabled
    };
})();

window.AudioEngine = AudioEngine;
