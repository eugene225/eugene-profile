async function injectScript(tabId) {
    try {
        // workclock-utils.js(순수 유틸)를 먼저 주입해 injected.js와 같은 스코프를 공유시킴
        await chrome.scripting.executeScript({ target: { tabId }, files: ['workclock-utils.js', 'injected.js'] });
    } catch (e) {
        console.error('Work Clock inject failed:', e);
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    if (tab && tab.id) await injectScript(tab.id);
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'run-work-clock') return;
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) await injectScript(tab.id);
});

// content script 대신 fetch 처리 (CORS·쿠키 문제 없음)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // JWT 액세스 토큰 등 "텍스트" 응답을 가져올 때 (any-origin에서 호출 가능하도록 background 경유)
    if (msg.type === 'FETCH_TEXT') {
        fetch(msg.url, { credentials: 'include' })
            .then(async (r) => {
                if (!r.ok) return sendResponse({ ok: false, error: 'HTTP ' + r.status });
                sendResponse({ ok: true, text: await r.text() });
            })
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (msg.type !== 'FETCH_WORK_DATA') return;
    fetch(msg.url, { credentials: 'include' })
        .then(async (r) => {
            // 로그인 세션이 없으면 서버가 로그인 페이지(HTML) 또는 401/403을 반환한다.
            if (r.status === 401 || r.status === 403) throw new Error('NOT_LOGGED_IN');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const ct = r.headers.get('content-type') || '';
            const body = await r.text();
            if (!ct.includes('json') || /^\s*<(?:!doctype|html)/i.test(body)) {
                throw new Error('NOT_LOGGED_IN'); // JSON이 아니라 HTML => 미로그인
            }
            return JSON.parse(body);
        })
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // 비동기 응답 유지
});
