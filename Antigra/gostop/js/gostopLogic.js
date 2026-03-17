/**
 * 고스톱 핵심 비즈니스 로직
 * - 카드 정의, 셔플, 분배, 점수 계산, 족보 확인 (UI 무관)
 */
const HWATU_DECK = [
    // 1월 송학
    { id: '1-1', month: 1, type: '광', isKwang: true, tag: '광' },
    { id: '1-2', month: 1, type: '띠', isHongdan: true, tag: '홍단' },
    { id: '1-3', month: 1, type: '피', tag: '피' },
    { id: '1-4', month: 1, type: '피', tag: '피' },
    // 2월 매조
    { id: '2-1', month: 2, type: '열', tag: '새' },
    { id: '2-2', month: 2, type: '띠', isHongdan: true, tag: '홍단' },
    { id: '2-3', month: 2, type: '피', tag: '피' },
    { id: '2-4', month: 2, type: '피', tag: '피' },
    // 3월 벚꽃
    { id: '3-1', month: 3, type: '광', isKwang: true, tag: '광' },
    { id: '3-2', month: 3, type: '띠', isHongdan: true, tag: '홍단' },
    { id: '3-3', month: 3, type: '피', tag: '피' },
    { id: '3-4', month: 3, type: '피', tag: '피' },
    // 4월 흑싸리
    { id: '4-1', month: 4, type: '열', tag: '새' },
    { id: '4-2', month: 4, type: '띠', isChodan: true, tag: '초단' },
    { id: '4-3', month: 4, type: '피', tag: '피' },
    { id: '4-4', month: 4, type: '피', tag: '피' },
    // 5월 난초
    { id: '5-1', month: 5, type: '열', tag: '나비' },
    { id: '5-2', month: 5, type: '띠', isChodan: true, tag: '초단' },
    { id: '5-3', month: 5, type: '피', tag: '피' },
    { id: '5-4', month: 5, type: '피', tag: '피' },
    // 6월 모란
    { id: '6-1', month: 6, type: '열', tag: '나비' },
    { id: '6-2', month: 6, type: '띠', isCheongdan: true, tag: '청단' },
    { id: '6-3', month: 6, type: '피', tag: '피' },
    { id: '6-4', month: 6, type: '피', tag: '피' },
    // 7월 홍싸리
    { id: '7-1', month: 7, type: '열', tag: '멧돼지' },
    { id: '7-2', month: 7, type: '띠', isChodan: true, tag: '초단' },
    { id: '7-3', month: 7, type: '피', tag: '피' },
    { id: '7-4', month: 7, type: '피', tag: '피' },
    // 8월 공산
    { id: '8-1', month: 8, type: '광', isKwang: true, tag: '광' },
    { id: '8-2', month: 8, type: '열', tag: '기러기' },
    { id: '8-3', month: 8, type: '피', tag: '피' },
    { id: '8-4', month: 8, type: '피', tag: '피' },
    // 9월 국진
    { id: '9-1', month: 9, type: '열', isSsangpi: true, tag: '쌍피' }, // 국진 10은 기본적으로 쌍피로 취급
    { id: '9-2', month: 9, type: '띠', isCheongdan: true, tag: '청단' },
    { id: '9-3', month: 9, type: '피', tag: '피' },
    { id: '9-4', month: 9, type: '피', tag: '피' },
    // 10월 단풍
    { id: '10-1', month: 10, type: '열', tag: '사슴' },
    { id: '10-2', month: 10, type: '띠', isCheongdan: true, tag: '청단' },
    { id: '10-3', month: 10, type: '피', tag: '피' },
    { id: '10-4', month: 10, type: '피', tag: '피' },
    // 11월 오동
    { id: '11-1', month: 11, type: '광', isKwang: true, tag: '광' },
    { id: '11-2', month: 11, type: '피', isSsangpi: true, tag: '쌍피' },
    { id: '11-3', month: 11, type: '피', tag: '피' },
    { id: '11-4', month: 11, type: '피', tag: '피' },
    // 12월 비
    { id: '12-1', month: 12, type: '광', isKwang: true, tag: '비광' },
    { id: '12-2', month: 12, type: '열', tag: '제비' },
    { id: '12-3', month: 12, type: '띠', tag: '비단' },
    { id: '12-4', month: 12, type: '피', isSsangpi: true, tag: '쌍피' }
];

class GostopLogic {
    constructor() {
        this.deck = [];
        this.board = [];
        this.playerHand = [];
        this.playerCollected = [];
        this.opponentHand = [];
        this.opponentCollected = [];
        this.turn = 'player'; // 'player' or 'opponent'

        this.initDeck();
    }

