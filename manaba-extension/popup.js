// Firebase プロジェクト設定
const API_KEY = 'AIzaSyCKg4TQExbxyxZ6wMpaTCVrU1U6fXhqAX0';
const PROJECT_ID = 'project-chickenmark2-001';
const MANABA_UNSUBMITTED_URL = 'https://cit.manaba.jp/ct/home_library_query';

const SIGN_IN_URL =
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const REFRESH_URL =
  `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;
const FIRESTORE_URL =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tasks`;

// ───── Firebase Auth ─────

async function signIn(email, password) {
  const res = await fetch(SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'ログイン失敗');
  return {
    idToken: json.idToken,
    refreshToken: json.refreshToken,
    uid: json.localId,
    email: json.email,
    expiresAt: Date.now() + 3600 * 1000,
  };
}

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
  // 5分前にリフレッシュ
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

// ───── Firestore REST ─────

async function fetchExistingTaskTitles(idToken, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'tasks' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: uid },
        },
      },
      select: { fields: [{ fieldPath: 'title' }] },
    },
  };
  try {
    const res = await fetch(url, {
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

function toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFsValue) } };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(val).map(([k, v]) => [k, toFsValue(v)])
        ),
      },
    };
  }
  return { stringValue: String(val) };
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
    steps: [
      {
        id: Date.now(),
        title: assignment.title,
        description: '',
        completed: false,
      },
    ],
    status: 'pending',
    currentStepIndex: 0,
  };

  const fields = Object.fromEntries(
    Object.entries(task).map(([k, v]) => [k, toFsValue(v)])
  );
  fields.createdAt = { timestampValue: now };
  fields.updatedAt = { timestampValue: now };

  const res = await fetch(FIRESTORE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    console.error('[manaba拡張] Firestore書き込みエラー:', msg, json);
    return { ok: false, error: msg };
  }
  console.log('[manaba拡張] 登録成功 docId:', json.name?.split('/').pop(), ' userId:', uid);
  return { ok: true };
}

// ───── UI ヘルパー ─────

const TYPE_LABELS = {
  report: 'レポート',
  quiz: '小テスト',
  drill: 'ドリル',
  survey: 'アンケート',
  project: 'プロジェクト',
  other: 'その他',
};

function deadlineDisplay(deadline) {
  if (!deadline) return { text: '締め切り不明', cls: '' };
  const now = new Date();
  const due = new Date(deadline);
  const diffH = (due - now) / (1000 * 60 * 60);
  const fmt =
    due.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) +
    ' ' +
    due.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  if (diffH < 0) return { text: `期限切れ: ${fmt}`, cls: 'deadline-red' };
  if (diffH < 24) return { text: `今日 ${fmt}`, cls: 'deadline-orange' };
  if (diffH < 72) return { text: `${fmt}`, cls: 'deadline-yellow' };
  return { text: fmt, cls: '' };
}

