/**
 * Main Application Logic
 * Integrates Pi SDK, manages UI state, and handles Canvas rendering and input.
 */

const gameLogic = new MahjongLogic();

// --- Configuration ---
const config = {
    tileWidth: 44,       // Base width of a tile
    tileHeight: 60,      // Base height of a tile
    tileDepth: 6,        // 3D thickness
    colors: {
        tileBg: '#fffdf0',
        tileBorder: '#d4cbb3',
        tileSide: '#e8dcbd',
        tileBottomSide: '#c8b995',
        selected: '#fca311',
        blockedOverlay: 'rgba(0, 0, 0, 0.25)', // Darken unavailable tiles
        text: '#14213d'
    }
};

let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const screens = {
    menu: document.getElementById('start-overlay'),
    game: document.getElementById('game-ui'),
    popup: document.getElementById('popup-screen'),
    tutorial: document.getElementById('tutorial-screen')
};

const UI = {
    score: document.getElementById('score-display'),
    pairs: document.getElementById('pairs-display'),
    level: document.getElementById('level-display'),
    wins: document.getElementById('wins-display'),
    username: document.getElementById('username-display'),
    popupTitle: document.getElementById('popup-title'),
    popupContent: document.getElementById('popup-content'),
    msgOverlay: document.getElementById('message-overlay'),
    muteBtn: document.getElementById('btn-mute')
};

// State
let gameState = 'menu'; // menu, playing, paused, gameover
let score = 0;
let combo = 0;
let lastMatchTime = 0;
let autoMatchUses = 2;
let wins = 0;
let level = 1;

// Pi Integration
let piUser = null;

const PiIntegration = {
    onIncompletePaymentFound: function(payment) {
        console.log("Incomplete payment found:", payment);
        // Handle incomplete payments here
    },

    init: async function() {
        try {
            if (typeof window.Pi !== 'undefined') {
                Pi.init({ version: "2.0", sandbox: true });
                
                const scopes = ['username', 'payments'];
                const authResults = await Pi.authenticate(scopes, PiIntegration.onIncompletePaymentFound);
                
                piUser = authResults.user;
                UI.username.textContent = `Welcome, @${piUser.username}`;
                console.log("Pi init success:", piUser);
            } else {
                UI.username.textContent = 'Development Mode (No Pi SDK)';
                console.warn("Pi SDK not found. Running in dev mode.");
            }
        } catch (err) {
            console.error("Pi Authentication failed:", err);
            UI.username.textContent = 'Pi Network connection failed';
        }
    }
};


// --- Game Flow ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
}

function startGame() {
    AudioEngine.init(); AudioEngine.resume();
    gameLogic.init();
    score = 0;
    combo = 0;
    autoMatchUses = 2;
    document.getElementById('auto-count').textContent = `${autoMatchUses}/2`;
    gameState = 'playing';
    
    updateHeaderStats();
    resizeCanvas(); // calculate scale
    showScreen('game');
    
    requestAnimationFrame(gameLoop);
}

function pauseGame() {
    gameState = 'paused';
    UI.popupTitle.textContent = 'PAUSED';
    UI.popupContent.innerHTML = `<p>Current Score: ${score}</p><p>Pairs Removed: ${gameLogic.pairsRemoved} / ${gameLogic.totalPairs}</p>`;
    showScreen('popup');
}

function resumeGame() {
    gameState = 'playing';
    showScreen('game');
    requestAnimationFrame(gameLoop);
}

function quitGame() {
    gameState = 'menu';
    wins = 0;
    level = 1;
    showScreen('menu');
}

function showGameOver(isWin) {
    gameState = 'gameover';
    
    if(isWin) {
        wins++;
        level++;
        updateHeaderStats();
    }
    
    UI.popupTitle.textContent = isWin ? 'YOU WIN!' : 'NO MORE MOVES';
    let msg = isWin ? 'Excellent job clearing the board.' : 'No available pairs remaining.';
    UI.popupContent.innerHTML = `
        <h3 style="color:var(--primary-color); font-size:2rem;">SCORE: ${score}</h3>
        <p>LEVEL: ${level} | WINS: ${wins}</p>
        <p>${msg}</p>
    `;
    // Hide resume button
    document.getElementById('btn-resume').style.display = 'none';
    showScreen('popup');
}

