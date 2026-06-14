// manaba のページから課題情報を抽出する content script

function parseDate(text) {
  if (!text) return null;
  // 「2026-05-08 00:00」形式（未提出一覧ページ）
  const m1 = text.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (m1) {
    const [, y, mo, d, h, min] = m1;
    return `${y}-${mo}-${d}T${h}:${min}`;
  }
  // 「2026年05月30日 23:59」または「2026/05/30 23:59」形式
  const m2 = text.match(/(\d{4})[年\/](\d{1,2})[月\/](\d{1,2})[日]?\s*(\d{2}):(\d{2})/);
  if (!m2) return null;
  const [, y, mo, d, h, min] = m2;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h}:${min}`;
}

function typeFromLabel(label) {
  if (/レポート|report/i.test(label)) return 'report';
  if (/小テスト|テスト|quiz|test|確認|exam/i.test(label)) return 'quiz';
  if (/ドリル|drill/i.test(label)) return 'drill';
  if (/アンケート|survey/i.test(label)) return 'survey';
  if (/プロジェクト|project/i.test(label)) return 'project';
  return 'other';
}

function resolveUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return location.origin + href;
  // 相対パス（例: course_1672656_survey_1766215）→ /ct/ 配下に解決
  return location.origin + '/ct/' + href;
}

// 未提出課題一覧ページ（home_library_query）の table.stdlist をパース
function extractFromUnsubmittedPage() {
  const table = document.querySelector('table.stdlist');
  if (!table) return null;

  const assignments = [];
  table.querySelectorAll('tr.row0, tr.row1').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;

    const typeText = cells[0].textContent.trim();
    const type = typeFromLabel(typeText);

    const titleLink = cells[1].querySelector('.myassignments-title a');
    if (!titleLink) return;
    const title = titleLink.textContent.trim();
    const url = resolveUrl(titleLink.getAttribute('href'));

    const courseLink = cells[2].querySelector('.mycourse-title a');
    const courseName = courseLink ? courseLink.textContent.trim() : '';

    // cells[3]=受付開始日時, cells[4]=受付終了日時（締め切り）
    const deadlineText = cells[4] ? cells[4].textContent.trim() : '';
    const deadline = parseDate(deadlineText) || null;

    assignments.push({ title, courseName, deadline, url, type, typeLabel: typeText });
  });

  return assignments;
}

// 汎用フォールバック: 他の manaba ページでレポートリンク等を探す
function extractFromGenericPage() {
  const assignments = [];
  const seenHrefs = new Set();
  const selector = [
    'a[href*="/ct/course_"][href*="_report_"]',
    'a[href*="/ct/course_"][href*="_survey_"]',
    'a[href*="/ct/course_"][href*="_drill_"]',
    'a[href*="/ct/course_"][href*="_exam_"]',
    'a[href*="/ct/report_"]',
  ].join(', ');

  document.querySelectorAll(selector).forEach(link => {
    const href = link.getAttribute('href');
    if (!href || seenHrefs.has(href)) return;
    seenHrefs.add(href);

    const title = link.textContent.trim();
    if (!title) return;

    const url = resolveUrl(href);
    let courseName = '';
    let deadline = null;

    const row = link.closest('tr');
    if (row) {
      row.querySelectorAll('td, th').forEach(cell => {
        const courseLink = cell.querySelector('a[href*="course_"]');
        if (courseLink && !courseName) courseName = courseLink.textContent.trim();
        if (!deadline) deadline = parseDate(cell.textContent);
      });
    } else {
      let el = link.parentElement;
      for (let i = 0; i < 6 && el; i++) {
        if (!deadline) deadline = parseDate(el.textContent);
        el = el.parentElement;
      }
    }

    const rowText = row ? row.textContent : '';
    if (rowText.includes('提出済') || rowText.includes('受付終了')) return;

    assignments.push({ title, courseName, deadline, url, type: typeFromLabel(title + ' ' + courseName) });
  });

  return assignments;
}

function extractAssignments() {
  // 未提出課題一覧ページを優先
  const fromUnsubmitted = extractFromUnsubmittedPage();
  if (fromUnsubmitted !== null) return fromUnsubmitted;
  return extractFromGenericPage();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EXTRACT') {
    sendResponse({ ok: true, assignments: extractAssignments() });
    return true;
  }
});
