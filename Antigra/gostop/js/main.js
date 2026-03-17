/**
 * 메인 엔트리 포인트 - 의존성 주입 및 게임 초기화
 */
window.onload = () => {
    console.log("Initializing Go-Stop Game...");

    // 1. 도메인 로직 초기화
    const logic = new GostopLogic();

    // 2. UI 컴포넌트 초기화
    const ui = new UI();

    // 3. 렌더링 및 입력 엔진 초기화
    const engine = new Engine('gameCanvas', logic, ui);

    // 4. 이벤트 바인딩 (UI -> Engine)
    ui.onStartGame = () => {
        engine.changeState('PLAYING');
    };
    ui.onRestart = () => {
        ui.hideGameOver();
        engine.changeState('PLAYING');
    };
    ui.onGo = () => {
        setTimeout(() => engine.playOpponentTurn(), 500);
    };
    ui.onStop = () => {
        engine.endGame();
    };

    // 5. 파이 네트워크 SDK 초기화
    PiIntegration.init();
    const btnLogin = document.getElementById('btnPiAuth');
    const userInfoEl = document.getElementById('user-info');

    btnLogin.addEventListener('click', async () => {
        const user = await PiIntegration.authenticate();
        if (user) {
            btnLogin.style.display = 'none';
            userInfoEl.textContent = `반갑습니다, ${user.username}님! 🎴`;
        }
    });

    // 초기화 완료, 메뉴 상태 표출
    console.log("Ready!");
};
