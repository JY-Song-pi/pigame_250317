/**
 * pacmanLogic.js — π Pac-Man 게임 핵심 로직
 * Canvas 기반 미로, 팩맨, 유령, Pi 아이템 구현
 */

const PacmanGame = (() => {
    'use strict';

    // ══════════════════════════════════════════════════════
    //  설정값
    // ══════════════════════════════════════════════════════
    const CFG = {
        CELL: 16,      // 셀 크기(px) — 미로 기준
        COLS: 19,
        ROWS: 21,
        PAC_SPEED: 1.4,     // 팩맨 픽셀/프레임 (더 느리게)
        GHOST_SPEED: 0.8,   // 유령 속도 (느리게)
        SCARED_SPEED: 0.5,  // 파워업 시 유령 속도
        SCARED_DUR: 8000,    // 무서운 유령 지속 ms
        DOT_SCORE: 10,
        POWER_SCORE: 50,
        PI_SCORE: 100,
        GHOST_SCORE: 200,
        PI_COIN_PI: 0.001,
        PI_CHANCE: 0.06,    // 스테이지당 π 코인 등장 비율
        LIVES: 3,
        // 색상 (CSS 변수 대신 직접 사용 — Canvas에서 var() 미지원)
        C_BG: '#080410',
        C_WALL: '#6B3FA0',
        C_WALL_GLOW: '#8B5CC8',
        C_DOT: '#FFCC55',
        C_POWER: '#FFFFFF',
        C_PI: '#FFE000',
        C_PAC: '#FFE000',
        C_GHOST: ['#FF4B6E', '#FF85C2', '#00CED1', '#FF8C00'],
        C_SCARED: '#3A1A80',
        C_SCARED_FLASH: '#FF4B6E',
        C_TEXT: '#F0E8FF',
    };

    // ══════════════════════════════════════════════════════
    //  미로 템플릿 (0=빈공간, 1=벽, 2=점, 3=파워점, 4=π코인)
    //  19×21 그리드
    // ══════════════════════════════════════════════════════
    const MAP_TEMPLATE = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
        [1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 3, 1],
        [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
        [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
        [1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1],
        [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
        [1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 1, 1, 1, 1],
        [0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0],
        [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1],
        [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
        [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
        [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
        [1, 3, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 3, 1],
        [1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1],
        [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
        [1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    // ══════════════════════════════════════════════════════
    //  상태
    // ══════════════════════════════════════════════════════
    let canvas, ctx;
    let mazeCache = null;  // 벽 오프스크린 캐시
    let scale = 1;    // 화면 맞춤 스케일
    let state = 'idle'; // idle | playing | paused | over | clear | dead
    let loopId = null;
    let dying = false;     // 중복 사망 방지 플래그

    let map = [];   // 현재 미로 (복사본)
    let dots = 0;    // 남은 점 수
    let score = 0;
    let bestScore = 0;
    let lives = CFG.LIVES;
    let stage = 1;

    let pacman = {};
    let ghosts = [];

    let scaredTimer = 0;
    let powerActive = false;
    let ghostEatCombo = 0; // 연속 유령 먹기 콤보

    // π 코인 위치 (맵에 4로 표시)
    let piCoins = [];

    // 스코어 팝업 이펙트
    let popups = [];
    // 파티클
    let particles = [];
    let listeners = {};

    // ── EventEmitter ─────────────────────────────────────
    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    }

    function trigger(event, ...args) {
        if (listeners[event]) listeners[event].forEach(fn => fn(...args));
    }

    let _cb = {}; // 외부 콜백

    // ══════════════════════════════════════════════════════
    //  초기화
    // ══════════════════════════════════════════════════════
    function init(canvasEl, callbacks) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        _cb = callbacks || {};
        bestScore = parseInt(localStorage.getItem('pi-pac-best') || '0', 10);
        _resize();
        _drawIdle();
        window.addEventListener('resize', () => { _resize(); if (state !== 'playing') _drawIdle(); });
        return { 
            on, trigger, startGame, togglePause, move: setDirection, 
            getBestScore: () => bestScore,
            getState: () => state,
            getScore: () => score,
            getStage: () => stage
        };
    }

    function _resize() {
        const wrapper = canvas.parentElement;
        // 사이드패널, 모바일 컨트롤에 의한 높이 소비를 고려
        const pw = wrapper.clientWidth || 400;
        const ph = wrapper.clientHeight || 400;
        const scaleX = pw / (CFG.COLS * CFG.CELL);
        const scaleY = ph / (CFG.ROWS * CFG.CELL);
        scale = Math.max(Math.min(scaleX, scaleY), 0.5);
        canvas.width = Math.floor(CFG.COLS * CFG.CELL * scale);
        canvas.height = Math.floor(CFG.ROWS * CFG.CELL * scale);
    }

    // ══════════════════════════════════════════════════════
    //  게임 시작 / 스테이지 초기화
    // ══════════════════════════════════════════════════════
    function startGame() {
        score = 0;
        lives = CFG.LIVES;
        stage = 1;
        ghostEatCombo = 0;
        if (_cb.onScoreChange) _cb.onScoreChange(score, bestScore);
        if (_cb.onLivesChange) _cb.onLivesChange(lives);
        if (_cb.onStageChange) _cb.onStageChange(stage);
        _initStage();
    }

    function _initStage() {
        // 미로 복사 + π 코인 랜덤 배치
        map = MAP_TEMPLATE.map(r => [...r]);
        dots = 0;
        piCoins = [];
        popups = [];
        particles = [];
        scaredTimer = 0;
        powerActive = false;
        dying = false;  // 사망 플래그 초기화

        // 점 카운트 & π 코인 랜덤 삽입
        const dotPositions = [];
        for (let r = 0; r < CFG.ROWS; r++) {
            for (let c = 0; c < CFG.COLS; c++) {
                if (map[r][c] === 2) { dots++; dotPositions.push({ r, c }); }
                if (map[r][c] === 3) dots++;
            }
        }
        // π 코인: 전체 점의 CFG.PI_CHANCE 비율 배치 (무작위)
        const piCount = Math.max(2, Math.floor(dots * CFG.PI_CHANCE));
        _shuffle(dotPositions);
        for (let i = 0; i < piCount && i < dotPositions.length; i++) {
            const { r, c } = dotPositions[i];
            map[r][c] = 4; // π 코인으로 대체
            dots--; // 일반 점 줄이고
            piCoins.push({ r, c });
        }
        dots += piCoins.length; // π 코인도 dots에 포함

        // 팩맨 초기 위치 (row 4, col 9 — 미로 상단 중앙 복도, 항상 화면에 표시됨)
        pacman = {
            x: 9 * CFG.CELL + CFG.CELL / 2,
            y: 4 * CFG.CELL + CFG.CELL / 2,
            dx: 0, dy: 0,
            nextDx: 0, nextDy: 0,
            mouthAngle: 0.25,
            mouthDir: 1,
        };

        // 유령 초기화 (집 내부 위치 조정)
        ghosts = [
            _makeGhost(9, 8, CFG.C_GHOST[0], 0),    // Blinky (집 밖 바로 앞)
            _makeGhost(8, 10, CFG.C_GHOST[1], 1500), // Pinky
            _makeGhost(9, 10, CFG.C_GHOST[2], 3000), // Inky
            _makeGhost(10, 10, CFG.C_GHOST[3], 4500), // Clyde
        ];

        state = 'playing';
        dying = false;
        if (_cb.onStateChange) _cb.onStateChange('playing');

        cancelAnimationFrame(loopId);
        lastTs = performance.now(); // ← firstFrame dt 과대값 방지
        loopId = requestAnimationFrame(_loop);
    }

    function _makeGhost(col, row, color, delay) {
        const gx = col * CFG.CELL + CFG.CELL / 2;
        const gy = row * CFG.CELL + CFG.CELL / 2;
        // 집 경계 (8~10 col, 9~11 row 내외)
        const inHouse = (col >= 7 && col <= 11 && row >= 9 && row <= 11);
        return {
            x: gx, y: gy,
            dx: 0, dy: 0,
            color,
            scared: false,
            eaten: false,
            leaving: inHouse, // 집 안에 있으면 탈출 모드
            delay: delay,
            homeX: gx,
            homeY: gy,
            timer: 0,
            flashTimer: 0,
        };
    }

    // ══════════════════════════════════════════════════════
    //  메인 루프
    // ══════════════════════════════════════════════════════
    let lastTs = 0;
    function _loop(ts) {
        if (state !== 'playing') return;
        loopId = requestAnimationFrame(_loop);

        const dt = Math.min(ts - lastTs, 50); // 최대 50ms (탭 전환 등)
        lastTs = ts;

        _update(dt);
        _render();
    }

    // ══════════════════════════════════════════════════════
    //  업데이트
    // ══════════════════════════════════════════════════════
    function _update(dt) {
        _movePacman();
        _checkDotEat();
        _moveGhosts(dt);
        _checkGhostCollision();
        _updateScaredTimer(dt);
        _updateParticles(dt);
        _updatePopups(dt);

        // 팩맨 입 애니메이션
        pacman.mouthAngle += 0.04 * pacman.mouthDir;
        if (pacman.mouthAngle > 0.28 || pacman.mouthAngle < 0.01) {
            pacman.mouthDir *= -1;
        }

        // 전부 먹으면 클리어
        if (dots <= 0) _stageClear();
    }

    // ── 팩맨 이동 ─────────────────────────────────────────
    function _movePacman() {
        const speed = CFG.PAC_SPEED;
        // 다음 방향 시도 → 가능하면 전환
        const nx = pacman.x + pacman.nextDx * speed;
        const ny = pacman.y + pacman.nextDy * speed;
        if (!_wallHit(nx, ny)) {
            pacman.dx = pacman.nextDx;
            pacman.dy = pacman.nextDy;
        }
        // 현재 방향으로 이동
        const mx = pacman.x + pacman.dx * speed;
        const my = pacman.y + pacman.dy * speed;
        if (!_wallHit(mx, my)) {
            pacman.x = mx;
            pacman.y = my;
        }
        // 터널 (좌우 wrap)
        const half = CFG.CELL / 2;
        if (pacman.x < -half) pacman.x = CFG.COLS * CFG.CELL + half;
        if (pacman.x > CFG.COLS * CFG.CELL + half) pacman.x = -half;
    }

    function _wallHit(px, py) {
        const r1 = CFG.CELL * 0.35; // 충돌 반경
        // 네 모서리 검사
        for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const cx = px + ox * r1;
            const cy = py + oy * r1;
            const col = Math.floor(cx / CFG.CELL);
            const row = Math.floor(cy / CFG.CELL);
            if (row < 0 || row >= CFG.ROWS || col < 0 || col >= CFG.COLS) continue;
            if (map[row][col] === 1) return true;
        }
        return false;
    }

    // ── 점 먹기 ───────────────────────────────────────────
    function _checkDotEat() {
        // 팩맨 중심이 속한 셀 계산 (floor 사용으로 정확도 향상)
        const col = Math.floor(pacman.x / CFG.CELL);
        const row = Math.floor(pacman.y / CFG.CELL);
        if (row < 0 || row >= CFG.ROWS || col < 0 || col >= CFG.COLS) return;

        // 셀 중심과의 거리 검사 (너무 멀면 먹지 않음)
        const cellCx = col * CFG.CELL + CFG.CELL / 2;
        const cellCy = row * CFG.CELL + CFG.CELL / 2;
        if (Math.abs(pacman.x - cellCx) > CFG.CELL * 0.6 ||
            Math.abs(pacman.y - cellCy) > CFG.CELL * 0.6) return;

        const cell = map[row][col];

        if (cell === 2) {
            map[row][col] = 0;
            dots--;
            _addScore(CFG.DOT_SCORE, col, row);
            _spawnParticles(col, row, CFG.C_DOT, 4);
            trigger('waka');
        } else if (cell === 3) {
            map[row][col] = 0;
            dots--;
            _addScore(CFG.POWER_SCORE, col, row);
            _activatePower();
            _spawnParticles(col, row, CFG.C_POWER, 10);
            trigger('powerUp');
        } else if (cell === 4) {
            map[row][col] = 0;
            dots--;
            const pi = PiIntegration.addPiReward(CFG.PI_COIN_PI);
            if (_cb.onPiChange) _cb.onPiChange(pi);
            _addScore(CFG.PI_SCORE, col, row, 'π +0.001');
            _spawnParticles(col, row, CFG.C_PI, 16);
            trigger('piEarned');
        }
    }

    // ── 파워 업 ───────────────────────────────────────────
    function _activatePower() {
        powerActive = true;
        scaredTimer = CFG.SCARED_DUR;
        ghostEatCombo = 0;
        ghosts.forEach(g => {
            if (!g.eaten) { g.scared = true; g.flashTimer = 0; }
        });
    }

    function _updateScaredTimer(dt) {
        if (!powerActive) return;
        scaredTimer -= dt;
        if (scaredTimer <= 0) {
            powerActive = false;
            ghosts.forEach(g => { g.scared = false; });
        }
        // 깜빡임 구간 (마지막 2초)
        if (scaredTimer < 2000) {
            ghosts.forEach(g => {
                if (g.scared) g.flashTimer += dt;
            });
        }
    }

    // ── 유령 이동 ─────────────────────────────────────────
    function _moveGhosts(dt) {
        const dirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
        ];

        ghosts.forEach(g => {
            // 초기 딜레이
            if (g.delay > 0) { g.delay -= dt; return; }

            const speed = g.eaten ? CFG.PAC_SPEED * 1.5
                : g.scared ? CFG.SCARED_SPEED
                    : CFG.GHOST_SPEED + (stage - 1) * 0.1;
            g.timer = (g.timer || 0) + dt;

            // 방향 전환 (그리드 정렬 때만)
            if (g.timer >= 200) {
                g.timer = 0;

                // 유령 집(jail) 좌표 및 출구
                const houseLeft = 7 * CFG.CELL;
                const houseRight = 11 * CFG.CELL;
                const houseTop = 9 * CFG.CELL;
                const houseBottom = 11 * CFG.CELL;
                const exitX = 9 * CFG.CELL + CFG.CELL / 2;
                const exitY = 8 * CFG.CELL + CFG.CELL / 2;

                // 집 탈출 로직 체크
                if (g.x > houseLeft && g.x < houseRight && g.y > houseTop && g.y < houseBottom) {
                    g.leaving = true;
                } else if (Math.abs(g.x - exitX) < 4 && Math.abs(g.y - exitY) < 4) {
                    g.leaving = false;
                }

                // 타겟 설정
                let targetX, targetY;
                if (g.eaten) {
                    const nearExit = Math.abs(g.x - exitX) < 8 && Math.abs(g.y - exitY) < 8;
                    const insideHouse = g.x > houseLeft && g.x < houseRight && g.y > houseTop;

                    if (nearExit || insideHouse) {
                        targetX = g.homeX;
                        targetY = g.homeY;
                    } else {
                        targetX = exitX;
                        targetY = exitY;
                    }
                } else if (g.leaving) {
                    // 집 탈출 중일 때는 무조건 출구 타겟팅
                    targetX = exitX;
                    targetY = exitY;
                } else if (g.scared) {
                    targetX = pacman.x + (Math.random() - 0.5) * CFG.COLS * CFG.CELL;
                    targetY = pacman.y + (Math.random() - 0.5) * CFG.ROWS * CFG.CELL;
                } else {
                    targetX = _ghostTargetX(g);
                    targetY = _ghostTargetY(g);
                }

                // 가능한 방향 중 목표 가까운 방향 선택
                let bestDir = null, bestDist = Infinity;
                _shuffle(dirs);
                for (const d of dirs) {
                    // 뒤로가기 방지 (단, 집 안이나 막다른 길에서는 허용될 수도 있음)
                    if (g.dx !== 0 && d.dx === -g.dx && d.dy === 0) continue; 
                    if (g.dy !== 0 && d.dy === -g.dy && d.dx === 0) continue;

                    const nx = g.x + d.dx * CFG.CELL;
                    const ny = g.y + d.dy * CFG.CELL;

                    // 벽 체크 - 집 내부 문(9, 8.5 위치)은 통과 허용 처리
                    if (!_wallHitGhost(nx, ny, g.leaving || g.eaten)) {
                        const dist = Math.hypot(nx - targetX, ny - targetY);
                        if (dist < bestDist) { bestDist = dist; bestDir = d; }
                    }
                }
                if (bestDir) { g.dx = bestDir.dx; g.dy = bestDir.dy; }
            }

            const nx = g.x + g.dx * speed;
            const ny = g.y + g.dy * speed;
            // 실제 이동 시에도 특수 모드(leaving/eaten) 여부를 전달하여 문 통과 허용
            if (!_wallHitGhost(nx, ny, g.leaving || g.eaten)) { 
                g.x = nx; 
                g.y = ny; 
            }

            // 집 복귀 시 부활
            if (g.eaten && Math.hypot(g.x - g.homeX, g.y - g.homeY) < 4) {
                g.eaten = false;
                g.leaving = true; // 부활 후 다시 탈출 목표 설정
                g.scared = powerActive;
            }

            // 터널
            if (g.x < 0) g.x = CFG.COLS * CFG.CELL;
            if (g.x > CFG.COLS * CFG.CELL) g.x = 0;
        });
    }

    function _ghostTargetX(g) {
        // 간단 AI: 팩맨 X 타겟
        return pacman.x + (Math.random() < 0.2 ? (Math.random() - 0.5) * 4 * CFG.CELL : 0);
    }

    function _ghostTargetY(g) {
        // 간단 AI: 팩맨 Y 타겟
        return pacman.y;
    }

    function _wallHitGhost(px, py, isSpecialMode) {
        const r = CFG.CELL * 0.32;
        for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const cx = px + ox * r, cy = py + oy * r;
            const col = Math.floor(cx / CFG.CELL);
            const row = Math.floor(cy / CFG.CELL);

            if (row < 0 || row >= CFG.ROWS || col < 0 || col >= CFG.COLS) continue;
            
            // 유령 집 입구 특수 처리 (row 9, col 9 가 통로)
            if (isSpecialMode && row === 9 && col === 9) continue;

            if (map[row][col] === 1) return true;
        }
        return false;
    }

    // ── 유령 충돌 ─────────────────────────────────────────
    function _checkGhostCollision() {
        if (dying) return; // 이미 사망 처리 중이면 무시
        ghosts.forEach(g => {
            if (g.eaten || dying) return;
            const dist = Math.hypot(g.x - pacman.x, g.y - pacman.y);
            if (dist < CFG.CELL * 0.7) {
                if (g.scared) {
                    g.eaten = true;
                    g.scared = false;
                    ghostEatCombo++;
                    const pts = CFG.GHOST_SCORE * ghostEatCombo;
                    _addScore(pts, Math.floor(g.x / CFG.CELL), Math.floor(g.y / CFG.CELL), `×${ghostEatCombo}`);
                    _spawnParticles(Math.floor(g.x / CFG.CELL), Math.floor(g.y / CFG.CELL), g.color, 12);
                    trigger('eatGhost');
                } else {
                    // dying 플래그로 중복 호출 방지
                    dying = true;
                    trigger('death');
                    _pacmanDie();
                }
            }
        });
    }

    function _pacmanDie() {
        lives--;
        if (_cb.onLivesChange) _cb.onLivesChange(lives);
        if (lives <= 0) {
            state = 'over';
            cancelAnimationFrame(loopId);
            if (_cb.onStateChange) _cb.onStateChange('over');
            if (_cb.onGameOver) _cb.onGameOver(score, PiIntegration.getSessionPi());
        } else {
            state = 'dead';
            setTimeout(() => {
                _respawnPacman();
                dying = false; // 리스폰 후 플래그 해제
                state = 'playing';
                lastTs = performance.now();
                loopId = requestAnimationFrame(_loop);
            }, 1200);
        }
    }

    function _respawnPacman() {
        pacman.x = 9 * CFG.CELL + CFG.CELL / 2;
        pacman.y = 16 * CFG.CELL + CFG.CELL / 2;
        pacman.dx = pacman.dy = 0;
        pacman.nextDx = pacman.nextDy = 0;
        ghosts.forEach((g, idx) => {
            g.x = g.homeX; g.y = g.homeY;
            g.eaten = false; g.scared = false;
            g.dx = g.dy = 0; g.delay = 500 + idx * 1000;
            g.leaving = true; // 부활 시 다시 탈출 모드
        });
        powerActive = false; scaredTimer = 0;
    }

    function _stageClear() {
        state = 'clear';
        cancelAnimationFrame(loopId);
        if (_cb.onStateChange) _cb.onStateChange('clear');
        if (_cb.onStageClear) _cb.onStageClear(stage, score);

        setTimeout(() => {
            stage++;
            if (_cb.onStageChange) _cb.onStageChange(stage);
            _initStage();
        }, 2500);
    }

    // ── 점수 ─────────────────────────────────────────────
    function _addScore(pts, col, row, label) {
        score += pts;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('pi-pac-best', bestScore);
        }
        if (_cb.onScoreChange) _cb.onScoreChange(score, bestScore);
        // 팝업 이펙트
        popups.push({
            x: col * CFG.CELL + CFG.CELL / 2,
            y: row * CFG.CELL,
            text: label ? label : '+' + pts,
            life: 1,
            isPi: (label && label.startsWith('π')),
        });
    }

    // ══════════════════════════════════════════════════════
    //  파티클 & 팝업
    // ══════════════════════════════════════════════════════
    function _spawnParticles(col, row, color, count) {
        const cx = col * CFG.CELL + CFG.CELL / 2;
        const cy = row * CFG.CELL + CFG.CELL / 2;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 0.8 + Math.random() * 2;
            particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1, decay: 0.05 + Math.random() * 0.04,
                size: 1.5 + Math.random() * 2.5, color,
            });
        }
    }

    function _updateParticles(dt) {
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.9; p.vy *= 0.9;
            p.life -= p.decay;
        });
    }

    function _updatePopups(dt) {
        popups = popups.filter(p => p.life > 0);
        popups.forEach(p => {
            p.y -= 0.5;
            p.life -= 0.018;
        });
    }

    // ══════════════════════════════════════════════════════
    //  렌더링
    // ══════════════════════════════════════════════════════
    function _render() {
        if (!canvas || !ctx) return;

        // 1. 캔버스 물리적 초기화
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. 브러시 및 필터 상태 초기화 (궤적 및 실종 방지 핵심)
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';

        // 3. 논리적 스케일 적용
        ctx.save();
        ctx.scale(scale, scale);

        const W = CFG.COLS * CFG.CELL;
        const H = CFG.ROWS * CFG.CELL;

        // 배경색 채우기
        ctx.fillStyle = CFG.C_BG;
        ctx.fillRect(0, 0, W, H);

        // 영역 외곽선 (디버그 및 가이드)
        ctx.strokeStyle = 'rgba(139, 92, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, W, H);

        _drawMaze();
        _drawDots();
        _drawParticles();
        _drawGhosts();
        _drawPacman();
        _drawPopups();

        ctx.restore();
    }

    // 벽을 오프스크린 캔버스에 한 번만 그려 캐시 (성능 최적화)
    function _drawMaze() {
        const C = CFG.CELL;

        // 벽 채우기
        ctx.fillStyle = CFG.C_WALL;
        for (let r = 0; r < CFG.ROWS; r++) {
            for (let c = 0; c < CFG.COLS; c++) {
                // 벽은 게임 도중 변하지 않으므로 MAP_TEMPLATE 원본을 직접 참조 (안전성)
                if (MAP_TEMPLATE[r] && MAP_TEMPLATE[r][c] === 1) {
                    ctx.fillRect(c * C, r * C, C, C);
                }
            }
        }

        // 벽 테두리 하이라이트
        ctx.strokeStyle = CFG.C_WALL_GLOW;
        ctx.lineWidth = 1;
        for (let r = 0; r < CFG.ROWS; r++) {
            for (let c = 0; c < CFG.COLS; c++) {
                if (MAP_TEMPLATE[r] && MAP_TEMPLATE[r][c] === 1) {
                    ctx.strokeRect(c * C + 0.5, r * C + 0.5, C - 1, C - 1);
                }
            }
        }
    }

    function _drawDots() {
        const C = CFG.CELL;
        const t = Date.now() / 1000;

        for (let r = 0; r < CFG.ROWS; r++) {
            for (let c = 0; c < CFG.COLS; c++) {
                const cell = map[r][c];
                const cx = c * C + C / 2;
                const cy = r * C + C / 2;

                if (cell === 2) {
                    ctx.fillStyle = CFG.C_DOT;
                    ctx.beginPath();
                    ctx.arc(cx, cy, C * 0.15, 0, Math.PI * 2); // 크기 약간 확대 (0.12 -> 0.15)
                    ctx.fill();
                } else if (cell === 3) {
                    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
                    ctx.fillStyle = CFG.C_POWER;
                    ctx.beginPath();
                    ctx.arc(cx, cy, C * 0.32 * pulse, 0, Math.PI * 2); // 크기 약간 확대
                    ctx.fill();
                    // 바깥쪽 테두리
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else if (cell === 4) {
                    const pulse = 0.8 + 0.2 * Math.sin(t * 3 + c);
                    ctx.fillStyle = CFG.C_PI;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, C * 0.40 * pulse, C * 0.40, 0, 0, Math.PI * 2); // 크기 약간 확대
                    ctx.fill();
                    ctx.fillStyle = '#1a0a00';
                    ctx.font = `bold ${Math.max(6, C * 0.55)}px Orbitron, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('π', cx, cy + 1);
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'alphabetic';
                }
            }
        }
    }

    function _drawPacman() {
        const C = CFG.CELL;
        const r = C * 0.45;
        const ma = pacman.mouthAngle * Math.PI;

        // 이동 방향에 따라 회전
        let angle = 0;
        if (pacman.dx === -1) angle = Math.PI;
        else if (pacman.dy === 1) angle = Math.PI / 2;
        else if (pacman.dy === -1) angle = -Math.PI / 2;

        ctx.save();
        ctx.translate(pacman.x, pacman.y);
        ctx.rotate(angle);

        ctx.fillStyle = CFG.C_PAC;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, ma, Math.PI * 2 - ma);
        ctx.closePath();
        ctx.fill();
        // 연놀린 테두리
        ctx.strokeStyle = 'rgba(255,160,0,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 눈
        ctx.fillStyle = '#1a0a00';
        ctx.beginPath();
        ctx.arc(r * 0.2, -r * 0.5, r * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function _drawGhosts() {
        const C = CFG.CELL;
        const t = Date.now();

        ghosts.forEach(g => {
            const r = C * 0.42;
            const cx = g.x, cy = g.y;

            let color;
            if (g.eaten) {
                // 눈만 표시
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.beginPath();
                ctx.arc(cx - r * 0.25, cy - r * 0.1, r * 0.2, 0, Math.PI * 2);
                ctx.arc(cx + r * 0.25, cy - r * 0.1, r * 0.2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            if (g.scared) {
                // 깜빡임 (마지막 2초)
                const flash = scaredTimer < 2000 && Math.floor(t / 180) % 2 === 0;
                color = flash ? CFG.C_SCARED_FLASH : CFG.C_SCARED;
            } else {
                color = g.color;
            }

            ctx.fillStyle = color;

            // 유령 머리 + 울령지 바닥
            ctx.beginPath();
            ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0);
            // 물결 바닥
            const steps = 4;
            const step = (r * 2) / steps;
            ctx.lineTo(cx + r, cy + r * 0.7);
            for (let i = 0; i < steps; i++) {
                const x1 = cx + r - step * i - step / 2;
                const x2 = cx + r - step * (i + 1);
                const yMid = cy + r * (i % 2 === 0 ? 0.4 : 0.9);
                ctx.quadraticCurveTo(x1, yMid, x2, cy + r * 0.7);
            }
            ctx.closePath();
            ctx.fill();

            // 눈
            if (!g.scared) {
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.ellipse(cx - r * 0.3, cy - r * 0.2, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
                ctx.ellipse(cx + r * 0.3, cy - r * 0.2, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2A1A50';
                ctx.beginPath();
                ctx.arc(cx - r * 0.28 + g.dx * r * 0.1, cy - r * 0.18 + g.dy * r * 0.1, r * 0.12, 0, Math.PI * 2);
                ctx.arc(cx + r * 0.32 + g.dx * r * 0.1, cy - r * 0.18 + g.dy * r * 0.1, r * 0.12, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // 무서운 눈
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath();
                ctx.arc(cx - r * 0.25, cy - r * 0.1, r * 0.15, 0, Math.PI * 2);
                ctx.arc(cx + r * 0.25, cy - r * 0.1, r * 0.15, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function _drawParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function _drawPopups() {
        popups.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.font = p.isPi
                ? `bold ${CFG.CELL * 0.75}px Orbitron, sans-serif`
                : `bold ${CFG.CELL * 0.65}px Orbitron, sans-serif`;
            ctx.fillStyle = p.isPi ? CFG.C_PI : '#FFCC55';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text, p.x, p.y);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    function _drawIdle() {
        if (!ctx) return;
        _resize();
        ctx.save();
        ctx.scale(scale, scale);
        ctx.fillStyle = CFG.C_BG;
        ctx.fillRect(0, 0, CFG.COLS * CFG.CELL, CFG.ROWS * CFG.CELL);
        _drawMaze();
        ctx.restore();
    }

    // ══════════════════════════════════════════════════════
    //  외부 인터페이스
    // ══════════════════════════════════════════════════════
    function setDirection(dx, dy) {
        if (state !== 'playing') return;
        pacman.nextDx = dx;
        pacman.nextDy = dy;
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        cancelAnimationFrame(loopId);
        if (_cb.onStateChange) _cb.onStateChange('paused');
    }

    function resume() {
        if (state !== 'paused') return;
        state = 'playing';
        lastTs = performance.now();
        loopId = requestAnimationFrame(_loop);
        if (_cb.onStateChange) _cb.onStateChange('playing');
    }

    function togglePause() {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
    }

    function _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function getState() { return state; }
    function getScore() { return score; }
    function getBestScore() { return bestScore; }
    function getStage() { return stage; }

    return { init, startGame, setDirection, pause, resume, togglePause, getState, getScore, getBestScore, getStage };
})();
