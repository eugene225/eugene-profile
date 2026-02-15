const TARGET_URL = 'https://workplace.worksmobile.com/my-space/work-statistics';
const TARGET_PREFIX = 'https://workplace.worksmobile.com/';

async function inject(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['injected.js']
        });
    } catch (error) {
        console.error('Failed to inject script:', error);
    }
}

async function runWorkClock(activeTab) {
    if (activeTab && activeTab.url && activeTab.url.startsWith(TARGET_PREFIX)) {
        await inject(activeTab.id);
        return;
    }

    const existingTabs = await chrome.tabs.query({ url: TARGET_PREFIX + '*' });
    if (existingTabs.length > 0) {
        const targetTab = existingTabs[0];
        await chrome.tabs.update(targetTab.id, { active: true });
        await inject(targetTab.id);
        return;
    }

    const newTab = await chrome.tabs.create({ url: TARGET_URL, active: true });
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            inject(tabId);
        }
    });
}

chrome.action.onClicked.addListener(async (tab) => {
    if (!tab || !tab.id) {
        return;
    }
    await runWorkClock(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'run-work-clock') {
        return;
    }
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await runWorkClock(activeTab);
});
