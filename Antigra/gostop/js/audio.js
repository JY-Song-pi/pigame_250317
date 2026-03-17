/**
 * π GO-STOP — Web Audio API 사운드 엔진
 * 화투 패 소리 및 고/스톱 효과음 구현
 */
const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let enabled = true;

    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(ctx.destination);
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    // ── 효과음 (SFX) ────────────────────────────────────────────────
    
    // 패 내려치는 소리 (탁!)
    function sfxSnap() {
        if (!ctx || !enabled) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }

    // 셔플/카드 넘기는 소리 (스윽)
    function sfxShuffle() {
        if (!ctx || !enabled) return;
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start();
    }

    // 승리/고! (팡파르 느낌)
    function sfxWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
    }

    return {
        init, resume, sfxSnap, sfxShuffle, sfxWin,
        setEnabled: (v) => { enabled = v; },
        isEnabled: () => enabled
    };
})();

window.AudioEngine = AudioEngine;
