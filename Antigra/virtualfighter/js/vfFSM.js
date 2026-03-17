/**
 * vfFSM.js — Pi Virtua Fighter 유한 상태 머신 (FSM)
 * 상태 관리, 프레임 데이터, 공격/가드 판정
 */

// ── 공격 프레임 데이터 테이블 ────────────────────────────────
// startup: 발생 프레임 (이 동안 무적 아님, 판정 없음)
// active:  판정 활성 프레임 (히트박스 존재)
// recovery:후딜레이 프레임 (이 동안 캔슬 불가)
// level:   'HIGH' | 'MID' | 'LOW'
// onHit:   히트 시 프레임 이득 (+= 플레이어 이득)
// onGuard: 가드 시 프레임 이득 (음수 = 수비측 플러스)
const MOVE_DATA = {
    // ── PIONEER (P1) 기술표 ──────────────────────────────────
    stand_punch:   { startup:6,  active:3, recovery:10, dmg:20, level:'HIGH', onHit:+5,  onGuard:-4, hitbox:'upper' },
    stand_kick:    { startup:10, active:4, recovery:14, dmg:28, level:'MID',  onHit:+3,  onGuard:-6, hitbox:'mid'   },
    low_punch:     { startup:8,  active:3, recovery:12, dmg:15, level:'LOW',  onHit:+2,  onGuard:-3, hitbox:'lower' },
    low_kick:      { startup:12, active:4, recovery:16, dmg:22, level:'LOW',  onHit:+4,  onGuard:-8, hitbox:'lower' },
    forward_punch: { startup:10, active:5, recovery:18, dmg:35, level:'HIGH', onHit:+8,  onGuard:-6, hitbox:'upper' },  // →+P
    forward_kick:  { startup:14, active:5, recovery:20, dmg:40, level:'MID',  onHit:+6,  onGuard:-10,hitbox:'mid'   },  // →+K
    back_punch:    { startup:14, active:4, recovery:22, dmg:30, level:'HIGH', onHit:+6,  onGuard:-8, hitbox:'upper' },  // ←+P
    jump_punch:    { startup:6,  active:6, recovery:8,  dmg:25, level:'HIGH', onHit:+4,  onGuard:-2, hitbox:'upper' },
    jump_kick:     { startup:8,  active:6, recovery:10, dmg:30, level:'MID',  onHit:+5,  onGuard:-4, hitbox:'mid'   },
    side_step:     { startup:4,  active:0, recovery:14, dmg:0,  level:'NONE', onHit:0,   onGuard:0,  hitbox:'none'  },  // →+G (회피기)
    // ── NODE RUNNER (P2 AI) 기술표 ───────────────────────────
    ai_punch:      { startup:8,  active:3, recovery:12, dmg:20, level:'HIGH', onHit:+5, onGuard:-4, hitbox:'upper' },
    ai_kick:       { startup:12, active:5, recovery:16, dmg:28, level:'MID',  onHit:+4, onGuard:-7, hitbox:'mid'   },
    ai_low_kick:   { startup:14, active:4, recovery:18, dmg:22, level:'LOW',  onHit:+3, onGuard:-8, hitbox:'lower' },
    ai_heavy:      { startup:18, active:6, recovery:24, dmg:40, level:'MID',  onHit:+8, onGuard:-12,hitbox:'mid'   },
};

// ── 가드 vs 공격 레벨 판정 테이블 ──────────────────────────
//  guard_type: 'stand' | 'crouch'
//  attack_level: 'HIGH' | 'MID' | 'LOW'
//  → true = 가드 성공, false = 피격
function canBlock(guardType, attackLevel) {
    if (attackLevel === 'NONE') return false; // 판정 없음 (사이드스텝 등)
    if (guardType === 'stand') {
        return attackLevel === 'HIGH' || attackLevel === 'MID'; // 하단은 서서 가드 불가
    }
    if (guardType === 'crouch') {
        return attackLevel === 'LOW'; // 중단은 앉아 가드 불가 (VF 핵심!)
    }
    return false;
}

