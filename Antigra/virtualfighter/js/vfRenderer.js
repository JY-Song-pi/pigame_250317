/**
 * vfRenderer.js — Pi Virtua Fighter 렌더러
 * Phase 1: 히트박스 시각화 + 상세 스프라이트
 */

const VFRenderer = (() => {
    'use strict';

    let canvas, ctx;
    let W, H, GROUND_Y;
    let showDebug = true;

    // 팔레트
    const COL = {
        SKY_TOP:    '#0a0022',
        SKY_BOT:    '#3a0060',
        FLOOR_TOP:  '#5a1090',
        FLOOR_BOT:  '#1a0030',
        P1_MAIN:    '#FF3355',
        P1_SKIN:    '#FFDAB9',
        P1_HAIR:    '#1a0800',
        P1_PANTS:   '#220018',
        P2_MAIN:    '#00CCFF',
        P2_SKIN:    '#C8A870',
        P2_HAIR:    '#001a10',
        P2_PANTS:   '#001a33',
        HITBOX:     'rgba(255,40,40,0.55)',
        HURTBOX:    'rgba(40,180,255,0.30)',
        BLOCK_BOX:  'rgba(255,220,0,0.5)',
        GROUND:     'rgba(200,100,255,0.5)',
    };

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        W = canvas.width;
        H = canvas.height;
        GROUND_Y = H * 0.78;
        window._VF_GROUND_Y = GROUND_Y;
    }

    // ── 배경 ─────────────────────────────────────────────────
    function drawBackground(tick) {
        // 하늘
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        sky.addColorStop(0, COL.SKY_TOP);
        sky.addColorStop(1, COL.SKY_BOT);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, GROUND_Y);

        // 파이 심볼 달
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#FFE000';
        ctx.font = `bold ${H * 0.35}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('π', W * 0.5, GROUND_Y * 0.55);
        ctx.globalAlpha = 1;
        ctx.restore();

        // 도시 실루엣
        _drawCityline(tick);

        // 관중
        _drawCrowd(tick);

        // 바닥
        const floor = ctx.createLinearGradient(0, GROUND_Y, 0, H);
        floor.addColorStop(0, COL.FLOOR_TOP);
        floor.addColorStop(1, COL.FLOOR_BOT);
        ctx.fillStyle = floor;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

        // 바닥 원근 선
        ctx.strokeStyle = 'rgba(180,80,255,0.25)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 6; i++) {
            const px = (i / 7) * W;
            ctx.beginPath();
            ctx.moveTo(px, GROUND_Y);
            ctx.lineTo(W / 2, H + 20);
            ctx.stroke();
        }

        // 바닥 선
        ctx.strokeStyle = COL.GROUND;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(W, GROUND_Y);
        ctx.stroke();
    }

    function _drawCityline(tick) {
        const buildings = [
            {x:0, w:70, h:110}, {x:60, w:55, h:80}, {x:110, w:80, h:130},
            {x:W-150, w:80, h:120}, {x:W-75, w:55, h:90}, {x:W-20, w:50, h:70}
        ];
        buildings.forEach(b => {
            ctx.fillStyle = 'rgba(16,4,32,0.9)';
            ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
            // 창문 (점등 상태 애니메이션)
            ctx.fillStyle = 'rgba(255,200,100,0.35)';
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 3; c++) {
                    const wx = b.x + 6 + c * (b.w / 3 - 2);
                    const wy = GROUND_Y - b.h + 10 + r * 18;
                    if (((r * 7 + c * 3 + Math.floor(tick / 90)) % 4) !== 0)
                        ctx.fillRect(wx, wy, b.w / 3 - 6, 10);
                }
            }
        });
    }

    function _drawCrowd(tick) {
        const pulse = Math.sin(tick * 0.08);
        const crowdColors = ['#FF4B6E','#00CED1','#FFE000','#aaffaa','#ffffff','#ff88aa'];
        ctx.save();
        for (let i = 0; i < 60; i++) {
            const px = (i / 60 * W * 1.1) - W * 0.05;
            const py = GROUND_Y - 60 + ((i * 13) % 40) + Math.sin(tick * 0.1 + i) * 3;
            const r = 5 + (i % 3) + (i % 4 === 0 ? pulse * 2 : 0);
            ctx.fillStyle = crowdColors[i % crowdColors.length];
            ctx.globalAlpha = 0.45 + (i % 5) * 0.08;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ── 캐릭터 스프라이트 ────────────────────────────────────
    function drawFighter(f) {
        if (!f) return;
        const gY = GROUND_Y;
        const bx = f.x;
        const by = gY;
        const flip = !f.facingRight;
        const crouching = (f.state === 'crouch' || f.state === 'block_crouch' || f.state === 'hit_stun');

        const isPi = (f.id === 'p1');
        const c = isPi ? {
            main: COL.P1_MAIN, skin: COL.P1_SKIN, hair: COL.P1_HAIR, pants: COL.P1_PANTS
        } : {
            main: COL.P2_MAIN, skin: COL.P2_SKIN, hair: COL.P2_HAIR, pants: COL.P2_PANTS
        };

        ctx.save();
        ctx.translate(bx, by);
        if (flip) ctx.scale(-1, 1);
        if (f.hurtFlash % 4 < 2 && f.hurtFlash > 0) ctx.globalAlpha = 0.4;

        const scale = crouching ? 0.75 : 1;
        ctx.scale(1, scale);

        _drawFighterBody(f, c, crouching);

        ctx.restore();

        // 히트/허트박스 오버레이 (디버그)
        if (showDebug) _drawBoxes(f);
    }

    function _drawFighterBody(f, c, crouching) {
        const isAttacking = (f.state === 'attack_active' || f.state === 'attack_startup');
        const isBlocking  = (f.state === 'block_stand' || f.state === 'block_crouch' || f.state === 'block_stun');
        const isDead = f.state === 'dead';
        const t = window._vfTick || 0;

        // 그림자
        ctx.save();
        ctx.scale(1, 1 / (crouching ? 0.75 : 1));
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(0, 6, 32, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (isDead) {
            // 쓰러진 모습
            ctx.fillStyle = c.main;
            ctx.save();
            ctx.rotate(Math.PI / 2);
            ctx.fillRect(-30, -60, 60, 125);
            ctx.restore();
            return;
        }

        // ── 다리 ──
        const isWalking = (f.state === 'walk_f') && !crouching;
        const legSwing = isWalking ? Math.sin(t * 0.28) * 13 : 0;

        ctx.fillStyle = c.pants;
        // 왼 다리
        ctx.beginPath(); ctx.roundRect(-28, -60 + legSwing, 22, 60, [3, 3, 10, 10]); ctx.fill();
        // 오른 다리
        ctx.beginPath(); ctx.roundRect(6, -60 - legSwing, 22, 60, [3, 3, 10, 10]); ctx.fill();
        // 신발
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(-17, -1, 20, 8, 0.1, 0, Math.PI); ctx.fill();
        ctx.beginPath(); ctx.ellipse(17, -1, 20, 8, -0.1, 0, Math.PI); ctx.fill();

        // 벨트
        ctx.fillStyle = '#FFE000';
        ctx.fillRect(-30, -65, 60, 10);

        // ── 몸통 ──
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.roundRect(-32, -125, 64, 65, [6]); ctx.fill();
        // 옷 디테일 (세로선)
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -125); ctx.lineTo(0, -65); ctx.stroke();
        // 가슴 하이라이트
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.ellipse(-10, -105, 18, 12, 0.3, 0, Math.PI * 2); ctx.fill();

        // 가드 시 팔 앞에 X 표시
        if (isBlocking) {
            ctx.strokeStyle = '#FFE000'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(-26, -120); ctx.lineTo(26, -70); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(26, -120); ctx.lineTo(-26, -70); ctx.stroke();
        }

        // ── 머리 ──
        ctx.fillStyle = c.skin;
        ctx.fillRect(-8, -142, 16, 20);
        ctx.beginPath(); ctx.ellipse(0, -162, 27, 23, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.hair;
        ctx.beginPath(); ctx.arc(0, -172, 29, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-8, -160, 10, 12, -0.3, 0, Math.PI, true); ctx.fill();

        // 눈썹
        ctx.strokeStyle = c.hair; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-21, -172); ctx.lineTo(-8, -176); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, -176); ctx.lineTo(21, -172); ctx.stroke();
        // 눈
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-13, -166, 8, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(13, -166, 8, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a1a55';
        ctx.beginPath(); ctx.arc(-13, -166, 4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(13, -166, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-11, -168, 1.8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(15, -168, 1.8, 0, Math.PI*2); ctx.fill();
        // 코
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(3, -161); ctx.lineTo(8, -154); ctx.lineTo(3, -154); ctx.stroke();
        // 입
        ctx.strokeStyle = '#a05040'; ctx.lineWidth = 2.5;
        if (f.state === 'attack_active') {
            ctx.beginPath(); ctx.arc(0, -152, 7, 0, Math.PI); ctx.stroke(); // 기합
        } else {
            ctx.beginPath(); ctx.moveTo(-8, -152); ctx.lineTo(8, -152); ctx.stroke(); // 무표정
        }

        // ── 팔 ──
        _drawArms(f, c, isBlocking, isAttacking, t);
    }

    function _drawArms(f, c, isBlocking, isAttacking, t) {
        const walkSwing = (f.state === 'walk_f') ? Math.sin(t * 0.28) * 12 : 0;

        if (isAttacking && f.currentMove) {
            _drawAttackArm(f, c);
            return;
        }

        if (isBlocking) {
            // 가드 자세: 팔을 앞에 겹쳐 X
            ctx.fillStyle = c.skin;
            ctx.beginPath(); ctx.roundRect(6, -122, 18, 50, [8]); ctx.fill();
            ctx.fillStyle = c.main;
            ctx.beginPath(); ctx.roundRect(6, -122, 18, 28, [4]); ctx.fill();

            ctx.fillStyle = c.skin;
            ctx.beginPath(); ctx.roundRect(-8, -118, 18, 50, [8]); ctx.fill();
            ctx.fillStyle = c.main;
            ctx.beginPath(); ctx.roundRect(-8, -118, 18, 28, [4]); ctx.fill();
            return;
        }

        // 기본 팔
        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.roundRect(22, -122 - walkSwing, 18, 28, [4]); ctx.fill();
        ctx.fillStyle = c.skin;
        ctx.beginPath(); ctx.roundRect(22, -98 - walkSwing, 18, 38, [8]); ctx.fill();

        ctx.fillStyle = c.main;
        ctx.beginPath(); ctx.roundRect(-40, -122 + walkSwing, 18, 28, [4]); ctx.fill();
        ctx.fillStyle = c.skin;
        ctx.beginPath(); ctx.roundRect(-40, -98 + walkSwing, 18, 38, [8]); ctx.fill();

        // 주먹
        ctx.fillStyle = c.skin;
        ctx.beginPath(); ctx.ellipse(31, -62 - walkSwing, 11, 9, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-31, -62 + walkSwing, 11, 9, 0, 0, Math.PI*2); ctx.fill();
    }

    function _drawAttackArm(f, c) {
        const mv = f.currentMove || '';
        if (mv.includes('punch') || mv === 'back_punch') {
            // 펀치: 오른팔 뻗음
            ctx.fillStyle = c.main;
            ctx.beginPath(); ctx.roundRect(22, -122, 18, 28, [4]); ctx.fill();
            ctx.fillStyle = c.skin;
            ctx.beginPath(); ctx.roundRect(40, -112, 55, 18, [2, 12, 12, 2]); ctx.fill();
            // 주먹
            ctx.fillStyle = c.skin;
            ctx.beginPath(); ctx.roundRect(92, -120, 24, 26, [6]); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath(); ctx.moveTo(95, -118 + i * 7); ctx.lineTo(114, -118 + i * 7); ctx.stroke();
            }
            // 왼 팔 가드
            ctx.fillStyle = c.main; ctx.beginPath(); ctx.roundRect(-40, -122, 18, 28, [4]); ctx.fill();
            ctx.fillStyle = c.skin; ctx.beginPath(); ctx.roundRect(-40, -98, 18, 38, [8]); ctx.fill();
        } else if (mv.includes('kick')) {
            // 킥: 오른 다리 뻗음
            ctx.save();
            ctx.rotate(-0.38);
            ctx.fillStyle = c.pants;
            ctx.beginPath(); ctx.roundRect(4, -50, 24, 75, [6, 6, 12, 12]); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.ellipse(16, 28, 26, 10, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            // 팔 기본
            ctx.fillStyle = c.main; ctx.beginPath(); ctx.roundRect(22, -122, 18, 28,[4]); ctx.fill();
            ctx.fillStyle = c.skin; ctx.beginPath(); ctx.roundRect(22, -98, 18, 38,[8]); ctx.fill();
            ctx.fillStyle = c.main; ctx.beginPath(); ctx.roundRect(-40, -122, 18, 28,[4]); ctx.fill();
            ctx.fillStyle = c.skin; ctx.beginPath(); ctx.roundRect(-40, -98, 18, 38,[8]); ctx.fill();
        }
    }

    // ── 박스 오버레이 ────────────────────────────────────────
    function _drawBoxes(f) {
        if (!showDebug) return;
        const gY = GROUND_Y;

        // 허트박스
        if (f.hurtbox) {
            ctx.strokeStyle = f.guardType ? COL.BLOCK_BOX : COL.HURTBOX;
            ctx.lineWidth = 2;
            ctx.strokeRect(f.hurtbox.x, f.hurtbox.y, f.hurtbox.w, f.hurtbox.h);
            ctx.fillStyle = f.guardType ? 'rgba(255,220,0,0.1)' : 'rgba(40,180,255,0.08)';
            ctx.fillRect(f.hurtbox.x, f.hurtbox.y, f.hurtbox.w, f.hurtbox.h);
        }

        // 히트박스
        if (f.hitbox) {
            const hb = f.hitbox;
            const rx = Math.min(hb.x, hb.x + hb.w);
            const rw = Math.abs(hb.w);
            ctx.fillStyle = COL.HITBOX;
            ctx.fillRect(rx, hb.y, rw, hb.h);
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(rx, hb.y, rw, hb.h);
        }
    }

    // ── 공격 이펙트 ──────────────────────────────────────────
    function drawHitEffect(effects) {
        effects.forEach(e => {
            const life = e.life / e.maxLife;
            const r = (1 - life) * 50;
            ctx.globalAlpha = life;
            const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
            grd.addColorStop(0, '#fff');
            grd.addColorStop(0.4, e.color);
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        });
    }

    // ── 링아웃 경계 표시 ─────────────────────────────────────
    function drawBoundary(leftEdge, rightEdge) {
        ctx.strokeStyle = '#FF3355';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        // 왼쪽 경계
        ctx.beginPath(); ctx.moveTo(leftEdge, GROUND_Y - 150); ctx.lineTo(leftEdge, GROUND_Y); ctx.stroke();
        // 오른쪽 경계
        ctx.beginPath(); ctx.moveTo(rightEdge, GROUND_Y - 150); ctx.lineTo(rightEdge, GROUND_Y); ctx.stroke();
        ctx.setLineDash([]);
    }

    function toggleDebug() { showDebug = !showDebug; }

    return { init, drawBackground, drawFighter, drawHitEffect, drawBoundary, toggleDebug };
})();
