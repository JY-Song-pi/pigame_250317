/**
 * VirtualJoystick - A simple touch-based joystick for mobile games
 */
class VirtualJoystick {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            size: options.size || 100,
            stickSize: options.stickSize || 50,
            color: options.color || 'rgba(128, 128, 128, 0.5)',
            handleColor: options.handleColor || 'rgba(255, 255, 255, 0.8)',
            ...options
        };

        this.base = null;
        this.stick = null;
        this.touchId = null;
        this.active = false;

        // Output values (-1 to 1)
        this.deltaX = 0;
        this.deltaY = 0;

        this._init();
    }

    _init() {
        this.container.style.position = 'relative';
        this.container.style.width = `${this.options.size}px`;
        this.container.style.height = `${this.options.size}px`;

        // Base
        this.base = document.createElement('div');
        this.base.className = 'joystick-base';
        this.base.style.width = '100%';
        this.base.style.height = '100%';
        this.base.style.borderRadius = '50%';
        this.base.style.position = 'absolute';
        this.base.style.top = '0';
        this.base.style.left = '0';
        this.container.appendChild(this.base);

        // Stick
        this.stick = document.createElement('div');
        this.stick.className = 'joystick-stick';
        this.stick.style.width = `${this.options.stickSize}px`;
        this.stick.style.height = `${this.options.stickSize}px`;
        this.stick.style.borderRadius = '50%';
        this.stick.style.position = 'absolute';
        this.stick.style.top = '50%';
        this.stick.style.left = '50%';
        this.stick.style.transform = 'translate(-50%, -50%)';
        this.container.appendChild(this.stick);

        // Events
        const handleStart = (e) => this._onStart(e);
        const handleMove = (e) => this._onMove(e);
        const handleEnd = (e) => this._onEnd(e);

        this.container.addEventListener('touchstart', handleStart, { passive: false });
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd, { passive: false });
        window.addEventListener('touchcancel', handleEnd, { passive: false });

        this.container.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
    }

    _onStart(e) {
        if (this.active) return;
        this.active = true;
        
        const touch = e.touches ? e.touches[0] : e;
        if (e.touches) this.touchId = touch.identifier;
        
        this._moveStick(touch.clientX, touch.clientY);
        if (e.cancelable) e.preventDefault();
    }

    _onMove(e) {
        if (!this.active) return;
        
        let touch = null;
        if (e.touches) {
            for (let t of e.touches) {
                if (t.identifier === this.touchId) { touch = t; break; }
            }
        } else {
            touch = e;
        }

        if (touch) {
            this._moveStick(touch.clientX, touch.clientY);
            if (e.cancelable) e.preventDefault();
        }
    }

    _onEnd(e) {
        if (!this.active) return;
        
        if (e.touches) {
            let stillTouching = false;
            for (let t of e.touches) {
                if (t.identifier === this.touchId) { stillTouching = true; break; }
            }
            if (!stillTouching) {
                this._reset();
            }
        } else {
            this._reset();
        }
    }

    _moveStick(clientX, clientY) {
        const rect = this.base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = this.options.size / 2;

        if (distance > maxDistance) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * maxDistance;
            dy = Math.sin(angle) * maxDistance;
        }

        this.stick.style.left = `${50 + (dx / rect.width) * 100}%`;
        this.stick.style.top = `${50 + (dy / rect.height) * 100}%`;

        this.deltaX = dx / maxDistance;
        this.deltaY = dy / maxDistance;
    }

    _reset() {
        this.active = false;
        this.touchId = null;
        this.deltaX = 0;
        this.deltaY = 0;
        this.stick.style.left = '50%';
        this.stick.style.top = '50%';
    }
}

window.VirtualJoystick = VirtualJoystick;