function renderAssignments(assignments, existingTitles = new Set()) {
  const list = document.getElementById('assignments-list');
  const noMsg = document.getElementById('no-assignments');
  const importBtn = document.getElementById('import-btn');

  list.innerHTML = '';

  if (assignments.length === 0) {
    noMsg.style.display = '';
    importBtn.style.display = 'none';
    return;
  }

  noMsg.style.display = 'none';

  const hasNew = assignments.some(a => !existingTitles.has(a.title));
  importBtn.style.display = hasNew ? '' : 'none';

  assignments.forEach((a, i) => {
    const dl = deadlineDisplay(a.deadline);
    const registered = existingTitles.has(a.title);
    const item = document.createElement('div');
    item.className = 'assignment-item';
    item.style.opacity = registered ? '0.5' : '1';
    item.innerHTML = `
      <input type="checkbox" id="chk-${i}" ${(!registered && a.deadline) ? 'checked' : ''} ${registered ? 'disabled' : ''}>
      <div class="assignment-info">
        <div class="assignment-title">${escapeHtml(a.title)}</div>
        <div class="assignment-meta">
          <span class="badge badge-${a.type}">${TYPE_LABELS[a.type]}</span>
          ${a.courseName ? escapeHtml(a.courseName) + ' · ' : ''}
          <span class="${dl.cls}">${dl.text}</span>
          ${registered ? '<span style="color:#16a34a;font-weight:600;">✓ 登録済み</span>' : ''}
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showView(name) {
  document.getElementById('login-view').style.display = name === 'login' ? '' : 'none';
  document.getElementById('main-view').style.display = name === 'main' ? '' : 'none';
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('import-status');
  el.textContent = msg;
  el.className = isError ? 'error' : 'success';
  el.style.display = msg ? '' : 'none';
}

// ───── タブ読み込み待機 ─────

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

// ───── 初期化 ─────

let scannedAssignments = [];

async function init() {
  const auth = await getValidToken();
  if (auth) {
    document.getElementById('user-label').textContent = auth.email || '';
    document.getElementById('uid-label').textContent = `UID: ${auth.uid}`;
    showView('main');
  } else {
    showView('login');
  }
}

// ───── ログイン ─────

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'ログイン中...';

  try {
    const auth = await signIn(email, password);
    await chrome.storage.local.set({ auth });
    document.getElementById('user-label').textContent = auth.email;
    document.getElementById('uid-label').textContent = `UID: ${auth.uid}`;
    showView('main');
  } catch (err) {
    const msgs = {
      EMAIL_NOT_FOUND: 'メールアドレスが見つかりません',
      INVALID_PASSWORD: 'パスワードが違います',
      INVALID_LOGIN_CREDENTIALS: 'メールアドレスまたはパスワードが違います',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'しばらく後にお試しください',
    };
    errEl.textContent = msgs[err.message] || err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'ログイン';
  }
});

// ───── ログアウト ─────

document.getElementById('logout-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove('auth');
  scannedAssignments = [];
  document.getElementById('assignments-area').style.display = 'none';
  showView('login');
});

// ───── スキャン ─────

document.getElementById('scan-btn').addEventListener('click', async () => {
  const notOnManaba = document.getElementById('not-on-manaba');
  const area = document.getElementById('assignments-area');
  const btn = document.getElementById('scan-btn');

  btn.disabled = true;
  btn.textContent = 'スキャン中...';
  setStatus('');

  let openedTabId = null;

  try {
    const unsubmittedTabs = await chrome.tabs.query({ url: 'https://cit.manaba.jp/ct/home_library_query*' });
    const anyManabaTabs = await chrome.tabs.query({ url: 'https://cit.manaba.jp/*' });

    // manabaのタブが1つも開いていない（未ログイン or 未アクセス）
    if (unsubmittedTabs.length === 0 && anyManabaTabs.length === 0) {
      notOnManaba.style.display = '';
      area.style.display = 'none';
      return;
    }
    notOnManaba.style.display = 'none';

    let tabId;
    if (unsubmittedTabs.length > 0) {
      // 未提出一覧タブがすでに開いていればそれを使う
      tabId = unsubmittedTabs[0].id;
    } else {
      // /home など他のmanabaタブのみの場合 → 未提出一覧をバックグラウンドで開いて取得
      btn.textContent = '課題一覧を取得中...';
      const tab = await chrome.tabs.create({ url: MANABA_UNSUBMITTED_URL, active: false });
      openedTabId = tab.id;
      await waitForTabLoad(tab.id);
      tabId = tab.id;
    }

    // content script が動いているか確認。動いていなければ inject する
    let result = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT' }).catch(() => null);
    if (!result) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      result = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT' }).catch(() => null);
    }

    scannedAssignments = result?.assignments ?? [];
    area.style.display = '';
    const currentAuth = await getValidToken();
    const existingTitles = currentAuth
      ? await fetchExistingTaskTitles(currentAuth.idToken, currentAuth.uid)
      : new Set();
    renderAssignments(scannedAssignments, existingTitles);
  } catch (err) {
    setStatus('スキャン中にエラーが発生しました: ' + err.message, true);
  } finally {
    if (openedTabId !== null) {
      chrome.tabs.remove(openedTabId).catch(() => {});
    }
    btn.disabled = false;
    btn.textContent = '🔍 manabaをスキャン';
  }
});

// ───── 登録 ─────

document.getElementById('import-btn').addEventListener('click', async () => {
  const auth = await getValidToken();
  if (!auth) { showView('login'); return; }

  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.textContent = '登録中...';
  setStatus('');

  // チェックが入っているものだけ選択
  const selected = scannedAssignments.filter((_, i) => {
    const chk = document.getElementById(`chk-${i}`);
    return chk?.checked;
  });

  if (selected.length === 0) {
    setStatus('課題が選択されていません', true);
    btn.disabled = false;
    btn.textContent = '✅ 選択した課題を登録する';
    return;
  }

  let success = 0;
  let fail = 0;
  const errors = [];

  for (const assignment of selected) {
    const result = await createTask(auth.idToken, auth.uid, assignment);
    if (result.ok) {
      success++;
    } else {
      fail++;
      errors.push(result.error);
    }
  }

  if (fail === 0) {
    setStatus(`✅ ${success}件の課題を登録しました！`);
    const refreshedAuth = await getValidToken();
    const refreshedTitles = refreshedAuth
      ? await fetchExistingTaskTitles(refreshedAuth.idToken, refreshedAuth.uid)
      : new Set();
    renderAssignments(scannedAssignments, refreshedTitles);
  } else {
    const errMsg = errors[0] ? `（${errors[0]}）` : '';
    setStatus(`${success}件成功、${fail}件失敗しました${errMsg}`, true);
  }

  btn.disabled = false;
  btn.textContent = '✅ 選択した課題を登録する';
});

// 起動
init();
