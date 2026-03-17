/**
 * Pi Fighter — Core Game Logic (v2: Detailed Sprites)
 * Street Fighter 스타일 격투 게임 핵심 로직
 */

const FighterGame = (() => {
    'use strict';

    const CFG = {
        WIDTH: 800,
        HEIGHT: 440,
        GRAVITY: 0.55,
        P1_START_X: 130,
        P2_START_X: 590,
        START_Y: 240,  // 발 위치 기준
        GROUND_Y: 370,
        MAX_HP: 100,
        FIGHTER_W: 80,
        FIGHTER_H: 130,
        COLS: {
            P1_SKIN:  '#FFDAB9',
            P1_HAIR:  '#1a0a00',
            P1_SUIT:  '#FF2244',
            P1_PANTS: '#220011',
            P1_BELT:  '#FFE000',
            P2_SKIN:  '#C8A87A',
            P2_HAIR:  '#001a0a',
            P2_SUIT:  '#00AACC',
            P2_PANTS: '#002240',
            P2_BELT:  '#FF8800',
        }
    };

    let canvas, ctx, offscreen, offCtx;
    let state = 'idle';
    let loopId = null;
    let lastTs = 0;
    let p1, p2;
    let matchTimer = 99;
    let timerTick = 0;
    let callbacks = {};
    let hitEffects = []; // 타격 이펙트
    let animTick = 0;    // 애니메이션 틱

    // ═══════════════════════════════════════════════════════════
    //  Fighter 클래스
    // ═══════════════════════════════════════════════════════════
    class Fighter {
        constructor(x, y, side, colors) {
            this.x = x;
            this.y = y;  // 발 위치
            this.vx = 0;
            this.vy = 0;
            this.width = CFG.FIGHTER_W;
            this.height = CFG.FIGHTER_H;
            this.side = side;  // 1=P1(왼쪽), -1=P2(오른쪽)
            this.hp = CFG.MAX_HP;
            this.state = 'idle';
            this.isJumping = false;
            this.attackFrame = 0;
            this.attackType = 'punch';
            this.energy = 0;
            this.hurtFlash = 0;
            this.colors = colors;
            this.speed = 4;
            this.jumpForce = -14;
            this.facingRight = (side === 1); // 오른쪽을 향하는지
        }

        get footX() { return this.x; }
        get footY() { return this.y; }
        get bodyTop() { return this.y - this.height; }
        get bodyLeft() { return this.x - this.width / 2; }

        update() {
            this.vy += CFG.GRAVITY;
            this.x += this.vx;
            this.y += this.vy;

            if (this.y >= CFG.GROUND_Y) {
                this.y = CFG.GROUND_Y;
                this.vy = 0;
                this.isJumping = false;
                if (this.state === 'jumping') this.state = 'idle';
            }

            const hw = this.width / 2;
            if (this.x - hw < 0) this.x = hw;
            if (this.x + hw > CFG.WIDTH) this.x = CFG.WIDTH - hw;

            if (this.hp <= 0) this.state = 'dead';
            if (this.hurtFlash > 0) this.hurtFlash--;

            // 항상 상대방을 바라봄
            const opponent = this.side === 1 ? p2 : p1;
            if (opponent) {
                this.facingRight = (opponent.x > this.x);
            }
        }

        // ── 스프라이트 렌더링 ──────────────────────────────────
        draw() {
            const c = this.colors;
            const flip = !this.facingRight;
            const bx = this.x; // 발 중심 X
            const fy = this.y; // 발 Y
            const hurt = this.hurtFlash > 0;

            ctx.save();

            // 피격 때 흰색 플래시
            if (hurt) ctx.globalAlpha = 0.6;

            // 좌우 반전을 위해 변환
            ctx.translate(bx, fy);
            if (flip) ctx.scale(-1, 1);

            this._drawShadow();
            this._drawLegs(c);
            this._drawBody(c);
            this._drawHead(c);
            this._drawArms(c);
            if (this.state === 'attacking') this._drawAttackEffect(c);

            ctx.restore();
        }

        _drawShadow() {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(0, 5, 32, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        _drawLegs(c) {
            const t = animTick;
            const isWalking = Math.abs(this.vx) > 0.5 && !this.isJumping;
            const legSwing = isWalking ? Math.sin(t * 0.3) * 14 : 0;

            // 오른 다리
            ctx.fillStyle = c.PANTS;
            ctx.beginPath();
            ctx.roundRect(-26, -62 + legSwing, 22, 62, [4, 4, 10, 10]);
            ctx.fill();
            // 왼 다리
            ctx.fillStyle = c.PANTS;
            ctx.beginPath();
            ctx.roundRect(4, -62 - legSwing, 22, 62, [4, 4, 10, 10]);
            ctx.fill();

            // 신발 (오른)
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.ellipse(-15, -2, 18, 8, 0.1, 0, Math.PI);
            ctx.fill();
            // 신발 (왼)
            ctx.beginPath();
            ctx.ellipse(15, -2, 18, 8, -0.1, 0, Math.PI);
            ctx.fill();

            // 벨트
            ctx.fillStyle = c.BELT;
            ctx.fillRect(-28, -66, 56, 10);
        }

        _drawBody(c) {
            // 몸통 (상체)
            ctx.fillStyle = c.SUIT;
            ctx.beginPath();
            ctx.roundRect(-30, -125, 60, 65, [6]);
            ctx.fill();

            // 가슴 근육 라인
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -125);
            ctx.lineTo(0, -65);
            ctx.stroke();

            // 옷깃/디테일
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.moveTo(0, -125);
            ctx.lineTo(-14, -105);
            ctx.lineTo(0, -100);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -125);
            ctx.lineTo(14, -105);
            ctx.lineTo(0, -100);
            ctx.closePath();
            ctx.fill();
        }

        _drawHead(c) {
            const t = animTick;
            // 목
            ctx.fillStyle = c.SKIN;
            ctx.fillRect(-8, -140, 16, 20);

            // 얼굴
            ctx.fillStyle = c.SKIN;
            ctx.beginPath();
            ctx.ellipse(0, -160, 26, 22, 0, 0, Math.PI * 2);
            ctx.fill();

            // 머리카락
            ctx.fillStyle = c.HAIR;
            ctx.beginPath();
            ctx.arc(0, -170, 28, Math.PI, 0);
            ctx.fill();
            // 앞머리
            ctx.fillStyle = c.HAIR;
            ctx.beginPath();
            ctx.ellipse(-8, -158, 10, 12, -0.3, 0, Math.PI, true);
            ctx.fill();

            // 눈썹
            ctx.fillStyle = c.HAIR;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-20, -168); ctx.lineTo(-8, -172);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(8, -172); ctx.lineTo(20, -168);
            ctx.stroke();

            // 눈
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(-13, -163, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(13, -163, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(-13, -163, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(13, -163, 3.5, 0, Math.PI * 2); ctx.fill();
            // 눈 하이라이트
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-11, -165, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, -165, 1.5, 0, Math.PI * 2); ctx.fill();

            // 코
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(3, -158); ctx.lineTo(8, -151); ctx.lineTo(3, -151); ctx.stroke();

            // 입 (상태에 따라)
            ctx.strokeStyle = '#a05040';
            ctx.lineWidth = 2;
            if (this.state === 'attacking') {
                // 기합
                ctx.beginPath(); ctx.arc(0, -150, 7, 0, Math.PI); ctx.stroke();
            } else if (this.state === 'hurt') {
                ctx.beginPath(); ctx.arc(0, -147, 5, Math.PI, 0); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.moveTo(-8, -150); ctx.lineTo(8, -150); ctx.stroke();
            }
        }

        _drawArms(c) {
            const t = animTick;
            const isWalking = Math.abs(this.vx) > 0.5;
            const armSwing = isWalking ? Math.sin(t * 0.3) * 14 : 0;

            if (this.state === 'attacking') {
                if (this.attackType === 'punch') this._drawPunch(c);
                else if (this.attackType === 'kick') this._drawKick(c);
                else if (this.attackType === 'special') this._drawSpecial(c);
                return;
            }

            // 기본 팔 (오른팔: 앞)
            ctx.fillStyle = c.SKIN;
            ctx.beginPath();
            ctx.roundRect(22, -120 - armSwing, 18, 55, [8]);
            ctx.fill();
            ctx.fillStyle = c.SUIT;
            ctx.beginPath();
            ctx.roundRect(22, -120, 18, 30, [4]);
            ctx.fill();

            // 기본 팔 (왼팔: 뒤)
            ctx.fillStyle = c.SKIN;
            ctx.beginPath();
            ctx.roundRect(-40, -120 + armSwing, 18, 55, [8]);
            ctx.fill();
            ctx.fillStyle = c.SUIT;
            ctx.beginPath();
            ctx.roundRect(-40, -120, 18, 30, [4]);
            ctx.fill();

            // 주먹
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.ellipse(31, -65 - armSwing, 10, 8, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-31, -65 + armSwing, 10, 8, 0, 0, Math.PI*2); ctx.fill();
        }

        _drawPunch(c) {
            // 왼팔은 가드
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(-38, -115, 18, 50, [8]); ctx.fill();
            ctx.fillStyle = c.SUIT;
            ctx.beginPath(); ctx.roundRect(-38, -115, 18, 28, [4]); ctx.fill();

            // 오른팔은 강하게 뻗음
            ctx.fillStyle = c.SUIT;
            ctx.beginPath(); ctx.roundRect(22, -120, 18, 28, [4]); ctx.fill();
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(40, -108, 45, 18, [2, 10, 10, 2]); ctx.fill();
            // 주먹
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(80, -114, 22, 24, [6]); ctx.fill();
            // 주먹 라인
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath(); ctx.moveTo(83, -112 + i * 7); ctx.lineTo(100, -112 + i * 7); ctx.stroke();
            }
        }

        _drawKick(c) {
            // 왼팔
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(-38, -115, 18, 50, [8]); ctx.fill();
            ctx.fillStyle = c.SUIT;
            ctx.beginPath(); ctx.roundRect(-38, -115, 18, 28, [4]); ctx.fill();
            // 오른팔 (가드)
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(22, -115, 16, 45, [8]); ctx.fill();
            ctx.fillStyle = c.SUIT;
            ctx.beginPath(); ctx.roundRect(22, -115, 16, 26, [4]); ctx.fill();

            // 킥하는 다리 (앞으로 뻗음)
            ctx.fillStyle = c.PANTS;
            ctx.save();
            ctx.rotate(-0.35); // 다리 각도
            ctx.beginPath(); ctx.roundRect(5, -50, 22, 70, [6, 6, 12, 12]); ctx.fill();
            ctx.restore();

            // 신발
            ctx.fillStyle = '#111';
            ctx.save();
            ctx.rotate(-0.35);
            ctx.beginPath(); ctx.ellipse(16, 26, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        _drawSpecial(c) {
            // π 기 (에너지 모으는 자세)
            ctx.fillStyle = c.SUIT;
            ctx.beginPath(); ctx.roundRect(-38, -120, 18, 30, [4]); ctx.fill();
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(-38, -95, 18, 40, [6]); ctx.fill();
            // 오른팔 들어올림
            ctx.save();
            ctx.rotate(-0.5);
            ctx.fillStyle = c.SUIT;
            ctx.beginPath(); ctx.roundRect(30, -100, 16, 28, [4]); ctx.fill();
            ctx.fillStyle = c.SKIN;
            ctx.beginPath(); ctx.roundRect(30, -76, 16, 38, [8]); ctx.fill();
            ctx.restore();
        }

        _drawAttackEffect(c) {
            // 공격할 때 이펙트
            const ex = (this.attackType === 'punch') ? 115 : (this.attackType === 'kick') ? 90 : 150;
            const ey = (this.attackType === 'kick') ? -50 : -95;
            const r = (this.attackType === 'special') ? 45 : 28;
            const col = (this.attackType === 'special') ? CFG.COLS.P1_BELT : c.SUIT;

            ctx.globalAlpha = 0.7;
            // 충격파 원형
            const grd = ctx.createRadialGradient(ex, ey, r * 0.2, ex, ey, r);
            grd.addColorStop(0, '#fff');
            grd.addColorStop(0.4, col);
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;

            // 별 모양 라인
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex + Math.cos(angle) * r * 0.8, ey + Math.sin(angle) * r * 0.8);
                ctx.stroke();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  입력 처리
    // ═══════════════════════════════════════════════════════════
    const keys = {};
    function _initInputs() {
        window.addEventListener('keydown', e => {
            keys[e.key.toLowerCase()] = true;
            _handleKey(e.key.toLowerCase(), true);
        });
        window.addEventListener('keyup', e => {
            keys[e.key.toLowerCase()] = false;
        });

        const touchMap = {
            'btn-left': 'a', 'btn-right': 'd', 'btn-up': 'w',
            'btn-punch': 'j', 'btn-kick': 'k', 'btn-special': 'l'
        };
        Object.entries(touchMap).forEach(([id, key]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('pointerdown', () => { keys[key] = true; _handleKey(key, true); });
            btn.addEventListener('pointerup', () => { keys[key] = false; });
        });
    }

    function _handleKey(key, pressed) {
        if (!pressed || state !== 'playing') return;
        if (key === 'w') p1.jump();
        if (key === 'j') p1.attack('punch');
        if (key === 'k') p1.attack('kick');
        if (key === 'l') p1.attack('special');
    }

    function _updateInputs() {
        if (!p1 || p1.state === 'dead' || p1.state === 'hurt') return;
        p1.vx = 0;
        if (keys['a']) p1.vx = -p1.speed;
        if (keys['d']) p1.vx = p1.speed;
    }

    // ═══════════════════════════════════════════════════════════
    //  피격 이펙트
    // ═══════════════════════════════════════════════════════════
    function _spawnHitEffect(x, y, type) {
        const colors = type === 'special' ? ['#FFE000', '#FF8800', '#fff'] : ['#fff', '#FFaaaa', '#FFaa00'];
        hitEffects.push({ x, y, life: 30, maxLife: 30, colors, type });
    }

    function _drawHitEffects() {
        hitEffects = hitEffects.filter(e => e.life > 0);
        hitEffects.forEach(e => {
            const p = 1 - e.life / e.maxLife;
            const r = p * (e.type === 'special' ? 60 : 35);
            ctx.globalAlpha = e.life / e.maxLife;
            const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
            grd.addColorStop(0, '#fff');
            grd.addColorStop(0.5, e.colors[0]);
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            e.life--;
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  Fighter 클래스에 attack/jump 메서드 추가
    // ═══════════════════════════════════════════════════════════
    Fighter.prototype.jump = function() {
        if (this.isJumping) return;
        this.vy = this.jumpForce;
        this.isJumping = true;
        this.state = 'jumping';
    };

    Fighter.prototype.attack = function(type) {
        if (this.state === 'dead') return;
        this.state = 'attacking';
        this.attackType = type;
        this.attackFrame = (type === 'special') ? 25 : 18;

        let reach = (type === 'punch') ? 100 : (type === 'kick') ? 110 : 200;
        let damage = (type === 'punch') ? 6 : (type === 'kick') ? 10 : 18;

        if (type === 'special') {
            if (this.energy < 30) { this.state = 'idle'; this.attackFrame = 0; return; }
            this.energy -= 30;
        }

        const dir = this.facingRight ? 1 : -1;
        const reach_x = this.x + dir * reach / 2;
        const attackRect = {
            x: this.facingRight ? this.x : this.x - reach,
            y: this.y - this.height,
            w: reach, h: this.height
        };
        const opponent = this.side === 1 ? p2 : p1;
        if (opponent && _rectsOverlap(attackRect, {
            x: opponent.x - opponent.width/2, y: opponent.y - opponent.height,
            w: opponent.width, h: opponent.height
        })) {
            opponent.takeDamage(damage, type);
            _spawnHitEffect(opponent.x, opponent.y - opponent.height * 0.6, type);
        }
    };

    Fighter.prototype.takeDamage = function(dmg, type) {
        this.hp = Math.max(0, this.hp - dmg);
        this.state = 'hurt';
        this.hurtFlash = 12;
        this.vx = (this.side === 1 ? -3 : 3);  // 피격 넉백
        setTimeout(() => { if (this.hp > 0) this.state = 'idle'; }, 300);
        if (callbacks.onHealthChange) callbacks.onHealthChange(p1.hp, p2.hp);
    };

    function _rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // ═══════════════════════════════════════════════════════════
    //  배경 스테이지 렌더링
    // ═══════════════════════════════════════════════════════════
    function _drawBackground() {
        const W = CFG.WIDTH, H = CFG.HEIGHT, G = CFG.GROUND_Y;

        // 하늘 (오후 노을 그라디언트)
        const sky = ctx.createLinearGradient(0, 0, 0, G);
        sky.addColorStop(0, '#1a003a');
        sky.addColorStop(0.4, '#3d0066');
        sky.addColorStop(1, '#7a1fa0');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, G);

        // π 심볼 달
        ctx.fillStyle = '#FFE000';
        ctx.globalAlpha = 0.18;
        ctx.font = 'bold 80px serif';
        ctx.textAlign = 'center';
        ctx.fillText('π', W * 0.8, G * 0.3);
        ctx.globalAlpha = 1;

        // 관중석 (멀리)
        const crowdGrd = ctx.createLinearGradient(0, G-100, 0, G-20);
        crowdGrd.addColorStop(0, '#2a0044');
        crowdGrd.addColorStop(1, '#1a0030');
        ctx.fillStyle = crowdGrd;
        ctx.fillRect(0, G - 100, W, 100);

        // 관중 (점으로 표현)
        const seed = 42;
        ctx.save();
        const crowdColors = ['#FF4B6E','#00CED1','#FFE000','#aaffaa','#ffffff','#ff88aa'];
        for (let i = 0; i < 80; i++) {
            const px = (i / 80 * W + (i * 37 % 60) - 30) % W;
            const py = G - 90 + ((i * 13) % 65);
            const r = 5 + (i % 3);
            ctx.fillStyle = crowdColors[i % crowdColors.length];
            ctx.globalAlpha = 0.5 + (i % 4) * 0.1;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // 건물 실루엣 (좌우)
        ctx.fillStyle = '#1a0030';
        _drawBuilding(0, G - 40, 80, 140);
        _drawBuilding(60, G - 40, 70, 110);
        _drawBuilding(W - 80, G - 40, 80, 130);
        _drawBuilding(W - 140, G - 40, 60, 90);

        // 바닥
        const floorGrd = ctx.createLinearGradient(0, G, 0, H);
        floorGrd.addColorStop(0, '#4a1080');
        floorGrd.addColorStop(1, '#1a0030');
        ctx.fillStyle = floorGrd;
        ctx.fillRect(0, G, W, H - G);

        // 바닥 반사광
        ctx.strokeStyle = 'rgba(200,100,255,0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(i * (W / 7), G);
            ctx.lineTo(W / 2, H);
            ctx.stroke();
        }

        // 바닥 선
        ctx.strokeStyle = 'rgba(255,200,255,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, G);
        ctx.lineTo(W, G);
        ctx.stroke();

        // Pi Network 로고
        ctx.fillStyle = 'rgba(255,210,0,0.2)';
        ctx.font = 'bold 120px serif';
        ctx.textAlign = 'center';
        ctx.fillText('π', W / 2, G - 20);

        // 중앙 라인
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(W / 2, G - 80);
        ctx.lineTo(W / 2, G);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function _drawBuilding(x, y, w, h) {
        ctx.fillRect(x, y - h, w, h);
        // 창문
        ctx.fillStyle = 'rgba(255,220,150,0.3)';
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 3; col++) {
                if (Math.random() > 0.4) {
                    ctx.fillRect(x + 8 + col * 22, y - h + 15 + row * 25, 12, 14);
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  AI
    // ═══════════════════════════════════════════════════════════
    function _updateAI() {
        if (!p2 || p2.state === 'dead') return;
        const dist = p1.x - p2.x;
        const absDist = Math.abs(dist);

        if (p2.state === 'hurt') return;

        if (absDist > 160) {
            p2.vx = dist > 0 ? 3 : -3;
        } else if (absDist < 60) {
            p2.vx = dist > 0 ? -2 : 2; // 너무 가까우면 물러남
        } else {
            p2.vx = 0;
            const r = Math.random();
            if (r < 0.02) p2.attack('punch');
            else if (r < 0.035) p2.attack('kick');
            else if (r < 0.04 && p2.energy > 30) p2.attack('special');
        }

        // 랜덤 점프
        if (Math.random() < 0.005 && !p2.isJumping) p2.jump();
    }

    // ═══════════════════════════════════════════════════════════
    //  렌더링
    // ═══════════════════════════════════════════════════════════
    function _render() {
        ctx.clearRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
        _drawBackground();
        _drawHitEffects();

        if (p1) p1.draw();
        if (p2) p2.draw();
    }

    // ═══════════════════════════════════════════════════════════
    //  게임 루프
    // ═══════════════════════════════════════════════════════════
    function _update(dt) {
        animTick++;
        _updateInputs();
        if (p1) p1.update();
        if (p2) p2.update();

        // 에너지 자동 충전
        if (p1) p1.energy = Math.min(100, p1.energy + dt * 0.008);
        if (p2) p2.energy = Math.min(100, p2.energy + dt * 0.008);
        if (callbacks.onEnergyChange) callbacks.onEnergyChange(
            p1 ? p1.energy : 0,
            p2 ? p2.energy : 0
        );

        _updateAI();

        // 공격 프레임 업데이트
        if (p1 && p1.attackFrame > 0) {
            p1.attackFrame--;
            if (p1.attackFrame === 0 && p1.state === 'attacking') p1.state = 'idle';
        }
        if (p2 && p2.attackFrame > 0) {
            p2.attackFrame--;
            if (p2.attackFrame === 0 && p2.state === 'attacking') p2.state = 'idle';
        }

        // 타이머
        timerTick += dt;
        if (timerTick >= 1000) {
            matchTimer = Math.max(0, matchTimer - 1);
            timerTick = 0;
            const el = document.getElementById('match-timer');
            if (el) el.innerText = matchTimer;
        }

        // 게임 오버 판정
        if (p1 && p2 && (p1.hp <= 0 || p2.hp <= 0 || matchTimer <= 0)) {
            if (state === 'playing') {
                state = 'over';
                const winner = (p1.hp >= p2.hp) ? 1 : 2;
                if (callbacks.onGameOver) callbacks.onGameOver(winner);
            }
        }
    }

    function _loop(ts) {
        if (state !== 'playing') return;
        loopId = requestAnimationFrame(_loop);
        const rawDt = ts - lastTs;
        lastTs = ts;
        const dt = Math.min(rawDt, 50);
        _update(dt);
        _render();
    }

    // ═══════════════════════════════════════════════════════════
    //  공개 API
    // ═══════════════════════════════════════════════════════════
    function init(canvasEl, cbs) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        callbacks = cbs || {};
        canvas.width = CFG.WIDTH;
        canvas.height = CFG.HEIGHT;
        _initInputs();
        return { startGame };
    }

    function startGame() {
        const P1C = {
            SKIN: CFG.COLS.P1_SKIN, HAIR: CFG.COLS.P1_HAIR,
            SUIT: CFG.COLS.P1_SUIT, PANTS: CFG.COLS.P1_PANTS, BELT: CFG.COLS.P1_BELT
        };
        const P2C = {
            SKIN: CFG.COLS.P2_SKIN, HAIR: CFG.COLS.P2_HAIR,
            SUIT: CFG.COLS.P2_SUIT, PANTS: CFG.COLS.P2_PANTS, BELT: CFG.COLS.P2_BELT
        };
        hitEffects = [];
        animTick = 0;
        p1 = new Fighter(CFG.P1_START_X, CFG.START_Y, 1, P1C);
        p2 = new Fighter(CFG.P2_START_X, CFG.START_Y, -1, P2C);
        matchTimer = 99;
        timerTick = 0;
        state = 'playing';

        if (callbacks.onHealthChange) callbacks.onHealthChange(p1.hp, p2.hp);
        if (callbacks.onEnergyChange) callbacks.onEnergyChange(p1.energy, p2.energy);

        cancelAnimationFrame(loopId);
        lastTs = performance.now();
        loopId = requestAnimationFrame(_loop);
    }

    return { init, startGame };
})();
