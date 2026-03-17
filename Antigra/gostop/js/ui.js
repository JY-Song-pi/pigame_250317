/**
 * DOM 기반 UI 조작 및 파이 네트워크 SDK 연동 제어
 */
class UI {
    constructor() {
        this.myScoreEl = document.getElementById('myScore');
        this.oppScoreEl = document.getElementById('oppScore');
        this.messageBox = document.getElementById('messageBox');

        this.startOverlay = document.getElementById('start-overlay');
        this.decisionModal = document.getElementById('decisionModal');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        
        this.btnStartGame = document.getElementById('btnStartGame');
        this.btnPiAuth = document.getElementById('btnPiAuth');
        this.btnGo = document.getElementById('btnGo');
        this.btnStop = document.getElementById('btnStop');
        this.btnRestart = document.getElementById('btn-restart');
        this.btnMute = document.getElementById('btn-mute');

        this.onStartGame = null;
        this.onGo = null;
        this.onStop = null;
        this.onRestart = null;

        this.bindEvents();
    }

    bindEvents() {
        this.btnStartGame.addEventListener('click', () => {
            AudioEngine.init(); AudioEngine.resume();
            if (this.onStartGame) this.onStartGame();
        });

        this.btnRestart.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });

        this.btnPiAuth.addEventListener('click', () => {
            this.authenticatePi();
        });

        this.btnGo.addEventListener('click', () => {
            this.hideDecisionModal();
            this.showMessage("고!");
            AudioEngine.sfxWin();
            if (this.onGo) this.onGo();
        });

        this.btnStop.addEventListener('click', () => {
            this.hideDecisionModal();
            this.showMessage("스톱! 승리");
            AudioEngine.sfxWin();
            if (this.onStop) this.onStop();
        });

        this.btnMute.addEventListener('click', () => {
            const enabled = AudioEngine.isEnabled();
            AudioEngine.setEnabled(!enabled);
            if (!enabled) {
                AudioEngine.resume();
                this.btnMute.textContent = '🔊';
            } else {
                this.btnMute.textContent = '🔇';
            }
        });
    }

    updateScores(myScore, oppScore) {
        this.myScoreEl.textContent = myScore;
        this.oppScoreEl.textContent = oppScore;
    }

    showMessage(msg) {
        this.messageBox.textContent = msg;
        this.messageBox.classList.remove('hidden');

        // 애니메이션 재시작 트릭
        this.messageBox.style.animation = 'none';
        this.messageBox.offsetHeight; /* trigger reflow */
        this.messageBox.style.animation = null;

        // 2초 뒤 숨김 처리는 css animation으로 진행하나 보장용 timeout
        setTimeout(() => {
            if (this.messageBox && !this.messageBox.classList.contains('hidden')) {
                this.messageBox.classList.add('hidden');
            }
        }, 2000);
    }

    hideMenu() {
        this.startOverlay.classList.remove('active');
    }

    showMenu() {
        this.startOverlay.classList.add('active');
    }

    showDecisionModal() {
        this.decisionModal.classList.add('active');
    }

    hideDecisionModal() {
        this.decisionModal.classList.remove('active');
    }

    showGameOver(myScore, oppScore, pi) {
        document.getElementById('final-my-score').textContent = myScore;
        document.getElementById('final-opp-score').textContent = oppScore;
        document.getElementById('final-pi').textContent = `${pi.toFixed(4)} π`;
        this.gameOverOverlay.classList.add('active');
    }

    hideGameOver() {
        this.gameOverOverlay.classList.remove('active');
    }

    // Pi SDK Mock 연동
    authenticatePi() {
        try {
            if (typeof Pi !== 'undefined') {
                Pi.authenticate(['username', 'payments'], this.onIncompletePaymentFound)
                    .then(auth => {
                        alert(`환영합니다, ${auth.user.username}님!`);
                        this.btnPiAuth.textContent = '인증 완료';
                        this.btnPiAuth.disabled = true;
                    }).catch(err => {
                        console.error("Pi Auth Error:", err);
                        alert("파이 네트워크 연동에 실패했습니다.");
                    });
            } else {
                alert("Pi Browser 환경에서 실행해주세요. (현재는 Mock 환경입니다)");
            }
        } catch (e) {
            console.error(e);
        }
    }

    onIncompletePaymentFound(payment) {
        console.log("미완료 결제 징후:", payment);
        // SDK 결제 파이프라인 처리
    }
}