function updateHeaderStats() {
    UI.score.textContent = score;
    UI.pairs.textContent = `${gameLogic.pairsRemoved} / ${gameLogic.totalPairs}`;
    UI.level.textContent = level;
    UI.wins.textContent = wins;
}

function showMessage(text) {
    UI.msgOverlay.textContent = text;
    UI.msgOverlay.classList.remove('hidden');
    setTimeout(() => {
        UI.msgOverlay.classList.add('hidden');
    }, 1500);
}

// --- Input Handling ---
canvas.addEventListener('pointerdown', (e) => {
    if (gameState !== 'playing') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Reverse hit test: top layers to bottom layers
    const sortedTiles = [...gameLogic.layout]
        .filter(t => t.state !== 'removed')
        .sort((a, b) => b.z - a.z || b.logicalY - a.logicalY || b.logicalX - a.logicalX);

    for (let spot of sortedTiles) {
        // Tile position on canvas
        const tx = offsetX + spot.logicalX * (config.tileWidth / 2) * scale - spot.z * config.tileDepth * scale;
        const ty = offsetY + spot.logicalY * (config.tileHeight / 2) * scale - spot.z * config.tileDepth * scale;
        
        const tw = config.tileWidth * scale;
        const th = config.tileHeight * scale;

        if (x >= tx && x <= tx + tw && y >= ty && y <= ty + th) {
            AudioEngine.sfxClick();
            handleTileClick(spot);
            break;
        }
    }
});

function handleTileClick(spot) {
    if (!gameLogic.isTileFree(spot)) {
        // Shake animation could go here
        return;
    }

    const { success, match, deselect, switch: switchSelection, pair, isGameOver, hasMoves } = gameLogic.selectTile(spot.id);
    
    if (match) {
        AudioEngine.sfxMatch();
        // Calculate combo
        let now = Date.now();
        if (now - lastMatchTime < 3000) {
            combo++;
        } else {
            combo = 1;
        }
        lastMatchTime = now;
        
        let pts = 10 * combo;
        
        if (pair && pair[0].tile.matchKey === 'dot-1') {
            pts += 50;
            showMessage(`🎉 Pi LOGO BONUS! +${pts} 🎉`);
        } else if (combo > 1) {
            showMessage(`${combo}x COMBO! +${pts}`);
        }
        
        score += pts;
        
        updateHeaderStats();
        
        if (isGameOver) {
            setTimeout(() => showGameOver(true), 500);
        } else if (!hasMoves) {
            setTimeout(() => showGameOver(false), 500);
        }
    }
}

// --- Payments ---
async function requestPayment(amount, memo, onSuccess) {
    if (typeof window.Pi === 'undefined') {
        // Dev mode bypass
        console.log(`[DEV MODE] Mock Payment of ${amount} Pi for: ${memo}`);
        onSuccess();
        return;
    }

    try {
        const paymentData = {
            amount: amount,
            memo: memo,
            metadata: { type: memo } // optional context
        };
        
        const callbacks = {
            onReadyForServerApproval: (paymentId) => {
                console.log("Ready for server approval:", paymentId);
                // Here backend should approve payment. Mocking for client-only prototype:
                // Actually Pi SDK Sandbox might auto-approve or require a dev backend.
                // Assuming client-side bypass for prototype if no backend provided:
                // NOTE: Production requires backend to call /approve API
            },
            onReadyForServerCompletion: (paymentId, txid) => {
                console.log("Ready for completion:", paymentId, txid);
                // Production requires backend to call /complete API
            },
            onCancel: (paymentId) => {
                console.log("Payment cancelled:", paymentId);
                alert("Payment cancelled.");
            },
            onError: (error, payment) => {
                console.error("Payment error:", error);
                alert("An error occurred during payment.");
            }
        };

        const payment = await Pi.createPayment(paymentData, callbacks);
        // If successful flow completes (Sandbox testing mode might need manual handling without backend)
        
        // Mock success until backend is connected
        onSuccess();
        
    } catch (e) {
        console.error("Payment request failed:", e);
    }
}

