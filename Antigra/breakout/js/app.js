document.addEventListener("DOMContentLoaded", () => {
    // ── Canvas setup ────────────────────────────────────
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width  = 480;
    canvas.height = 640;

    // ── UI 요소 ─────────────────────────────────────────
    const scoreEl = document.getElementById('score');
    const stageEl = document.getElementById('stage');
    const livesEl = document.getElementById('lives');

    // ── 오버레이 유틸 ────────────────────────────────────
    const overlays = {
        start:      document.getElementById('start-overlay'),
        gameOver:   document.getElementById('game-over-overlay'),
        stageClear: document.getElementById('stage-clear-overlay'),
        pause:      document.getElementById('pause-overlay'),
    };
    const showOverlay = (key) => {
        Object.values(overlays).forEach(o => o.classList.remove('active'));
        if (key) overlays[key].classList.add('active');
    };

    // ── 오디오 초기화 (첫 사용자 제스처 시 호출) ────────
    const initAudio = () => { AudioEngine.init(); AudioEngine.resume(); };

    // ── 뮤트 버튼 ───────────────────────────────────────
    const btnMute = document.getElementById('btn-mute');
    btnMute.addEventListener('click', () => {
        if (AudioEngine.isEnabled()) {
            AudioEngine.setEnabled(false);
            btnMute.textContent = '🔇';
            btnMute.classList.add('muted');
        } else {
            AudioEngine.setEnabled(true);
            AudioEngine.resume();
            btnMute.textContent = '🔊';
            btnMute.classList.remove('muted');
        }
    });

    // ── Pi SDK ───────────────────────────────────────────
    PiIntegration.init();
    document.getElementById('btn-login').addEventListener('click', () => {
        PiIntegration.authenticate({
            onSuccess: (user) => {
                document.getElementById('btn-login').textContent = `Hi, ${user.username}!`;
                document.getElementById('btn-login').disabled = true;
                document.getElementById('user-info').textContent = `π ${user.username}`;
            },
            onError: () => {},
        });
    });

    // ── 게임 엔진 ────────────────────────────────────────
    const game = new BreakoutGame(canvas, ctx);

    // 이벤트 → UI 업데이트
    game.on('score', s => scoreEl.innerText = s);
    game.on('stage', s => stageEl.innerText = s);
    game.on('lives', l => {
        livesEl.innerText = '♥'.repeat(Math.max(l, 0)) || '💀';
        if (l < 3) AudioEngine.sfxLifeLost();
    });

    // 이벤트 → 사운드
    game.on('brickHit',    ({ isPi }) => isPi ? AudioEngine.sfxPiTile() : AudioEngine.sfxBrick());
    game.on('paddleHit',   () => AudioEngine.sfxPaddle());
    game.on('wallHit',     () => AudioEngine.sfxWall());
    game.on('ballLaunched',() => AudioEngine.sfxLaunch());

    game.on('gameOver', ({ score, stage }) => {
        AudioEngine.stopBGM();
        AudioEngine.sfxGameOver();
        document.getElementById('final-score').innerText = score;
        document.getElementById('final-stage').innerText = stage;
        let best = parseInt(localStorage.getItem('breakoutBest') || '0', 10);
        if (score > best) { best = score; localStorage.setItem('breakoutBest', best); }
        document.getElementById('best-disp').innerText = best;
        showOverlay('gameOver');
    });
    game.on('stageClear', ({ score }) => {
        AudioEngine.stopBGM();
        AudioEngine.sfxStageClear();
        document.getElementById('clear-score').innerText = score;
        showOverlay('stageClear');
    });

    // ── 버튼 이벤트 ──────────────────────────────────────
    document.getElementById('btn-start').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        initAudio();
        showOverlay(null);
        game.start();
        AudioEngine.startBGM();
    });
    document.getElementById('btn-restart').addEventListener('click', () => {
        showOverlay(null); game.start(); AudioEngine.startBGM();
    });
    document.getElementById('btn-revive').addEventListener('click', () => {
        showOverlay(null); game.revive(); AudioEngine.startBGM();
    });
    document.getElementById('btn-next-stage').addEventListener('click', () => {
        showOverlay(null); game.nextStage(); AudioEngine.startBGM();
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
        showOverlay(null); game.togglePause(); AudioEngine.startBGM();
    });
    document.getElementById('btn-pause').addEventListener('click', () => {
        game.togglePause();
        if (game.isPaused) { AudioEngine.stopBGM(); showOverlay('pause'); }
        else                { AudioEngine.startBGM(); showOverlay(null); }
    });

    // ── 키보드 ───────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.code === 'Escape') {
            game.togglePause();
            if (game.isPaused) { AudioEngine.stopBGM(); showOverlay('pause'); }
            else                { AudioEngine.startBGM(); showOverlay(null); }
        }
        if (e.code === 'Space' || e.code === 'ArrowUp') game.launchBall();
        game.handleKeyDown(e.code);
    });
    document.addEventListener('keyup', e => game.handleKeyUp(e.code));

    // ── 모바일 컨트롤 버튼 홀드 ─────────────────────────
    const bindHold = (id, keyCode) => {
        const el = document.getElementById(id);
        const press   = e => { 
            e.preventDefault(); e.stopPropagation();
            game.handleKeyDown(keyCode); el.classList.add('active'); 
        };
        const release = e => { 
            e.preventDefault(); e.stopPropagation();
            game.handleKeyUp(keyCode);   el.classList.remove('active'); 
        };
        el.addEventListener('touchstart',  press,   { passive: false });
        el.addEventListener('touchend',    release, { passive: false });
        el.addEventListener('touchcancel', release, { passive: false });
        el.addEventListener('mousedown',   press);
        el.addEventListener('mouseup',     release);
        el.addEventListener('mouseleave',  release);
    };
    bindHold('btn-left',  'ArrowLeft');
    bindHold('btn-right', 'ArrowRight');

    // ── 조이스틱 초기화 & 연동 ─────────────────────────
    const joystick = new VirtualJoystick('joystick-container', {
        size: 80,
        stickSize: 40
    });

    // 조이스틱 값을 게임 입력으로 변환 (매 프레임 체크)
    function updateJoystickInput() {
        if (joystick.deltaX < -0.2) {
            game.handleKeyDown('ArrowLeft');
        } else {
            if (!document.getElementById('btn-left').classList.contains('active')) {
                game.handleKeyUp('ArrowLeft');
            }
        }

        if (joystick.deltaX > 0.2) {
            game.handleKeyDown('ArrowRight');
        } else {
            if (!document.getElementById('btn-right').classList.contains('active')) {
                game.handleKeyUp('ArrowRight');
            }
        }
        requestAnimationFrame(updateJoystickInput);
    }
    updateJoystickInput();

    // ── 터치 / 탭 → 볼 발사 (중복 실행 방지) ────────────────
    // ── 터치 / 탭 → 볼 발사 (중복 실행 방지 강화) ──────────
    const canvasArea = document.getElementById('canvas-area');
    let lastLaunchTime = 0;
    const tryLaunch = (e) => {
        if (e) { 
            if (e.cancelable) e.preventDefault();
            e.stopPropagation(); 
        }
        if (game.state !== 'PLAYING' || (game.ball && game.ball.launched)) return;

        const now = Date.now();
        if (now - lastLaunchTime < 800) return; // 0.8초 내 엄격한 중복 방지
        lastLaunchTime = now;
        
        console.log('[BREAKOUT] Launch Triggered by', e ? e.type : 'manual');
        game.launchBall();
    };

    let touchStartY = 0;
    canvasArea.addEventListener('touchstart', e => { 
        touchStartY = e.touches[0].clientY; 
    }, { passive: true });

    canvasArea.addEventListener('touchend', e => {
        const dy = touchStartY - e.changedTouches[0].clientY;
        if (dy > 30 || Math.abs(dy) < 10) {
            tryLaunch(e);
        }
    }, { passive: false });

    // 데스크톱 환경용 마우스 클릭 (touchend가 지원되지 않을 때만)
    canvasArea.addEventListener('mousedown', e => {
        // 모바일 터치 이벤트가 발생한 경우 mousedown 무시
        if (e.pointerType === 'touch' || ('ontouchstart' in window && e.detail === 0)) return;
        tryLaunch(e);
    });
});
