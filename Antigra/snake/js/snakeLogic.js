/**
 * snakeLogic.js — π Snake 게임 핵심 로직
 * Canvas 기반 렌더링 & 순수 게임 상태 관리
 * Pi Network 연동: π 아이템 추가
 */

const SnakeGame = (() => {

    // ══════════════════════════════════════════════════════
    //  설정값
    // ══════════════════════════════════════════════════════
    const CONFIG = {
        GRID_SIZE: 20,     // 격자 칸 수 (20×20)
        BASE_INTERVAL: 160,     // 기본 이동 속도 (ms)
        MIN_INTERVAL: 70,     // 최대 속도 한계 (ms)
        SPEED_UP_STEP: 8,     // N점마다 속도 증가
        FOOD_SCORE: 10,     // 일반 먹이 점수
        PI_FOOD_SCORE: 50,     // π 아이템 점수
        PI_FOOD_PI: 0.001,   // π 아이템 1개당 획득 Pi
        PI_FOOD_CHANCE: 0.18,   // π 아이템 출현 확률
        // 색상
        COLOR_BG: '#050310',
        COLOR_GRID: 'rgba(139, 92, 200, 0.06)',
        COLOR_SNAKE_HEAD: '#2ED573',
        COLOR_SNAKE_BODY: '#1E9E52',
        COLOR_SNAKE_GLOW: 'rgba(46, 213, 115, 0.5)',
        COLOR_FOOD: '#FF4B6E',
        COLOR_FOOD_GLOW: 'rgba(255, 75, 110, 0.6)',
        COLOR_PI_FOOD: '#F5A623',
        COLOR_PI_GLOW: 'rgba(245, 166, 35, 0.75)',
        COLOR_PI_TEXT: '#FFCC55',
    };

    // ══════════════════════════════════════════════════════
    //  게임 상태
    // ══════════════════════════════════════════════════════
    let canvas, ctx;
    let cellSize = 0;

    // 게임 모드: 'idle' | 'playing' | 'paused' | 'over'
    let state = 'idle';
    let loopId = null;
    let lastTime = 0;
    let interval = CONFIG.BASE_INTERVAL;

    let snake = [];       // [{x, y}, ...]  head at [0]
    let dir = { x: 1, y: 0 };
    let nextDir = { x: 1, y: 0 };
    let food = null;     // { x, y, isPi: bool }
    let score = 0;
    let bestScore = 0;

    // π 아이템 파티클 이펙트
    let particles = [];

    // 외부에서 점수/Pi 변경 시 콜백
    let _onScoreChange = null;
    let _onPiChange = null;
    let _onGameOver = null;
    let _onStateChange = null;

    let listeners = {};

    // ── EventEmitter ─────────────────────────────────────
    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    }

    function trigger(event, ...args) {
        if (listeners[event]) listeners[event].forEach(fn => fn(...args));
    }

    // ══════════════════════════════════════════════════════
    //  초기화
    // ══════════════════════════════════════════════════════
    function init(canvasEl, callbacks = {}) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');

        _onScoreChange = callbacks.onScoreChange || null;
        _onPiChange = callbacks.onPiChange || null;
        _onGameOver = callbacks.onGameOver || null;
        _onStateChange = callbacks.onStateChange || null;

        // 로컬스토리지에서 최고 점수 복원
        bestScore = parseInt(localStorage.getItem('pi-snake-best') || '0', 10);

        _resize();
        _drawIdle();

        window.addEventListener('resize', () => {
            _resize();
            if (state !== 'playing') _drawIdle();
        });

        return { on, startGame, pause, resume, togglePause, setDirection, getState, getScore, getBestScore };
    }

    // ══════════════════════════════════════════════════════
    //  캔버스 리사이즈
    // ══════════════════════════════════════════════════════
    function _resize() {
        const parentW = canvas.parentElement.clientWidth;
        const parentH = canvas.parentElement.clientHeight;
        const side = Math.min(parentW, parentH);
        canvas.width = side;
        canvas.height = side;
        cellSize = Math.floor(side / CONFIG.GRID_SIZE);
    }

    // ══════════════════════════════════════════════════════
    //  게임 시작
    // ══════════════════════════════════════════════════════
    function startGame() {
        state = 'playing';
        score = 0;
        interval = CONFIG.BASE_INTERVAL;
        particles = [];

        // 뱀 초기 위치: 중앙에서 2칸 길이
        const mid = Math.floor(CONFIG.GRID_SIZE / 2);
        snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
        ];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };

        _spawnFood();
        if (_onScoreChange) _onScoreChange(score, bestScore);
        if (_onStateChange) _onStateChange('playing');

        cancelAnimationFrame(loopId);
        lastTime = performance.now();
        loopId = requestAnimationFrame(_loop);
    }

    // ══════════════════════════════════════════════════════
    //  게임 루프
    // ══════════════════════════════════════════════════════
    function _loop(ts) {
        if (state !== 'playing') return;
        loopId = requestAnimationFrame(_loop);

        const delta = ts - lastTime;
        if (delta < interval) {
            // 속도 이전에도 렌더링(파티클)만
            _render();
            return;
        }
        lastTime = ts;

        _update();
        _render();
    }

    // ══════════════════════════════════════════════════════
    //  게임 업데이트 (매 틱)
    // ══════════════════════════════════════════════════════
    function _update() {
        // 방향 반영
        dir = { ...nextDir };

        const head = snake[0];
        const newHead = {
            x: (head.x + dir.x + CONFIG.GRID_SIZE) % CONFIG.GRID_SIZE,
            y: (head.y + dir.y + CONFIG.GRID_SIZE) % CONFIG.GRID_SIZE,
        };

        // 자기 몸 충돌 체크
        if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
            _endGame();
            return;
        }

        snake.unshift(newHead);

        // 먹이 충돌
        if (food && newHead.x === food.x && newHead.y === food.y) {
            _eatFood();
        } else {
            snake.pop();
        }

        // 파티클 업데이트
        _updateParticles();
    }

    // ══════════════════════════════════════════════════════
    //  먹이 섭취 처리
    // ══════════════════════════════════════════════════════
    function _eatFood() {
        const isPi = food.isPi;

        if (isPi) {
            score += CONFIG.PI_FOOD_SCORE;
            const earned = PiIntegration.addPiReward(CONFIG.PI_FOOD_PI);
            if (_onPiChange) _onPiChange(earned);
            _spawnParticles(food.x, food.y, CONFIG.COLOR_PI_FOOD, 14);
            trigger('piEarned');
        } else {
            score += CONFIG.FOOD_SCORE;
            _spawnParticles(food.x, food.y, CONFIG.COLOR_FOOD, 8);
            trigger('eat');
        }

        // 속도 증가 (최대 속도 제한)
        const speedLevel = Math.floor(score / CONFIG.SPEED_UP_STEP);
        interval = Math.max(CONFIG.MIN_INTERVAL, CONFIG.BASE_INTERVAL - speedLevel * 5);

        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('pi-snake-best', bestScore);
        }

        if (_onScoreChange) _onScoreChange(score, bestScore);
        _spawnFood();
    }

    // ══════════════════════════════════════════════════════
    //  먹이 생성
    // ══════════════════════════════════════════════════════
    function _spawnFood() {
        const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
        let x, y;
        do {
            x = Math.floor(Math.random() * CONFIG.GRID_SIZE);
            y = Math.floor(Math.random() * CONFIG.GRID_SIZE);
        } while (occupied.has(`${x},${y}`));

        const isPi = Math.random() < CONFIG.PI_FOOD_CHANCE;
        food = { x, y, isPi };
    }

    // ══════════════════════════════════════════════════════
    //  게임 종료
    // ══════════════════════════════════════════════════════
    function _endGame() {
        state = 'over';
        cancelAnimationFrame(loopId);
        trigger('die');
        _render(); // 마지막 프레임 그리기

        if (_onStateChange) _onStateChange('over');
        if (_onGameOver) _onGameOver(score, PiIntegration.getSessionPi());
    }

    // ══════════════════════════════════════════════════════
    //  일시정지 / 재개
    // ══════════════════════════════════════════════════════
    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        cancelAnimationFrame(loopId);
        if (_onStateChange) _onStateChange('paused');
    }

    function resume() {
        if (state !== 'paused') return;
        state = 'playing';
        lastTime = performance.now();
        loopId = requestAnimationFrame(_loop);
        if (_onStateChange) _onStateChange('playing');
    }

    function togglePause() {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
    }

    // ══════════════════════════════════════════════════════
    //  방향 입력
    // ══════════════════════════════════════════════════════
    function setDirection(dx, dy) {
        // 역방향 입력 무시
        if (dx !== 0 && dx === -dir.x) return;
        if (dy !== 0 && dy === -dir.y) return;
        nextDir = { x: dx, y: dy };
    }

    // ══════════════════════════════════════════════════════
    //  파티클 이펙트
    // ══════════════════════════════════════════════════════
    function _spawnParticles(gx, gy, color, count) {
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 1.5 + Math.random() * 3;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.04 + Math.random() * 0.04,
                size: 2 + Math.random() * 3,
                color,
            });
        }
    }

    function _updateParticles() {
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.life -= p.decay;
        });
    }

    // ══════════════════════════════════════════════════════
    //  렌더링
    // ══════════════════════════════════════════════════════
    function _render() {
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // 배경
        ctx.fillStyle = CONFIG.COLOR_BG;
        ctx.fillRect(0, 0, W, H);

        // 격자선
        _drawGrid();

        // 파티클
        _drawParticles();

        // 먹이
        if (food) _drawFood();

        // 뱀
        _drawSnake();
    }

    function _drawGrid() {
        ctx.strokeStyle = CONFIG.COLOR_GRID;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= CONFIG.GRID_SIZE; i++) {
            const x = i * cellSize;
            const y = i * cellSize;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }

    function _drawSnake() {
        snake.forEach((seg, idx) => {
            const x = seg.x * cellSize;
            const y = seg.y * cellSize;
            const s = cellSize - 2;
            const r = idx === 0 ? 6 : 4;

            // 헤드 글로우
            if (idx === 0) {
                ctx.shadowBlur = 18;
                ctx.shadowColor = CONFIG.COLOR_SNAKE_GLOW;
            } else {
                ctx.shadowBlur = 0;
            }

            // 몸 색
            const ratio = idx / snake.length;
            ctx.fillStyle = idx === 0
                ? CONFIG.COLOR_SNAKE_HEAD
                : `hsl(147, ${70 - ratio * 30}%, ${40 - ratio * 15}%)`;

            // 둥근 사각형
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, s, s, r);
            ctx.fill();

            // 헤드 눈
            if (idx === 0) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                const eyeSize = Math.max(2, cellSize * 0.15);
                const ex1 = x + s * 0.3, ey1 = y + s * 0.25;
                const ex2 = x + s * 0.65, ey2 = y + s * 0.25;
                if (dir.y !== 0) {
                    ctx.fillRect(ex1, dir.y > 0 ? y + s * 0.55 : y + s * 0.2, eyeSize, eyeSize);
                    ctx.fillRect(ex2, dir.y > 0 ? y + s * 0.55 : y + s * 0.2, eyeSize, eyeSize);
                } else {
                    ctx.fillRect(dir.x > 0 ? x + s * 0.55 : x + s * 0.2, ey1, eyeSize, eyeSize);
                    ctx.fillRect(dir.x > 0 ? x + s * 0.55 : x + s * 0.2, ey2, eyeSize, eyeSize);
                }
            }
        });
        ctx.shadowBlur = 0;
    }

    function _drawFood() {
        const cx = food.x * cellSize + cellSize / 2;
        const cy = food.y * cellSize + cellSize / 2;
        const r = Math.max(4, cellSize / 2 - 2);

        // 글로우
        ctx.shadowBlur = food.isPi ? 22 : 14;
        ctx.shadowColor = food.isPi ? CONFIG.COLOR_PI_GLOW : CONFIG.COLOR_FOOD_GLOW;

        if (food.isPi) {
            // π 아이템 — 골드 원형 + π 텍스트
            ctx.fillStyle = CONFIG.COLOR_PI_FOOD;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#1a0a00';
            ctx.font = `bold ${Math.max(8, cellSize * 0.55)}px Orbitron, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('π', cx, cy + 1);
        } else {
            // 일반 먹이 — 빨간 원
            ctx.fillStyle = CONFIG.COLOR_FOOD;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    function _drawParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    // 대기 화면 그리기 (오버레이 뒤 배경)
    function _drawIdle() {
        if (!ctx) return;
        _resize();
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = CONFIG.COLOR_BG;
        ctx.fillRect(0, 0, W, H);
        _drawGrid();
    }

    // ══════════════════════════════════════════════════════
    //  Getter
    // ══════════════════════════════════════════════════════
    function getState() { return state; }
    function getScore() { return score; }
    function getBestScore() { return bestScore; }

    // ══════════════════════════════════════════════════════
    //  공개 API
    // ══════════════════════════════════════════════════════
    return {
        init,
        startGame,
        pause,
        resume,
        togglePause,
        setDirection,
        getState,
        getScore,
        getBestScore,
    };

})();
