/**
 * π SAJU — 사주 팔자(Manse-ryeok) 연산 엔진
 * 1900~2100년 범위의 간력한 만세력 로직 및 오행 분석
 */

const SajuLogic = (() => {
    // 10천간 & 12지지
    const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    
    // 오행 색상 맵핑
    const ELEMENT_MAP = {
        '甲': 'wood', '乙': 'wood',
        '丙': 'fire', '丁': 'fire',
        '戊': 'earth', '己': 'earth',
        '庚': 'metal', '辛': 'metal',
        '壬': 'water', '癸': 'water',
        '寅': 'wood', '卯': 'wood',
        '巳': 'fire', '午': 'fire',
        '辰': 'earth', '未': 'earth', '戌': 'earth', '丑': 'earth',
        '申': 'metal', '酉': 'metal',
        '亥': 'water', '子': 'water'
    };

    /**
     * 간략화된 태양력 -> 간지 변환 (실제 상용 만세력은 복잡한 천문 연산 필요)
     * 여기서는 프로토타입용 기준일(1900-01-01) 기반 연산 적용
     */
    function getSaju(year, month, day, timeIdx, isLunar) {
        // TODO: 실제 음양력 변환 라이브러리가 없을 경우, 우선 양력 기준으로 연산
        // 기준일: 1900년 1월 31일 (경자년 정월 초하루 근처)
        const birthDate = new Date(year, month - 1, day);
        const baseDate = new Date(1900, 0, 31);
        const diffDays = Math.floor((birthDate - baseDate) / (24 * 60 * 60 * 1000));

        // 년주 (Year Pillar) - 60갑자 순환
        // 1900년은 경자(庚子)년 (Stem 6, Branch 0)
        let yearGanIdx = (year - 4) % 10;
        let yearJiIdx = (year - 4) % 12;

        // 월주 (Month Pillar) - 년간에 따라 월간이 결정됨
        // 간단 계산식: (년간*12 + 월 + 1) % 60
        let monthOffset = (yearGanIdx % 5) * 2 + 2; 
        let monthGanIdx = (monthOffset + month - 1) % 10;
        let monthJiIdx = (month + 1) % 12; // 인(寅)월이 1월(음력 기준)

        // 일주 (Day Pillar) - 기준일로부터의 경과일수 % 60
        // 1900년 1월 31일은 갑진(甲辰)일 (Stem 0, Branch 4)
        let dayIdx = (diffDays + 40) % 60; // Offset 조정
        let dayGanIdx = dayIdx % 10;
        let dayJiIdx = dayIdx % 12;

        // 시주 (Hour Pillar) - 일간에 따라 시간(Stem) 결정
        let hourJiIdx = (timeIdx === -1) ? -1 : (timeIdx + 1) % 12;
        let hourGanIdx = -1;
        if (hourJiIdx !== -1) {
            let hourOffset = (dayGanIdx % 5) * 2;
            hourGanIdx = (hourOffset + Math.floor((timeIdx + 1) / 1)) % 10;
        }

        return {
            year: { gan: HEAVENLY_STEMS[yearGanIdx], ji: EARTHLY_BRANCHES[yearJiIdx] },
            month: { gan: HEAVENLY_STEMS[monthGanIdx], ji: EARTHLY_BRANCHES[monthJiIdx] },
            day: { gan: HEAVENLY_STEMS[dayGanIdx], ji: EARTHLY_BRANCHES[dayJiIdx] },
            hour: hourJiIdx !== -1 ? { gan: HEAVENLY_STEMS[hourGanIdx], ji: EARTHLY_BRANCHES[hourJiIdx] } : null
        };
    }

    function getElement(char) {
        return ELEMENT_MAP[char] || 'metal';
    }

    // 일간(Day Master) 기준 성향 분석 (한글 UI 텍스트)
    function analyzePersonality(dayGan) {
        const traits = {
            '甲': '당당하고 추진력 있는 거목의 기운입니다. 리더십이 뛰어나지만 고집이 셀 수 있습니다.',
            '乙': '유연하고 생명력 넘치는 넝쿨의 기운입니다. 적응력이 좋고 예술적 감각이 뛰어납니다.',
            '丙': '열정적이고 화려한 태양의 기운입니다. 솔직담백하며 주변을 밝게 만드는 에너지가 있습니다.',
            '丁': '따뜻하고 안정적인 등불의 기운입니다. 예의 바르고 내면의 심지가 굳은 분입니다.',
            '戊': '믿음직하고 묵직한 넓은 대지의 기운입니다. 포용력이 크고 신의를 중요시합니다.',
            '己': '섬세하고 생산적인 옥토의 기운입니다. 실속이 있고 어머니 같은 자애로움이 있습니다.',
            '庚': '강직하고 결단력 있는 바위의 기운입니다. 의리가 깊고 정의감이 투철합니다.',
            '辛': '예리하고 고귀한 보석의 기운입니다. 완벽주의적이며 섬세한 감성을 지녔습니다.',
            '壬': '지혜롭고 유동적인 큰 바다의 기운입니다. 총명하며 임기응변에 강하고 생각이 깊습니다.',
            '癸': '촉촉하고 생명을 키우는 단비의 기운입니다. 배려심이 깊고 사람을 편하게 해줍니다.'
        };
        return traits[dayGan] || "분석 중입니다.";
    }

    return { getSaju, getElement, analyzePersonality };
})();

window.SajuLogic = SajuLogic;
