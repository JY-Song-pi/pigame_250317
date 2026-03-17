/**
 * π MAHJONG — Web Audio API 사운드 엔진
 * 마작패 클릭, 매칭, 셔플 효과음 구현
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

    // ── 효과음 (SFX) ────────────────────────────────────────────────
    
    // 패 선택 (가벼운 클릭)
    function sfxClick() {
        if (!ctx || !enabled) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(); osc.stop(ctx.currentTime + 0.05);
    }

    // 매칭 성공 (맑은 벨 소리)
    function sfxMatch() {
        if (!ctx || !enabled) return;
        [600, 900].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.05);
            gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.2);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(ctx.currentTime + i * 0.05);
            osc.stop(ctx.currentTime + i * 0.05 + 0.2);
        });
    }

    // 셔플/아이템 사용 (Magic Sweep)
    function sfxMagic() {
        if (!ctx || !enabled) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
    }

    // 게임 클리어 (짧은 팡파르)
    function sfxWin() {
        const melody = [523.25, 659.25, 783.99, 1046.50];
        melody.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.4);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
    }

    return {
        init, resume, sfxClick, sfxMatch, sfxMagic, sfxWin,
        setEnabled: (v) => { enabled = v; },
        isEnabled: () => enabled
    };
})();

window.AudioEngine = AudioEngine;
