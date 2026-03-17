/**
 * π SAJU — 메인 컨트롤러 & Pi SDK 결제 연동
 */

const App = (() => {
    let piUser = null;
    let currentSaju = null;

    const UI = {
        inputSection: document.getElementById('input-section'),
        resultSection: document.getElementById('result-section'),
        sajuTable: document.getElementById('saju-table'),
        descToday: document.getElementById('desc-today'),
        username: document.getElementById('username-display'),
        premiumBox: document.querySelector('.report-box.premium')
    };

    const PiIntegration = {
        init: async function() {
            try {
                if (typeof window.Pi !== 'undefined') {
                    Pi.init({ version: "2.0", sandbox: true });
                    const scopes = ['username', 'payments'];
                    const authResults = await Pi.authenticate(scopes, (p) => console.log("Payment found:", p));
                    piUser = authResults.user;
                    UI.username.textContent = piUser.username;
                }
            } catch (e) { console.warn("Pi Auth failed", e); }
        },
        requestPayment: async function(onSuccess) {
            if (typeof window.Pi === 'undefined') { 
                alert("[Dev Mode] 결제 성공!"); onSuccess(); return; 
            }
            try {
                const payment = await Pi.createPayment({
                    amount: 1,
                    memo: "π SAJU - 프리미엄 상세 분석 리포트",
                    metadata: { type: "saju_report" }
                }, {
                    onReadyForServerApproval: (id) => console.log("Approval required:", id),
                    onReadyForServerCompletion: (id, tx) => { console.log("Complete:", id); onSuccess(); },
                    onCancel: (id) => alert("결제가 취소되었습니다."),
                    onError: (e) => alert("결제 중 오류가 발생했습니다.")
                });
            } catch (err) { console.error(err); }
        }
    };

    function bindEvents() {
        document.getElementById('btn-analyze').addEventListener('click', () => {
            AudioEngine.init(); AudioEngine.resume();
            runAnalysis();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            UI.resultSection.classList.add('hidden');
            UI.inputSection.classList.remove('hidden');
        });

        document.getElementById('btn-pay-pi').addEventListener('click', () => {
            PiIntegration.requestPayment(() => {
                UI.premiumBox.classList.remove('locked');
                UI.premiumBox.querySelector('.lock-overlay').style.display = 'none';
                UI.premiumBox.querySelector('.blurred-text').classList.remove('blurred-text');
            });
        });

        // 양력/음력 토글
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    function runAnalysis() {
        const name = document.getElementById('input-name').value || "사용자";
        const dateVal = document.getElementById('input-date').value;
        const timeIdx = parseInt(document.getElementById('input-time').value);
        
        if (!dateVal) { alert("날짜를 선택해주세요."); return; }
        
        const [y, m, d] = dateVal.split('-').map(Number);
        const saju = SajuLogic.getSaju(y, m, d, timeIdx, false);
        currentSaju = saju;

        displayResult(name, saju);
        
        UI.inputSection.classList.add('hidden');
        UI.resultSection.classList.remove('hidden');
    }

    function displayResult(name, saju) {
        document.getElementById('user-manifesto').textContent = `${name}님의 천명(天命)`;
        
        // 사주 팔자 렌더링
        UI.sajuTable.innerHTML = '';
        const pillars = [
            { label: '시간(時)', data: saju.hour },
            { label: '일주(日)', data: saju.day },
            { label: '월주(月)', data: saju.month },
            { label: '년주(年)', data: saju.year }
        ];

        pillars.forEach(p => {
            const cell = document.createElement('div');
            cell.className = 'saju-cell';
            if (p.data) {
                cell.innerHTML = `
                    <div class="cell-label">${p.label}</div>
                    <div class="cell-gan col-${SajuLogic.getElement(p.data.gan)}">${p.data.gan}</div>
                    <div class="cell-ji col-${SajuLogic.getElement(p.data.ji)}">${p.data.ji}</div>
                `;
            } else {
                cell.innerHTML = `<div class="cell-label">${p.label}</div><div class="cell-gan">?</div><div class="cell-ji">?</div>`;
            }
            UI.sajuTable.appendChild(cell);
        });

        // 성향 분석 결과
        UI.descToday.textContent = SajuLogic.analyzePersonality(saju.day.gan);
    }

    return {
        init: () => {
            PiIntegration.init();
            bindEvents();
        }
    };
})();

window.onload = App.init;
