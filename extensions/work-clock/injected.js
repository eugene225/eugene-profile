(async function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const todayStr = year + month + String(now.getDate()).padStart(2, '0');
    const fromDate = year + month + '01';
    const toDate = year + month + String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0');

    const stored = await chrome.storage.local.get(['work_clock_empId', 'work_clock_startTime']);
    let empId = stored.work_clock_empId;
    if (!empId) {
        empId = prompt('📝 empId를 입력하세요\n\n🔍 찾는 방법: F12 → Network → 검색 클릭 → list? API Payload에서 empId 복사\n\n💡 한 번만 입력하면 저장됩니다!');
        if (!empId) { alert('❌ empId가 필요합니다.'); return; }
    }
    await chrome.storage.local.set({ work_clock_empId: empId });
    let savedStartTime = stored.work_clock_startTime || '09:00';

    const companyId = '5662ae5e-e3a9-4a8b-866c-1fdc44b5f204';

    const apiUrl = 'https://workplace.worksmobile.com/my-space/work-statistics/list?fromDate=' + fromDate +
                   '&toDate=' + toDate + '&empId=' + empId + '&chkWorkingDay=Y&_=' + Date.now();
    const commuteApiUrl = 'https://workplace.worksmobile.com/my-space/commute-status/list?companyId=' + companyId +
                          '&fromDate=' + todayStr + '&toDate=' + todayStr + '&empId=' + empId + '&_=' + Date.now();

    function fetchData(url) {
        return new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'FETCH_WORK_DATA', url }, resolve);
        });
    }

    function removeOverlay() {
        document.querySelectorAll('#wc-overlay, #wc-style').forEach(el => el.remove());
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
        if (!response || !response.ok) throw new Error(response ? response.error : '응답 없음');
        const data = response.data;

        // 오늘 출퇴근 시간 (commute-status API)
        let todayRealIn = null, todayRealOut = null;
        if (commuteResponse && commuteResponse.ok) {
            const cl = commuteResponse.data && commuteResponse.data.data && commuteResponse.data.data.list;
            if (cl) {
                const todayRec = cl.find(r => r.checkYmd === todayStr);
                if (todayRec && todayRec.realInHm) {
                    const h = todayRec.realInHm.slice(0,2), m = todayRec.realInHm.slice(2,4);
                    todayRealIn = h + ':' + m;
                    savedStartTime = todayRealIn;
                    chrome.storage.local.set({ work_clock_startTime: todayRealIn });
                }
                if (todayRec && todayRec.realOutHm) {
                    const h = todayRec.realOutHm.slice(0,2), m = todayRec.realOutHm.slice(2,4);
                    todayRealOut = h + ':' + m;
                }
            }
        }
        if (!data.data || !data.data.list) throw new Error('응답 형식 오류');

            const records = data.data.list;
            const today = new Date(); today.setHours(0,0,0,0);
            const LEAVE_EXACT = new Set([2*60, 4*60, 6*60, 8*60]);

            let workedMinutes = 0, totalWorkDays = 0, pastWorkDays = 0;
            let futureLeave6h = 0, futureLeave8h = 0, futureNonLeave = 0;
            let workedToday = false, todayInProgress = false;
            const leaveDays = [];

            records.forEach(r => {
                if (r.dayTpCd !== 'WORK') return;
                const d = new Date(+r.checkYmd.slice(0,4), +r.checkYmd.slice(4,6)-1, +r.checkYmd.slice(6,8));
                const isToday = d.getTime() === today.getTime();
                const wt = r.sumWorkTime;
                const hasMins = wt && wt !== '0000';
                let mins = 0;
                if (hasMins) { const h=+wt.slice(0,2), m=+wt.slice(2,4); if (!isNaN(h+m)) mins = h*60+m; }
                const isLeave = hasMins && (r.restTime||'0000')==='0000' && LEAVE_EXACT.has(mins);
                const isFullLeave = isLeave && mins >= 6*60;
                totalWorkDays++;
                if (d < today) {
                    pastWorkDays++; workedMinutes += Math.min(mins, 10 * 60);
                    if (isFullLeave) {
                        leaveDays.push({ date: d, mins, future: false });
                    }
                } else if (isToday) {
                    if (hasMins) { pastWorkDays++; workedToday = true; workedMinutes += Math.min(mins, 10 * 60); }
                    else todayInProgress = true;
                } else {
                    if (isFullLeave) {
                        mins >= 8*60 ? futureLeave8h++ : futureLeave6h++;
                        leaveDays.push({ date: d, mins, future: true });
                    } else futureNonLeave++;
                }
            });


            const totalTarget = totalWorkDays * 8 * 60;

            function computeStats(extraMins) {
                const wToday = workedToday || extraMins > 0;
                const tInProg = todayInProgress && extraMins === 0;
                const wM = workedMinutes + extraMins;
                const pD = pastWorkDays + (extraMins > 0 && !workedToday ? 1 : 0);
                const todayDiff = wM - pD * 8 * 60;
                const projected = wM + futureLeave6h*6*60 + futureLeave8h*8*60 + futureNonLeave*8*60 + (tInProg ? 8*60 : 0);
                const monthDiff = projected - totalTarget;
                const remainReal = futureNonLeave + (tInProg ? 1 : 0);
                const covered = wM + futureLeave6h*6*60 + futureLeave8h*8*60;
                const stillNeed = Math.max(0, totalTarget - covered);
                const avgMins = remainReal > 0 ? Math.round(stillNeed / remainReal) : 0;
                const savedStart = savedStartTime;
                const [sh, sm] = savedStart.split(':').map(Number);
                const balanceMins = sh*60 + sm + 8*60 - todayDiff;
                const bH = Math.floor(balanceMins/60)%24, bM = balanceMins%60;
                return {
                    wToday, tInProg, wM, pD, todayDiff, monthDiff, remainReal,
                    avgH: Math.floor(avgMins/60), avgM: avgMins%60,
                    balanceStr: String(bH).padStart(2,'0')+':'+String(bM).padStart(2,'0'),
                    savedStart,
                    todayNote: wToday ? '오늘 포함' : tInProg ? '진행 중' : '오늘 제외'
                };
            }

            function fmtVal(diff) {
                const ah = Math.floor(Math.abs(diff)/60), am = Math.abs(diff)%60;
                return diff >= 0
                    ? `<span class="wc-hero-val over">+${ah}h ${am}m 초과 ✓</span>`
                    : `<span class="wc-hero-val">-${ah}h ${am}m 부족</span>`;
            }

            function getNowStr() {
                const t = new Date();
                return t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
            }

            function getBreakMins(rawMins) {
                if (rawMins >= 6 * 60) return 60;
                return 0;
            }


            function calcPreview(startVal, endVal) {
                const [sh,sm]=startVal.split(':').map(Number), [eh,em]=endVal.split(':').map(Number);
                const rawMins=(eh*60+em)-(sh*60+sm);
                const breakMins=getBreakMins(rawMins);
                const m=Math.min(rawMins-breakMins, 10*60);
                if(m<=0) return null;
                const newW=workedMinutes+m, newP=pastWorkDays+(workedToday?0:1);
                const diff=newW-newP*8*60, ah=Math.floor(Math.abs(diff)/60), am2=Math.abs(diff)%60;
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

            modal.innerHTML = `
                <div class="wc-header">
                    <h2>🏃 퇴근시켜주세요</h2>
                    <div class="wc-sub">${year}년 ${month}월 근무 현황</div>
                </div>
                <div class="wc-body">
                    <div id="wc-month-hero" class="wc-hero ${initStats.monthDiff>=0?'over':''}">
                        <div class="wc-hero-label">이달 예상</div>
                        <div id="wc-month-val">${fmtVal(initStats.monthDiff)}</div>
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

                    <div class="wc-time-card" ${isWeekend || isDone ? 'style="opacity:0.4;pointer-events:none;"' : ''}>
                        <div class="wc-card-label" style="margin-bottom:8px;">오늘 퇴근 계산${isDone ? ' · <span style="color:#0a7a4a;">퇴근 완료</span>' : ''}</div>
                        <div id="wc-balance" class="wc-balance" style="${!isDone && (initStats.tInProg||initStats.wToday)?'':'display:none;'}">
                            딱 맞춰 퇴근 <strong style="color:#C06400;font-size:1.05em;" id="wc-balance-time">${initStats.balanceStr}</strong>
                            <span style="color:#bbb;font-size:0.9em;" id="wc-balance-start"> (출근 ${initStats.savedStart} 기준)</span>
                        </div>
                        <div id="wc-preview" class="wc-balance" style="${isDone?'display:none;':''}">
                            지금(${nowStr}) 퇴근하면 → ${calcPreview(savedStart, nowStr)||'<span style="color:#ccc">계산 불가</span>'}
                        </div>
                        <div class="wc-time-row">
                            <div>
                                <div class="wc-time-lbl">출근</div>
                                <input type="time" id="wc-start" class="wc-input" value="${savedStart}">
                            </div>
                            <div>
                                <div class="wc-time-lbl">퇴근</div>
                                <input type="time" id="wc-end" class="wc-input" value="${isDone ? (todayRealOut||nowStr) : nowStr}">
                            </div>
                            <button id="wc-apply" class="wc-btn apply">반영</button>
                        </div>
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
                document.getElementById('wc-month-val').innerHTML = fmtVal(stats.monthDiff);
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

            if (!isDone) liveTimer = setInterval(() => updatePreview(true), 30000);

            // 이벤트
            document.getElementById('wc-close').addEventListener('click', closeAll);
            document.getElementById('wc-reset').addEventListener('click', () => {
                chrome.storage.local.remove('work_clock_empId');
                closeAll();
                alert('✅ empId 초기화됨. 다시 클릭하면 새로 입력할 수 있습니다.');
            });

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
                const m = (eh*60+em)-(sh*60+sm);
                if (m <= 0) { alert('퇴근 시간이 출근 시간보다 늦어야 합니다.'); return; }
                window._wcOverrideMins = m;
                userChangedEnd = true; // 반영 후 실시간 auto-update 중단
                updateHero(computeStats(m), sv, ev, true);
            });

            document.getElementById('wc-cancel-btn')?.addEventListener('click', () => {
                window._wcOverrideMins = 0;
                userChangedEnd = false;
                updateHero(computeStats(0), null, null, false);
                // preview도 실시간으로 복귀
                updatePreview(true);
            });

        } catch(err) {
            console.error('퇴근시켜주세요 Error:', err);
            modal.innerHTML = `
                <div style="padding:32px;text-align:center;">
                    <div style="font-size:2em;margin-bottom:12px;">❌</div>
                    <div style="font-weight:700;color:#1f1a17;margin-bottom:6px;">오류 발생</div>
                    <div style="font-size:0.85em;color:#888;margin-bottom:20px;">${err.message}</div>
                    <button onclick="document.getElementById('wc-overlay').remove()" style="padding:10px 24px;background:#1f1a17;color:#fff;border:none;border-radius:999px;cursor:pointer;font-weight:600;">닫기</button>
                </div>
            `;
        }
})();