document.getElementById('btn-auto').addEventListener('click', () => {
    if (gameState !== 'playing') return;
    if (autoMatchUses <= 0) {
        showMessage("자동 맞춤 기회를 모두 사용했습니다!");
        return;
    }

    let hintPair = gameLogic.getHint();
    if (hintPair) {
        autoMatchUses--;
        document.getElementById('auto-count').textContent = `${autoMatchUses}/2`;
        
        // 첫 번째 패 선택
        handleTileClick(hintPair[0]);
        
        // 시각적 효과를 위해 0.3초(300ms) 후 두 번째 패 선택하여 짝 맞춤 완료
        setTimeout(() => {
            handleTileClick(hintPair[1]);
            showMessage(`자동 맞춤! (잔여: ${autoMatchUses}회)`);
        }, 300);
    } else {
        alert("현재 맞출 수 있는 짝이 없습니다! 모양을 섞어보세요.");
    }
});

document.getElementById('btn-hint').addEventListener('click', () => {
    requestPayment(1, "Hint Use", () => {
        let hintPair = gameLogic.getHint();
        if (hintPair) {
            hintPair[0].state = 'selected';
            hintPair[1].state = 'selected';
            setTimeout(() => {
                if (hintPair[0].state === 'selected') hintPair[0].state = 'normal';
                if (hintPair[1].state === 'selected') hintPair[1].state = 'normal';
            }, 1000);
            showMessage("HINT USED: -1 Pi");
        } else {
            alert("No more moves available! Use Shuffle.");
        }
    });
});

document.getElementById('btn-shuffle').addEventListener('click', () => {
    requestPayment(2, "Board Shuffle", () => {
        gameLogic.shuffleRemaining();
        showMessage("BOARD SHUFFLED: -2 Pi");
        
        if (!gameLogic.checkAvailableMoves()) {
            setTimeout(() => showGameOver(false), 1000);
        }
    });
});

// --- Rendering ---
function resizeCanvas() {
    const container = document.getElementById('canvas-area');
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    // Compute scale
    const logicW = gameLogic.boardWidth * (config.tileWidth / 2);
    const logicH = gameLogic.boardHeight * (config.tileHeight / 2);
    
    const availW = container.clientWidth * 0.95;
    const availH = container.clientHeight * 0.95;
    
    const scaleX = availW / logicW;
    const scaleY = availH / logicH;
    
    scale = Math.min(scaleX, scaleY, 1.8); 
    
    offsetX = (container.clientWidth - (logicW * scale)) / 2;
    offsetY = (container.clientHeight - (logicH * scale)) / 2;
}

window.addEventListener('resize', () => {
    if (gameState === 'playing' || gameState === 'paused') {
        resizeCanvas();
    }
});

