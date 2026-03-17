/**
 * vfGame.js — Pi Virtua Fighter 메인 게임 루프
 * Phase 1: FSM 통합, 충돌/가드 판정, AI, 링아웃, UI 연동
 */

const VFGame = (() => {
    'use strict';

    // ── 설정 ─────────────────────────────────────────────────
    const CFG = {
        CANVAS_W: 800,
        CANVAS_H: 450,
        P1_START_X: 200,
        P2_START_X: 600,
        STAGE_LEFT:  60,    // 링아웃 왼쪽 경계
        STAGE_RIGHT: 740,   // 링아웃 오른쪽 경계
        TIMER_SEC:  45,
        ROUNDS_TO_WIN: 2,
    };

    let canvas, ctx;
    let p1, p2;
    let state = 'idle'; // 'idle' | 'playing' | 'round_end' | 'match_end'
    let tick = 0;
    let timerMs = CFG.TIMER_SEC * 1000;
    let timerMs_last = 0;
    let hitEffects = [];
    let p1Rounds = 0, p2Rounds = 0;
    let roundEndTimer = 0;

    // ── 초기화 ────────────────────────────────────────────────
    function init() {
        canvas = document.getElementById('vf-canvas');
        canvas.width  = CFG.CANVAS_W;
        canvas.height = CFG.CANVAS_H;
        ctx = canvas.getContext('2d');
        window._vfTick = 0;

        VFRenderer.init(canvas);
        VFInput.init();

        // UI 이벤트
        document.getElementById('start-btn').addEventListener('click', startMatch);
        window.addEventListener('keydown', e => {
            if (e.key === 'F1') { e.preventDefault(); VFRenderer.toggleDebug(); }
        });

        _drawIdle();
    }

    function _drawIdle() {
        if (!canvas) return;
        ctx.clearRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);
        ctx.fillStyle = '#060210';
        ctx.fillRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);
    }

    // ── 라운드/매치 시작 ─────────────────────────────────────
    function startMatch() {
        p1Rounds = 0;
        p2Rounds = 0;
        _updateRoundDots();
        document.getElementById('overlay').style.display = 'none';
        _startRound();
    }

    function _startRound() {
        // 파이터 생성
        const GROUND = window._VF_GROUND_Y || CFG.CANVAS_H * 0.78;
        p1 = new VFFighter('p1', CFG.P1_START_X, 1);
        p2 = new VFFighter('p2', CFG.P2_START_X, -1);
        p1.GROUND_Y = GROUND;
        p2.GROUND_Y = GROUND;
        p1.y = GROUND;
        p2.y = GROUND;

        // 마주보게
        p1.facingRight = true;
        p2.facingRight = false;

        hitEffects = [];
        timerMs = CFG.TIMER_SEC * 1000;
        timerMs_last = performance.now();
        tick = 0;
        state = 'playing';

        // HP 바 초기화
        _updateHPBars();
        document.getElementById('match-timer').innerText = CFG.TIMER_SEC;

        // FIGHT 공지
        _announce('FIGHT!', 1200);

        requestAnimationFrame(_loop);
    }

    // ── 메인 루프 ─────────────────────────────────────────────
    let _lastRaf = 0;
    function _loop(ts) {
        if (state !== 'playing') return;
        requestAnimationFrame(_loop);

        const dt = Math.min(ts - _lastRaf, 50);
        _lastRaf = ts;
        tick++;
        window._vfTick = tick;

        VFInput.tick();
        _update(dt);
        _render();
        _updateDebugPanel();
    }

    // ── 업데이트 ──────────────────────────────────────────────
    function _update(dt) {
        // 타이머
        timerMs -= dt;
        const secLeft = Math.ceil(timerMs / 1000);
        const timerEl = document.getElementById('match-timer');
        if (timerEl) timerEl.innerText = Math.max(0, secLeft);

        // P1 입력 처리
        _handlePlayerInput();

        // AI (P2)
        _updateAI();

        // FSM 업데이트
        const p1Input = _getHeldForFighter(p1);
        const p2Input = null; // AI가 직접 메서드 호출
        p1.update(p1Input);
        p2.update(p2Input);

        // 상대방 마주보기
        _updateFacing();

        // 충돌/가드/히트 판정
        _checkHit(p1, p2);
        _checkHit(p2, p1);

        // 위치 경계 (서로 통과 방지)
        _pushApart();

        // 히트 이펙트 업데이트
        hitEffects = hitEffects.filter(e => e.life > 0);
        hitEffects.forEach(e => e.life--);

        // HP 바 업데이트
        _updateHPBars();

        // 링아웃 / 타임오버 / KO 판정
        _checkEndCondition();
    }

    function _handlePlayerInput() {
        // 가드 상태 관리
        const held = VFInput.getHeld();

        if (held.G) {
            const guardType = held.down ? 'crouch' : 'stand';
            p1.startGuard(guardType);
        } else if (p1.state === 'block_stand' || p1.state === 'block_crouch') {
            p1.stopGuard();
        }

        // 앉기
        if (!held.G) {
            if (held.down && p1.state === 'idle') p1.crouch();
            else if (!held.down && p1.state === 'crouch') p1.setState('idle');
        }

        // 점프
        if (held.up && !p1.isJumping) p1.jump();

        // 기술 입력 (콤보 우선, 없으면 단독 버튼)
        const combo = VFInput.consumeCombo();
        if (combo) {
            p1.startMove(combo);
        } else {
            // 단독 버튼 입력은 즉시 소비형이 아니라 held 체크
            // (단, 이전 프레임에서 누른 것만 소비하도록 버퍼 이용)
        }

        // 이동 처리: update() 내부에서 held 상태로 처리됨
    }

    function _getHeldForFighter(f) {
        const h = VFInput.getHeld();
        if (f.id !== 'p1') return null;
        // 방향키는 facing에 따라 left/right 반전 불필요 (절대 방향 사용)
        return h;
    }

    // ── 단순 AI ───────────────────────────────────────────────
    const AI_MOVES = ['ai_punch', 'ai_kick', 'ai_low_kick', 'ai_heavy'];
    function _updateAI() {
        if (!p2 || p2.state === 'dead' || p2.state === 'hit_stun') return;

        const dist = Math.abs(p1.x - p2.x);
        const isClose = dist < 130;

        // 이동
        if (!['attack_startup','attack_active','attack_recovery','block_stun'].includes(p2.state)) {
            if (dist > 150) {
                p2.vx = (p1.x > p2.x) ? 2.5 : -2.5;
                p2.setState('walk_f');
            } else if (dist < 70) {
                p2.vx = (p1.x > p2.x) ? -2 : 2;
                p2.setState('walk_f');
            } else {
                p2.vx = 0;
                if (p2.state === 'walk_f') p2.setState('idle');
            }
        }

        // 공격 / 가드
        if (p2.aiCooldown <= 0 && isClose) {
            const r = Math.random();
            if (r < 0.03) {
                const pick = AI_MOVES[Math.floor(Math.random() * AI_MOVES.length)];
                if (p2.startMove(pick)) {
                    p2.aiCooldown = 30 + Math.floor(Math.random() * 30);
                }
            } else if (r < 0.06) {
                // 가드
                const guardType = (Math.random() < 0.4) ? 'crouch' : 'stand';
                p2.startGuard(guardType);
                p2.aiCooldown = 20;
            } else {
                p2.stopGuard();
            }
        }
    }

    // ── 히트/가드 판정 ────────────────────────────────────────
    function _checkHit(attacker, defender) {
        if (!attacker.hitbox || attacker.hitConfirmed) return;
        if (defender.state === 'dead') return;
        if (attacker.isInvincible || defender.isInvincible) return;

        const hb = attacker.hitbox;
        const rx = Math.min(hb.x, hb.x + hb.w);
        const rw = Math.abs(hb.w);
        const hitRect = { x: rx, y: hb.y, w: rw, h: hb.h };

        const db = defender.hurtbox;
        if (!db) return;

        // AABB 판정
        if (!_rectsOverlap(hitRect, db)) return;

        attacker.hitConfirmed = true;

        const md = attacker.moveData;
        if (!md) return;

        // 가드 vs 공격 레벨 판정
        const guardType = defender.guardType;
        const blocked = guardType ? canBlock(guardType, md.level) : false;

        defender.receiveHit(md.damage, md.level, blocked);

        // 히트 이펙트
        const ey = defender.hurtbox ? (defender.hurtbox.y + defender.hurtbox.h * 0.4) : window._VF_GROUND_Y - 80;
        const ex = (attacker.x + defender.x) / 2;
        hitEffects.push({
            x: ex, y: ey,
            life: 20, maxLife: 20,
            color: blocked ? '#FFE000' : (md.level === 'HIGH' ? '#FF4488' : md.level === 'LOW' ? '#44FF88' : '#FFAA00')
        });

        // 판정 표시 텍스트
        if (!blocked) {
            const txt = ({ HIGH:'HIGH HIT!', MID:'MID HIT!', LOW:'LOW HIT!', NONE:'' })[md.level] || 'HIT!';
            if (txt) _flashText(txt, '#FF4466', 600);
        } else {
            _flashText('GUARD!', '#FFE000', 400);
        }
    }

    function _rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // ── 페이서 마주보기 ──────────────────────────────────────
    function _updateFacing() {
        if (p1 && p2) {
            const freeStates = ['idle','walk_f','crouch','jump'];
            if (freeStates.includes(p1.state)) p1.facingRight = (p2.x > p1.x);
            if (freeStates.includes(p2.state)) p2.facingRight = (p1.x > p2.x);
        }
    }

    // ── 캐릭터끼리 겹침 방지 ────────────────────────────────
    function _pushApart() {
        const minDist = 55;
        const diff = p2.x - p1.x;
        if (Math.abs(diff) < minDist) {
            const push = (minDist - Math.abs(diff)) / 2;
            if (diff >= 0) { p1.x -= push; p2.x += push; }
            else           { p1.x += push; p2.x -= push; }
        }
    }

    // ── 종료 조건 체크 ───────────────────────────────────────
    function _checkEndCondition() {
        // 링아웃
        const p1RingOut = (p1.x < CFG.STAGE_LEFT || p1.x > CFG.STAGE_RIGHT) && p1.y >= p1.GROUND_Y;
        const p2RingOut = (p2.x < CFG.STAGE_LEFT || p2.x > CFG.STAGE_RIGHT) && p2.y >= p2.GROUND_Y;

        if (p1RingOut) { p1.hp = 0; }
        if (p2RingOut) { p2.hp = 0; }

        const p1Dead = p1.hp <= 0;
        const p2Dead = p2.hp <= 0;
        const timeUp = timerMs <= 0;

        if (p1Dead || p2Dead || timeUp) {
            state = 'round_end';
            _endRound(p1Dead, p2Dead, timeUp);
        }
    }

    function _endRound(p1Dead, p2Dead, timeUp) {
        let msg = '';
        if (timeUp && !p1Dead && !p2Dead) {
            if (p1.hp > p2.hp)      { msg = 'TIME UP — P1 WIN!'; p1Rounds++; }
            else if (p2.hp > p1.hp) { msg = 'TIME UP — AI WIN!'; p2Rounds++; }
            else                    { msg = 'DRAW!'; }
        } else if (p1Dead && !p2Dead) {
            msg = 'K.O. — AI WIN!'; p2Rounds++;
        } else if (p2Dead && !p1Dead) {
            msg = p1Dead ? 'K.O. — DOUBLE K.O.!' : 'K.O.!'; p1Rounds++;
            if (!p1Dead) msg = 'K.O.!';
        } else {
            msg = 'DOUBLE K.O.!';
        }

        _announce(msg, 2500);
        _updateRoundDots();

        setTimeout(() => {
            if (p1Rounds >= CFG.ROUNDS_TO_WIN || p2Rounds >= CFG.ROUNDS_TO_WIN) {
                _endMatch();
            } else {
                _startRound();
            }
        }, 2800);
    }

    function _endMatch() {
        const winner = p1Rounds >= CFG.ROUNDS_TO_WIN ? 'PIONEER WINS!' : 'NODE RUNNER WINS!';
        const overlay = document.getElementById('overlay');
        document.getElementById('overlay-title').innerText = winner;
        document.getElementById('overlay-sub').innerText = `P1: ${p1Rounds}  vs  AI: ${p2Rounds}`;
        document.getElementById('start-btn').innerText = '▶ REMATCH';
        overlay.style.display = 'flex';
        state = 'match_end';
    }

    // ── 렌더링 ────────────────────────────────────────────────
    function _render() {
        ctx.clearRect(0, 0, CFG.CANVAS_W, CFG.CANVAS_H);
        VFRenderer.drawBackground(tick);
        VFRenderer.drawBoundary(CFG.STAGE_LEFT, CFG.STAGE_RIGHT);
        VFRenderer.drawHitEffect(hitEffects);
        VFRenderer.drawFighter(p1);
        VFRenderer.drawFighter(p2);
    }

    // ── UI 헬퍼 ──────────────────────────────────────────────
    function _updateHPBars() {
        if (!p1 || !p2) return;
        const p1Pct = Math.max(0, (p1.hp / p1.maxHp) * 100);
        const p2Pct = Math.max(0, (p2.hp / p2.maxHp) * 100);
        const p1El = document.getElementById('p1-hp');
        const p2El = document.getElementById('p2-hp');
        if (p1El) p1El.style.width = p1Pct + '%';
        if (p2El) p2El.style.width = p2Pct + '%';
    }

    function _updateRoundDots() {
        const d1 = document.getElementById('p1-rounds');
        const d2 = document.getElementById('p2-rounds');
        if (d1) d1.innerHTML = Array.from({length: CFG.ROUNDS_TO_WIN}, (_,i) =>
            `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;margin:0 2px;background:${i < p1Rounds ? '#FF3355' : 'rgba(255,255,255,0.2)'};border:1.5px solid rgba(255,255,255,0.4)"></span>`
        ).join('');
        if (d2) d2.innerHTML = Array.from({length: CFG.ROUNDS_TO_WIN}, (_,i) =>
            `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;margin:0 2px;background:${i < p2Rounds ? '#00CCFF' : 'rgba(255,255,255,0.2)'};border:1.5px solid rgba(255,255,255,0.4)"></span>`
        ).join('');
    }

    let _announceTimer = null;
    function _announce(text, duration) {
        const el = document.getElementById('announce');
        if (!el) return;
        el.innerText = text;
        el.classList.remove('hidden');
        if (_announceTimer) clearTimeout(_announceTimer);
        _announceTimer = setTimeout(() => el.classList.add('hidden'), duration);
    }

    function _flashText(text, color, dur) {
        // 간단한 캔버스 플래시 (announce 재활용)
        // 실제로는 화면 가운데 잠깐 표시
    }

    function _updateDebugPanel() {
        const d1 = document.getElementById('p1-debug');
        const d2 = document.getElementById('p2-debug');
        if (d1 && p1) d1.innerText = p1.getDebugText();
        if (d2 && p2) d2.innerText = p2.getDebugText();
    }

    return { init };
})();

// ── 진입점 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    VFGame.init();
});
