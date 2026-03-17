/**
 * 게임 루프, 렌더링 엔진, 사용자 입력(터치/크로스플랫폼) 제어
 */
class Engine {
    constructor(canvasId, logic, ui) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.logic = logic;
        this.ui = ui;

        // 이미지 에셋 로드
        this.cardImage = new Image();
        this.cardImage.src = 'img/hwatu_sprite.png';
        
        // 크기 조정
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // 상태 머신
        this.state = 'MENU'; // MENU, PLAYING, GAME_OVER

        // 이벤트 바인딩
        this.bindEvents();

        // 렌더링 루프 바인딩
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        // flex: 1 인 main 영역의 실제 크기에 맞춤
        const container = this.canvas.parentElement;
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
    }

    bindEvents() {
        // 마우스 및 터치 통합 (포인터 이벤트)
        this.canvas.addEventListener('pointerup', (e) => {
            if (this.state !== 'PLAYING') return;

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.handlePointerUp(x, y);
        });
    }

    handlePointerUp(x, y) {
        if (this.state !== 'PLAYING' || this.logic.turn !== 'player') return;

        // 플레이어 패 크기 및 위치 계산
        const handW = 40;
        const handH = 65;
        const spacing = 2;
        const totalW = this.logic.playerHand.length * (handW + spacing);
        const startX = (this.width - totalW) / 2;
        const startY = this.height - handH - 30;

        for (let i = 0; i < this.logic.playerHand.length; i++) {
            const cardX = startX + i * (handW + spacing);
            // 클릭이 카드 영역 내에 있는지 검사(Hitbox)
            if (x >= cardX && x <= cardX + handW && y >= startY && y <= startY + handH) {
                this.playPlayerTurn(i);
                break;
            }
        }
    }

    playPlayerTurn(cardIndex) {
        this.logic.turn = 'processing';

        const result = this.logic.playCard(cardIndex, true);
        AudioEngine.sfxSnap();
        this.updateUIPostTurn(result, true);

        if (result.isGameEnd) {
            this.endGame();
            return;
        }

        // 1초 뒤 상대 턴 실행 (시각적 피드백을 위함)
        setTimeout(() => this.playOpponentTurn(), 1000);
    }

    playOpponentTurn() {
        if (this.state !== 'PLAYING') return;

        this.logic.turn = 'processing';

        // 가장 기초적인 AI: 남은 패 중 랜덤으로 한 장 냄
        const idx = Math.floor(Math.random() * this.logic.opponentHand.length);
        const result = this.logic.playCard(idx, false);
        AudioEngine.sfxSnap();

        this.updateUIPostTurn(result, false);

        if (result.isGameEnd) {
            this.endGame();
            return;
        }

        this.logic.turn = 'player';
    }

    updateUIPostTurn(result, isPlayer) {
        // 현재까지 점수 업데이트
        const myScore = this.logic.calculateScore(this.logic.playerCollected);
        const oppScore = this.logic.calculateScore(this.logic.opponentCollected);
        this.ui.updateScores(myScore, oppScore);

        // 고/스톱 판단 (베타 버전을 위한 심플한 로직: 3점 이상일 시 한 번만 노출)
        // 원래는 점수가 오를 때마다 물어봐야 함
        if (isPlayer && myScore >= 3 && !this.logic.goStopTriggered) {
            this.logic.goStopTriggered = true; // 중복 호출 방지
            this.logic.turn = 'decision';
            this.ui.showDecisionModal();
        }
    }

    endGame() {
        this.state = 'GAME_OVER';
        const myScore = this.logic.calculateScore(this.logic.playerCollected);
        const oppScore = this.logic.calculateScore(this.logic.opponentCollected);
        
        let reward = 0;
        if (myScore > oppScore) {
            reward = 0.001 + (myScore * 0.0001);
            PiIntegration.addPiReward(reward);
            this.ui.showMessage("🎊 승리하셨습니다! π 보상이 지급됩니다.");
        } else {
            this.ui.showMessage("게임 종료! 다시 도전해보세요.");
        }

        setTimeout(() => {
            this.ui.showGameOver(myScore, oppScore, PiIntegration.getSessionPi());
        }, 1500);
    }

    changeState(newState) {
        this.state = newState;
        if (newState === 'PLAYING') {
            AudioEngine.sfxShuffle();
            this.logic.deal();
            this.ui.hideMenu();
            this.ui.updateScores(0, 0);
            this.ui.showMessage("게임이 시작되었습니다!");
        }
    }

    // 메인 루프
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }

    update() {
        // 애니메이션 등 상태 업데이트 (카드 이동 중 틱 등)
        if (this.state === 'PLAYING') {
            // 로직 진행 상태 체크
        }
    }

    draw() {
        // 화면 클리어
        this.ctx.clearRect(0, 0, this.width, this.height);

        if (this.state === 'PLAYING') {
            this.drawBoard();
            this.drawHands();
            this.drawCollected();
        }
    }

    drawRect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);
    }

    drawHwatuCard(x, y, w, h, card, isHidden = false) {
        if (isHidden || !this.cardImage.complete || this.cardImage.naturalHeight === 0) {
            // 뒷면이거나 이미지가 안불러와진 경우 뒷면 그래픽으로 렌더링
            this.ctx.fillStyle = '#C42126';
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeStyle = '#a01015';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            for(let py = y + 5; py < y + h; py += 5) {
                this.ctx.moveTo(x, py);
                this.ctx.lineTo(x + w, py);
            }
            this.ctx.stroke();
            this.ctx.strokeStyle = '#000';
            this.ctx.strokeRect(x, y, w, h);
            return;
        }

        // 실제 화투 이미지 설정값 (2400x1200, 12열 4행 구조)
        const srcCardW = 200;   // 2400 / 12 = 200
        const srcCardH = 300;   // 1200 / 4 = 300
        const margin = 0;

        let srcX, srcY;

        // 앞면
        // HWATU_DECK 순서(1, 2, 3, 4번째 카드)를 추적하기 위해 card.id의 뒷자리를 사용
        // card.id 형태는 "1-1", "1-2", "1-3", "1-4"
        const idxStr = card.id.split('-')[1]; // "1", "2", "3", "4"
        let idx = parseInt(idxStr, 10) - 1; // 0, 1, 2, 3
        
        // 안전 장치
        if (isNaN(idx) || idx < 0 || idx > 3) idx = 0;

        const monthIdx = card.month - 1; // 0 ~ 11

        srcX = monthIdx * srcCardW;
        srcY = idx * srcCardH;

        // 이미지 그리기
        this.ctx.drawImage(this.cardImage, srcX, srcY, srcCardW, srcCardH, x, y, w, h);
    }

    drawBoard() {
        // 바닥에 깔린 패 렌더링
        this.logic.board.forEach((card, i) => {
            const cols = 5;
            const cardW = 60; // 기존 45에서 60으로 확대 (비율 160x255 약 1:1.59)
            const cardH = 95; // 기존 70에서 95로 확대

            const startX = (this.width - (cols * (cardW + 10))) / 2;
            const x = startX + (i % cols) * (cardW + 10);
            const y = this.height / 2 - 120 + Math.floor(i / cols) * (cardH + 10);

            this.drawHwatuCard(x, y, cardW, cardH, card, false);
        });
    }

    drawHands() {
        // 플레이어 패 (하단 중앙)
        const handW = 60;
        const handH = 95;
        const spacing = 5; // 패 간 공백 약간 넓힘
        const totalW = this.logic.playerHand.length * (handW + spacing);
        const startX = (this.width - totalW) / 2;

        this.logic.playerHand.forEach((card, i) => {
            const x = startX + i * (handW + spacing);
            const y = this.height - handH - 20;
            this.drawHwatuCard(x, y, handW, handH, card, false);
        });

        // 상대방 패 (상단, 뒷면)
        const oppStartX = (this.width - (this.logic.opponentHand.length * (handW + spacing))) / 2;
        this.logic.opponentHand.forEach((card, i) => {
            const x = oppStartX + i * (handW + spacing);
            const y = 40; // 상단 점수판 아래 약간 내림
            this.drawHwatuCard(x, y, handW, handH, null, true);
        });
    }

    drawCollected() {
        // 먹은 패 (우측에 간단히 표시)
        const cW = 20, cH = 30;
        let pTotal = this.logic.playerCollected.length;
        let oTotal = this.logic.opponentCollected.length;

        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Noto Sans KR';

        // 플레이어 먹은 패 개수 표시
        this.ctx.fillText(`획득: ${pTotal}장`, this.width - 80, this.height - 30);

        // 상대 먹은 패 개수 표시
        this.ctx.fillText(`획득: ${oTotal}장`, this.width - 80, 50);
    }
}
