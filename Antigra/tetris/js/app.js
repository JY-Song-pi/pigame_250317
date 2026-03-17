/**
 * app.js — π Tetris 메인 컨트롤러 (Standardized Version)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── DOM 요소 ──────────────────────────────────────────
    const scoreEl = document.getElementById('score');
    const linesEl = document.getElementById('lines');
    const levelEl = document.getElementById('level');
    
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

    // ── 게임 엔진 초기화 & 렌더링 ──────────────────────────
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const nextCanvas = document.getElementById('next-canvas');
    const nextCtx = nextCanvas.getContext('2d');

    const engine = new TetrisEngine();

    function render() {
        const { board, piece, state } = engine;
        const width = canvas.width;
        const height = canvas.height;
        const blockSize = width / 10;

        ctx.clearRect(0, 0, width, height);

        // 상시 점선 가이드
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= 10; x++) {
            ctx.beginPath(); ctx.moveTo(x * blockSize, 0); ctx.lineTo(x * blockSize, height); ctx.stroke();
        }
        for (let y = 0; y <= 20; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * blockSize); ctx.lineTo(width, y * blockSize); ctx.stroke();
        }

        // 보드 그리기
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) drawBlock(ctx, x, y, value, blockSize);
            });
        });

        // 현재 피스 그리기
        if (piece && state === 'PLAYING') {
            piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value > 0) drawBlock(ctx, piece.x + x, piece.y + y, value, blockSize);
                });
            });
        }
    }

    function drawNext() {
        const { nextPiece } = engine;
        const blockSize = nextCanvas.width / 4;
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (nextPiece) {
            const offsetX = (4 - nextPiece.shape[0].length) / 2;
            const offsetY = (4 - nextPiece.shape.length) / 2;
            nextPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value > 0) drawBlock(nextCtx, x + offsetX, y + offsetY, value, blockSize);
                });
            });
        }
    }

    function drawBlock(c, x, y, colorId, size) {
        const color = COLORS[colorId]; // e.g. 'var(--tet-i)'
        
        // 블록 위치
        const bx = x * size;
        const by = y * size;

        // 1. 기본 채우기 (그라데이션 효과)
        const grad = c.createLinearGradient(bx, by, bx + size, by + size);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0.3)'); // 하단 어둡게
        
        c.fillStyle = grad;
        c.fillRect(bx + 1, by + 1, size - 2, size - 2);

        // 2. 내부 하이라이트 (Crystal Look)
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.fillRect(bx + 3, by + 3, size - 6, size / 4);
        
        // 3. 테두리 (글로우 엣지)
        c.strokeStyle = color;
        c.lineWidth = 1;
        c.strokeRect(bx + 1, by + 1, size - 2, size - 2);

        // 4. 아주 얇은 외곽 강조
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.lineWidth = 0.5;
        c.strokeRect(bx, by, size, size);
    }

    // ── 엔진 이벤트 연결 ───────────────────────────────────
    engine.on('scoreUpdate', (s) => scoreEl.innerText = s);
    engine.on('linesUpdate', (l) => linesEl.innerText = l);
    engine.on('levelUpdate', (lv) => levelEl.innerText = lv);
    engine.on('nextPiece', () => drawNext());
    
    // 사운드 연결
    engine.on('move', () => AudioEngine.sfxMove());
    engine.on('rotate', () => AudioEngine.sfxRotate());
    engine.on('drop', () => { /* Soft drop sound skip to reduce noise */ });
    engine.on('line', () => {
        AudioEngine.sfxLine();
        PiIntegration.addPiReward(0.005);
    });
    engine.on('gameOver', () => {
        AudioEngine.sfxGameOver();
        document.getElementById('final-score').innerText = scoreEl.innerText;
        document.getElementById('final-best').innerText = engine.score; // Simple best logic
        document.getElementById('final-lines').innerText = linesEl.innerText;
        showOverlay('gameOver');
    });

    // ── 게임 루프 ──────────────────────────────────────────
    let lastTime = 0;
    let dropCounter = 0;

    function gameLoop(time = 0) {
        if (engine.state === 'PLAYING') {
            const deltaTime = time - lastTime;
            lastTime = time;
            dropCounter += deltaTime;
            if (dropCounter > engine.dropInterval) {
                engine.move(0, 1);
                dropCounter = 0;
            }
            render();
        }
        requestAnimationFrame(gameLoop);
    }

    // ── 버튼 이벤트 ───────────────────────────────────────
    const startAction = () => {
        initAudio();
        showOverlay(null);
        engine.start();
        render();
        drawNext();
    };

    document.getElementById('btn-start').addEventListener('click', startAction);
    document.getElementById('btn-restart').addEventListener('click', startAction);
    document.getElementById('btn-resume').addEventListener('click', () => {
        showOverlay(null);
        engine.pause();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        engine.pause();
        if (engine.state === 'PAUSED') showOverlay('pause');
        else showOverlay(null);
    });

    // ── 컨트롤 바인딩 ─────────────────────────────────────
    const bindBtn = (id, action) => {
        const el = document.getElementById(id);
        const trigger = (e) => { e.preventDefault(); action(); render(); };
        el.addEventListener('touchstart', trigger, {passive: false});
        el.addEventListener('mousedown', trigger);
    };

    bindBtn('btn-left', () => engine.move(-1, 0));
    bindBtn('btn-right', () => engine.move(1, 0));
    bindBtn('btn-drop', () => engine.move(0, 1));
    bindBtn('btn-rotate', () => engine.rotate());

    // 키보드
    window.addEventListener('keydown', (e) => {
        if (engine.state !== 'PLAYING') return;
        switch(e.key) {
            case 'ArrowLeft':  engine.move(-1, 0); break;
            case 'ArrowRight': engine.move(1, 0); break;
            case 'ArrowDown':  engine.move(0, 1); break;
            case 'ArrowUp':    engine.rotate(); break;
            case ' ':          engine.hardDrop(); AudioEngine.sfxDrop(); break;
        }
        render();
    });

    // 초기화
    canvas.width = 300;
    canvas.height = 600;
    nextCanvas.width = 100;
    nextCanvas.height = 100;
    gameLoop();
});
