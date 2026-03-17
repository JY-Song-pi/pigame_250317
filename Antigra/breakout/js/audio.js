/**
 * π BREAKOUT — Web Audio API 사운드 엔진
 * 외부 음원 파일 없이 순수 Web Audio API로 BGM + 효과음 생성
 */
const AudioEngine = (() => {
    let ctx = null;
    let masterGain = null;
    let bgmNode = null;
    let bgmGain = null;
    let bgmInterval = null;
    let enabled = true;

    // ── AudioContext 초기화 (사용자 제스처 이후 호출) ──────────────
    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.55;
        masterGain.connect(ctx.destination);
        bgmGain = ctx.createGain();
        bgmGain.gain.value = 0.3;
        bgmGain.connect(masterGain);
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    // ── 기본 오실레이터 帮함수 ──────────────────────────────────────
    function playTone(freq, type, duration, gainVal = 0.4, startDelay = 0, target = masterGain) {
        if (!ctx || !enabled) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(gainVal, ctx.currentTime + startDelay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
        osc.connect(gain);
        gain.connect(target);
        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration);
    }

    // ── 효과음 ─────────────────────────────────────────────────────
    function sfxBrick() {
        // 짧고 경쾌한 핑 소리
        playTone(880, 'square', 0.08, 0.25);
        playTone(1200, 'sine',  0.06, 0.15, 0.03);
    }

    function sfxPiTile() {
        // π 특수 벽돌 — 화려한 팡파레
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => playTone(f, 'triangle', 0.18, 0.3, i * 0.07));
    }

    function sfxPaddle() {
        // 패들에 맞을 때 퉁기는 소리
        playTone(330, 'sine', 0.1, 0.3);
        playTone(440, 'square', 0.05, 0.1, 0.05);
    }

    function sfxWall() {
        // 벽에 맞을 때 가벼운 틱
        playTone(220, 'square', 0.06, 0.15);
    }

    function sfxLifeLost() {
        // 목숨 잃기 — 짧은 2음 하강 (게임오버와 확실히 다른 소리)
        playTone(440, 'sine', 0.12, 0.4);
        playTone(220, 'sawtooth', 0.18, 0.35, 0.1);
    }

    function sfxGameOver() {
        // 게임 오버 — 느리게 내려가는 비장한 멜로디
        const notes = [349, 294, 247, 196, 147];
        notes.forEach((f, i) => playTone(f, 'sawtooth', 0.35, 0.4, i * 0.18));
    }

    function sfxStageClear() {
        // 스테이지 클리어 — 올라가는 밝은 팡파레
        const notes = [523, 659, 784, 1047, 1319];
        notes.forEach((f, i) => playTone(f, 'triangle', 0.22, 0.45, i * 0.09));
    }

    function sfxLaunch() {
        // 볼 발사 '퓨~'
        if (!ctx || !enabled) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    }

    // ── BGM (칩튠 스타일 반복 루프) ────────────────────────────────
    // C major 기반의 간단한 아르페지오 패턴
    const BGM_PATTERN = [
        262, 330, 392, 524,   // C4 E4 G4 C5
        294, 370, 440, 587,   // D4 F#4 A4 D5
        262, 330, 392, 524,
        220, 277, 349, 440,   // A3 C#4 F4 A4
    ];

    let bgmStep = 0;
    const BGM_TEMPO_MS = 135; // BPM ≈ 111

    function startBGM() {
        if (!ctx || !enabled) return;
        stopBGM();
        bgmStep = 0;
        bgmInterval = setInterval(() => {
            const freq = BGM_PATTERN[bgmStep % BGM_PATTERN.length];
            playTone(freq, 'square', 0.13, 0.22, 0, bgmGain);
            // 베이스 (2옥타브 아래, 4박 마다)
            if (bgmStep % 4 === 0) {
                playTone(freq / 2, 'triangle', 0.25, 0.18, 0, bgmGain);
            }
            bgmStep++;
        }, BGM_TEMPO_MS);
    }

    function stopBGM() {
        if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
    }

    function setEnabled(val) {
        enabled = val;
        if (!val) stopBGM();
    }

    return {
        init,
        resume,
        sfxBrick,
        sfxPiTile,
        sfxPaddle,
        sfxWall,
        sfxLifeLost,
        sfxGameOver,
        sfxStageClear,
        sfxLaunch,
        startBGM,
        stopBGM,
        setEnabled,
        isEnabled: () => enabled,
    };
})();

window.AudioEngine = AudioEngine;
