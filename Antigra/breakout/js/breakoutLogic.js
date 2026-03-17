/**
 * π BREAKOUT — Pi Network 벽돌깨기 게임 엔진
 * HTML5 Canvas 기반, 순수 Vanilla JS
 */
class BreakoutGame {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.W = canvas.width;
        this.H = canvas.height;

        this._listeners = {};
        this.isPaused = false;
        this.state = 'IDLE'; // IDLE | PLAYING | PAUSED | GAMEOVER | STAGE_CLEAR

        // 게임 상태
        this.score = 0;
        this.stageNum = 1;
        this.lives = 3;

        // 입력 상태
        this._keys = {};

        // 엔티티
        this.paddle = null;
        this.ball = null;
        this.bricks = [];

        this._rafId = null;
        this._lastTime = 0;
        this._ballDead = false;    // 이중 사망 방지 플래그
        this._autoLaunchTimer = null; // 자동 발사 타이머
        this._launchGrace = 0;     // 발사 직후 무적 시간 (프레임 단위)
    }

    // ─── EventEmitter ─────────────────────────────────
    on(event, listener) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(listener);
    }

    trigger(event, ...args) {
        (this._listeners[event] || []).forEach(fn => fn(...args));
    }

    // ─── 입력 ─────────────────────────────────────────
    handleKeyDown(code) {
        this._keys[code] = true;
        // 스페이스 / 터치 → 볼 발사
        if ((code === 'Space' || code === 'ArrowUp') && this.state === 'PLAYING' && this.ball && !this.ball.launched) {
            this.ball.launch();
        }
    }

    handleKeyUp(code) {
        this._keys[code] = false;
    }

    launchBall() {
        if (this.state === 'PLAYING' && this.ball && !this.ball.launched) {
            this.ball.launch();
            this.trigger('ballLaunched');
        }
    }

    // ─── 초기화 & 시작 ────────────────────────────────
    start() {
        this.score = 0;
        this.stageNum = 1;
        this.lives = 3;
        this._ballDead = false;
        if (this._autoLaunchTimer) { clearTimeout(this._autoLaunchTimer); this._autoLaunchTimer = null; }
        this._setupStage();
        this.trigger('score', this.score);
        this.trigger('stage', this.stageNum);
        this.trigger('lives', this.lives);
    }

    revive() {
        // 현재 스테이지 유지, 라이프 3개로 초기화
        this.lives = 3;
        this._ballDead = false;
        if (this._autoLaunchTimer) { clearTimeout(this._autoLaunchTimer); this._autoLaunchTimer = null; }
        this._setupStage();
        this.trigger('lives', this.lives);
    }

    nextStage() {
        this.stageNum++;
        this._setupStage();
        this.trigger('stage', this.stageNum);
        this.trigger('score', this.score);
    }

    _setupStage() {
        this.state = 'PLAYING';
        this.isPaused = false;
        this._ballDead = false;
        if (this._autoLaunchTimer) { clearTimeout(this._autoLaunchTimer); this._autoLaunchTimer = null; }
        this.paddle = new Paddle(this.W, this.H);
        this.ball = new Ball(this.W, this.H);
        this.bricks = createBricks(this.W, this.stageNum);

        // 이전 RAF 루프 완전 종료
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        this._lastTime = 0;
        this._rafId = requestAnimationFrame((t) => this._loop(t));
    }

    togglePause() {
        if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
        this.isPaused = !this.isPaused;
        this.state = this.isPaused ? 'PAUSED' : 'PLAYING';

        if (!this.isPaused) {
            this._lastTime = 0;
            this._rafId = requestAnimationFrame((t) => this._loop(t));
        }
    }

    // ─── 게임 루프 ────────────────────────────────────
    _loop(timestamp) {
        if (this.state !== 'PLAYING') return;

        const dt = this._lastTime ? Math.min((timestamp - this._lastTime) / 1000, 0.05) : 0;
        this._lastTime = timestamp;

        this._update(dt);
        this._draw();

        this._rafId = requestAnimationFrame((t) => this._loop(t));
    }

    _update(dt) {
        const { paddle, ball, _keys } = this;
        const spd = paddle.speed * dt;

        // 패들 이동
        if (_keys['ArrowLeft']) paddle.x = Math.max(0, paddle.x - spd);
        if (_keys['ArrowRight']) paddle.x = Math.min(this.W - paddle.w, paddle.x + spd);

        if (!ball.launched) {
            // 발사 대기 중 — 볼을 패들 위에 고정 (물력 충돌 방지를 위해 충분한 여유 공간 확보)
            ball.x = paddle.x + paddle.w / 2;
            ball.y = paddle.y - ball.r - 10;
            ball.launchTime = 0; // 발사 전 초기화
            return;
        }

        // 볼 이동
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // 벽 충돌 (좌/우/상단)
        if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); this.trigger('wallHit'); }
        if (ball.x + ball.r > this.W) { ball.x = this.W - ball.r; ball.vx = -Math.abs(ball.vx); this.trigger('wallHit'); }
        if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); this.trigger('wallHit'); }

        // 하단 이탈 → 목숨 감소 (발사 후 1.5초간 무적 + 내려가는 중일 때만 판정)
        const timeSinceLaunch = performance.now() - (ball.launchTime || 0);
        if (ball.launched && ball.y - ball.r > this.H && !this._ballDead && timeSinceLaunch > 1500 && ball.vy > 0) {
            console.log(`[BREAKOUT] Ball Out! Y: ${ball.y.toFixed(2)}, TimeSinceLaunch: ${timeSinceLaunch.toFixed(0)}ms`);
            this._ballDead = true; 
            this.lives--;
            this.trigger('lives', this.lives);

            if (this.lives <= 0) {
                this.state = 'GAMEOVER';
                this.trigger('gameOver', { score: this.score, stage: this.stageNum });
            } else {
                // 볼 재설치 (이제 자동 발사하지 않음)
                this.ball = new Ball(this.W, this.H);
                this.ball.x = this.paddle.x + this.paddle.w / 2;
                this.ball.y = this.paddle.y - this.ball.r - 10;
                this._ballDead = false; 
                if (this._autoLaunchTimer) { clearTimeout(this._autoLaunchTimer); this._autoLaunchTimer = null; }
            }
            return;
        }

        // 패들 충돌 (내려오는 중일 때만 판정하여 발사 시 끼임 방지)
        if (ball.vy > 0 && circleRectCollide(ball, paddle)) {
            ball.vy = -Math.abs(ball.vy);
            this.trigger('paddleHit');
            // 패들 어느 위치에 맞았는지에 따라 X 방향 변경 (더 재미있게)
            const relPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            ball.vx = relPos * 600;
            // 속도 증가 방지
            const spd = Math.min(Math.hypot(ball.vx, ball.vy), ball.maxSpeed);
            const angle = Math.atan2(-ball.vy, ball.vx);
            ball.vx = Math.cos(angle) * spd;
            ball.vy = -Math.abs(Math.sin(angle) * spd);
        }

        // 벽돌 충돌
        let allDestroyed = true;
        for (let b of this.bricks) {
            if (b.destroyed) continue;
            allDestroyed = false;
            if (circleRectCollide(ball, b)) {
                const isPi = b.maxHits === 3 && b.colors[2] === '#FFCC55';
                b.hits--;
                if (b.hits <= 0) {
                    b.destroyed = true;
                    this.score += b.points;
                    this.trigger('score', this.score);
                } else {
                    // 내구도 낮아짐 표현
                    b.color = b.colors[Math.max(0, b.hits - 1)];
                }
                this.trigger('brickHit', { isPi });
                // 반사 방향 결정
                resolveBallBrickCollision(ball, b);
                break;
            }
        }

        if (allDestroyed) {
            this.state = 'STAGE_CLEAR';
            this.trigger('stageClear', { score: this.score });
        }
    }

    _draw() {
        const { ctx, canvas, paddle, ball, bricks } = this;
        const W = canvas.width, H = canvas.height;

        // 배경
        ctx.fillStyle = '#04020D';
        ctx.fillRect(0, 0, W, H);

        // 그리드 라인 효과
        ctx.strokeStyle = 'rgba(107, 63, 160, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // 벽돌 그리기
        for (let b of bricks) {
            if (b.destroyed) continue;
            // 벽돌 본체
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 4);
            ctx.fill();
            // 글로우 효과
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.shadowBlur = 0;
            // 파이 심볼 or 내구도 표시
            if (b.hits > 1) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = `bold ${(b.h - 6)}px 'Orbitron', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(b.hits, b.x + b.w / 2, b.y + b.h / 2);
            }
        }

        // 패들 그리기
        const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
        grad.addColorStop(0, '#A855F7');
        grad.addColorStop(1, '#6B3FA0');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#A855F7';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 볼 그리기
        const ballGrad = ctx.createRadialGradient(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 1, ball.x, ball.y, ball.r);
        ballGrad.addColorStop(0, '#FFEE88');
        ballGrad.addColorStop(1, '#F5A623');
        ctx.fillStyle = ballGrad;
        ctx.shadowColor = '#F5A623';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 발사 대기 안내 문구
        if (!ball.launched && this.state === 'PLAYING') {
            ctx.fillStyle = 'rgba(255, 204, 85, 0.85)';
            ctx.font = '13px "Press Start 2P", cursive';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('↑ 위로 스와이프 / 탭', W / 2, H / 2 + 60);
        }
    }
}

// ─── 패들 ────────────────────────────────────────────
class Paddle {
    constructor(W, H) {
        this.w = 100;
        this.h = 14;
        this.x = (W - this.w) / 2;
        this.y = H - 60;
        this.speed = 650;
    }
}

// ─── 볼 ──────────────────────────────────────────────
class Ball {
    constructor(W, H) {
        this.r = 10;
        this.x = W / 2;
        this.y = H - 80;
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 800;
        this.launched = false;
    }

    launch() {
        const angle = -Math.PI / 4 - Math.random() * Math.PI / 2; // -45° ~ -135° (위쪽)
        const speed = 400;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.launchTime = performance.now();
        this.launched = true;
    }
}

// ─── 벽돌 생성 ───────────────────────────────────────
const BRICK_COLORS = {
    1: ['#6B3FA0'],                    // 1타 - 퍼플
    2: ['#3D1E6E', '#8B5CC8'],         // 2타 - 다크 퍼플 → 라이트 퍼플
    3: ['#1A0E3A', '#6B3FA0', '#C084FC'], // 3타
    pi: ['#C07C0A', '#F5A623', '#FFCC55'], // π 특수 벽돌
};

function createBricks(W, stage) {
    const bricks = [];
    const cols = 8;
    const rows = Math.min(4 + stage, 10);
    const padding = 6;
    const offsetX = 20;
    const offsetY = 40;
    const bW = (W - offsetX * 2 - padding * (cols - 1)) / cols;
    const bH = 22;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // 스테이지가 높아질수록 내구도 증가
            const maxHits = Math.min(3, 1 + Math.floor((r + stage - 1) / 3));
            const isPi = (r === 0 && c === Math.floor(cols / 2)) || (stage > 2 && r === 1 && c === Math.floor(cols / 2) - 1);
            const hits = isPi ? 3 : maxHits;
            const colors = isPi ? [...BRICK_COLORS.pi] : [...(BRICK_COLORS[hits] || BRICK_COLORS[1])];

            bricks.push({
                x: offsetX + c * (bW + padding),
                y: offsetY + r * (bH + padding),
                w: bW,
                h: bH,
                hits,
                maxHits: hits,
                colors,
                color: colors[hits - 1],
                destroyed: false,
                points: isPi ? 100 * stage : 10 * hits * stage,
            });
        }
    }
    return bricks;
}

// ─── 충돌 감지 ───────────────────────────────────────
function circleRectCollide(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.r * circle.r;
}

function resolveBallBrickCollision(ball, brick) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;

    const overlapX = (brick.w / 2 + ball.r) - Math.abs(ball.x - cx);
    const overlapY = (brick.h / 2 + ball.r) - Math.abs(ball.y - cy);

    if (overlapX < overlapY) {
        ball.vx = (ball.x < cx) ? -Math.abs(ball.vx) : Math.abs(ball.vx);
    } else {
        ball.vy = (ball.y < cy) ? -Math.abs(ball.vy) : Math.abs(ball.vy);
    }
}

window.BreakoutGame = BreakoutGame;