function drawMahjongFace(ctx, t, x, y, w, h, scale, state) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    
    ctx.save();
    
    // Determine colors
    const piOrange = '#fca311';
    const darkNavy = '#14213d';
    const darkRed = '#c0392b';
    const forestGreen = '#27ae60';
    
    let isSel = (state === 'selected');
    let colorPrimary = isSel ? '#fff' : darkNavy;
    let colorSecondary = isSel ? '#f0f0f0' : piOrange;
    let colorAccent = isSel ? '#e0e0e0' : forestGreen;
    let colorRed = isSel ? '#fff' : darkRed;

    const drawDot = (dx, dy, r, col) => {
        ctx.beginPath();
        ctx.arc(cx + dx * scale, cy + dy * scale, r * scale, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 1 * scale;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    };
    
    const drawPiLogo = (dx, dy, size, col) => {
        ctx.fillStyle = col;
        ctx.font = `bold ${size * scale}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('π', cx + dx * scale, cy + dy * scale + 2*scale);
    };

    const drawBamboo = (dx, dy, blockW, blockH, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        let bw = blockW * scale;
        let bh = blockH * scale;
        let bx = cx + dx * scale - bw/2;
        let by = cy + dy * scale - bh/2;
        ctx.roundRect(bx, by, bw, bh, 2 * scale);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillRect(bx + bw*0.2, by + bh/2 - 0.5*scale, bw*0.6, 1*scale);
    };

    if (t.type === 'suit') {
        if (t.suit === 'dot') {
            const rad = 5;
            if (t.value === 1) {
                // 1 Dot = Big Pi Coin
                drawDot(0, 0, 16, colorSecondary);
                drawPiLogo(0, 0, 24, '#fff');
            } else if (t.value === 2) {
                drawDot(0, -10, rad, colorAccent); drawDot(0, 10, rad, colorAccent);
            } else if (t.value === 3) {
                drawDot(-8, -10, rad, colorPrimary); drawDot(0, 0, rad, colorRed); drawDot(8, 10, rad, colorAccent);
            } else if (t.value === 4) {
                drawDot(-8, -10, rad, colorPrimary); drawDot(8, -10, rad, colorAccent);
                drawDot(-8, 10, rad, colorAccent); drawDot(8, 10, rad, colorPrimary);
            } else if (t.value === 5) {
                drawDot(-8, -12, rad, colorPrimary); drawDot(8, -12, rad, colorAccent);
                drawDot(0, 0, rad, colorRed);
                drawDot(-8, 12, rad, colorAccent); drawDot(8, 12, rad, colorPrimary);
            } else if (t.value === 6) {
                drawDot(-8, -12, rad, colorAccent); drawDot(8, -12, rad, colorAccent);
                drawDot(-8, 0, rad, colorRed); drawDot(8, 0, rad, colorRed);
                drawDot(-8, 12, rad, colorPrimary); drawDot(8, 12, rad, colorPrimary);
            } else if (t.value === 7) {
                drawDot(-10, -14, rad, colorRed); drawDot(0, -10, rad, colorRed); drawDot(10, -6, rad, colorRed);
                drawDot(-8, 6, rad, colorPrimary); drawDot(8, 6, rad, colorPrimary);
                drawDot(-8, 16, rad, colorPrimary); drawDot(8, 16, rad, colorPrimary);
            } else if (t.value === 8) {
                drawDot(-8, -15, rad, colorPrimary); drawDot(8, -15, rad, colorPrimary);
                drawDot(-8, -5, rad, colorPrimary); drawDot(8, -5, rad, colorPrimary);
                drawDot(-8, 5, rad, colorPrimary); drawDot(8, 5, rad, colorPrimary);
                drawDot(-8, 15, rad, colorPrimary); drawDot(8, 15, rad, colorPrimary);
            } else if (t.value === 9) {
                drawDot(-10, -12, rad, colorPrimary); drawDot(0, -12, rad, colorPrimary); drawDot(10, -12, rad, colorPrimary);
                drawDot(-10, 0, rad, colorRed); drawDot(0, 0, rad, colorRed); drawDot(10, 0, rad, colorRed);
                drawDot(-10, 12, rad, colorPrimary); drawDot(0, 12, rad, colorPrimary); drawDot(10, 12, rad, colorPrimary);
            }
        } 
        else if (t.suit === 'bamboo') {
            const bw = 4, bh = 14;
            if (t.value === 1) {
                // 1 Bamboo = Fractal / Bird
                ctx.fillStyle = colorRed;
                ctx.font = `bold ${26 * scale}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🦚', cx, cy); // Simple bird representation
            } else if (t.value === 2) {
                drawBamboo(0, -10, bw, bh, colorPrimary); drawBamboo(0, 10, bw, bh, colorAccent);
            } else if (t.value === 3) {
                drawBamboo(0, -10, bw, bh, colorPrimary); drawBamboo(-8, 10, bw, bh, colorAccent); drawBamboo(8, 10, bw, bh, colorAccent);
            } else if (t.value === 4) {
                drawBamboo(-8, -10, bw, bh, colorAccent); drawBamboo(8, -10, bw, bh, colorPrimary);
                drawBamboo(-8, 10, bw, bh, colorPrimary); drawBamboo(8, 10, bw, bh, colorAccent);
            } else if (t.value === 5) {
                drawBamboo(-10, -10, bw, bh, colorAccent); drawBamboo(10, -10, bw, bh, colorPrimary);
                drawBamboo(0, 0, bw, bh, colorRed);
                drawBamboo(-10, 10, bw, bh, colorPrimary); drawBamboo(10, 10, bw, bh, colorAccent);
            } else if (t.value === 6) {
                drawBamboo(-8, -12, bw, bh, colorAccent); drawBamboo(0, -12, bw, bh, colorAccent); drawBamboo(8, -12, bw, bh, colorAccent);
                drawBamboo(-8, 12, bw, bh, colorPrimary); drawBamboo(0, 12, bw, bh, colorPrimary); drawBamboo(8, 12, bw, bh, colorPrimary);
            } else if (t.value === 7) {
                drawBamboo(0, -14, bw, bh, colorRed);
                drawBamboo(-8, 0, bw, bh, colorAccent); drawBamboo(0, 0, bw, bh, colorAccent); drawBamboo(8, 0, bw, bh, colorAccent);
                drawBamboo(-8, 14, bw, bh, colorPrimary); drawBamboo(0, 14, bw, bh, colorPrimary); drawBamboo(8, 14, bw, bh, colorPrimary);
            } else if (t.value === 8) {
                drawBamboo(-10, -10, bw, bh, colorAccent); drawBamboo(10, -10, bw, bh, colorAccent);
                drawBamboo(-4, -6, bw, bh, colorPrimary); drawBamboo(4, -6, bw, bh, colorPrimary);
                drawBamboo(-10, 10, bw, bh, colorAccent); drawBamboo(10, 10, bw, bh, colorAccent);
                drawBamboo(-4, 6, bw, bh, colorPrimary); drawBamboo(4, 6, bw, bh, colorPrimary);
            } else if (t.value === 9) {
                drawBamboo(-10, -14, bw, bh, colorRed); drawBamboo(0, -14, bw, bh, colorRed); drawBamboo(10, -14, bw, bh, colorRed);
                drawBamboo(-10, 0, bw, bh, colorAccent); drawBamboo(0, 0, bw, bh, colorAccent); drawBamboo(10, 0, bw, bh, colorAccent);
                drawBamboo(-10, 14, bw, bh, colorPrimary); drawBamboo(0, 14, bw, bh, colorPrimary); drawBamboo(10, 14, bw, bh, colorPrimary);
            }
        }
        else if (t.suit === 'character') {
            const charMap = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
            ctx.fillStyle = colorPrimary;
            ctx.font = `bold ${18 * scale}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(charMap[t.value - 1], cx, cy - 8 * scale);
            
            ctx.fillStyle = colorRed;
            ctx.font = `bold ${18 * scale}px serif`;
            ctx.fillText('萬', cx, cy + 10 * scale);
        }
    } 
    else if (t.type === 'wind' || t.type === 'dragon') {
        let symbol = '';
        let color = colorPrimary;
        
        if (t.type === 'wind') {
            const windMap = { 'east': '東', 'south': '南', 'west': '西', 'north': '北' };
            symbol = windMap[t.value];
            color = colorPrimary;
        } else if (t.type === 'dragon') {
            if (t.value === 'red') { symbol = '中'; color = colorRed; }
            if (t.value === 'green') { symbol = '發'; color = colorAccent; }
            if (t.value === 'white') {
                ctx.lineWidth = 3 * scale;
                ctx.strokeStyle = colorPrimary; // Blue box
                if(isSel) ctx.strokeStyle = '#fff';
                ctx.strokeRect(cx - 10*scale, cy - 14*scale, 20*scale, 28*scale);
            }
        }
        
        if (symbol) {
            ctx.fillStyle = color;
            ctx.font = `bold ${26 * scale}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(symbol, cx, cy + 2*scale);
        }
    }
    else if (t.type === 'flower' || t.type === 'season') {
        let iconMapFlower = ['🌸','🪷','🌺','🌻'];
        let iconMapSeason = ['🌱','☀️','🍁','❄️'];
        let charMapFlower = ['梅','蘭','菊','竹'];
        let charMapSeason = ['春','夏','秋','冬'];
        
        let isFlower = t.type === 'flower';
        
        // Emoji
        ctx.fillStyle = isSel ? '#fff' : '#333';
        ctx.font = `${18 * scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isFlower ? iconMapFlower[t.value-1] : iconMapSeason[t.value-1], cx, cy - 8 * scale);
        
        // Character
        ctx.fillStyle = isSel ? '#fff' : (isFlower ? colorRed : colorAccent);
        ctx.font = `bold ${14 * scale}px serif`;
        ctx.fillText(isFlower ? charMapFlower[t.value-1] : charMapSeason[t.value-1], cx, cy + 12 * scale);
    }

    ctx.restore();
}

function drawTile(ctx, spot) {
    const x = offsetX + spot.logicalX * (config.tileWidth / 2) * scale - spot.z * config.tileDepth * scale;
    const y = offsetY + spot.logicalY * (config.tileHeight / 2) * scale - spot.z * config.tileDepth * scale;
    
    const w = config.tileWidth * scale;
    const h = config.tileHeight * scale;
    const d = config.tileDepth * scale;
    
    const r = 4 * scale; // border radius

    // Shadow Layer (Side / Bottom)
    ctx.fillStyle = config.colors.tileSide;
    ctx.beginPath();
    ctx.roundRect(x + d, y + d, w, h, r);
    ctx.fill();

    // Main Face
    ctx.fillStyle = spot.state === 'selected' ? config.colors.selected : config.colors.tileBg;
    
    // If not free, draw slightly darker overlay to help players see layers
    if (!gameLogic.isTileFree(spot) && spot.state !== 'selected') {
        ctx.fillStyle = '#eaddcd'; // Darker base for covered/blocked tiles
    }

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.lineWidth = 1 * scale;
    ctx.strokeStyle = config.colors.tileBorder;
    ctx.stroke();

    // Render Complex Graphical Face
    const t = spot.tile;
    if (t) {
        drawMahjongFace(ctx, t, x, y, w, h, scale, spot.state);
    }
    
    // Draw blocked overlay explicitly if needed
    if (!gameLogic.isTileFree(spot)) {
        ctx.fillStyle = config.colors.blockedOverlay;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
    }
}

function gameLoop() {
    if (gameState !== 'playing') return;

    // Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw layout from bottom to top (Z order), then Y order, then X order
    const sortedTiles = [...gameLogic.layout]
        .filter(s => s.state !== 'removed')
        .sort((a, b) => a.z - b.z || a.logicalY - b.logicalY || a.logicalX - b.logicalX);

    for (let spot of sortedTiles) {
        drawTile(ctx, spot);
    }

    requestAnimationFrame(gameLoop);
}

// --- Init Event Listeners ---
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-pause').addEventListener('click', pauseGame);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart').addEventListener('click', () => {
    // Reset buttons and start again
    document.getElementById('btn-resume').style.display = 'block';
    startGame();
});
document.getElementById('btn-quit').addEventListener('click', () => {
    document.getElementById('btn-resume').style.display = 'block';
    quitGame();
});

document.getElementById('btn-tutorial').addEventListener('click', () => {
    showScreen('tutorial');
});

document.getElementById('btn-close-tutorial').addEventListener('click', () => {
    showScreen('menu');
});

UI.muteBtn.addEventListener('click', () => {
    const enabled = AudioEngine.isEnabled();
    AudioEngine.setEnabled(!enabled);
    if (!enabled) {
        AudioEngine.resume();
        UI.muteBtn.textContent = '🔊';
    } else {
        UI.muteBtn.textContent = '🔇';
    }
});

// Run Init
window.onload = () => {
    PiIntegration.init();
};
