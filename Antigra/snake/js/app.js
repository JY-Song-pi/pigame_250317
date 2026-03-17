/**
 * app.js — π Snake 메인 컨트롤러 (Standardized Version)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── DOM 요소 ──────────────────────────────────────────
    const scoreEl = document.getElementById('score');
    const bestScoreEl = document.getElementById('best-score');
    
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
    const game = SnakeGame.init(canvas, {
        onStateChange: (state) => {
            if (state === 'over') {
                document.getElementById('final-score').innerText = scoreEl.innerText;
                document.getElementById('final-best').innerText = bestScoreEl.innerText;
                document.getElementById('final-pi').innerText = PiIntegration.getSessionPi().toFixed(4);
                showOverlay('gameOver');
            } else if (state === 'paused') {
                showOverlay('pause');
            } else if (state === 'playing') {
                showOverlay(null);
            }
        },
        onScoreChange: (score, best) => {
            scoreEl.innerText = score;
            bestScoreEl.innerText = best;
        },
        onPiChange: (totalPi) => {
            // 필요 시 실시간 π 표시 로직 추가
        }
    });

    // 사운드 이벤트 연결
    game.on('eat', () => AudioEngine.sfxEat());
    game.on('piEarned', () => AudioEngine.sfxPiEarned());
    game.on('die', () => AudioEngine.sfxDie());

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
        const state = game.getState();
        if (state === 'playing') {
            game.pause();
            showOverlay('pause');
        } else if (state === 'paused') {
            game.resume();
            showOverlay(null);
        }
    });

    // ── 모바일 컨트롤 (D-Pad) ──────────────────────────────
    const bindDpad = (id, x, y) => {
        const el = document.getElementById(id);
        const press = (e) => {
            e.preventDefault();
            game.setDirection(x, y);
            el.classList.add('active');
        };
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
            case 'ArrowUp':    game.setDirection(0, -1); break;
            case 'ArrowDown':  game.setDirection(0, 1); break;
            case 'ArrowLeft':  game.setDirection(-1, 0); break;
            case 'ArrowRight': game.setDirection(1, 0); break;
            case 'Escape': case 'p': case 'P':
                game.togglePause();
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
            if (Math.abs(dx) > 30) game.setDirection(dx > 0 ? 1 : -1, 0);
        } else {
            if (Math.abs(dy) > 30) game.setDirection(0, dy > 0 ? 1 : -1);
        }
    }, {passive: true});
});
