/**
 * galagaLogic.js — 갤러가 게임 엔진
 * HTML5 Canvas 기반의 고성능 아케이드 로직
 */

const GalagaGame = (() => {
    // ── 설정 (CFG) ───────────────────────────────────────
    const CFG = {
        FPS: 60,
        SHIP_SPEED: 4.5,
        MISSILE_SPEED: 7,
        ENEMY_MISSILE_SPEED: 3.5,
        FIRE_RATE: 250,      // 발사 간격(ms)
        ENEMY_COLS: 8,
        ENEMY_ROWS: 4,
        STARS_COUNT: 50,
        COLORS: {
            SHIP_MAIN: '#4B9EFF',
            SHIP_ACCENT: '#FFFFFF',
            SHIP_COCKPIT: '#CCEAFF',
            ENEMY1: '#FF4B6E',
            ENEMY2: '#00CED1',
            ENEMY_BOSS: '#FFE000',
            PI_COIN: '#F5A623',
            MISSILE: '#FFFFFF',
            MISSILE_GLOW: 'rgba(255, 224, 0, 0.4)',
            EXPLOSION: '#FF8C00',
            FLAME: '#FF5F00',
            FLAME_INNER: '#FFD700'
        }
    };

    // ── 상태 변수 ────────────────────────────────────────
    let canvas, ctx, lastTs = 0;
    let gameState = 'menu'; // menu, playing, paused, gameover, entering
    let score = 0, bestScore = 0, lives = 3, stage = 1;
    let piEarned = 0;
    let gameOverTime = 0;

    const player = { x: 0, y: 0, w: 26, h: 26, alive: true, lastFire: 0, invul: 0 };
    let missiles = [];
    let enemyMissiles = [];
    let enemies = [];
    let particles = [];
    let stars = [];
    let keys = {};
    let listeners = {};

    // ── EventEmitter ─────────────────────────────────────
    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    }

    function trigger(event, ...args) {
        if (listeners[event]) listeners[event].forEach(fn => fn(...args));
    }

    // ── 외부 콜백 ────────────────────────────────────────
    let onStateChange = null;
    let onScoreUpdate = null;

    // ── 초기화 ───────────────────────────────────────────
    function init(canvasElement, callbacks) {
        canvas = canvasElement;
        ctx = canvas.getContext('2d');
        onStateChange = callbacks.onStateChange;
        onScoreUpdate = callbacks.onScoreUpdate;

        _resize();
        _initStars();
        _loadBestScore();

        window.addEventListener('keydown', e => keys[e.code] = true);
        window.addEventListener('keyup', e => keys[e.code] = false);
        window.addEventListener('resize', _resize);

        requestAnimationFrame(_gameLoop);
        return { on, trigger, start, togglePause, moveLeft, moveRight, requestFire, getBestScore: () => bestScore, getState: () => gameState };
    }

    function _resize() {
        const wrapper = canvas.parentElement;
        if (!wrapper) return;
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        player.x = canvas.width / 2 - player.w / 2;
        player.y = canvas.height - 80;
    }

    function _initStars() {
        stars = [];
        for (let i = 0; i < CFG.STARS_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                s: 0.5 + Math.random() * 1.5,
                o: 0.3 + Math.random() * 0.7
            });
        }
    }

    // ── 게임 루프 ────────────────────────────────────────
    function _gameLoop(ts) {
        const dt = ts - (lastTs || ts);
        lastTs = ts;

        _update(dt);
        _render();

        requestAnimationFrame(_gameLoop);
    }

    function _update(dt) {
        _updateStars();

        if (gameState !== 'playing' && gameState !== 'entering') return;

        if (gameState === 'entering') {
            _updateEntry();
        } else {
            _updatePlayer();
            _updateEnemies(dt);
        }

        _updateMissiles();
        _updateParticles();
        _checkCollisions();

        if (player.invul > 0) player.invul -= dt;

        if (enemies.length === 0 && gameState === 'playing') {
            _nextStage();
        }
    }

    function _updateStars() {
        stars.forEach(s => {
            s.y += s.s * 1.5;
            if (s.y > canvas.height) {
                s.y = -5;
                s.x = Math.random() * canvas.width;
            }
        });
    }

    function _updatePlayer() {
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= CFG.SHIP_SPEED;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += CFG.SHIP_SPEED;

        if (player.x < 0) player.x = 0;
        if (player.x > canvas.width - player.w) player.x = canvas.width - player.w;

        if (keys['Space']) fireMissile();
    }

    function fireMissile() {
        const now = Date.now();
        if (now - player.lastFire > CFG.FIRE_RATE) {
            missiles.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 12 });
            player.lastFire = now;
            trigger('shoot');
        }
    }

    function _updateMissiles() {
        for (let i = missiles.length - 1; i >= 0; i--) {
            missiles[i].y -= CFG.MISSILE_SPEED;
            if (missiles[i].y < -20) missiles.splice(i, 1);
        }

        for (let i = enemyMissiles.length - 1; i >= 0; i--) {
            enemyMissiles[i].y += CFG.ENEMY_MISSILE_SPEED;
            if (enemyMissiles[i].y > canvas.height + 20) enemyMissiles.splice(i, 1);
        }
    }

    function _updateEntry() {
        const allIn = enemies.every(e => e.state === 'formation');
        if (allIn) {
            gameState = 'playing';
            if (onStateChange) onStateChange('playing');
        } else {
            enemies.forEach(e => {
                if (e.state === 'entering') {
                    e.x += (e.originX - e.x) * 0.05;
                    e.y += (e.originY - e.y) * 0.05;
                    if (Math.abs(e.x - e.originX) < 1 && Math.abs(e.y - e.originY) < 1) {
                        e.state = 'formation';
                    }
                }
            });
        }
    }

    function _updateEnemies(dt) {
        const time = Date.now() / 1000;
        enemies.forEach(e => {
            if (e.state === 'formation') {
                e.x = e.originX + Math.sin(time + e.r * 0.2) * 40;
                e.y = e.originY + Math.cos(time * 0.5) * 10;

                if (Math.random() < 0.0005 + (stage * 0.0001)) {
                    _startDiving(e);
                }
            } else if (e.state === 'diving') {
                e.y += 3.5 + stage * 0.2;
                e.x += Math.sin(e.y * 0.05) * 6;

                if (Math.random() < 0.02) _enemyFire(e);

                if (e.y > canvas.height) {
                    e.y = -50;
                    e.state = 'returning';
                }
            } else if (e.state === 'returning') {
                e.y += (e.originY - e.y) * 0.04;
                e.x += (e.originX - e.x) * 0.04;
                if (Math.abs(e.y - e.originY) < 5) e.state = 'formation';
            }
        });
    }

    function _startDiving(e) {
        if (enemies.filter(en => en.state === 'diving').length < 1 + Math.floor(stage / 2)) {
            e.state = 'diving';
        }
    }

    function _enemyFire(e) {
        if (enemyMissiles.length < 5 + stage) {
            enemyMissiles.push({ x: e.x + e.w / 2, y: e.y + e.h, w: 3, h: 8 });
        }
    }

    function _updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.025;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ── 충돌 감지 ────────────────────────────────────────
    function _checkCollisions() {
        for (let mi = missiles.length - 1; mi >= 0; mi--) {
            const m = missiles[mi];
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const e = enemies[ei];
                if (_rectIntersect(m, e)) {
                    _createExplosion(e.x + e.w / 2, e.y + e.h / 2, e.color);
                    const bonus = e.state === 'diving' ? 2 : 1;
                    score += e.score * bonus;
                    if (e.isPi) {
                        piEarned += 0.005;
                        trigger('piEarned');
                        if (onScoreUpdate) onScoreUpdate({ score, piEarned, isPi: true });
                    } else {
                        trigger('enemyKill');
                        if (onScoreUpdate) onScoreUpdate({ score, piEarned });
                    }
                    enemies.splice(ei, 1);
                    missiles.splice(mi, 1);
                    break;
                }
            }
        }

        if (player.invul <= 0) {
            for (let i = enemyMissiles.length - 1; i >= 0; i--) {
                if (_rectIntersect(enemyMissiles[i], player)) {
                    _playerHit();
                    enemyMissiles.splice(i, 1);
                    return;
                }
            }

            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if ((e.state === 'diving' || e.state === 'formation') && _rectIntersect(e, player)) {
                    _playerHit();
                    _createExplosion(e.x + e.w / 2, e.y + e.h / 2, e.color);
                    enemies.splice(i, 1);
                    return;
                }
            }
        }
    }

    function _rectIntersect(r1, r2) {
        return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
            r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    }

    function _playerHit() {
        lives--;
        player.invul = 2500;
        _createExplosion(player.x + player.w / 2, player.y + player.h / 2, '#FF0000', 30);
        trigger('lifeLost', lives);
        if (onScoreUpdate) onScoreUpdate({ lives });

        if (lives <= 0) {
            _gameOver();
        } else {
            player.x = canvas.width / 2 - player.w / 2;
        }
    }

    // ── 렌더링 ───────────────────────────────────────────
    function _render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _drawStars();

        if (gameState === 'menu') return;

        _drawEnemies();
        _drawMissiles();

        if (player.invul <= 0 || Math.floor(Date.now() / 150) % 2 === 0) {
            _drawPlayer();
        }

        _drawParticles();
    }

    function _drawStars() {
        ctx.fillStyle = '#FFF';
        stars.forEach(s => {
            ctx.globalAlpha = s.o;
            ctx.fillRect(s.x, s.y, s.s, s.s);
        });
        ctx.globalAlpha = 1;
    }

    function _drawPlayer() {
        const tilt = Math.max(-0.2, Math.min(0.2, (keys['ArrowRight'] || keys['KeyD']) ? 0.2 : ((keys['ArrowLeft'] || keys['KeyA']) ? -0.2 : 0)));

        ctx.save();
        ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
        ctx.rotate(tilt);
        ctx.translate(-(player.x + player.w / 2), -(player.y + player.h / 2));

        const x = player.x, y = player.y, w = player.w, h = player.h;

        const pulse = 0.8 + Math.random() * 0.4;
        const gradFlame = ctx.createLinearGradient(x + w / 2, y + h, x + w / 2, y + h + 15 * pulse);
        gradFlame.addColorStop(0, CFG.COLORS.FLAME_INNER);
        gradFlame.addColorStop(0.5, CFG.COLORS.FLAME);
        gradFlame.addColorStop(1, 'transparent');
        ctx.fillStyle = gradFlame;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 4, y + h);
        ctx.lineTo(x + w / 2, y + h + 15 * pulse);
        ctx.lineTo(x + w / 2 + 4, y + h);
        ctx.fill();

        ctx.fillStyle = CFG.COLORS.SHIP_MAIN;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h - 5);
        ctx.lineTo(x + w / 2, y + h - 2);
        ctx.lineTo(x, y + h - 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = CFG.COLORS.SHIP_COCKPIT;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 10, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function _drawEnemies() {
        const time = Date.now() / 1000;
        enemies.forEach(e => {
            ctx.save();
            const x = e.x, y = e.y, w = e.w, h = e.h;

            if (e.isPi) {
                const gradPi = ctx.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w / 2);
                gradPi.addColorStop(0, '#FFE000');
                gradPi.addColorStop(1, '#F5A623');
                ctx.fillStyle = gradPi;
                ctx.beginPath();
                ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a0a00';
                ctx.font = 'bold 14px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText('π', x + w / 2, y + h / 2 + 5);
            } else {
                ctx.fillStyle = e.color;
                if (e.color === CFG.COLORS.ENEMY_BOSS) {
                    ctx.beginPath();
                    ctx.moveTo(x + w / 2, y + h);
                    ctx.lineTo(x + w, y);
                    ctx.lineTo(x + w * 0.8, y + h * 0.4);
                    ctx.lineTo(x + w / 2, y + h * 0.2);
                    ctx.lineTo(x + w * 0.2, y + h * 0.4);
                    ctx.lineTo(x, y);
                    ctx.closePath();
                    ctx.fill();
                } else if (e.color === CFG.COLORS.ENEMY1) {
                    ctx.fillRect(x + 4, y, w - 8, h);
                    ctx.fillRect(x, y + 4, 4, h - 4);
                    ctx.fillRect(x + w - 4, y + 4, 4, h - 4);
                } else {
                    ctx.beginPath();
                    ctx.moveTo(x + w / 2, y);
                    ctx.bezierCurveTo(x + w, y, x + w, y + h, x + w / 2, y + h);
                    ctx.bezierCurveTo(x, y + h, x, y, x + w / 2, y);
                    ctx.fill();
                }
                const eyeOpen = Math.sin(time * 5 + e.c) > 0;
                ctx.fillStyle = eyeOpen ? '#FFF' : '#333';
                ctx.fillRect(x + 6, y + 6, 3, 3);
                ctx.fillRect(x + w - 9, y + 6, 3, 3);
            }
            ctx.restore();
        });
    }

    function _drawMissiles() {
        missiles.forEach(m => {
            const grad = ctx.createLinearGradient(m.x, m.y, m.x, m.y + m.h);
            grad.addColorStop(0, '#FFF');
            grad.addColorStop(1, '#4B9EFF');
            ctx.fillStyle = grad;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#4B9EFF';
            ctx.fillRect(m.x, m.y, m.w, m.h);
            ctx.shadowBlur = 0;
        });

        enemyMissiles.forEach(m => {
            ctx.fillStyle = '#FF4B6E';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#FF0000';
            ctx.beginPath();
            ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w / 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    }

    function _drawParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1;
    }

    // ── 유틸리티 ──────────────────────────────────────────
    function start() {
        score = 0;
        lives = 3;
        stage = 1;
        piEarned = 0;
        player.invul = 0;
        _initStage();
        gameState = 'entering';
        if (onScoreUpdate) onScoreUpdate({ lives, score, piEarned });
        if (onStateChange) onStateChange(gameState);
    }

    function _initStage() {
        enemies = [];
        missiles = [];
        enemyMissiles = [];
        particles = [];

        const spacingX = 45;
        const spacingY = 40;
        const startX = (canvas.width - (CFG.ENEMY_COLS * spacingX)) / 2;
        const startY = 80;

        for (let r = 0; r < CFG.ENEMY_ROWS; r++) {
            for (let c = 0; c < CFG.ENEMY_COLS; c++) {
                const isPi = Math.random() < 0.05;
                const originX = startX + c * spacingX;
                const originY = startY + r * spacingY;

                enemies.push({
                    x: Math.random() * canvas.width,
                    y: -50 - (Math.random() * 300),
                    originX, originY,
                    w: 24, h: 20,
                    r, c,
                    state: 'entering',
                    color: r === 0 ? CFG.COLORS.ENEMY_BOSS : (r % 2 === 0 ? CFG.COLORS.ENEMY1 : CFG.COLORS.ENEMY2),
                    score: r === 0 ? 150 : 50,
                    isPi
                });
            }
        }
    }

    function _createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: 2 + Math.random() * 3,
                color,
                life: 1
            });
        }
    }

    function _nextStage() {
        stage++;
        _initStage();
        gameState = 'entering';
        if (onStateChange) onStateChange('entering', stage);
    }

    function _gameOver() {
        gameState = 'gameover';
        gameOverTime = Date.now();
        if (score > bestScore) {
            bestScore = score;
            _saveBestScore();
        }
        if (onStateChange) onStateChange(gameState);
    }

    function togglePause() {
        if (gameState === 'playing') gameState = 'paused';
        else if (gameState === 'paused') gameState = 'playing';
        if (onStateChange) onStateChange(gameState);
        return gameState;
    }

    function _saveBestScore() { localStorage.setItem('piGalagaBest', bestScore); }
    function _loadBestScore() { bestScore = parseInt(localStorage.getItem('piGalagaBest') || '0'); }

    function moveLeft(active) { keys['ArrowLeft'] = active; }
    function moveRight(active) { keys['ArrowRight'] = active; }

    function requestFire() {
        if (gameState === 'gameover') {
            if (Date.now() - gameOverTime < 1000) return;
        }
        fireMissile();
    }

    return { init, start, togglePause, moveLeft, moveRight, requestFire, getBestScore: () => bestScore, on };
})();
