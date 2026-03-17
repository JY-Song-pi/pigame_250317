/**
 * app.js — π Pac-Man 메인 컨트롤러 (Standardized Version)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── DOM 요소 ──────────────────────────────────────────
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
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
            btnMute.textContent = '🔊';
            btnMute.classList.remove('muted');
        } else {
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
    const game = PacmanGame.init(canvas, {
        onStateChange: (state) => {
            if (state === 'over') {
                document.getElementById('final-score').innerText = scoreEl.innerText;
                document.getElementById('final-best').innerText = game.getBestScore();
                document.getElementById('final-level').innerText = levelEl.innerText;
                showOverlay('gameOver');
            } else if (state === 'paused') {
                showOverlay('pause');
            } else if (state === 'playing') {
                showOverlay(null);
            }
        },
        onScoreChange: (score, best) => { scoreEl.innerText = score; },
        onLivesChange: (lives) => { livesEl.innerText = '♥'.repeat(Math.max(0, lives)) || '💀'; },
        onStageChange: (stage) => { levelEl.innerText = stage; },
        onPiChange: (totalPi) => { /* UI 상단에 π 표시할 공간 있으면 추가 가능 */ }
    });

    // 사운드 이벤트 연결
    game.on('waka', () => AudioEngine.sfxWaka());
    game.on('powerUp', () => AudioEngine.sfxPowerUp());
    game.on('piEarned', () => AudioEngine.sfxPiEarned());
    game.on('eatGhost', () => AudioEngine.sfxEatGhost());
    game.on('death', () => AudioEngine.sfxDeath());

    // ── 버튼 이벤트 ───────────────────────────────────────
    document.getElementById('btn-start').addEventListener('click', () => {
        initAudio();
        showOverlay(null);
        game.startGame();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        showOverlay(null);
        game.startGame();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
        showOverlay(null);
        game.togglePause();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        const state = game.togglePause();
        if (state === 'paused') showOverlay('pause');
        else showOverlay(null);
    });

    // ── 모바일 컨트롤 (D-Pad) ──────────────────────────────
    const bindDpad = (id, x, y) => {
        const el = document.getElementById(id);
        const press = (e) => { e.preventDefault(); game.move(x, y); el.classList.add('active'); };
        const release = () => el.classList.remove('active');
        el.addEventListener('touchstart', press, {passive: false});
        el.addEventListener('touchend', release);
        el.addEventListener('mousedown', press);
        el.addEventListener('mouseup', release);
    };

    bindDpad('btn-up', 0, -1);
    bindDpad('btn-down', 0, 1);
    bindDpad('btn-left', -1, 0);
    bindDpad('btn-right', 1, 0);

    // ── 키보드 컨트롤 ─────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowUp':    game.move(0, -1); break;
            case 'ArrowDown':  game.move(0, 1); break;
            case 'ArrowLeft':  game.move(-1, 0); break;
            case 'ArrowRight': game.move(1, 0); break;
            case 'p': case 'P': case 'Escape':
                const state = game.togglePause();
                if (state === 'paused') showOverlay('pause');
                else showOverlay(null);
                break;
        }
    });

    // ── 스와이프 제스처 (캔버스 타겟) ────────────────────────
    let touchX = 0, touchY = 0;
    canvas.addEventListener('touchstart', (e) => {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
    }, {passive: true});

    canvas.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 30) game.move(dx > 0 ? 1 : -1, 0);
        } else {
            if (Math.abs(dy) > 30) game.move(0, dy > 0 ? 1 : -1);
        }
    }, {passive: true});

    // ── 조이스틱 초기화 & 제어 루프 ────────────────────────
    const joystick = new VirtualJoystick('joystick-container', {
        size: 100,
        stickSize: 50,
        color: 'rgba(168, 85, 247, 0.15)',
        handleColor: 'rgba(168, 85, 247, 0.8)'
    });

    // 부드러운 전환을 위한 조이스틱 임계값
    const THRESHOLD = 0.2;
    let lastJoyX = 0;
    let lastJoyY = 0;

    setInterval(() => {
        if (!game.getState || game.getState() !== 'playing') return;

        const { deltaX, deltaY } = joystick;
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > THRESHOLD) moveX = deltaX > 0 ? 1 : -1;
        } else {
            if (Math.abs(deltaY) > THRESHOLD) moveY = deltaY > 0 ? 1 : -1;
        }

        if (moveX !== 0 || moveY !== 0) {
            if (moveX !== lastJoyX || moveY !== lastJoyY) {
                console.log(`Joystick Move: ${moveX}, ${moveY}`);
                game.move(moveX, moveY);
                lastJoyX = moveX;
                lastJoyY = moveY;
            }
        } else {
            lastJoyX = 0;
            lastJoyY = 0;
        }
    }, 100);
});