    // 48장 패 초기화 (1월~12월, 각 4장)
    initDeck() {
        // 객체 깊은 복사를 통해 덱 초기화
        this.deck = JSON.parse(JSON.stringify(HWATU_DECK));
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    deal() {
        this.shuffle();
        // 플레이어 10장, 바닥 8장, 상대 10장 (2인 기준)
        this.playerHand = this.deck.splice(0, 10);
        this.opponentHand = this.deck.splice(0, 10);
        this.board = this.deck.splice(0, 8);
    }

    // 카드 매칭 확인 헬퍼 함수
    getMatchingCards(targetCard) {
        return this.board.filter(c => c.month === targetCard.month);
    }

    // 카드를 바닥에 놓고 매칭 처리 후 먹은 패 반환
    processCardDrop(card) {
        const matches = this.getMatchingCards(card);
        let collected = [];

        if (matches.length === 0) {
            this.board.push(card);
        } else if (matches.length === 1) {
            collected.push(card, matches[0]);
            this.board = this.board.filter(c => c.id !== matches[0].id);
        } else if (matches.length === 2) {
            // 2장일 때 하나 선택해야 하지만 단순화를 위해 첫 번째 매칭 카드 획득
            collected.push(card, matches[0]);
            this.board = this.board.filter(c => c.id !== matches[0].id);
        } else if (matches.length === 3) {
            // 바닥에 3장(싼 거) 있으면 다 먹음
            collected.push(card, ...matches);
            this.board = this.board.filter(c => c.month !== card.month);
        }
        return collected;
    }

    // 카드를 냈을 때의 핵심 로직 프로세스
    playCard(cardIndex, isPlayer) {
        let hand = isPlayer ? this.playerHand : this.opponentHand;
        let collectedStore = isPlayer ? this.playerCollected : this.opponentCollected;

        if (cardIndex < 0 || cardIndex >= hand.length) return null;

        // 1. 손에서 카드 내기
        const playedCard = hand.splice(cardIndex, 1)[0];
        let turnCollected = [];

        // 2. 바닥 패와 매칭
        const playedMatches = this.processCardDrop(playedCard);
        turnCollected.push(...playedMatches);

        // 3. 덱에서 1장 뒤집기
        let drawnCard = null;
        if (this.deck.length > 0) {
            drawnCard = this.deck.pop();
            const drawnMatches = this.processCardDrop(drawnCard);

            // 쪽, 뻑, 따닥 등 복잡한 룰은 생략/추가 기능으로 분리 가능
            // 일단은 뒤집은 카드 처리 추가
            turnCollected.push(...drawnMatches);
        }

        // 4. 먹은 패 수집
        collectedStore.push(...turnCollected);

        // 5. 점수 계산
        const newScore = this.calculateScore(collectedStore);

        return {
            playedCard,
            drawnCard,
            collected: turnCollected,
            newScore: newScore,
            isGameEnd: (this.playerHand.length === 0 && this.opponentHand.length === 0)
        };
    }

    // 족보 및 점수 계산 로직
    calculateScore(collectedCards) {
        let score = 0;

        const kwangs = collectedCards.filter(c => c.isKwang);
        const yuls = collectedCards.filter(c => c.type === '열');
        const ttis = collectedCards.filter(c => c.type === '띠');
        const pis = collectedCards.filter(c => c.type === '피' || c.isSsangpi);

        // 광 점수 계산
        if (kwangs.length === 5) score += 15; // 오광
        else if (kwangs.length === 4) score += 4; // 사광
        else if (kwangs.length === 3) {
            const hasBiKwang = kwangs.some(c => c.month === 12);
            score += hasBiKwang ? 2 : 3; // 비삼광 2점, 삼광 3점
        }

        // 열(동물) 점수 계산
        if (yuls.length >= 5) {
            score += (yuls.length - 4); // 5장부터 1점씩
            // 고도리 (2, 4, 8월 새 3마리)
            const godori = yuls.filter(c => c.month === 2 || c.month === 4 || c.month === 8);
            if (godori.length === 3) score += 5;
        }

        // 띠 점수 계산
        if (ttis.length >= 5) {
            score += (ttis.length - 4);
            // 홍단, 초단, 청단
            if (ttis.filter(c => c.isHongdan).length === 3) score += 3;
            if (ttis.filter(c => c.isChodan).length === 3) score += 3;
            if (ttis.filter(c => c.isCheongdan).length === 3) score += 3;
        }

        // 피 점수 계산
        let piCount = 0;
        pis.forEach(p => {
            piCount += p.isSsangpi ? 2 : 1;
        });

        if (piCount >= 10) {
            score += Math.max(0, piCount - 9);
        }

        return score;
    }
}
