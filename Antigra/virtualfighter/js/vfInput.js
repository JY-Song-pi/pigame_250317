/**
 * vfInput.js — Pi Virtua Fighter 3버튼 입력 시스템
 * P (Punch) / K (Kick) / G (Guard) + 방향키 + 콤보 인식
 */

const VFInput = (() => {
    'use strict';

    // ── 현재 누른 키 상태 ─────────────────────────────────────
    const held = {
        up: false, down: false, left: false, right: false,
        P: false, K: false, G: false
    };

    // ── 입력 버퍼 (프레임 기반 콤보 인식용) ──────────────────
    // 각 이벤트: { type: 'direction'|'button', value, frame }
    const BUFFER_WINDOW = 16; // 16프레임 안에 입력된 것들을 콤보로 인식
    let frameCount = 0;
    const inputBuffer = [];

    // ── 키보드 매핑 ──────────────────────────────────────────
    const KEY_MAP = {
        'w': 'up',    'arrowup': 'up',
        's': 'down',  'arrowdown': 'down',
        'a': 'left',  'arrowleft': 'left',
        'd': 'right', 'arrowright': 'right',
        'j': 'P',
        'k': 'K',
        'l': 'G',
    };

    // ── 콤보 정의 (방향 + 버튼 순서로 매칭) ──────────────────
    // { seq: ['right', 'P'], name: 'sobat' }
    const COMBO_TABLE = [
        { seq: ['right', 'P'], name: 'forward_punch' },
        { seq: ['left', 'P'],  name: 'back_punch'    },
        { seq: ['down', 'K'],  name: 'low_kick'      },
        { seq: ['down', 'P'],  name: 'low_punch'     },
        { seq: ['up',   'P'],  name: 'jump_punch'    },
        { seq: ['up',   'K'],  name: 'jump_kick'     },
        { seq: ['right', 'K'], name: 'forward_kick'  },
        { seq: ['right', 'G'], name: 'side_step'     },
    ];

    // ── 이벤트 리스너 등록 ──────────────────────────────────
    function init() {
        window.addEventListener('keydown', _onKeyDown);
        window.addEventListener('keyup', _onKeyUp);
        _initMobileButtons();
    }

    function _onKeyDown(e) {
        const mapped = KEY_MAP[e.key.toLowerCase()];
        if (!mapped) return;
        e.preventDefault();
        if (held[mapped]) return; // Key repeat 방지
        held[mapped] = true;
        _pushBuffer(mapped);
    }

    function _onKeyUp(e) {
        const mapped = KEY_MAP[e.key.toLowerCase()];
        if (mapped) { held[mapped] = false; }
    }

    function _initMobileButtons() {
        const btnMap = {
            'm-up': 'up', 'm-down': 'down',
            'm-left': 'left', 'm-right': 'right',
            'm-punch': 'P', 'm-kick': 'K', 'm-guard': 'G'
        };
        Object.entries(btnMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('pointerdown', () => { held[key] = true; _pushBuffer(key); });
            el.addEventListener('pointerup', () => { held[key] = false; });
            el.addEventListener('pointerleave', () => { held[key] = false; });
        });
    }

    // ── 버퍼 쓰기 ────────────────────────────────────────────
    function _pushBuffer(input) {
        inputBuffer.push({ value: input, frame: frameCount });
        // 오래된 항목 제거
        const cutoff = frameCount - BUFFER_WINDOW;
        while (inputBuffer.length && inputBuffer[0].frame < cutoff) inputBuffer.shift();
    }

    // ── 프레임 틱 (게임 루프에서 매 프레임 호출) ──────────────
    function tick() {
        frameCount++;
        // 오래된 버퍼 정리
        const cutoff = frameCount - BUFFER_WINDOW;
        while (inputBuffer.length && inputBuffer[0].frame < cutoff) inputBuffer.shift();
    }

    // ── 콤보 감지 및 소비 ────────────────────────────────────
    // 현재 버퍼에서 정의된 콤보 시퀀스를 찾으면 소비하고 이름을 반환
    function consumeCombo() {
        const recentValues = inputBuffer.map(e => e.value);
        for (const combo of COMBO_TABLE) {
            const seq = combo.seq;
            // 버퍼 끝에서 seq를 역순으로 탐색
            if (_bufferEndsWith(recentValues, seq)) {
                // 소비 (마지막 seq.length 항목 제거)
                inputBuffer.splice(inputBuffer.length - seq.length, seq.length);
                return combo.name;
            }
        }
        return null;
    }

    function _bufferEndsWith(buf, seq) {
        if (buf.length < seq.length) return false;
        const start = buf.length - seq.length;
        for (let i = 0; i < seq.length; i++) {
            if (buf[start + i] !== seq[i]) return false;
        }
        return true;
    }

    // ── 단일 버튼 소비 (콤보 없는 단독 입력) ─────────────────
    function consumeButton(btn) {
        const idx = inputBuffer.findIndex(e => e.value === btn);
        if (idx !== -1) { inputBuffer.splice(idx, 1); return true; }
        return false;
    }

    // ── 외부 조회용 ──────────────────────────────────────────
    function isHeld(key) { return !!held[key]; }
    function getHeld() { return { ...held }; }
    function getBuffer() { return [...inputBuffer]; }

    return { init, tick, isHeld, getHeld, consumeCombo, consumeButton };
})();