// ── Fighter 상태 머신 ────────────────────────────────────────
class VFFighter {
    constructor(id, x, side) {
        this.id = id;       // 'p1' | 'p2'
        this.x = x;         // 발 중심 X
        this.y = 0;         // 발 Y (0 = 그라운드)
        this.vx = 0;
        this.vy = 0;
        this.side = side;   // 1=왼쪽(오른향), -1=오른쪽(왼향)
        this.facingRight = (side === 1);

        this.hp = 200;
        this.maxHp = 200;
        this.stunFrames = 0;    // 경직 프레임 잔량
        this.blockStunFrames = 0;

        // ── 상태 ────────────────────────────────────────────
        // 'idle' | 'walk_f' | 'walk_b' | 'crouch' | 'jump'
        // | 'side_step'
        // | 'attack_startup' | 'attack_active' | 'attack_recovery'
        // | 'block_stand' | 'block_crouch'
        // | 'hit_stun' | 'block_stun'
        // | 'dead' | 'win'
        this.state = 'idle';
        this.prevState = 'idle';

        // ── 현재 기술 프레임 관리 ────────────────────────────
        this.currentMove = null;    // MOVE_DATA 키
        this.moveData = null;       // 현재 기술의 프레임 데이터
        this.moveFrame = 0;         // 현재 기술에서 경과한 프레임
        this.hitConfirmed = false;  // 이미 히트한 경우 중복 방지

        // 히트박스 (렌더러에서 사용)
        this.hitbox  = null;  // 공격 판정: { x, y, w, h }
        this.hurtbox = null;  // 피격 판정: { x, y, w, h }

        // 물리
        this.GROUND_Y = 0;
        this.JUMP_FORCE = -14;
        this.GRAVITY = 0.6;
        this.SPEED = 3.5;
        this.W = 60;   // 바디 너비
        this.H = 130;  // 바디 높이

        // 연출용 피격 플래시
        this.hurtFlash = 0;

        // AI용 쿨다운
        this.aiCooldown = 0;
    }

    // ── 상태 전환 ────────────────────────────────────────────
    setState(next) {
        this.prevState = this.state;
        this.state = next;
    }

    // ── 공격 시작 ────────────────────────────────────────────
    startMove(moveName) {
        // 공격/경직 중에는 새 기술 불가 (단, 같은 기술도 불가)
        const blockStates = ['attack_startup','attack_active','attack_recovery','hit_stun','block_stun','dead'];
        if (blockStates.includes(this.state)) return false;

        const data = MOVE_DATA[moveName];
        if (!data) return false;

        this.currentMove = moveName;
        this.moveData = data;
        this.moveFrame = 0;
        this.hitConfirmed = false;
        this.hitbox = null;

        if (moveName === 'side_step') {
            this.setState('side_step');
        } else {
            this.setState('attack_startup');
        }
        return true;
    }

    // ── 가드 시작 ────────────────────────────────────────────
    startGuard(type) {
        if (['attack_startup','attack_active','attack_recovery','hit_stun','dead'].includes(this.state)) return;
        this.setState(type === 'crouch' ? 'block_crouch' : 'block_stand');
    }

    stopGuard() {
        if (this.state === 'block_stand' || this.state === 'block_crouch') {
            this.setState('idle');
        }
    }

    // ── 점프 ─────────────────────────────────────────────────
    jump() {
        if (this.y > this.GROUND_Y || this.state === 'jump') return;
        if (['attack_startup','attack_active','attack_recovery','hit_stun','dead'].includes(this.state)) return;
        this.vy = this.JUMP_FORCE;
        this.setState('jump');
    }

    // ── 앉기 ─────────────────────────────────────────────────
    crouch() {
        if (['attack_startup','attack_active','attack_recovery','hit_stun','dead','jump'].includes(this.state)) return;
        this.setState('crouch');
    }

    // ── 피격 처리 ────────────────────────────────────────────
    receiveHit(damage, level, isBlocked) {
        if (this.state === 'dead') return;

        if (isBlocked) {
            // 가드 성공: 블록 스턴
            this.blockStunFrames = 12;
            this.setState('block_stun');
        } else {
            // 피격: 히트 스턴
            this.hp = Math.max(0, this.hp - damage);
            this.stunFrames = 18 + Math.floor(damage / 5);
            this.hurtFlash = 10;
            this.setState('hit_stun');
            // 넉백
            this.vx = this.facingRight ? -3 : 3;
            if (this.y <= this.GROUND_Y) {
                this.vy = -4; // 약간 뜨는 효과
            }
            if (this.hp <= 0) {
                this.stunFrames = 9999;
                this.setState('dead');
            }
        }
    }

