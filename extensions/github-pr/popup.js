const PR_TEMPLATE_URL = 'https://api.haengbokza.site/etc/pr-template';
const BRANCHES_URL = 'https://api.haengbokza.site/etc/branches';

const repoEl = document.getElementById('repo');
const baseEl = document.getElementById('base');
const headEl = document.getElementById('head');
const tokenEl = document.getElementById('token');
const draftEl = document.getElementById('draft');
const jiraUrlEl = document.getElementById('jiraUrl');
const statusEl = document.getElementById('status');
const branchesList = document.getElementById('branches');
const loadBranchesBtn = document.getElementById('loadBranches');
const createBtn = document.getElementById('create');

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

const storage = typeof chrome !== 'undefined' && chrome?.storage?.local ? chrome.storage.local : null;

function loadSaved() {
  if (!storage) return;
  storage.get(['repo', 'base', 'head', 'jiraUrl'], (data) => {
    if (data.repo) repoEl.value = data.repo;
    if (data.base) baseEl.value = data.base;
    if (data.head) headEl.value = data.head;
    if (data.jiraUrl) jiraUrlEl.value = data.jiraUrl;
  });
}

function saveFields() {
  if (!storage) return;
  storage.set({
    repo: repoEl.value.trim(),
    base: baseEl.value.trim(),
    head: headEl.value.trim(),
    jiraUrl: jiraUrlEl.value.trim()
  });
}

function parseRepo() {
  const repoValue = repoEl.value.trim();
  const [owner, repo] = repoValue.split('/');
  if (!owner || !repo) {
    throw new Error('Repository는 owner/repo 형식이어야 합니다.');
  }
  return { owner, repo };
}

function fillBranches(branches) {
  branchesList.innerHTML = '';
  branches.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    branchesList.appendChild(option);
  });
}

function normalizeBranches(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
  if (Array.isArray(payload.branches)) {
    return payload.branches.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
  }
  if (Array.isArray(payload.data)) {
    return payload.data.map((item) => item?.name).filter(Boolean);
  }
  if (Array.isArray(payload.result)) {
    return payload.result.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
  }
  return [];
}

async function loadBranches() {
  const token = tokenEl.value.trim();
  if (!token) {
    setStatus('브랜치 조회에는 GitHub token이 필요합니다.', 'error');
    return;
  }

  let owner;
  let repo;
  try {
    ({ owner, repo } = parseRepo());
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }

  setStatus('Loading branches...', '');

  try {
    const res = await fetch(BRANCHES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-token': token
      },
      body: JSON.stringify({ owner, repo })
    });

    if (!res.ok) {
      throw new Error(`Branches error: ${res.status}`);
    }

    const data = await res.json();
    const branches = normalizeBranches(data);

    if (!branches.length) {
      throw new Error('No branches returned.');
    }

    fillBranches(branches);
    setStatus(`Loaded ${branches.length} branches.`, 'success');
  } catch (err) {
    setStatus(err.message || '브랜치 조회 실패', 'error');
  }
}

async function generateTitleBody({ owner, repo, base, head, jiraUrl, token }) {
  const res = await fetch(PR_TEMPLATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-github-token': token
    },
    body: JSON.stringify({ owner, repo, base, head, jiraUrl })
  });

  if (!res.ok) {
    const msg = `PR Template error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data.title || !data.body) {
    throw new Error('PR Template response must include title and body.');
  }

  return { title: data.title, body: data.body };
}

async function createPR() {
  const base = baseEl.value.trim();
  const head = headEl.value.trim();
  const token = tokenEl.value.trim();
  const jiraUrl = jiraUrlEl.value.trim();
  const draft = !!draftEl.checked;

  if (!base || !head || !token) {
    setStatus('base/head/token을 모두 입력하세요.', 'error');
    return;
  }

  let owner;
  let repo;
  try {
    ({ owner, repo } = parseRepo());
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }

  saveFields();
  setStatus('Generating title/body...', '');

  let title = '';
  let body = '';

  try {
    const generated = await generateTitleBody({ owner, repo, base, head, jiraUrl, token });
    title = generated.title;
    body = generated.body;
  } catch (err) {
    setStatus(err.message || 'PR Template 요청 실패', 'error');
    return;
  }

  setStatus('Creating PR...', '');

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        body,
        head,
        base,
        draft
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data && data.message ? data.message : `HTTP ${res.status}`;
      throw new Error(msg);
    }

    setStatus('PR created. Opening...', 'success');
    if (data.html_url) {
      chrome.tabs.create({ url: data.html_url });
    }
  } catch (err) {
    setStatus(err.message || 'PR 생성 실패', 'error');
  }
}

loadBranchesBtn.addEventListener('click', loadBranches);
createBtn.addEventListener('click', createPR);

[repoEl, baseEl, headEl, jiraUrlEl].forEach((el) => {
  el.addEventListener('blur', saveFields);
});

loadSaved();
