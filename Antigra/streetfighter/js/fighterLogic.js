/**
 * Pi Fighter — Core Game Logic
 */

const FighterGame = (() => {
    'use strict';

    // Settings
    const CFG = {
        WIDTH: 800,
        HEIGHT: 400,
        GRAVITY: 0.6,
        FRICTION: 0.8,
        P1_START_P: { x: 150, y: 200 },
        P2_START_P: { x: 600, y: 200 },
        GROUND_Y: 350,
        COLORS: {
            P1: '#FF4B6E',
            P2: '#00CED1',
            PI_COIN: '#FFE000',
        },
        MAX_HP: 100
    };

    let canvas, ctx;
    let state = 'idle';
    let loopId = null;
    let lastTs = 0;
    
    let p1, p2;
    let matchTimer = 99;
    let timerTick = 0;

    let callbacks = {};

    // ── Fighter Class ─────────────────────────────────────────
    class Fighter {
        constructor(x, y, color, side) {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.width = 60;
            this.height = 120;
            this.color = color;
            this.side = side; // 1: Left, -1: Right
            this.hp = CFG.MAX_HP;
            this.state = 'idle'; // idle, walking, jumping, attacking, hurt, dead
            this.isJumping = false;
            this.attackFrame = 0;
            this.energy = 0;
            
            // Stats
            this.speed = 5;
            this.jumpForce = -15;
            this.attackDamage = 5;
        }

        update() {
            // Apply Physics
            this.vy += CFG.GRAVITY;
            this.x += this.vx;
            this.y += this.vy;

            // Ground Collision
            if (this.y + this.height > CFG.GROUND_Y) {
                this.y = CFG.GROUND_Y - this.height;
                this.vy = 0;
                this.isJumping = false;
            }

            // Screen Bounds
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > CFG.WIDTH) this.x = CFG.WIDTH - this.width;

            // State management for animations
            if (this.hp <= 0) this.state = 'dead';
        }

        draw() {
            ctx.save();
            
            // Draw shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width/2, CFG.GROUND_Y, 30, 8, 0, 0, Math.PI*2);
            ctx.fill();

            // Body
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Prototype "Fighting Stance"
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // Head
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 10, this.y - 25, 40, 40);

            // Attack visualization
            if (this.state === 'attacking') {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                const attackX = this.side === 1 ? this.x + this.width : this.x - 40;
                ctx.fillRect(attackX, this.y + 20, 40, 20);
            }

            ctx.restore();
        }

        jump() {
            if (this.isJumping) return;
            this.vy = this.jumpForce;
            this.isJumping = true;
        }

        attack(type) {
            if (this.state !== 'idle' && this.state !== 'walking' && !this.isJumping) return;
            
            const prevMove = this.vx;
            this.state = 'attacking';
            this.attackType = type || 'punch';
            this.attackFrame = 15; 
            
            // Special: Pi Blast (Projectile simplified for now as a long hitbox)
            let reach = 60;
            let damage = 5;
            let yOffset = 40;
            
            if (type === 'kick') { reach = 80; damage = 8; yOffset = 80; }
            if (type === 'special') { 
                if (this.energy < 30 && this.side === 1) return; // Need energy
                reach = 200; damage = 15; yOffset = 40; 
                if (this.side === 1) this.energy -= 30;
            }

            const attackRect = {
                x: this.side === 1 ? this.x + this.width : this.x - reach,
                y: this.y + yOffset,
                w: reach,
                h: 20
            };

            const opponent = this.side === 1 ? p2 : p1;
            if (this.checkCollision(attackRect, opponent)) {
                opponent.takeDamage(damage);
                // Energy gain on hit
                this.energy = Math.min(100, this.energy + 10);
                if (callbacks.onEnergyChange) callbacks.onEnergyChange(p1.energy, p2.energy);
            }
        }

        checkCollision(rect, target) {
            return rect.x < target.x + target.width &&
                   rect.x + rect.w > target.x &&
                   rect.y < target.y + target.height &&
                   rect.y + rect.h > target.y;
        }

        takeDamage(dmg) {
            this.hp -= dmg;
            if (this.hp < 0) this.hp = 0;
            this.state = 'hurt';
            
            // Pop effect
            setTimeout(() => { if (this.hp > 0) this.state = 'idle'; }, 200);
            
            if (callbacks.onHealthChange) callbacks.onHealthChange(p1.hp, p2.hp);
        }
    }

    // ── Input Handling ─────────────────────────────────────
    const keys = {};
    function _initInputs() {
        window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; _handleKey(e.key.toLowerCase(), true); });
        window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; _handleKey(e.key.toLowerCase(), false); });
        
        // Touch buttons
        const touchBtns = {
            'btn-left': 'a', 'btn-right': 'd', 'btn-up': 'w', 'btn-down': 's',
            'btn-punch': 'j', 'btn-kick': 'k', 'btn-special': 'l'
        };
        Object.entries(touchBtns).forEach(([id, key]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('pointerdown', () => { keys[key] = true; _handleKey(key, true); });
            btn.addEventListener('pointerup', () => { keys[key] = false; _handleKey(key, false); });
        });
    }

    function _handleKey(key, isPressed) {
        if (state !== 'playing') return;
        if (isPressed) {
            if (key === 'w') p1.jump();
            if (key === 'j') p1.attack('punch');
            if (key === 'k') p1.attack('kick');
            if (key === 'l') p1.attack('special');
        }
    }

    function _updateInputs() {
        if (p1.state === 'dead' || p1.state === 'hurt') return;
        p1.vx = 0;
        if (keys['a']) p1.vx = -p1.speed;
        if (keys['d']) p1.vx = p1.speed;
    }

    // ── Game APIs ─────────────────────────────────────────────
    function init(canvasEl, cbs) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        callbacks = cbs || {};

        canvas.width = CFG.WIDTH;
        canvas.height = CFG.HEIGHT;

        _initInputs();
        _initMatch();
        return { startGame };
    }

    function _initMatch() {
        p1 = new Fighter(CFG.P1_START_P.x, CFG.P1_START_P.y, CFG.COLORS.P1, 1);
        p2 = new Fighter(CFG.P2_START_P.x, CFG.P2_START_P.y, CFG.COLORS.P2, -1);
        matchTimer = 99;
        state = 'playing';
        timerTick = 0;
    }

    function startGame() {
        _initMatch();
        lastTs = performance.now();
        loopId = requestAnimationFrame(_loop);
    }

    function _loop(ts) {
        if (state !== 'playing') return;
        loopId = requestAnimationFrame(_loop);
        const dt = ts - lastTs;
        lastTs = ts;

        _update(dt);
        _render();
    }

    function _update(dt) {
        _updateInputs();
        p1.update();
        p2.update();

        // Passive energy gain
        p1.energy = Math.min(100, p1.energy + dt * 0.01);
        p2.energy = Math.min(100, p2.energy + dt * 0.01);
        if (callbacks.onEnergyChange) callbacks.onEnergyChange(p1.energy, p2.energy);

        // Simple CPU AI
        _updateAI();

        // Update attack frames
        if (p1.attackFrame > 0) p1.attackFrame--;
        else if (p1.state === 'attacking') p1.state = 'idle';
        
        if (p2.attackFrame > 0) p2.attackFrame--;
        else if (p2.state === 'attacking') p2.state = 'idle';

        // Timer
        timerTick += dt;
        if (timerTick >= 1000) {
            matchTimer--;
            timerTick = 0;
            const timerEl = document.getElementById('match-timer');
            if (timerEl) timerEl.innerText = matchTimer;
        }

        if (p1.hp <= 0 || p2.hp <= 0 || matchTimer <= 0) {
            state = 'over';
            const winner = p1.hp > p2.hp ? 1 : 2;
            if (callbacks.onGameOver) callbacks.onGameOver(winner);
        }
    }

    function _updateAI() {
        // Very basic AI for p2
        const dist = Math.abs(p2.x - p1.x);
        if (dist > 100) {
            p2.vx = (p1.x < p2.x) ? -2 : 2;
        } else {
            p2.vx = 0;
            if (Math.random() < 0.05) p2.attack();
        }
    }

    function _render() {
        ctx.clearRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
        
        // Ground line
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(0, CFG.GROUND_Y);
        ctx.lineTo(CFG.WIDTH, CFG.GROUND_Y);
        ctx.stroke();

        p1.draw();
        p2.draw();
    }

    function setInputs(player, action) {
        // To be implemented for actual controls
    }

    return { init, startGame };
})();
