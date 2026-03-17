/**
 * piIntegration.js — Pi Network SDK 연동 모듈
 * π Snake 게임의 Pi 인증 & 결제 파이프라인
 */

const PiIntegration = (() => {
    // ── 내부 상태 ──────────────────────────────────────────
    let _initialized  = false;
    let _currentUser  = null;     // { uid, username }
    let _accessToken  = null;

    // 세션 동안 누적한 Pi 보상 (서버 승인 후 실제 지급)
    let _sessionPiEarned = 0;

    // Pi SDK가 로드됐는지 확인
    function _sdkAvailable() {
        return typeof Pi !== 'undefined';
    }

    // ── 초기화 ────────────────────────────────────────────
    function init() {
        if (!_sdkAvailable()) {
            console.warn('[Pi] SDK를 불러올 수 없습니다. (Pi Browser 환경이 아님)');
            return;
        }
        try {
            Pi.init({ version: '2.0', sandbox: true });
            _initialized = true;
            console.log('[Pi] SDK 초기화 완료 (sandbox mode)');
        } catch (e) {
            console.error('[Pi] 초기화 오류:', e);
        }
    }

    // ── 로그인 / 인증 ─────────────────────────────────────
    async function authenticate() {
        if (!_sdkAvailable() || !_initialized) {
            console.warn('[Pi] SDK 미초기화 상태입니다.');
            return null;
        }
        try {
            const authResult = await Pi.authenticate(
                ['username', 'payments'],
                _onIncompletePaymentFound
            );
            _currentUser = authResult.user;
            _accessToken = authResult.accessToken;
            console.log('[Pi] 로그인 성공:', _currentUser.username);
            return _currentUser;
        } catch (e) {
            console.warn('[Pi] 로그인 취소 또는 오류:', e);
            return null;
        }
    }

    // ── 미완료 결제 처리 콜백 ────────────────────────────
    function _onIncompletePaymentFound(payment) {
        console.log('[Pi] 미완료 결제 발견:', payment.identifier);
        // 실제 서비스에서는 백엔드로 전달하여 처리
        // Pi.payments.complete(payment.identifier)
    }

    // ── 보상 결제 생성 (acquire) ──────────────────────────
    /**
     * 게임 종료 후 π 보상을 Pi 결제로 전환
     * @param {number} piAmount - 지급할 Pi 수량
     * @param {function} onSuccess - 결제 성공 콜백
     */
    async function claimReward(piAmount, onSuccess) {
        if (!_sdkAvailable() || !_initialized) {
            console.warn('[Pi] SDK 미초기화 — 보상을 지급할 수 없습니다.');
            alert('Pi Browser에서 실행해야 보상을 받을 수 있습니다.');
            return;
        }

        const amount = Math.max(0.001, parseFloat(piAmount.toFixed(3)));
        const memo   = `π SNAKE 게임 보상: ${amount}π`;

        try {
            await Pi.createPayment({
                amount,
                memo,
                metadata: {
                    game:    'pi-snake',
                    user:    _currentUser?.username ?? 'guest',
                    session: Date.now(),
                }
            }, {
                // 결제 준비 완료 → 서버 승인 요청
                onReadyForServerApproval(paymentId) {
                    console.log('[Pi] 서버 승인 대기:', paymentId);
                    // 실제 서비스: POST /api/pi/approve { paymentId }
                    // 여기서는 개발용으로 바로 complete 호출
                    // Pi.currentPayment.complete(paymentId);
                },

                // 서버 완료 처리
                onReadyForServerCompletion(paymentId, txid) {
                    console.log('[Pi] 결제 완료 — txid:', txid);
                    // 실제 서비스: POST /api/pi/complete { paymentId, txid }
                    _sessionPiEarned = 0; // 세션 초기화
                    if (typeof onSuccess === 'function') onSuccess(txid);
                },

                // 결제 취소
                onCancel(paymentId) {
                    console.log('[Pi] 결제 취소:', paymentId);
                },

                // 결제 오류
                onError(error, payment) {
                    console.error('[Pi] 결제 오류:', error, payment);
                    alert('결제 중 오류가 발생했습니다: ' + error.message);
                }
            });
        } catch (e) {
            console.error('[Pi] createPayment 오류:', e);
        }
    }

    // ── π 보상 누적 ───────────────────────────────────────
    function addPiReward(amount) {
        _sessionPiEarned = parseFloat((_sessionPiEarned + amount).toFixed(4));
        return _sessionPiEarned;
    }

    function resetSessionPi() {
        _sessionPiEarned = 0;
    }

    // ── Getter ────────────────────────────────────────────
    function getCurrentUser()    { return _currentUser; }
    function getSessionPi()      { return _sessionPiEarned; }
    function isLoggedIn()        { return _currentUser !== null; }

    // ── 공개 API ─────────────────────────────────────────
    return {
        init,
        authenticate,
        claimReward,
        addPiReward,
        resetSessionPi,
        getCurrentUser,
        getSessionPi,
        isLoggedIn,
    };
})();
