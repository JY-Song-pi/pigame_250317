/**
 * app.js — 갤러가 게임 메인 컨트롤러 (Standardized Version)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── DOM 요소 ──────────────────────────────────────────
    const scoreEl = document.getElementById('score');
    const piEarnedEl = document.getElementById('pi-earned');
    const livesEl = document.getElementById('lives');
    
    const overlays = {
        start:      document.getElementById('start-overlay'),
        gameOver:   document.getElementById('game-over-overlay'),
        pause:      document.getElementById('pause-overlay'),
    };

    const showOverlay = (key) => {
        Object.values(overlays).forEach(o => o.classList.remove('active'));
        if (key) overlays[key].classList.add('active');
    };

    // ── 오디오 초기화 ──────────────────────────────────────
    const initAudio = () => { AudioEngine.init(); AudioEngine.resume(); };

    const btnMute = document.getElementById('btn-mute');
    btnMute.addEventListener('click', () => {
        const enabled = AudioEngine.isEnabled();
        AudioEngine.setEnabled(!enabled);
        if (!enabled) {
            AudioEngine.resume();
            AudioEngine.startBGM();
            btnMute.textContent = '🔊';
            btnMute.classList.remove('muted');
        } else {
            AudioEngine.stopBGM();
            btnMute.textContent = '🔇';
            btnMute.classList.add('muted');
        }
    });

    // ── Pi SDK ────────────────────────────────────────────
    PiIntegration.init();
    const btnLogin = document.getElementById('btn-login');
    const userInfoEl = document.getElementById('user-info');
    
    btnLogin.addEventListener('click', async () => {
        const user = await PiIntegration.authenticate();
        if (user) {
            btnLogin.style.display = 'none';
            userInfoEl.textContent = `Welcome, ${user.username}!`;
        }
    });

    // ── 게임 엔진 초기화 & 이벤트 바인딩 ───────────────────
    const canvas = document.getElementById('game-canvas');
    const game = GalagaGame.init(canvas, {
        onStateChange: (state) => {
            if (state === 'gameover') {
                AudioEngine.stopBGM();
                AudioEngine.sfxGameOver();
                document.getElementById('final-score').innerText = scoreEl.innerText;
                document.getElementById('final-best').innerText = game.getBestScore();
                document.getElementById('final-pi').innerText = piEarnedEl.innerText + 'π';
                showOverlay('gameOver');
            } else if (state === 'paused') {
                AudioEngine.stopBGM();
                showOverlay('pause');
            } else if (state === 'playing') {
                showOverlay(null);
            }
        },
        onScoreUpdate: (data) => {
            if (data.score !== undefined) scoreEl.innerText = data.score;
            if (data.piEarned !== undefined) piEarnedEl.innerText = data.piEarned.toFixed(3);
            if (data.lives !== undefined) livesEl.innerText = '♥'.repeat(Math.max(0, data.lives)) || '💀';
        }
    });

    // 사운드 이벤트 연결
    game.on('shoot', () => AudioEngine.sfxShoot());
    game.on('enemyKill', () => AudioEngine.sfxExplosion());
    game.on('piEarned', () => {
        AudioEngine.sfxPiEarned();
        PiIntegration.addPiReward(0.005);
    });
    game.on('lifeLost', () => AudioEngine.sfxLifeLost());

    // ── 버튼 이벤트 ───────────────────────────────────────
    document.getElementById('btn-start').addEventListener('click', () => {
        initAudio();
        showOverlay(null);
        game.start();
        AudioEngine.startBGM();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        showOverlay(null);
        game.start();
        AudioEngine.startBGM();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
        showOverlay(null);
        game.togglePause();
        AudioEngine.startBGM();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        const state = game.togglePause();
        if (state === 'paused') {
            AudioEngine.stopBGM();
            showOverlay('pause');
        } else {
            AudioEngine.startBGM();
            showOverlay(null);
        }
    });

    // ── 모바일 컨트롤 ─────────────────────────────────────
    const btnLeft  = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnFire  = document.getElementById('btn-fire');

    const bindCtrl = (el, action, val) => {
        if (!el) return;
        const press = (e) => { e.preventDefault(); action(val); el.classList.add('active'); };
        const release = (e) => { e.preventDefault(); action(!val); el.classList.remove('active'); };
        el.addEventListener('touchstart', press, {passive: false});
        el.addEventListener('touchend', release, {passive: false});
        el.addEventListener('mousedown', press);
        el.addEventListener('mouseup', release);
    };

    if (btnLeft) bindCtrl(btnLeft,  game.moveLeft,  true);
    if (btnRight) bindCtrl(btnRight, game.moveRight, true);
    
    if (btnFire) {
        btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); game.requestFire(); }, {passive: false});
        btnFire.addEventListener('mousedown', () => game.requestFire());
    }

    // ── 조이스틱 초기화 & 제어 루프 ────────────────────────
    const joystick = new VirtualJoystick('joystick-container', {
        size: 100,
        stickSize: 50,
        color: 'rgba(168, 85, 247, 0.15)',
        handleColor: 'rgba(168, 85, 247, 0.8)'
    });

    const THRESHOLD = 0.2;
    let lastJoyX = 0;

    setInterval(() => {
        // GalagaGame.init returns getState if it matches standardized pattern, 
        // but let's check if it exposes it. Based on galagaLogic.js view, 
        // it doesn't expose getState. Let's add it or use a different check.
        // Actually, galagaLogic.js has gameState variable.
        
        const { deltaX } = joystick;
        let moveX = 0;

        if (Math.abs(deltaX) > THRESHOLD) {
            moveX = deltaX > 0 ? 1 : -1;
        }

        if (moveX !== lastJoyX) {
            if (moveX === -1) {
                game.moveLeft(true);
                game.moveRight(false);
            } else if (moveX === 1) {
                game.moveRight(true);
                game.moveLeft(false);
            } else {
                game.moveLeft(false);
                game.moveRight(false);
            }
            lastJoyX = moveX;
        }
    }, 50);
});