    // ── 프레임 업데이트 ──────────────────────────────────────
    update(input) {
        // 피격 플래시
        if (this.hurtFlash > 0) this.hurtFlash--;

        // AI 쿨다운
        if (this.aiCooldown > 0) this.aiCooldown--;

        // 피격/블록 스턴 처리
        if (this.state === 'hit_stun') {
            this.stunFrames--;
            if (this.stunFrames <= 0) this.setState('idle');
        }
        if (this.state === 'block_stun') {
            this.blockStunFrames--;
            if (this.blockStunFrames <= 0) {
                // 가드 키를 여전히 누르고 있으면 가드 유지
                if (input && (input.G)) {
                    const guardType = (input.down) ? 'block_crouch' : 'block_stand';
                    this.setState(guardType);
                } else {
                    this.setState('idle');
                }
            }
        }

        // 공격 프레임 FSM
        this._tickAttack();

        // 물리
        this._tickPhysics(input);

        // 히트/허트박스 갱신
        this._updateBoxes();
    }

    _tickAttack() {
        if (!this.moveData) return;
        this.moveFrame++;

        const md = this.moveData;

        if (this.state === 'attack_startup') {
            this.hitbox = null;
            if (this.moveFrame >= md.startup) {
                this.setState('attack_active');
                this.moveFrame = 0;
            }
        } else if (this.state === 'attack_active') {
            // 히트박스 활성
            this._setHitbox(md.hitbox);
            if (this.moveFrame >= md.active) {
                this.hitbox = null;
                this.setState('attack_recovery');
                this.moveFrame = 0;
            }
        } else if (this.state === 'attack_recovery') {
            this.hitbox = null;
            if (this.moveFrame >= md.recovery) {
                this.currentMove = null;
                this.moveData = null;
                this.moveFrame = 0;
                this.setState('idle');
            }
        } else if (this.state === 'side_step') {
            if (this.moveFrame >= md.startup + md.recovery) {
                this.currentMove = null;
                this.moveData = null;
                this.moveFrame = 0;
                this.setState('idle');
            }
        }
    }

    _setHitbox(zone) {
        const dir = this.facingRight ? 1 : -1;
        const bx = this.x - this.W / 2;
        const by = window._VF_GROUND_Y - this.H;
        if (zone === 'upper') {
            this.hitbox = { x: this.x + dir * (this.W * 0.5), y: by,            w: 55 * dir, h: 45 };
        } else if (zone === 'mid') {
            this.hitbox = { x: this.x + dir * (this.W * 0.5), y: by + 45,       w: 60 * dir, h: 45 };
        } else if (zone === 'lower') {
            this.hitbox = { x: this.x + dir * (this.W * 0.5), y: by + 88,       w: 65 * dir, h: 42 };
        } else {
            this.hitbox = null;
        }
    }

    _tickPhysics(input) {
        // 공격/스턴 시 이동 입력 무시 (단, 넉백 관성은 유지)
        const locked = ['attack_startup','attack_active','attack_recovery','hit_stun','block_stun','dead'].includes(this.state);

        if (!locked && input) {
            const speed = this.SPEED;

            // 상태별 이동
            if (this.state !== 'crouch' && this.state !== 'jump') {
                if (input.left  && !input.right) { this.vx = -speed; this.setState('walk_f'); }
                else if (input.right && !input.left) { this.vx = speed;  this.setState('walk_f'); }
                else { this.vx = 0; this.setState('idle'); }
            }
        }

        if (locked) {
            this.vx *= 0.75; // 넉백 감쇠
        }

        // 중력
        this.vy += this.GRAVITY;
        this.y = Math.min(this.y + this.vy, this.GROUND_Y);
        if (this.y >= this.GROUND_Y) {
            this.y = this.GROUND_Y;
            this.vy = 0;
            if (this.state === 'jump') this.setState('idle');
        }

        this.x += this.vx;
    }

    _updateBoxes() {
        const gY = window._VF_GROUND_Y || 320;
        const by = gY - this.H;
        const bx = this.x - this.W / 2;
        const crouching = (this.state === 'crouch' || this.state === 'block_crouch');
        const hh = crouching ? this.H * 0.6 : this.H;
        const hy = gY - hh;
        this.hurtbox = { x: bx, y: hy, w: this.W, h: hh };
    }

    // ── 상태 요약 (디버그 표시용) ────────────────────────────
    getDebugText() {
        const lines = [
            `State: ${this.state}`,
            `HP: ${this.hp}/${this.maxHp}`,
            `Move: ${this.currentMove || '—'}`,
            `MvF: ${this.moveFrame}`,
            `Stun: ${this.stunFrames}`,
        ];
        return lines.join('\n');
    }

    get guardType() {
        if (this.state === 'block_stand') return 'stand';
        if (this.state === 'block_crouch') return 'crouch';
        return null;
    }

    get isInvincible() {
        return this.state === 'side_step';
    }
}

// 외부 export
window.VFFighter = VFFighter;
window.MOVE_DATA = MOVE_DATA;
window.canBlock = canBlock;
