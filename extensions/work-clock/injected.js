(function() {
    const targetUrl = 'https://workplace.worksmobile.com/my-space/work-statistics';
    const isWorkplacePage = window.location.href.includes('workplace.worksmobile.com/my-space/work-statistics');

    const autoRunFlag = sessionStorage.getItem('work_clock_autorun');
    const wasAutoRedirected = autoRunFlag === 'pending';

    if (!isWorkplacePage) {
        sessionStorage.setItem('work_clock_autorun', 'pending');
        window.location.href = targetUrl;
        return;
    }

    if (wasAutoRedirected) {
        sessionStorage.removeItem('work_clock_autorun');
        if (document.readyState === 'loading') {
            alert('⏳ 페이지가 로딩 중입니다. 잠시 후 북마크를 다시 클릭해주세요.');
            return;
        }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fromDate = year + month + '01';
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const toDate = year + month + String(lastDay).padStart(2, '0');

    let empId = localStorage.getItem('work_clock_empId');

    if (!empId) {
        empId = prompt('📝 empId를 입력하세요\n\n🔍 empId 찾는 방법:\n1. F12 개발자 도구 열기\n2. Network 탭 선택\n3. 검색 버튼 클릭\n4. list? API의 Payload 탭에서 empId 복사\n\n💡 한 번만 입력하면 자동 저장됩니다!');
        if (!empId) {
            alert('❌ empId가 필요합니다.');
            return;
        }
    }

    localStorage.setItem('work_clock_empId', empId);

    const apiUrl = 'https://workplace.worksmobile.com/my-space/work-statistics/list?fromDate=' + fromDate +
                   '&toDate=' + toDate + '&empId=' + empId + '&chkWorkingDay=Y&_=' + Date.now();

    function removeAllWorkClockOverlays() {
        document.querySelectorAll('#work-clock-overlay, #work-clock-loading, #work-clock-style').forEach((el) => el.remove());
    }

    removeAllWorkClockOverlays();

    const overlay = document.createElement('div');
    overlay.id = 'work-clock-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.2);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'work-clock-loading';
    loadingDiv.style.cssText = 'background:#ffffff;padding:28px;border-radius:18px;box-shadow:0 18px 40px rgba(31,26,23,0.2);font-family:"Space Grotesk","IBM Plex Sans KR","Apple SD Gothic Neo",sans-serif;min-width:360px;max-width:520px;width:100%;border:1px solid rgba(255,140,0,0.2);';
    loadingDiv.innerHTML = '<div style="text-align:center;color:#6e6159">⏳ 근무 기록을 불러오는 중...</div>';
    overlay.appendChild(loadingDiv);
    document.body.appendChild(overlay);

    const onOverlayKeydown = (e) => {
        if (e.key === 'Escape') {
            removeAllWorkClockOverlays();
            document.removeEventListener('keydown', onOverlayKeydown);
        }
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            removeAllWorkClockOverlays();
            document.removeEventListener('keydown', onOverlayKeydown);
        }
    });
    document.addEventListener('keydown', onOverlayKeydown);

    if (!document.getElementById('work-clock-style')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'work-clock-style';
        styleTag.textContent = `
            .work-clock-modal {
                min-width: 360px;
                color: #1f1a17;
                background: #ffffff;
            }
            .work-clock-title {
                margin: 0 0 8px 0;
                text-align: center;
                font-size: 1.25rem;
                border-bottom: 2px solid rgba(255,140,0,0.3);
                padding-bottom: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .work-clock-title .icon {
                font-size: 0.95rem;
            }
            .work-clock-hero {
                padding: 14px;
                border-radius: 14px;
                border: 2px solid #FF8C00;
                margin-bottom: 8px;
                display: grid;
                gap: 6px;
            }
            .work-clock-hero.over {
                border-color: #0f7b4f;
            }
            .work-clock-hero .work-clock-label { margin-bottom: 0; }
            .work-clock-hero .work-clock-note { margin-top: 0; }
            .work-clock-stack {
                display: grid;
                gap: 8px;
                color: #3b322d;
                line-height: 1.7;
            }
            .work-clock-card {
                background: #FFFBF0;
                padding: 12px;
                border-radius: 12px;
                border: 1px solid rgba(255,140,0,0.2);
            }
            .work-clock-card.alt {
                background: #FFFDF5;
                border-color: rgba(255,140,0,0.16);
            }
            .work-clock-label {
                font-size: 0.85em;
                color: #6e6159;
                margin-bottom: 4px;
            }
            .work-clock-value {
                font-size: 1.2em;
                font-weight: 600;
                color: #FF8C00;
            }
            .work-clock-note {
                font-size: 0.82em;
                color: #6e6159;
                margin-top: 4px;
            }
            .work-clock-actions {
                display: flex;
                gap: 10px;
                margin-top: 14px;
            }
            .work-clock-btn {
                border: none;
                border-radius: 999px;
                cursor: pointer;
                font-weight: 600;
                padding: 12px;
                font-size: 14px;
            }
            .work-clock-btn.secondary {
                flex: 1;
                background: #1f1a17;
                color: white;
            }
            .work-clock-btn.primary {
                flex: 2;
                background: linear-gradient(135deg,#FFB347 0%,#FF8C00 100%);
                color: white;
            }
        `;
        document.head.appendChild(styleTag);
    }

    const iconCandidates = [
        '.ico_globe',
        '.icon-globe',
        '.ico_world',
        '.icon-world',
        '.icon-global'
    ];
    iconCandidates.forEach(selector => {
        const target = document.querySelector(selector);
        if (target && !target.dataset.workClockReplaced) {
            const clock = document.createElement('span');
            clock.textContent = '🕒';
            clock.style.fontSize = '18px';
            clock.style.display = 'inline-block';
            clock.style.marginRight = '6px';
            clock.dataset.workClockReplaced = 'true';
            target.replaceWith(clock);
        }
    });

    fetch(apiUrl)
        .then(r => {
            if (!r.ok) throw new Error('HTTP error! status: ' + r.status);
            return r.json();
        })
        .then(data => {
            if (!data.data || !data.data.list) {
                throw new Error('예상치 못한 응답 형식입니다.');
            }

            const records = data.data.list;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let workedMinutes = 0;
            let totalMonthMinutes = 0;
            let totalWorkDays = 0;
            let pastWorkDays = 0;
            let workedToday = false;
            let todayInProgress = false;

            records.forEach(record => {
                if (record.dayTpCd !== 'WORK') return;

                totalWorkDays++;

                const recordDate = new Date(
                    record.checkYmd.substring(0, 4),
                    parseInt(record.checkYmd.substring(4, 6)) - 1,
                    parseInt(record.checkYmd.substring(6, 8))
                );

                const isToday = recordDate.getTime() === today.getTime();
                const workTime = record.sumWorkTime;
                const hasWorkTime = workTime && workTime !== '0000';

                let timeMinutes = 0;
                if (hasWorkTime) {
                    const hours = parseInt(workTime.substring(0, 2), 10);
                    const minutes = parseInt(workTime.substring(2, 4), 10);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        timeMinutes = hours * 60 + minutes;
                        totalMonthMinutes += timeMinutes;
                    }
                }

                if (recordDate < today) {
                    pastWorkDays++;
                    workedMinutes += timeMinutes;
                } else if (isToday) {
                    if (hasWorkTime) {
                        pastWorkDays++;
                        workedToday = true;
                        workedMinutes += timeMinutes;
                    } else {
                        todayInProgress = true;
                    }
                }
            });

            const shouldHaveWorked = pastWorkDays * 8 * 60;
            const totalRequiredMinutes = totalWorkDays * 8 * 60;
            const shouldWorkMore = totalRequiredMinutes - totalMonthMinutes;
            const differenceMinutes = workedMinutes - shouldHaveWorked;
            const remainingWorkDays = totalWorkDays - pastWorkDays;

            const dailyNeededMins = remainingWorkDays > 0 && shouldWorkMore > 0
                ? Math.ceil(shouldWorkMore / remainingWorkDays)
                : 0;
            const dailyNeededHours = Math.floor(dailyNeededMins / 60);
            const dailyNeededMinsRem = dailyNeededMins % 60;

            const futureLeaveMinutes = totalMonthMinutes - workedMinutes;
            const totalMonthHours = Math.floor(totalMonthMinutes / 60);
            const totalMonthMins = totalMonthMinutes % 60;
            const futureLeaveHours = Math.floor(futureLeaveMinutes / 60);
            const futureLeaveMins = futureLeaveMinutes % 60;

            let todayStatus = '오늘 제외';
            if (workedToday) {
                todayStatus = '오늘 포함';
            } else if (todayInProgress) {
                todayStatus = '오늘 진행 중 (퇴근 미체크)';
            }

            const workedHours = Math.floor(workedMinutes / 60);
            const workedMins = workedMinutes % 60;
            const shouldWorkMoreHours = Math.floor(shouldWorkMore / 60);
            const shouldWorkMoreMins = shouldWorkMore % 60;
            const diffHours = Math.floor(Math.abs(differenceMinutes) / 60);
            const diffMins = Math.abs(differenceMinutes) % 60;
            const isOverTime = differenceMinutes > 0;

            const differenceText = isOverTime
                ? `<span style="color:#0f7b4f;font-weight:700;font-size:1.4em;">+${diffHours}시간 ${diffMins}분 초과 ✨</span>`
                : `<span style="color:#FF8C00;font-weight:700;font-size:1.4em;">${diffHours}시간 ${diffMins}분 부족 ⚠️</span>`;

            loadingDiv.innerHTML = `
                <div class="work-clock-modal">
                    <h2 class="work-clock-title">
                        <span class="icon">🕒</span>
                        ${year}년 ${month}월 근무 현황
                    </h2>

                    <div class="work-clock-hero ${isOverTime ? 'over' : ''}">
                        <div class="work-clock-label">⚖️ 현재 초과/부족</div>
                        <div>${differenceText}</div>
                        <div class="work-clock-note">
                            근무 ${workedHours}h ${workedMins}m / 목표 ${Math.floor(shouldHaveWorked/60)}h ${shouldHaveWorked%60}m · ${todayStatus}
                        </div>
                    </div>

                    <div class="work-clock-stack">
                        <div class="work-clock-card">
                            <div class="work-clock-label">📅 총 근무일</div>
                            <div><strong>${totalWorkDays}일</strong> · 지난 ${pastWorkDays}일 + 남은 ${remainingWorkDays}일</div>
                        </div>

                        ${futureLeaveMinutes > 0 ? `
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div class="work-clock-card">
                                <div class="work-clock-label">✅ 오늘까지 근무한 시간</div>
                                <div class="work-clock-value">${workedHours}시간 ${workedMins}분</div>
                            </div>
                            <div class="work-clock-card">
                                <div class="work-clock-label">📊 이번달 총 근무시간 (부재 포함)</div>
                                <div class="work-clock-value">${totalMonthHours}시간 ${totalMonthMins}분</div>
                                <div class="work-clock-note">부재 확정 ${futureLeaveHours}h ${futureLeaveMins}m 포함</div>
                            </div>
                        </div>
                        ` : `
                        <div class="work-clock-card">
                            <div class="work-clock-label">✅ 오늘까지 근무한 시간</div>
                            <div class="work-clock-value">${workedHours}시간 ${workedMins}분</div>
                        </div>
                        `}

                        <div class="work-clock-card alt">
                            ${shouldWorkMore <= 0 ? `
                            <div class="work-clock-label">📋 앞으로 근무해야 하는 시간</div>
                            <div class="work-clock-value" style="color:#0f7b4f">이번달 근무 시간을 모두 채웠어요! 🎉</div>
                            ` : `
                            <div class="work-clock-label">📋 앞으로 근무해야 하는 시간</div>
                            <div class="work-clock-value">${shouldWorkMoreHours}시간 ${shouldWorkMoreMins}분</div>
                            `}
                        </div>
                    </div>

                    <div class="work-clock-actions">
                        <button id="work-clock-reset-empid" class="work-clock-btn secondary">empId 재설정</button>
                        <button id="work-clock-close" class="work-clock-btn primary">닫기</button>
                    </div>
                </div>
            `;

            document.getElementById('work-clock-close').addEventListener('click', () => {
                removeAllWorkClockOverlays();
                document.removeEventListener('keydown', onOverlayKeydown);
            });

            document.getElementById('work-clock-reset-empid').addEventListener('click', () => {
                localStorage.removeItem('work_clock_empId');
                removeAllWorkClockOverlays();
                document.removeEventListener('keydown', onOverlayKeydown);
                alert('✅ empId가 초기화되었습니다.\n북마크를 다시 클릭하여 새로운 empId를 입력하세요.');
            });
        })
        .catch(err => {
            console.error('Error:', err);
            loadingDiv.innerHTML = `
                <div style="color:#FF8C00">
                    <h3>❌ 오류 발생</h3>
                    <p>${err.message}</p>
                    <p style="font-size:0.9em;color:#6e6159">개발자 콘솔(F12)을 확인하세요.</p>
                    <button onclick="document.querySelectorAll('#work-clock-overlay, #work-clock-loading').forEach(el => el.remove())" style="margin-top:10px;padding:10px 20px;background:#FF8C00;color:white;border:none;border-radius:999px;cursor:pointer">
                        닫기
                    </button>
                </div>
            `;
        });
})();
