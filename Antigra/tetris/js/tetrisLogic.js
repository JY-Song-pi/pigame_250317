/**
 * Core Tetris Engine Logic (No DOM dependencies)
 */

const COLS = 10;
const ROWS = 20;

const SHAPES = [
    [],
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I (1)
    [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // J (2)
    [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // L (3)
    [[4, 4], [4, 4]], // O (4)
    [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // S (5)
    [[0, 6, 0], [6, 6, 6], [0, 0, 0]], // T (6)
    [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // Z (7)
];

const COLORS = [
    'none',      // 0
    '#A855F7',   // 1 Vivid Purple (I)
    '#6B3FA0',   // 2 Deep Pi Purple (J)
    '#F5A623',   // 3 Pi Gold (L)
    '#FFCC55',   // 4 Light Gold (O)
    '#C084FC',   // 5 Lavender (S)
    '#E879F9',   // 6 Magenta-Purple (T)
    '#FDBA74'    // 7 Amber-Orange (Z)
];

class TetrisEngine {
    constructor() {
        this.board = this.getEmptyBoard();
        this.piece = null;
        this.nextPiece = null;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAME_OVER
        this.dropInterval = 1000;
        this.callbacks = {};
    }

    on(event, callback) {
        this.callbacks[event] = callback;
    }

    trigger(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event](data);
        }
    }

    getEmptyBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    randomPiece() {
        const typeId = Math.floor(Math.random() * 7) + 1; // 1 to 7
        return {
            shape: SHAPES[typeId],
            colorId: typeId,
            x: typeId === 4 ? 4 : 3, // O shape is 2x2, others 3x3 or 4x4
            y: 0
        };
    }

    reset() {
        this.board = this.getEmptyBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.updateDropInterval();
        this.nextPiece = this.randomPiece();
        this.spawnPiece();
    }

    start() {
        this.reset();
        this.state = 'PLAYING';
    }

    pause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
        }
    }

    spawnPiece() {
        this.piece = this.nextPiece;
        this.nextPiece = this.randomPiece();
        this.trigger('nextPiece', this.nextPiece);
        // Game Over condition
        if (this.collides()) {
            this.state = 'GAME_OVER';
            this.trigger('gameOver', { score: this.score });
        }
    }

    move(dx, dy) {
        if (this.state !== 'PLAYING') return false;

        this.piece.x += dx;
        this.piece.y += dy;

        if (this.collides()) {
            this.piece.x -= dx;
            this.piece.y -= dy;

            if (dy > 0) {
                this.lockPiece();
            }
            return false;
        }
        
        if (dx !== 0) this.trigger('move');
        if (dy > 0) this.trigger('drop');
        return true;
    }

    rotate() {
        if (this.state !== 'PLAYING') return;

        const p = this.piece.shape;
        // Transpose the matrix
        const pLen = p.length;
        let pNew = Array.from({ length: pLen }, () => new Array(pLen).fill(0));

        for (let y = 0; y < pLen; ++y) {
            for (let x = 0; x < pLen; ++x) {
                pNew[x][y] = p[y][x];
            }
        }

        // Reverse rows
        for (let y = 0; y < pLen; ++y) {
            pNew[y].reverse();
        }

        const oldShape = this.piece.shape;
        this.piece.shape = pNew;

        // Basic wall kick (push left/right if against wall)
        if (this.collides()) {
            this.piece.x++; // try right
            if (this.collides()) {
                this.piece.x -= 2; // try left
                if (this.collides()) {
                    this.piece.x++; // reset
                    this.piece.shape = oldShape; // revert
                } else {
                    this.trigger('rotate');
                }
            } else {
                this.trigger('rotate');
            }
        } else {
            this.trigger('rotate');
        }
    }

    hardDrop() {
        if (this.state !== 'PLAYING') return;
        while (this.move(0, 1)) {
            this.score += 2; // bonus points for hard drop
        }
        this.trigger('scoreUpdate', this.score);
    }

    collides() {
        const { shape, x, y } = this.piece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] !== 0) {
                    const absX = x + c;
                    const absY = y + r;
                    // Wall collision
                    if (absX < 0 || absX >= COLS || absY >= ROWS) {
                        return true;
                    }
                    // Board collision (if piece is above board (y<0), allow it but don't check board index)
                    if (absY >= 0 && this.board[absY][absX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    lockPiece() {
        const { shape, x, y, colorId } = this.piece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] !== 0) {
                    const absY = y + r;
                    if (absY >= 0) {
                        this.board[absY][x + c] = colorId;
                    }
                }
            }
        }

        this.clearLines();
        this.spawnPiece();
    }

    clearLines() {
        let linesCleared = 0;
        outer: for (let r = ROWS - 1; r >= 0; r--) {
            for (let c = 0; c < COLS; c++) {
                if (this.board[r][c] === 0) {
                    continue outer; // not purely filled
                }
            }
            // Remove row
            const row = this.board.splice(r, 1)[0].fill(0);
            this.board.unshift(row);
            r++; // Check the same row number again (since everything shifted down)
            linesCleared++;
        }

        if (linesCleared > 0) {
            // Scoring System (Standard BPS)
            const linePoints = [0, 100, 300, 500, 800];
            this.score += linePoints[linesCleared] * this.level;
            this.lines += linesCleared;

            // Level up every 10 lines
            if (this.lines >= this.level * 10) {
                this.level++;
                this.updateDropInterval();
            }

            this.trigger('scoreUpdate', this.score);
            this.trigger('linesUpdate', this.lines);
            this.trigger('levelUpdate', this.level);
            this.trigger('line');
        }
    }

    updateDropInterval() {
        // Speed up as level increases
        this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
    }
}

window.TetrisEngine = TetrisEngine;
window.COLORS = COLORS;
window.ROWS = ROWS;
window.COLS = COLS;
