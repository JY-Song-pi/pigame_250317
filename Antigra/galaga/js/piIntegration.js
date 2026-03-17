/**
 * piIntegration.js — Pi Network SDK 연동 모듈
 * π Galaga 게임의 Pi 인증 & 결제 파이프라인
 */

const PiIntegration = (() => {
    let _initialized = false;
    let _currentUser = null;
    let _sessionPiEarned = 0;

    function _sdkAvailable() {
        return typeof Pi !== 'undefined';
    }

    // ── 초기화 ────────────────────────────────────────────
    function init() {
        if (!_sdkAvailable()) {
            console.warn('[Pi] SDK 없음 — Pi Browser 환경이 아닙니다.');
            return;
        }
        try {
            // Galaga 전용 초기화
            Pi.init({ version: '2.0', sandbox: true });
            _initialized = true;
            console.log('[Pi] Galaga SDK 초기화 완료');
        } catch (e) {
            console.error('[Pi] 초기화 오류:', e);
        }
    }

    // ── 로그인 ────────────────────────────────────────────
    async function authenticate() {
        if (!_sdkAvailable() || !_initialized) return null;
        try {
            const auth = await Pi.authenticate(
                ['username', 'payments'],
                _onIncompletePayment
            );
            _currentUser = auth.user;
            console.log('[Pi] 파일럿 로그인 성공:', _currentUser.username);
            return _currentUser;
        } catch (e) {
            console.warn('[Pi] 인증 실패:', e);
            return null;
        }
    }

    function _onIncompletePayment(payment) {
        console.log('[Pi] 미완료 결제 건 확인:', payment.identifier);
    }

    // ── 보상 결제 (미션 성공 시) ──────────────────────────
    async function claimReward(piAmount, onSuccess) {
        if (!_sdkAvailable() || !_initialized) {
            alert('Pi Browser에서만 보상을 수령할 수 있습니다.');
            return;
        }
        const amount = Math.max(0.001, parseFloat(piAmount.toFixed(3)));
        const memo = `π GALAGA 미션 달성 보상: ${amount}π`;

        try {
            await Pi.createPayment({
                amount,
                memo,
                metadata: {
                    game: 'pi-galaga',
                    user: _currentUser?.username ?? 'guest',
                    session: Date.now(),
                }
            }, {
                onReadyForServerApproval(paymentId) {
                    console.log('[Pi] 미션 승인 대기:', paymentId);
                },
                onReadyForServerCompletion(paymentId, txid) {
                    console.log('[Pi] 보상 지급 완료:', txid);
                    _sessionPiEarned = 0;
                    if (typeof onSuccess === 'function') onSuccess(txid);
                },
                onCancel(paymentId) {
                    console.log('[Pi] 지급 취소:', paymentId);
                },
                onError(error, payment) {
                    console.error('[Pi] 보상 오류:', error);
                }
            });
        } catch (e) {
            console.error('[Pi] 결제 파이프라인 오류:', e);
        }
    }

    // ── π 보상 실시간 누적 (게임 중 π 기체 격파 시) ──────────
    function addPiReward(amount) {
        _sessionPiEarned = parseFloat((_sessionPiEarned + amount).toFixed(4));
        return _sessionPiEarned;
    }

    function resetSessionPi() { _sessionPiEarned = 0; }
    function getCurrentUser() { return _currentUser; }
    function getSessionPi() { return _sessionPiEarned; }
    function isLoggedIn() { return _currentUser !== null; }

    return { init, authenticate, claimReward, addPiReward, resetSessionPi, getCurrentUser, getSessionPi, isLoggedIn };
})();
