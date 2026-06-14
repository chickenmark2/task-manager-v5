const API_KEY = 'AIzaSyCKg4TQExbxyxZ6wMpaTCVrU1U6fXhqAX0';
const PROJECT_ID = 'project-chickenmark2-001';
const REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;
const FIRESTORE_QUERY_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
const FIRESTORE_TASKS_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tasks`;
const MANABA_UNSUBMITTED_URL = 'https://cit.manaba.jp/ct/home_library_query';

let syncing = false;

// ── Auth ──

async function refreshIdToken(refreshToken) {
  const res = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const json = await res.json();
  if (!res.ok) throw new Error('トークン更新失敗');
  return {
    idToken: json.id_token,
    refreshToken: json.refresh_token,
    uid: json.user_id,
    expiresAt: Date.now() + 3600 * 1000,
  };
}

async function getValidToken() {
  const { auth } = await chrome.storage.local.get('auth');
  if (!auth) return null;
  if (Date.now() < auth.expiresAt - 5 * 60 * 1000) return auth;
  try {
    const refreshed = await refreshIdToken(auth.refreshToken);
    const updated = { ...auth, ...refreshed };
    await chrome.storage.local.set({ auth: updated });
    return updated;
  } catch {
    await chrome.storage.local.remove('auth');
    return null;
  }
}

// ── Firestore ──

function toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFsValue) } };
  if (typeof val === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, toFsValue(v)])) } };
  }
  return { stringValue: String(val) };
}

async function fetchExistingTaskTitles(idToken, uid) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'tasks' }],
      where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } } },
      select: { fields: [{ fieldPath: 'title' }] },
    },
  };
  try {
    const res = await fetch(FIRESTORE_QUERY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return new Set();
    const results = await res.json();
    const titles = new Set();
    for (const r of results) {
      const title = r.document?.fields?.title?.stringValue;
      if (title) titles.add(title);
    }
    return titles;
  } catch {
    return new Set();
  }
}

async function createTask(idToken, uid, assignment) {
  const now = new Date().toISOString();
  const task = {
    userId: uid,
    title: assignment.title,
    type: assignment.type,
    description: assignment.courseName ? `${assignment.courseName}の課題` : '',
    rewardMinutes: 10,
    deadline: assignment.deadline,
    steps: [{ id: Date.now(), title: assignment.title, description: '', completed: false }],
    status: 'pending',
    currentStepIndex: 0,
  };
  const fields = Object.fromEntries(Object.entries(task).map(([k, v]) => [k, toFsValue(v)]));
  fields.createdAt = { timestampValue: now };
  fields.updatedAt = { timestampValue: now };
  const res = await fetch(FIRESTORE_TASKS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return res.ok ? { ok: true } : { ok: false };
}

// ── Tab helpers ──

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) { reject(new Error('tab not found')); return; }
      if (tab.status === 'complete') { resolve(); return; }
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('timeout'));
      }, 20000);
      function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

async function extractFromTab(tabId) {
  try {
    let result = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT' }).catch(() => null);
    if (!result) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      result = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT' }).catch(() => null);
    }
    return result?.assignments ?? [];
  } catch {
    return [];
  }
}

// ── Auto sync ──

async function autoSync() {
  if (syncing) return;
  syncing = true;
  let openedTabId = null;

  try {
    const auth = await getValidToken();
    if (!auth) return;

    // 未提出一覧タブがあればそれを使う。なければバックグラウンドで開く
    const unsubmittedTabs = await chrome.tabs.query({ url: `${MANABA_UNSUBMITTED_URL}*` });

    let tabId;
    if (unsubmittedTabs.length > 0) {
      tabId = unsubmittedTabs[0].id;
    } else {
      const tab = await chrome.tabs.create({ url: MANABA_UNSUBMITTED_URL, active: false });
      openedTabId = tab.id;
      await waitForTabLoad(tab.id);
      tabId = tab.id;
    }

    const assignments = await extractFromTab(tabId);
    if (assignments.length === 0) return;

    const existingTitles = await fetchExistingTaskTitles(auth.idToken, auth.uid);
    const newAssignments = assignments.filter(a => a.deadline && !existingTitles.has(a.title));
    if (newAssignments.length === 0) return;

    let success = 0;
    for (const a of newAssignments) {
      const r = await createTask(auth.idToken, auth.uid, a);
      if (r.ok) success++;
    }

    if (success > 0) {
      chrome.notifications.create(`sync-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: '課題を自動登録しました',
        message: `${success}件の新しい課題を登録しました。`,
      });
    }
  } catch (e) {
    console.error('[auto-sync] error:', e);
  } finally {
    if (openedTabId !== null) {
      chrome.tabs.remove(openedTabId).catch(() => {});
    }
    syncing = false;
  }
}

// ── Trigger: 課題管理アプリを開いたときに自動同期 ──

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url ?? '';
  if (
    url.includes('project-chickenmark2-001.web.app') ||
    url.includes('project-chickenmark2-001.firebaseapp.com') ||
    url.includes('task-manager-v3-drab.vercel.app') ||
    url.includes('task-manager-v4-six.vercel.app')
  ) {
    autoSync();
  }
});
