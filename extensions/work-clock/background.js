async function injectScript(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['injected.js'] });
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
    if (msg.type !== 'FETCH_WORK_DATA') return;
    fetch(msg.url, { credentials: 'include' })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => sendResponse({ ok: true, data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // 비동기 응답 유지
});
