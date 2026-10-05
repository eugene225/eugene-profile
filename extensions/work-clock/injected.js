(async function() {
    // workclock-utils.js 가 globalThis.__WC 에 노출한 상수·순수 유틸을 가져온다.
    // (executeScript의 각 파일은 격리 스코프라 전역을 통해서만 값 공유 가능)
    const WC = (typeof globalThis !== 'undefined' ? globalThis : window).__WC;
    if (!WC) { alert('❌ 확장 로딩 오류: 유틸 스크립트가 주입되지 않았습니다. 확장을 새로고침 해주세요.'); return; }
    const {
        STANDARD_WORK_MINUTES, MAX_WORK_MINUTES, BREAK_THRESHOLD_MINUTES, BREAK_MINUTES,
        FULL_LEAVE_MIN_MINUTES, effectiveWorkMinutes, fmtMinutesShort, fmtVal, getNowStr
    } = WC;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const todayStr = year + month + String(now.getDate()).padStart(2, '0');
    const fromDate = year + month + '01';
    const toDate = year + month + String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0');

    const stored = await chrome.storage.local.get(['work_clock_empId', 'work_clock_startTime']);

    // 로그인한 본인의 empId/companyId를 JWT 액세스 토큰에서 가져온다.
    // (쿠키 인증만으로 호출되며 empId 파라미터가 필요 없어, 어느 페이지에서든 동작)
    // background 경유로 호출해야 Workplace가 아닌 다른 도메인 페이지에서도 CORS 없이 작동한다.
    function fetchTextViaBackground(url) {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'FETCH_TEXT', url }, resolve);
        });
    }
    async function fetchIdentityFromJwt() {
        try {
            const res = await fetchTextViaBackground('https://workplace.worksmobile.com/apigw/auth-jwt/access-token');
            if (!res || !res.ok || !res.text) return null;
            const jwt = (res.text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [])[0];
            if (!jwt) return null;
            const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            const id = payload.empId || payload.sub || null;
            return id ? { empId: id, companyId: payload.companyId || null } : null;
        } catch (e) {
            return null;
        }
    }

    // 현재 페이지가 이미 보낸 API 요청 URL에서 empId를 추출한다 (JWT 실패 시 fallback).
    function extractEmpIdFromPage() {
        try {
            const found = performance.getEntriesByType('resource')
                .map(e => e.name)
                .filter(u => /empId=/.test(u))
                .map(u => {
                    const m = decodeURIComponent(u).match(/empId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
                    return m && m[1];
                })
                .filter(Boolean);
            return found[0] || null;
        } catch (e) {
            return null;
        }
    }

    let empId = stored.work_clock_empId;
    let companyId = '5662ae5e-e3a9-4a8b-866c-1fdc44b5f204'; // JWT 실패 시 사용할 기본값

    // 로그인 안내 오버레이 (empId 획득 전에도 쓸 수 있도록 간단히 독립 구현)
    function showLoginRequiredOverlay() {
        document.querySelectorAll('#wc-overlay, #wc-login-overlay').forEach(el => el.remove());
        const ov = document.createElement('div');
        ov.id = 'wc-login-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Pretendard","Apple SD Gothic Neo","Space Grotesk",sans-serif;';
        ov.innerHTML = `
            <div style="background:#fff;border-radius:20px;box-shadow:0 20px 48px rgba(0,0,0,0.18);max-width:400px;width:100%;padding:32px;text-align:center;">
                <div style="font-size:2em;margin-bottom:12px;">🔒</div>
                <div style="font-weight:700;color:#1f1a17;margin-bottom:6px;font-size:1.05rem;">로그인이 필요해요</div>
                <div style="font-size:0.88em;color:#888;margin-bottom:20px;line-height:1.5;">
                    Workplace에 로그인한 뒤 다시 실행해주세요.
                </div>
                <div style="display:flex;gap:8px;justify-content:center;">
                    <a href="https://workplace.worksmobile.com/" target="_blank" rel="noopener noreferrer"
                       style="padding:10px 20px;background:#FF8C00;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:0.9em;">Workplace 열기</a>
                    <button id="wc-login-close"
                       style="padding:10px 20px;background:#1f1a17;color:#fff;border:none;border-radius:999px;cursor:pointer;font-weight:600;font-size:0.9em;">닫기</button>
                </div>
            </div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        document.getElementById('wc-login-close').addEventListener('click', () => ov.remove());
    }

    // empId 획득 순서: ① JWT 토큰 → ② 페이지 네트워크 기록 → ③ 저장값 → ④ 수동 입력
    // JWT 성공 여부는 "현재 로그인 상태" 판별 신호로도 쓴다.
    const identity = await fetchIdentityFromJwt();
    if (identity) {
        empId = identity.empId;
        if (identity.companyId) companyId = identity.companyId;
    }
    if (!empId) empId = extractEmpIdFromPage();
    if (!empId) empId = stored.work_clock_empId;
    if (!empId) {
        // JWT도 실패하고 다른 수단으로도 empId를 못 구함.
        // JWT 실패는 보통 미로그인 신호이므로, empId 입력을 요구하기 전에 로그인 안내를 먼저 띄운다.
        if (!identity) { showLoginRequiredOverlay(); return; }
        // 로그인은 됐는데(JWT 성공) empId만 못 얻은 드문 경우에만 수동 입력
        empId = prompt('📝 empId를 입력하세요\n\n💡 보통은 자동으로 찾아지지만, 안 될 경우 직접 입력하세요.\n🔍 찾는 방법: F12 → Network → 검색 클릭 → list? API Payload에서 empId 복사');
        if (!empId) { alert('❌ empId가 필요합니다.'); return; }
    }
    await chrome.storage.local.set({ work_clock_empId: empId });
    let savedStartTime = stored.work_clock_startTime || '09:00';

    const apiUrl = 'https://workplace.worksmobile.com/my-space/work-statistics/list?fromDate=' + fromDate +
                   '&toDate=' + toDate + '&empId=' + empId + '&chkWorkingDay=Y&_=' + Date.now();
    const commuteApiUrl = 'https://workplace.worksmobile.com/my-space/commute-status/list?companyId=' + companyId +
                          '&fromDate=' + fromDate + '&toDate=' + toDate + '&empId=' + empId + '&_=' + Date.now();

    function fetchData(url) {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'FETCH_WORK_DATA', url }, resolve);
        });
    }

    function removeOverlay() {
        document.querySelectorAll('#wc-overlay, #wc-login-overlay, #wc-style').forEach(el => el.remove());
    }
    removeOverlay();

    if (!document.getElementById('wc-style')) {
        const s = document.createElement('style');
        s.id = 'wc-style';
        s.textContent = `
            #wc-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px; }
            #wc-modal { background:#fff;border-radius:20px;box-shadow:0 20px 48px rgba(0,0,0,0.18);font-family:"Pretendard","Apple SD Gothic Neo","Space Grotesk",sans-serif;width:100%;max-width:480px;font-size:15px; }
            .wc-header { padding:18px 24px 14px;border-bottom:1px solid #f0ece6;text-align:center; }
            .wc-header h2 { margin:0;font-size:1.1rem;font-weight:700;color:#1f1a17; }
            .wc-header .wc-sub { font-size:0.82em;color:#aaa;margin-top:2px; }
            .wc-body { padding:14px 18px 18px;display:grid;gap:10px; }
            .wc-heroes { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
            .wc-hero { padding:16px;border-radius:14px;border:2px solid #FF8C00;display:grid;gap:5px;transition:border-color .2s; }
            .wc-hero.over { border-color:#0a9e62; }
            .wc-hero-label { font-size:0.8em;font-weight:700;color:#7a6f69;letter-spacing:.05em;text-transform:uppercase; }
            .wc-hero-val { font-size:1.35em;font-weight:800;color:#E07800; }
            .wc-hero-val.over { color:#0a7a4a; }
            .wc-hero-note { font-size:0.82em;color:#7a6f69;line-height:1.4; }
            .wc-mode-bar { display:flex;align-items:center;gap:8px;padding:8px 14px;background:#FFF8EE;border-radius:10px;border:1px solid rgba(255,140,0,0.25);font-size:0.88em;color:#5a4a3a; }
            .wc-mode-bar button { margin-left:auto;padding:4px 12px;border:1px solid rgba(255,140,0,0.4);border-radius:999px;background:#fff;color:#C06400;font-size:0.88em;font-weight:600;cursor:pointer; }
            .wc-card { background:#FDFAF4;padding:13px 15px;border-radius:12px;border:1px solid rgba(255,140,0,0.15); }
            .wc-card-label { font-size:0.8em;font-weight:700;color:#7a6f69;letter-spacing:.05em;text-transform:uppercase;margin-bottom:5px; }
            .wc-card-val { font-size:1.15em;font-weight:700;color:#B05800; }
            .wc-card-note { font-size:0.84em;color:#7a6f69;margin-top:3px; }
            .wc-tag { display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:0.84em;font-weight:600; }
            .wc-tag.past { background:#FFF0D9;color:#B05800; }
            .wc-tag.future { background:#E8F5EE;color:#1a7a50; }
            .wc-time-card { background:#FFFAF2;padding:13px 15px;border-radius:12px;border:1px solid rgba(255,140,0,0.28); }
            .wc-balance { font-size:0.9em;color:#3a2e28;padding:8px 11px;background:#fff;border-radius:8px;margin-bottom:8px;border:1px solid rgba(255,140,0,0.18);line-height:1.5; }
            .wc-time-row { display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:flex-end; }
            .wc-time-lbl { font-size:0.8em;color:#7a6f69;font-weight:600;margin-bottom:3px; }
            input[type=time].wc-input { width:100%;padding:8px 9px;border:1px solid rgba(255,140,0,0.3);border-radius:8px;font-size:0.95em;font-family:inherit;color:#1f1a17;background:#fff;box-sizing:border-box; }
            .wc-actions { display:flex;gap:8px;padding:0 18px 18px; }
            .wc-btn { border:none;border-radius:999px;cursor:pointer;font-weight:700;font-size:14px;padding:12px 16px; }
            .wc-btn.ghost { flex:1;background:#F0EBE5;color:#5a4a3a; }
            .wc-btn.apply { background:#FF8C00;color:#fff;padding:9px 15px; }
            .wc-btn.close { flex:2;background:#1f1a17;color:#fff; }
        `;
        document.head.appendChild(s);
    }

    const overlay = document.createElement('div');
    overlay.id = 'wc-overlay';
    const modal = document.createElement('div');
    modal.id = 'wc-modal';
    modal.innerHTML = '<div style="padding:48px;text-align:center;color:#bbb;font-size:0.88em;">⏳ 불러오는 중...</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeAll = () => { if (liveTimer) clearInterval(liveTimer); removeOverlay(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') closeAll(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) closeAll(); });
    document.addEventListener('keydown', onKey);

    let liveTimer = null;

    const [response, commuteResponse] = await Promise.all([fetchData(apiUrl), fetchData(commuteApiUrl)]);
    try {
        // 로그인 세션이 없으면 background가 NOT_LOGGED_IN 을 돌려준다.
        if (response && !response.ok && response.error === 'NOT_LOGGED_IN') throw new Error('NOT_LOGGED_IN');
        if (!response || !response.ok) throw new Error(response ? response.error : '응답 없음');
        const data = response.data;

        // commute-status: 날짜별 출퇴근/부재 정보 map (checkYmd -> { absenceMins, realInHm, realOutHm })
        // absenceTime = 그날 연차·재택 등으로 "실근무 체크 없이 부재 처리된 시간"(HHMM)
        const commuteByDate = {};
        let todayRealIn = null, todayRealOut = null;
        if (commuteResponse && commuteResponse.ok) {
            const cl = commuteResponse.data && commuteResponse.data.data && commuteResponse.data.data.list;
            if (Array.isArray(cl)) {
                cl.forEach(r => {
                    if (!r.checkYmd) return;
                    const absStr = r.absenceTime || '0000';
                    const absenceMins = (+absStr.slice(0,2) * 60) + (+absStr.slice(2,4) || 0);
                    commuteByDate[r.checkYmd] = {
                        absenceMins: isNaN(absenceMins) ? 0 : absenceMins,
                        realInHm: r.realInHm || null,
                        realOutHm: r.realOutHm || null
                    };
                });
                const todayRec = commuteByDate[todayStr];
                if (todayRec && todayRec.realInHm) {
                    todayRealIn = todayRec.realInHm.slice(0,2) + ':' + todayRec.realInHm.slice(2,4);
                    savedStartTime = todayRealIn;
                    chrome.storage.local.set({ work_clock_startTime: todayRealIn });
                }
                if (todayRec && todayRec.realOutHm) {
                    todayRealOut = todayRec.realOutHm.slice(0,2) + ':' + todayRec.realOutHm.slice(2,4);
                }
            }
        }
        if (!data.data || !data.data.list) throw new Error('응답 형식 오류');

            const records = data.data.list;
            const today = new Date(); today.setHours(0,0,0,0);

            let workedMinutes = 0, totalWorkDays = 0, pastWorkDays = 0;
            let futureLeave6h = 0, futureLeave8h = 0, futureNonLeave = 0;
            let workedToday = false, todayInProgress = false;
            // 오늘이 근무일(WORK 레코드 존재)인지, 오늘 기록이 연차·재택(종일 부재)인지
            let todayIsWorkday = false, todayIsFullLeave = false;
            const leaveDays = [];

            records.forEach(r => {
                if (r.dayTpCd !== 'WORK') return;
                const d = new Date(+r.checkYmd.slice(0,4), +r.checkYmd.slice(4,6)-1, +r.checkYmd.slice(6,8));
                const isToday = d.getTime() === today.getTime();
                const wt = r.sumWorkTime;
                const hasMins = wt && wt !== '0000';
                let mins = 0;
                if (hasMins) { const h=+wt.slice(0,2), m=+wt.slice(2,4); if (!isNaN(h+m)) mins = h*60+m; }
                // 종일 연차·재택 판별 (commute-status의 absenceTime 사용):
                // absenceTime = 그날 출퇴근 체크 없이 "부재 처리된" 시간.
                // 6시간 이상 부재면 종일 연차·재택으로 간주한다. (6h 연차는 보통 나머지 2h를
                // 다른 날 채우는 운영이라 그날 자체는 종일 부재로 처리)
                // 2h·4h 등 부분 연차(반차·반반차)는 그날 일부를 실제 근무하므로 부재로 보지 않는다.
                const absenceMins = (commuteByDate[r.checkYmd] && commuteByDate[r.checkYmd].absenceMins) || 0;
                const isFullLeave = absenceMins >= FULL_LEAVE_MIN_MINUTES;
                totalWorkDays++;
                if (d < today) {
                    pastWorkDays++; workedMinutes += Math.min(mins, MAX_WORK_MINUTES);
                    if (isFullLeave) {
                        leaveDays.push({ date: d, mins, future: false });
                    }
                } else if (isToday) {
                    todayIsWorkday = true;
                    if (isFullLeave) todayIsFullLeave = true;
                    if (hasMins) { pastWorkDays++; workedToday = true; workedMinutes += Math.min(mins, MAX_WORK_MINUTES); }
                    else todayInProgress = true;
                } else {
                    if (isFullLeave) {
                        mins >= STANDARD_WORK_MINUTES ? futureLeave8h++ : futureLeave6h++;
                        leaveDays.push({ date: d, mins, future: true });
                    } else futureNonLeave++;
                }
            });


            const totalTarget = totalWorkDays * STANDARD_WORK_MINUTES;

            function computeStats(extraMins) {
                const wToday = workedToday || extraMins > 0;
                const tInProg = todayInProgress && extraMins === 0;
                const wM = workedMinutes + extraMins;
                const pD = pastWorkDays + (extraMins > 0 && !workedToday ? 1 : 0);
                const todayDiff = wM - pD * STANDARD_WORK_MINUTES;
                const projected = wM + futureLeave6h*FULL_LEAVE_MIN_MINUTES + futureLeave8h*STANDARD_WORK_MINUTES + futureNonLeave*STANDARD_WORK_MINUTES + (tInProg ? STANDARD_WORK_MINUTES : 0);
                const monthDiff = projected - totalTarget;
                const remainReal = futureNonLeave + (tInProg ? 1 : 0);
                const covered = wM + futureLeave6h*FULL_LEAVE_MIN_MINUTES + futureLeave8h*STANDARD_WORK_MINUTES;
                const stillNeed = Math.max(0, totalTarget - covered);
                const avgMins = remainReal > 0 ? Math.round(stillNeed / remainReal) : 0;
                const savedStart = savedStartTime;
                const [sh, sm] = savedStart.split(':').map(Number);
                const netNeeded = STANDARD_WORK_MINUTES - todayDiff;
                const balanceMins = sh*60 + sm + netNeeded + (netNeeded > BREAK_THRESHOLD_MINUTES ? BREAK_MINUTES : 0);
                const bH = Math.floor(balanceMins/60)%24, bM = balanceMins%60;
                return {
                    wToday, tInProg, wM, pD, todayDiff, monthDiff, remainReal,
                    projectedMinutes: projected, totalTargetMinutes: totalTarget,
                    avgH: Math.floor(avgMins/60), avgM: avgMins%60,
                    balanceStr: String(bH).padStart(2,'0')+':'+String(bM).padStart(2,'0'),
                    savedStart,
                    todayNote: wToday ? '오늘 포함' : tInProg ? '진행 중' : '오늘 제외'
                };
            }

            // 지정한 출근~퇴근 시간으로 "지금 퇴근하면" 오늘까지 초과/부족을 미리 보여주는 HTML
            function calcPreview(startVal, endVal) {
                const [sh,sm]=startVal.split(':').map(Number), [eh,em]=endVal.split(':').map(Number);
                const rawMins=(eh*60+em)-(sh*60+sm);
                const breakMins=rawMins>BREAK_THRESHOLD_MINUTES?BREAK_MINUTES:0;
                const m=effectiveWorkMinutes(rawMins);
                if(m<=0) return null;
                const newW=workedMinutes+m, newP=pastWorkDays+(workedToday?0:1);
                const diff=newW-newP*STANDARD_WORK_MINUTES, ah=Math.floor(Math.abs(diff)/60), am2=Math.abs(diff)%60;
                const breakLabel=breakMins>0?`<span style="color:#bbb;font-size:0.88em;"> (휴게 ${breakMins}분 제외)</span>`:'';
                return diff>=0
                    ? `<span style="color:#0a7a4a;font-weight:700;">+${ah}h ${am2}m 초과 ✨</span>${breakLabel}`
                    : `<span style="color:#E07800;font-weight:700;">-${ah}h ${am2}m 부족 ⚠️</span>${breakLabel}`;
            }

            // 초기 렌더
            const savedStart = savedStartTime;
            const initStats = computeStats(0);
            const leaveTagsHtml = leaveDays.map(d => {
                const mo=d.date.getMonth()+1, dy=d.date.getDate(), h=Math.floor(d.mins/60);
                return `<span class="wc-tag ${d.future?'future':'past'}">${mo}/${dy} (${h}h)${d.future?' 예정':''}</span>`;
            }).join('');

            const nowStr = getNowStr();
            const isWeekend = now.getDay() === 0 || now.getDay() === 6;
            const isDone = !!todayRealOut;

            // "오늘 퇴근 계산"을 비활성화해야 하는 경우와 사유
            // - 주말 / 공휴일(=근무일 레코드 없음) : 애초에 근무일이 아님
            // - 오늘 연차·재택(종일 부재) : 이미 종일 처리되어 퇴근 계산 불필요
            // - 퇴근 완료 : 이미 퇴근함
            let todayCalcDisabled = true, todayCalcReason = '';
            if (isWeekend) {
                todayCalcReason = '주말';
            } else if (!todayIsWorkday) {
                todayCalcReason = '휴일';
            } else if (todayIsFullLeave) {
                todayCalcReason = '연차·재택';
            } else if (isDone) {
                todayCalcReason = '퇴근 완료';
            } else {
                todayCalcDisabled = false;
            }

            modal.innerHTML = `
                <div class="wc-header">
                    <h2>🏃 퇴근시켜주세요</h2>
                    <div class="wc-sub">${year}년 ${month}월 근무 현황</div>
                </div>
                <div class="wc-body">
                    <div id="wc-month-hero" class="wc-hero ${initStats.monthDiff>=0?'over':''}">
                        <div class="wc-hero-label">이달 예상</div>
                        <div id="wc-month-val">${fmtVal(initStats.monthDiff, { current: initStats.wM, target: initStats.totalTargetMinutes })}</div>
                        <div id="wc-today-note" class="wc-hero-note">${initStats.pD}일 근무 · 잔여 ${initStats.remainReal}일 · ${initStats.todayNote}</div>
                    </div>

                    <div id="wc-mode-bar" class="wc-mode-bar" style="display:none;">
                        <span id="wc-mode-txt"></span>
                        <button id="wc-cancel-btn">적용해제</button>
                    </div>

                    ${initStats.remainReal > 0 ? `
                    <div class="wc-card">
                        <div class="wc-card-label">하루 평균 목표</div>
                        <div id="wc-avg-val" class="wc-card-val">${initStats.avgH}h ${initStats.avgM}m / 일</div>
                        <div id="wc-avg-note" class="wc-card-note">남은 ${initStats.remainReal}일 기준 (연차·재택 제외)</div>
                    </div>
                    ` : ''}

                    ${leaveDays.length > 0 ? `
                    <div class="wc-card">
                        <div class="wc-card-label">연차·재택 적용날짜 (${leaveDays.length}일)</div>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">${leaveTagsHtml}</div>
                    </div>
                    ` : ''}

                    <div class="wc-time-card" ${todayCalcDisabled ? 'style="opacity:0.5;"' : ''}>
                        <div class="wc-card-label" style="margin-bottom:8px;">오늘 퇴근 계산${todayCalcDisabled ? ` · <span style="color:#0a7a4a;">${todayCalcReason}</span>` : ''}</div>
                        ${todayCalcDisabled ? `
                        <div class="wc-balance" style="text-align:center;color:#9a8f88;">
                            ${todayCalcReason === '퇴근 완료'
                                ? `오늘은 이미 퇴근했어요 🎉${todayRealOut ? ` (${todayRealOut})` : ''}`
                                : todayCalcReason === '연차·재택'
                                    ? '오늘은 연차·재택으로 종일 처리되어 퇴근 계산이 필요 없어요 🌴'
                                    : '오늘은 근무일이 아니에요'}
                        </div>
                        ` : `
                        <div id="wc-balance" class="wc-balance" style="${(initStats.tInProg||initStats.wToday)?'':'display:none;'}">
                            딱 맞춰 퇴근 <strong style="color:#C06400;font-size:1.05em;" id="wc-balance-time">${initStats.balanceStr}</strong>
                            <span style="color:#bbb;font-size:0.9em;" id="wc-balance-start"> (출근 ${initStats.savedStart} 기준)</span>
                        </div>
                        <div id="wc-preview" class="wc-balance">
                            지금(${nowStr}) 퇴근하면 → ${calcPreview(savedStart, nowStr)||'<span style="color:#ccc">계산 불가</span>'}
                        </div>
                        <div class="wc-time-row">
                            <div>
                                <div class="wc-time-lbl">출근</div>
                                <input type="time" id="wc-start" class="wc-input" value="${savedStart}">
                            </div>
                            <div>
                                <div class="wc-time-lbl">퇴근</div>
                                <input type="time" id="wc-end" class="wc-input" value="${nowStr}">
                            </div>
                            <button id="wc-apply" class="wc-btn apply">반영</button>
                        </div>
                        `}
                    </div>
                </div>
                <div class="wc-actions">
                    <button id="wc-reset" class="wc-btn ghost">empId 초기화</button>
                    <button id="wc-close" class="wc-btn close">닫기</button>
                </div>
            `;

            // hero + avg DOM 업데이트 (풀 리렌더 없이)
            function updateHero(stats, startVal, endVal, isManual) {
                document.getElementById('wc-month-hero').className = `wc-hero ${stats.monthDiff>=0?'over':''}`;
                document.getElementById('wc-month-val').innerHTML = fmtVal(stats.monthDiff, { current: stats.wM, target: stats.totalTargetMinutes });
                document.getElementById('wc-today-note').textContent = `${stats.pD}일 근무 · 잔여 ${stats.remainReal}일 · ${stats.todayNote}`;

                const avgValEl = document.getElementById('wc-avg-val');
                const avgNoteEl = document.getElementById('wc-avg-note');
                if (avgValEl) avgValEl.textContent = `${stats.avgH}h ${stats.avgM}m / 일`;
                if (avgNoteEl) avgNoteEl.textContent = `남은 ${stats.remainReal}일 기준 (연차·재택 제외)`;

                const balEl = document.getElementById('wc-balance');
                if (balEl) {
                    balEl.style.display = (stats.tInProg || stats.wToday) ? '' : 'none';
                    document.getElementById('wc-balance-time').textContent = stats.balanceStr;
                    document.getElementById('wc-balance-start').textContent = ` (출근 ${stats.savedStart} 기준)`;
                }

                const modeBar = document.getElementById('wc-mode-bar');
                const modeTxt = document.getElementById('wc-mode-txt');
                if (modeBar && modeTxt) {
                    if (isManual) {
                        modeTxt.textContent = `✅ ${startVal} ~ ${endVal} 반영됨`;
                        modeBar.style.display = 'flex';
                    } else {
                        modeBar.style.display = 'none';
                    }
                }
            }

            // 미리보기 업데이트
            let userChangedEnd = false;
            function updatePreview(useCurrent) {
                const startEl = document.getElementById('wc-start');
                const endEl = document.getElementById('wc-end');
                const previewEl = document.getElementById('wc-preview');
                if (!startEl || !endEl || !previewEl) { clearInterval(liveTimer); return; }
                if (useCurrent && !userChangedEnd) {
                    endEl.value = getNowStr();
                }
                const sv = startEl.value, ev = endEl.value;
                const label = (useCurrent && !userChangedEnd) ? `지금(${ev}) 퇴근하면` : `${sv} ~ ${ev} 퇴근하면`;
                previewEl.innerHTML = `${label} → ${calcPreview(sv, ev)||'<span style="color:#ccc">계산 불가</span>'}`;
            }

            if (!todayCalcDisabled) liveTimer = setInterval(() => updatePreview(true), 30000);

            // 이벤트
            document.getElementById('wc-close').addEventListener('click', closeAll);
            document.getElementById('wc-reset').addEventListener('click', () => {
                chrome.storage.local.remove('work_clock_empId');
                closeAll();
                alert('✅ empId 초기화됨. 다시 클릭하면 새로 입력할 수 있습니다.');
            });

            // 퇴근 계산 입력 요소는 비활성(주말·휴일·연차·퇴근완료) 상태에서는 렌더되지 않으므로
            // 활성 상태에서만 이벤트를 바인딩한다.
            if (!todayCalcDisabled) {
            document.getElementById('wc-start').addEventListener('change', e => {
                savedStartTime = e.target.value;
                chrome.storage.local.set({ work_clock_startTime: e.target.value });
                updatePreview(false);
                // 균형 퇴근 시간도 재계산 (현재 override 상태 유지)
                const overrideMins = window._wcOverrideMins || 0;
                updateHero(computeStats(overrideMins), e.target.value, document.getElementById('wc-end').value, overrideMins > 0);
            });

            document.getElementById('wc-end').addEventListener('input', () => {
                userChangedEnd = true;
                updatePreview(false);
            });

            document.getElementById('wc-apply').addEventListener('click', () => {
                const sv = document.getElementById('wc-start').value;
                const ev = document.getElementById('wc-end').value;
                if (!ev) return;
                const [sh,sm]=sv.split(':').map(Number), [eh,em]=ev.split(':').map(Number);
                const rawMins = (eh*60+em)-(sh*60+sm);
                if (rawMins <= 0) { alert('퇴근 시간이 출근 시간보다 늦어야 합니다.'); return; }
                // 미리보기(calcPreview)와 동일하게 휴게시간 제외 + 10h 상한 적용
                const m = effectiveWorkMinutes(rawMins);
                if (m <= 0) { alert('근무 시간이 0분 이하입니다.'); return; }
                window._wcOverrideMins = m;
                userChangedEnd = true; // 반영 후 실시간 auto-update 중단
                updateHero(computeStats(m), sv, ev, true);
            });
            } // end if (!todayCalcDisabled)

            document.getElementById('wc-cancel-btn')?.addEventListener('click', () => {
                window._wcOverrideMins = 0;
                userChangedEnd = false;
                updateHero(computeStats(0), null, null, false);
                // preview도 실시간으로 복귀
                updatePreview(true);
            });

        } catch(err) {
            console.error('퇴근시켜주세요 Error:', err);
            if (err.message === 'NOT_LOGGED_IN') {
                // 로그인 안내는 공용 오버레이 재사용 (CSP 안전: 인라인 핸들러 없음)
                removeOverlay();
                showLoginRequiredOverlay();
            } else {
                modal.innerHTML = `
                    <div style="padding:32px;text-align:center;">
                        <div style="font-size:2em;margin-bottom:12px;">❌</div>
                        <div style="font-weight:700;color:#1f1a17;margin-bottom:6px;">오류 발생</div>
                        <div style="font-size:0.85em;color:#888;margin-bottom:20px;word-break:break-all;">${err.message}</div>
                        <button id="wc-err-close" style="padding:10px 24px;background:#1f1a17;color:#fff;border:none;border-radius:999px;cursor:pointer;font-weight:600;">닫기</button>
                    </div>
                `;
                const errClose = document.getElementById('wc-err-close');
                if (errClose) errClose.addEventListener('click', () => removeOverlay());
            }
        }
})();
