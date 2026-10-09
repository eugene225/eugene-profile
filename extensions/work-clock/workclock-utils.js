/*
 * 근무시간 계산 공용 유틸.
 *
 * 주의: chrome.scripting.executeScript 의 files 배열로 주입되는 각 파일은
 *       "서로 다른 격리 스코프"에서 실행된다(스코프를 공유하지 않음).
 *       따라서 injected.js 와 값을 공유하려면 전역 객체에 명시적으로 노출해야 한다.
 *       아래 상수·함수를 globalThis.__WC 네임스페이스에 담아 injected.js 가 참조한다.
 *       외부 상태(DOM·storage·fetch)에 의존하지 않는 순수 로직만 여기에 둔다.
 */
(function (root) {
    // --- 근무시간 규칙 상수 ---
    const STANDARD_WORK_MINUTES = 8 * 60;    // 하루 기준 근무시간 (8h)
    const MAX_WORK_MINUTES = 10 * 60;        // 하루 인정 상한 (10h)
    const BREAK_THRESHOLD_MINUTES = 5 * 60;  // 체류가 이 시간을 "초과"하면 휴게시간 차감 (회사 규정: 5h까지 인정, 초과 시 1h 휴게)
    const BREAK_MINUTES = 60;                // 차감되는 휴게시간
    const FULL_LEAVE_MIN_MINUTES = 6 * 60;   // 이 시간 이상 부재(absenceTime)면 종일 연차·재택으로 간주
    const EARLIEST_LEAVE_MINUTES = 16 * 60;  // 회사 의무 근무: 이 시각(16:00) 이전엔 퇴근 불가 (딱 맞춰 퇴근 하한)

    // 하루 근무시간(분)에서 휴게시간을 빼고 상한을 적용한 "인정 근무시간"
    function effectiveWorkMinutes(rawMinutes) {
        const breakMins = rawMinutes > BREAK_THRESHOLD_MINUTES ? BREAK_MINUTES : 0;
        return Math.min(rawMinutes - breakMins, MAX_WORK_MINUTES);
    }

    // 분을 "X시간" 또는 "X시간 Y분" 형태의 짧은 문자열로 (요약 표기용)
    function fmtMinutesShort(mins) {
        const h = Math.floor(mins / 60), m = mins % 60;
        return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
    }

    // 초과/부족 분(diff)을 히어로 영역 HTML 문자열로 포맷
    // summary = { current, target } (분)이 주어지면 "(실근무 / 목표)"를 작은 글씨로 덧붙인다.
    function fmtVal(diff, summary) {
        const ah = Math.floor(Math.abs(diff) / 60), am = Math.abs(diff) % 60;
        const main = diff >= 0
            ? `<span class="wc-hero-val over">+${ah}h ${am}m 초과 ✓</span>`
            : `<span class="wc-hero-val">-${ah}h ${am}m 부족</span>`;
        if (!summary) return main;
        const sub = `<span style="color:#aaa;font-size:0.72em;font-weight:500;"> (${fmtMinutesShort(summary.current)} / ${fmtMinutesShort(summary.target)})</span>`;
        return main + sub;
    }

    // 현재 시각을 "HH:MM" 문자열로
    function getNowStr() {
        const t = new Date();
        return t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
    }

    // injected.js 가 참조할 전역 네임스페이스
    root.__WC = {
        STANDARD_WORK_MINUTES,
        MAX_WORK_MINUTES,
        BREAK_THRESHOLD_MINUTES,
        BREAK_MINUTES,
        FULL_LEAVE_MIN_MINUTES,
        EARLIEST_LEAVE_MINUTES,
        effectiveWorkMinutes,
        fmtMinutesShort,
        fmtVal,
        getNowStr
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
