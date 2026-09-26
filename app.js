const NAME_STORAGE_KEY = 'jpquiz_name';
const NAME_PATTERN = /^[A-Za-z0-9]+$/;
const MAX_PRIORITY_SHARE = 0.3; // từ trong danh sách ưu tiên chiếm tối đa 30% số câu 1 lượt chơi, tránh độc chiếm cả bài

const state = {
  mode: 'vocab', // 'vocab' | 'test'
  filteredWords: [],
  quizQueue: [],
  currentIndex: 0,
  correctCount: 0,
  answeredCount: 0,
  wrongList: [],
  playerName: '',
  fieldTally: {}, // { fieldName: { correct, total } }
  showReading: false,
  autoAdvance: true,
  quizStartTime: 0,
  timerInterval: null,
  autoAdvanceTimer: null,
  markedWords: new Set(), // key = `${field}|${wordId}`
};

const el = {
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingOverlayText: document.getElementById('loading-overlay-text'),
  loadingRingBar: document.getElementById('loading-ring-bar'),
  loadingProgressText: document.getElementById('loading-progress-text'),
  nameInput: document.getElementById('name-input'),
  nameSuggestions: document.getElementById('name-suggestions'),
  nameError: document.getElementById('name-error'),
  groupList: document.getElementById('group-list'),
  countLabel: document.getElementById('count-label'),
  countSelect: document.getElementById('count-select'),
  directionField: document.getElementById('direction-field'),
  setupError: document.getElementById('setup-error'),
  startBtn: document.getElementById('start-btn'),

  setupScreen: document.getElementById('setup-screen'),
  quizScreen: document.getElementById('quiz-screen'),
  resultScreen: document.getElementById('result-screen'),

  exitQuizBtn: document.getElementById('exit-quiz-btn'),
  quizProgressText: document.getElementById('quiz-progress-text'),
  quizTimer: document.getElementById('quiz-timer'),
  autoAdvanceCheckbox: document.getElementById('auto-advance-checkbox'),
  toggleReadingBtn: document.getElementById('toggle-reading-btn'),
  markWordBtn: document.getElementById('mark-word-btn'),
  questionText: document.getElementById('question-text'),
  questionReading: document.getElementById('question-reading'),
  revealBtn: document.getElementById('reveal-btn'),
  answers: document.getElementById('answers'),
  feedback: document.getElementById('feedback'),
  nextBtnResult: document.getElementById('next-btn-result'),
  nextBtnLabel: document.getElementById('next-btn-label'),
  feedbackExample: document.getElementById('feedback-example'),
  feedbackExampleMeaning: document.getElementById('feedback-example-meaning'),
  nextBtn: document.getElementById('next-btn'),

  resultName: document.getElementById('result-name'),
  resultScore: document.getElementById('result-score'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultTime: document.getElementById('result-time'),
  resultCongrats: document.getElementById('result-congrats'),
  resultPointsEarned: document.getElementById('result-points-earned'),
  resultStreakMessage: document.getElementById('result-streak-message'),
  resultRankMessage: document.getElementById('result-rank-message'),
  wrongListWrap: document.getElementById('wrong-list-wrap'),
  wrongListTitle: document.getElementById('wrong-list-title'),
  wrongList: document.getElementById('wrong-list'),
  replayBtn: document.getElementById('replay-btn'),

  leaderboardWidget: document.getElementById('leaderboard-widget'),
  leaderboardList: document.getElementById('leaderboard-list'),
  leaderboardFilter: document.getElementById('leaderboard-filter'),
  leaderboardToggle: document.getElementById('leaderboard-toggle'),

  historyModal: document.getElementById('history-modal'),
  historyModalTitle: document.getElementById('history-modal-title'),
  historyModalClose: document.getElementById('history-modal-close'),
  historyLoading: document.getElementById('history-loading'),
  historyEmpty: document.getElementById('history-empty'),
  historyTable: document.getElementById('history-table'),
  historyTableBody: document.getElementById('history-table-body'),

  appVersion: document.getElementById('app-version'),
};

// Lay so "?v=" ngay tren the <script src="app.js?v=..."> dang chay, de hien thi phien ban ma khong
// can nho khai bao 1 hang so rieng - moi lan sua app.js von da phai tang so nay de pha cache roi.
// Chan moi thao tac (click xuyen qua overlay se khong toi duoc cac nut ben duoi) trong luc dang tai
// du lieu quan trong (danh sach linh vuc luc vao trang, hoac cau hoi luc bam "Bat dau"), tranh viec
// nguoi dung bam lung tung vao nut khac trong luc cho.
// Vong tron % la tien trinh GIA LAP (fetch khong bao gio biet truoc tong dung luong de tinh % that -
// Apps Script Web App khong tra Content-Length). Chay dan cham lai khi gan toi LOADING_PROGRESS_CAP,
// dung han o do (khong bao gio tu vuot qua) cho den khi thuc su co ket qua, luc do nhay thang len 100%.
// Rieng % thoi khong du: neu mang qua cham, dung o gan cap qua lau van gay lo lang y het nhu dung o 90% -
// nen kem theo doi chu trang thai theo moc thoi gian (LOADING_STALL_MESSAGES) de tran an nguoi dung.
const LOADING_RING_CIRCUMFERENCE = 169.6; // 2 * PI * 27 (r cua vong tron trong SVG)
const LOADING_PROGRESS_CAP = 96;
const LOADING_STALL_MESSAGES = [
  { afterMs: 6000, text: 'Đang tải hơi lâu, vui lòng đợi thêm chút...' },
  { afterMs: 15000, text: 'Mạng có vẻ chậm, hệ thống vẫn đang thử tải, đừng tắt trang nhé...' },
];
let loadingProgressTimer = null;
let loadingProgressValue = 0;
let loadingStallTimers = [];

function setLoadingProgress(percent) {
  loadingProgressValue = percent;
  el.loadingProgressText.textContent = `${Math.round(percent)}%`;
  el.loadingRingBar.style.strokeDashoffset = LOADING_RING_CIRCUMFERENCE * (1 - percent / 100);
}

function clearLoadingStallTimers() {
  loadingStallTimers.forEach(t => clearTimeout(t));
  loadingStallTimers = [];
}

function showLoadingOverlay(text) {
  el.loadingOverlayText.textContent = text || 'Đang tải...';
  el.loadingOverlay.classList.remove('hidden');

  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  setLoadingProgress(0);
  loadingProgressTimer = setInterval(() => {
    const remaining = LOADING_PROGRESS_CAP - loadingProgressValue;
    if (remaining <= 0.1) return; // da sat cap, dung hang o day cho den khi co ket qua that
    setLoadingProgress(loadingProgressValue + Math.max(remaining * 0.06, 0.15));
  }, 200);

  clearLoadingStallTimers();
  loadingStallTimers = LOADING_STALL_MESSAGES.map(m => setTimeout(() => {
    el.loadingOverlayText.textContent = m.text;
  }, m.afterMs));
}

// An overlay NGAY LAP TUC, dung khi that bai/loi - khong can cho hieu ung 100% vi khong co gi de "hoan thanh".
function hideLoadingOverlay() {
  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  clearLoadingStallTimers();
  el.loadingOverlay.classList.add('hidden');
}

// Dung khi THANH CONG: cho vong tron chay hien het len 100% de nguoi dung thay ro da xong, roi moi
// an overlay. Neu an ngay lap tuc luc dang o giua chung tien trinh gia lap (vd moi 30%) se gay cam
// giac giat cuc/nhu bi loi, dung du de trinh duyet ve xong 100% (transition CSS) truoc khi an.
function finishLoadingOverlay() {
  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  clearLoadingStallTimers();
  setLoadingProgress(100);
  setTimeout(() => {
    el.loadingOverlay.classList.add('hidden');
  }, 350);
}

function getAppVersion() {
  const script = document.querySelector('script[src*="app.js"]');
  const match = script && script.src.match(/[?&]v=([\w.]+)/);
  return match ? match[1] : '?';
}

const LEADERBOARD_COLLAPSED_COUNT = 5;
let leaderboardExpanded = false;
let lastLeaderboardList = [];

init();

async function init() {
  const savedName = localStorage.getItem(NAME_STORAGE_KEY);
  if (savedName) el.nameInput.value = savedName;
  el.appVersion.textContent = `v${getAppVersion()}`;

  el.startBtn.addEventListener('click', startQuiz);
  el.revealBtn.addEventListener('click', revealAnswers);
  el.nextBtn.addEventListener('click', nextQuestion);
  el.replayBtn.addEventListener('click', () => showScreen('setup'));
  el.leaderboardFilter.addEventListener('change', () => {
    leaderboardExpanded = false;
    loadLeaderboard(el.leaderboardFilter.value);
  });
  el.leaderboardToggle.addEventListener('click', () => {
    leaderboardExpanded = !leaderboardExpanded;
    renderLeaderboard(lastLeaderboardList);
  });
  el.exitQuizBtn.addEventListener('click', exitQuiz);
  el.toggleReadingBtn.addEventListener('click', toggleReading);
  el.markWordBtn.addEventListener('click', toggleMarkCurrentWord);
  el.autoAdvanceCheckbox.addEventListener('change', () => {
    state.autoAdvance = el.autoAdvanceCheckbox.checked;
    if (!state.autoAdvance && state.autoAdvanceTimer) {
      clearAutoAdvanceTimer();
      el.nextBtnLabel.textContent = 'Câu tiếp theo';
    } else if (state.autoAdvance && !el.feedback.classList.contains('hidden') && !state.autoAdvanceTimer) {
      startAutoAdvanceCountdown();
    }
  });
  el.leaderboardList.addEventListener('click', (e) => {
    const nameBtn = e.target.closest('.lb-name');
    if (nameBtn) openHistoryModal(nameBtn.dataset.name);
  });
  el.historyModalClose.addEventListener('click', closeHistoryModal);
  el.historyModal.addEventListener('click', (e) => {
    if (e.target === el.historyModal) closeHistoryModal();
  });
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', onModeChange);
  });

  // Tải song song, không chờ tuần tự — 3 lượt gọi này độc lập với nhau.
  // Chan thao tac cho den khi fieldCounts xong (can de biet co gi de chon) - leaderboard/goi y ten
  // khong chan vi khong anh huong den viec bam "Bat dau".
  showLoadingOverlay('Đang tải danh sách lĩnh vực...');
  loadFieldCounts().finally(finishLoadingOverlay);
  loadLeaderboard('all');
  loadNameSuggestions();
}

async function openHistoryModal(name) {
  el.historyModalTitle.textContent = `Lịch sử làm bài — ${name}`;
  el.historyModal.classList.remove('hidden');
  el.historyEmpty.classList.add('hidden');
  el.historyTable.classList.add('hidden');
  el.historyLoading.classList.remove('hidden');

  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=history&name=${encodeURIComponent(name)}`);
    const sessions = await res.json();
    el.historyLoading.classList.add('hidden');

    if (!sessions || sessions.length === 0) {
      el.historyEmpty.textContent = 'Chưa có lịch sử.';
      el.historyEmpty.classList.remove('hidden');
      return;
    }

    el.historyTableBody.innerHTML = sessions.map(s => `
      <tr>
        <td>${formatDateTime(s.timestamp)}</td>
        <td>${escapeHtml(s.field || '')}</td>
        <td>${s.correct}/${s.total}</td>
        <td>${s.accuracy}%</td>
        <td>${formatTime((s.durationSeconds || 0) * 1000)}</td>
      </tr>
    `).join('');
    el.historyTable.classList.remove('hidden');
  } catch (err) {
    el.historyLoading.classList.add('hidden');
    el.historyEmpty.textContent = 'Không tải được lịch sử.';
    el.historyEmpty.classList.remove('hidden');
  }
}

function closeHistoryModal() {
  el.historyModal.classList.add('hidden');
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadNameSuggestions() {
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=names`);
    const names = await res.json();
    el.nameSuggestions.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
  } catch (err) {
    // im lặng bỏ qua nếu chưa lấy được danh sách tên gợi ý
  }
}

// Lay danh sach tu (field+id) ma "name" nay da danh dau "on lai" o cac lan choi truoc
async function loadMarkedWords(name) {
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=markedWords&name=${encodeURIComponent(name)}`);
    const marked = await res.json();
    return new Set(marked.map(m => `${m.field}|${m.wordId}`));
  } catch (err) {
    return new Set();
  }
}

let allFieldsWithCounts = [];

// Chỉ cần tên sheet có dấu "-" là được coi là "Môn-Bài": phần trước dấu "-" đầu tiên
// là Môn, phần sau là tên Bài. Sheet không có dấu "-" thì tự nó là 1 môn với đúng 1 bài trùng tên.
function parseFieldName(field) {
  const idx = field.indexOf('-');
  if (idx === -1) return { subject: field, lesson: field };
  return { subject: field.slice(0, idx).trim(), lesson: field.slice(idx + 1).trim() };
}

const FIELD_CACHE_KEY = 'jpquiz_fieldCounts';
const VERSION_CACHE_KEY = 'jpquiz_dataVersion';

// So sanh "phien ban du lieu" (tang moi khi co linh vuc moi/import CSV/sua tay tren Sheet - xem
// bumpVersion() ben Apps Script) voi ban da luu trong localStorage tu lan truoc. Khop nhau thi dung
// luon ban da cache trong trinh duyet (khong can tai lai fieldCounts qua mang), khong khop moi tai lai.
// Nho vay khong can cho cache het han hay bam nut tai lai thu cong nua.
async function loadFieldCounts() {
  try {
    const verRes = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=version`);
    const verData = await verRes.json();
    const currentVersion = String(verData.version);
    const cachedVersion = localStorage.getItem(VERSION_CACHE_KEY);
    const cachedFields = localStorage.getItem(FIELD_CACHE_KEY);

    if (cachedVersion === currentVersion && cachedFields) {
      allFieldsWithCounts = JSON.parse(cachedFields);
      renderFieldCheckboxes();
      return;
    }

    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=fieldCounts`);
    allFieldsWithCounts = await res.json();
    localStorage.setItem(VERSION_CACHE_KEY, currentVersion);
    localStorage.setItem(FIELD_CACHE_KEY, JSON.stringify(allFieldsWithCounts));
    renderFieldCheckboxes();
  } catch (err) {
    el.groupList.innerHTML = `
      <p class="error-text">Không tải được danh sách lĩnh vực, vui lòng thử lại.</p>
      <button type="button" id="retry-fields-btn" class="secondary-btn">Thử lại</button>
    `;
    document.getElementById('retry-fields-btn').addEventListener('click', () => {
      el.groupList.innerHTML = '<div class="loading-row"><span class="spinner"></span> Đang tải danh sách từ...</div>';
      showLoadingOverlay('Đang tải danh sách lĩnh vực...');
      loadFieldCounts().finally(finishLoadingOverlay);
    });
  }
}

function onModeChange() {
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  el.directionField.classList.toggle('hidden', state.mode === 'test');
  el.countLabel.textContent = state.mode === 'test' ? 'Số câu muốn làm' : 'Số từ muốn ôn';
  renderFieldCheckboxes();
}

async function fetchLeaderboardData(fieldFilter) {
  const url = fieldFilter && fieldFilter !== 'all'
    ? `${CONFIG.APPS_SCRIPT_URL}?action=leaderboard&field=${encodeURIComponent(fieldFilter)}`
    : `${CONFIG.APPS_SCRIPT_URL}?action=leaderboard`;
  const res = await fetch(url);
  return res.json();
}

async function loadLeaderboard(fieldFilter) {
  try {
    const data = await fetchLeaderboardData(fieldFilter);
    renderLeaderboard(data);
  } catch (err) {
    // im lặng bỏ qua nếu leaderboard chưa sẵn sàng
  }
}

// Cap bac theo tong diem tich luy, hien icon dep hon thay cho 1 icon cup phang duy nhat -
// tao dong luc "len hang" khi choi nhieu hon, thay vi chi la 1 con so kho.
const SCORE_TIERS = [
  { min: 20000, icon: '💎', label: 'Huyền thoại' },
  { min: 10000, icon: '👑', label: 'Bậc thầy' },
  { min: 6000, icon: '🔥', label: 'Cao thủ' },
  { min: 3000, icon: '⚔️', label: 'Chiến binh' },
  { min: 1000, icon: '🥋', label: 'Học viên' },
  { min: 0, icon: '🌱', label: 'Tân binh' },
];

function getScoreTier(score) {
  return SCORE_TIERS.find(t => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

// Icon chuoi ngay lam bai lien tiep "nong" dan len theo so ngay, kieu cac app hay dung (Duolingo/TikTok...)
// de tao cam giac "dung de tat lua", khuyen khich quay lai lam bai moi ngay.
function getStreakIcon(streak) {
  if (streak >= 30) return '🔥💯';
  if (streak >= 14) return '🔥🔥🔥';
  if (streak >= 7) return '🔥🔥';
  return '🔥';
}

let hasLeaderboardData = false;

function renderLeaderboard(list) {
  lastLeaderboardList = list || [];
  hasLeaderboardData = lastLeaderboardList.length > 0;
  if (!hasLeaderboardData) {
    el.leaderboardList.innerHTML = '';
    el.leaderboardToggle.classList.add('hidden');
    updateLeaderboardVisibility();
    return;
  }
  const rankMedals = ['🥇', '🥈', '🥉'];
  const rankClasses = ['rank-gold', 'rank-silver', 'rank-bronze'];
  const visibleList = leaderboardExpanded ? lastLeaderboardList : lastLeaderboardList.slice(0, LEADERBOARD_COLLAPSED_COUNT);

  el.leaderboardList.innerHTML = visibleList.map((item, i) => `
    <li class="${rankClasses[i] || ''}">
      <span class="lb-left">
        ${rankMedals[i] ? `<span class="lb-medal">${rankMedals[i]}</span>` : `<span class="lb-rank">${i + 1}</span>`}
        <span class="lb-name-wrap">
          <button class="lb-name" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>
          ${renderMetaLine(item)}
        </span>
      </span>
      <span class="lb-right">
        <span class="lb-score" title="${escapeHtml(getScoreTier(item.score).label)}">${getScoreTier(item.score).icon} ${item.score}</span>
        <span class="lb-acc">${item.accuracy}%</span>
      </span>
    </li>
  `).join('');

  if (lastLeaderboardList.length > LEADERBOARD_COLLAPSED_COUNT) {
    el.leaderboardToggle.classList.remove('hidden');
    el.leaderboardToggle.textContent = leaderboardExpanded ? 'Thu gọn' : 'Xem thêm';
  } else {
    el.leaderboardToggle.classList.add('hidden');
  }

  updateLeaderboardVisibility();
}

// Trạng thái hoạt động dựa trên lần nộp bài gần nhất: từ 15 phút trở xuống tính là "Online".
// Quá 15 phút mới bắt đầu tính offline, và tính TỪ MỐC 15 PHÚT (vd phút thứ 16 = offline 1 phút).
// Không lấy phần lẻ (làm tròn xuống theo đơn vị đang hiển thị); offline quá 10 ngày chỉ hiện dấu "-".
const ONLINE_THRESHOLD_MINUTES = 15;

function getActivityStatus(isoString) {
  if (!isoString) return { text: '', online: false };
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return { text: '', online: false };

  const totalMinutes = Math.floor((Date.now() - then) / 60000);
  if (totalMinutes <= ONLINE_THRESHOLD_MINUTES) return { text: 'Online', online: true };

  const offlineMinutes = totalMinutes - ONLINE_THRESHOLD_MINUTES;
  if (offlineMinutes < 60) return { text: `${offlineMinutes} phút trước`, online: false };

  const offlineHours = Math.floor(offlineMinutes / 60);
  if (offlineHours < 24) return { text: `${offlineHours} giờ trước`, online: false };

  const offlineDays = Math.floor(offlineHours / 24);
  return { text: offlineDays > 10 ? '-' : `${offlineDays} ngày trước`, online: false };
}

function renderActivityStatus(isoString) {
  const status = getActivityStatus(isoString);
  if (!status.text) return '';
  const cls = status.online ? 'lb-lastactive online' : 'lb-lastactive';
  const icon = status.online ? '🟢 ' : '';
  return `<span class="${cls}">${icon}${escapeHtml(status.text)}</span>`;
}

// Gop dong hoat dong (online/offline) va chuoi ngay lam bai lien tiep thanh 1 dong gon duoi ten.
// Boc trong 1 the container duy nhat vi lb-name-wrap la flex-column - neu de nhieu the <span> roi
// nam canh nhau o cung cap se bi tach thanh nhieu dong rieng thay vi nam chung 1 dong.
function renderMetaLine(item) {
  const parts = [];
  const activity = renderActivityStatus(item.lastActive);
  if (activity) parts.push(activity);
  if (item.streak > 0) parts.push(`<span class="lb-streak">${getStreakIcon(item.streak)} ${item.streak} ngày</span>`);
  if (parts.length === 0) return '';
  return `<span class="lb-meta-line">${parts.join('<span class="lb-meta-sep"> · </span>')}</span>`;
}

function updateLeaderboardVisibility() {
  el.leaderboardWidget.classList.toggle('hidden', !hasLeaderboardData);
}

function renderFieldCheckboxes() {
  // Bộ lọc xếp hạng liệt kê theo MÔN (gộp điểm mọi bài cùng môn), không phụ thuộc chế độ đang chọn
  const subjectsForLeaderboard = [...new Set(allFieldsWithCounts.map(f => parseFieldName(f.field).subject))];
  el.leaderboardFilter.innerHTML = '<option value="all">Tổng</option>' +
    subjectsForLeaderboard.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  const unit = state.mode === 'test' ? 'câu' : 'từ';
  const relevantFields = allFieldsWithCounts.filter(f => f.type === state.mode);

  if (relevantFields.length === 0) {
    el.groupList.innerHTML = `<p class="muted">Chưa có dữ liệu ${state.mode === 'test' ? 'bộ test' : 'từ vựng'}.</p>`;
    return;
  }

  // Nhóm các lĩnh vực (sheet) theo Môn — mỗi môn hiện 1 dòng gộp, bấm vào mới xổ ra các bài bên trong
  const groups = new Map();
  relevantFields.forEach(f => {
    const { subject, lesson } = parseFieldName(f.field);
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject).push({ field: f.field, lesson, count: f.count });
  });

  // Sắp xếp các bài trong từng môn theo thứ tự tự nhiên (P1, P2, P3... thay vì theo thứ tự tab trong Sheet)
  groups.forEach(lessons => {
    lessons.sort((a, b) => a.lesson.localeCompare(b.lesson, undefined, { numeric: true, sensitivity: 'base' }));
  });

  const totalCount = relevantFields.reduce((sum, f) => sum + f.count, 0);
  let html = `<label class="field-row field-all"><input type="checkbox" value="__all__" checked><span>Tất cả (${totalCount} ${unit})</span></label>`;

  groups.forEach((lessons, subject) => {
    if (lessons.length === 1) {
      const l = lessons[0];
      html += `<label class="field-row"><input type="checkbox" name="field" value="${escapeHtml(l.field)}"><span>${escapeHtml(subject)} (${l.count} ${unit})</span></label>`;
      return;
    }

    const subjectTotal = lessons.reduce((sum, l) => sum + l.count, 0);
    html += `
      <div class="subject-group">
        <div class="field-row subject-row" data-subject="${escapeHtml(subject)}">
          <input type="checkbox" class="subject-checkbox" data-subject="${escapeHtml(subject)}">
          <span class="subject-label">${escapeHtml(subject)} (${subjectTotal} ${unit})</span>
          <button type="button" class="expand-btn" data-subject="${escapeHtml(subject)}" tabindex="-1">▸</button>
        </div>
        <div class="lesson-list hidden" data-lessons-for="${escapeHtml(subject)}">
          ${lessons.map(l => `<label class="field-row lesson-row"><input type="checkbox" name="field" value="${escapeHtml(l.field)}" class="lesson-checkbox" data-subject="${escapeHtml(subject)}"><span>${escapeHtml(l.lesson)} (${l.count} ${unit})</span></label>`).join('')}
        </div>
      </div>`;
  });

  el.groupList.innerHTML = html;
  bindFieldListEvents();
}

function bindFieldListEvents() {
  const allCheckbox = el.groupList.querySelector('input[value="__all__"]');

  allCheckbox.addEventListener('change', () => {
    if (!allCheckbox.checked) return;
    el.groupList.querySelectorAll('input[name="field"], input.subject-checkbox').forEach(cb => { cb.checked = false; });
  });

  el.groupList.querySelectorAll('.subject-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.subject-checkbox')) return; // để checkbox tự xử lý chọn/bỏ chọn, không đụng tới việc xổ danh sách
      const subject = row.dataset.subject;
      const list = el.groupList.querySelector(`[data-lessons-for="${CSS.escape(subject)}"]`);
      const btn = row.querySelector('.expand-btn');
      const willExpand = list.classList.contains('hidden');
      list.classList.toggle('hidden');
      if (btn) btn.textContent = willExpand ? '▾' : '▸';
    });
  });

  el.groupList.querySelectorAll('.subject-checkbox').forEach(subCb => {
    subCb.addEventListener('change', () => {
      const subject = subCb.dataset.subject;
      el.groupList.querySelectorAll(`.lesson-checkbox[data-subject="${CSS.escape(subject)}"]`).forEach(c => { c.checked = subCb.checked; });
      if (subCb.checked) allCheckbox.checked = false;
    });
  });

  el.groupList.querySelectorAll('input[name="field"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) allCheckbox.checked = false;
      const subject = cb.dataset.subject;
      if (!subject) return;
      const siblings = [...el.groupList.querySelectorAll(`.lesson-checkbox[data-subject="${CSS.escape(subject)}"]`)];
      const subCb = el.groupList.querySelector(`.subject-checkbox[data-subject="${CSS.escape(subject)}"]`);
      if (subCb) subCb.checked = siblings.every(s => s.checked);
    });
  });
}

function getSelectedFields() {
  const allCheckbox = el.groupList.querySelector('input[value="__all__"]');
  if (!allCheckbox || allCheckbox.checked) return null; // null = tất cả lĩnh vực
  return [...el.groupList.querySelectorAll('input[name="field"]:checked')].map(cb => cb.value);
}

async function startQuiz() {
  const name = el.nameInput.value.trim();
  el.nameError.textContent = '';
  el.setupError.textContent = '';

  if (!NAME_PATTERN.test(name)) {
    el.nameError.textContent = 'Tên chỉ được chứa chữ cái A-Z, a-z và số, không dấu cách hoặc ký tự đặc biệt.';
    return;
  }

  const selectedFields = getSelectedFields();

  el.startBtn.disabled = true;
  el.startBtn.textContent = 'Đang tải câu hỏi...';
  showLoadingOverlay('Đang tải câu hỏi...');

  let pool;
  try {
    const url = selectedFields
      ? `${CONFIG.APPS_SCRIPT_URL}?field=${encodeURIComponent(selectedFields.join(','))}`
      : CONFIG.APPS_SCRIPT_URL;
    const res = await fetch(url);
    const data = await res.json();
    pool = state.mode === 'test'
      ? data.filter(w => w.question && w.choice1)
      : data.filter(w => w.word && w.meaning);
  } catch (err) {
    hideLoadingOverlay();
    el.startBtn.disabled = false;
    el.startBtn.textContent = 'Bắt đầu';
    el.setupError.textContent = 'Không tải được câu hỏi, vui lòng thử lại.';
    return;
  }

  el.startBtn.disabled = false;
  el.startBtn.textContent = 'Bắt đầu';

  if (pool.length < 4) {
    hideLoadingOverlay();
    el.setupError.textContent = state.mode === 'test'
      ? 'Cần ít nhất 4 câu hỏi trong lĩnh vực đã chọn.'
      : 'Cần ít nhất 4 từ trong lĩnh vực đã chọn để tạo câu hỏi trắc nghiệm.';
    return;
  }

  localStorage.setItem(NAME_STORAGE_KEY, name);
  state.playerName = name;
  state.filteredWords = pool;

  state.markedWords = await loadMarkedWords(name);

  const countValue = el.countSelect.value;
  const count = countValue === 'all' ? pool.length : Math.min(Number(countValue), pool.length);

  const direction = document.querySelector('input[name="direction"]:checked').value;
  const selected = buildQuizSelection(pool, count, word => state.markedWords.has(wordMarkKey(word)));
  state.quizQueue = selected.map(word => ({
    word,
    direction: state.mode === 'vocab'
      ? (direction === 'mix' ? (Math.random() < 0.5 ? 'jp2meaning' : 'meaning2jp') : direction)
      : null,
  }));

  state.currentIndex = 0;
  state.correctCount = 0;
  state.answeredCount = 0;
  state.wrongList = [];
  state.fieldTally = {};
  state.autoAdvance = el.autoAdvanceCheckbox.checked;

  startTimer();
  showScreen('quiz');
  renderQuestion();
  finishLoadingOverlay();
}

function startTimer() {
  state.quizStartTime = Date.now();
  updateTimerDisplay();
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
  return Date.now() - state.quizStartTime;
}

function updateTimerDisplay() {
  el.quizTimer.textContent = `⏱ ${formatTime(Date.now() - state.quizStartTime)}`;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function renderQuestion() {
  const total = state.quizQueue.length;
  const item = state.quizQueue[state.currentIndex];
  el.quizProgressText.textContent = `Câu ${state.currentIndex + 1} / ${total} — Điểm: ${state.correctCount}`;

  el.answers.innerHTML = '';
  el.feedback.classList.add('hidden');
  el.nextBtn.classList.add('hidden');
  el.nextBtn.classList.remove('wrong-result');
  el.nextBtnResult.textContent = '';
  el.nextBtnLabel.textContent = 'Câu tiếp theo';

  if (state.mode === 'test') {
    el.revealBtn.classList.add('hidden');
    el.toggleReadingBtn.classList.add('hidden');
    el.questionReading.textContent = '';
    el.questionText.textContent = item.word.question;
    renderTestAnswers(item);
    el.answers.classList.remove('hidden');
  } else {
    el.revealBtn.classList.remove('hidden');
    el.toggleReadingBtn.classList.remove('hidden');
    el.answers.classList.add('hidden');
    el.questionText.textContent = item.direction === 'jp2meaning' ? item.word.word : item.word.meaning;
    updateReadingDisplay();
  }

  updateMarkButtonDisplay();
}

function renderTestAnswers(item) {
  const data = item.word;
  [data.choice1, data.choice2, data.choice3, data.choice4].forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => selectTestAnswer(idx + 1, btn));
    el.answers.appendChild(btn);
  });
}

function selectTestAnswer(chosenIndex, btnEl) {
  const item = state.quizQueue[state.currentIndex];
  const data = item.word;
  const correctIndex = Number(data.correct);
  const isCorrect = chosenIndex === correctIndex;
  const correctText = data['choice' + correctIndex] || '';

  [...el.answers.children].forEach((btn, idx) => {
    btn.disabled = true;
    if (idx + 1 === correctIndex) btn.classList.add('correct');
  });
  if (!isCorrect) btnEl.classList.add('wrong');

  const resultText = isCorrect ? '✅ Chính xác!' : `❌ Sai rồi. Đáp án đúng: ${correctText}`;
  finalizeAnswer(data, isCorrect, resultText, data.explanation || '', '');
}

function wordMarkKey(word) {
  return `${word.field}|${word.id}`;
}

function updateMarkButtonDisplay() {
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;
  const marked = state.markedWords.has(wordMarkKey(item.word));
  el.markWordBtn.textContent = marked ? '★ Đã đánh dấu ôn lại' : '☆ Đánh dấu ôn lại';
  el.markWordBtn.classList.toggle('marked', marked);
}

async function toggleMarkCurrentWord() {
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;
  const key = wordMarkKey(item.word);
  const willMark = !state.markedWords.has(key);

  el.markWordBtn.disabled = true;
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'toggleMark',
        name: state.playerName,
        field: item.word.field,
        wordId: item.word.id,
      }),
    });
    if (willMark) state.markedWords.add(key); else state.markedWords.delete(key);
    updateMarkButtonDisplay();
  } catch (err) {
    // lỗi mạng thì thôi, không chặn người dùng làm tiếp
  } finally {
    el.markWordBtn.disabled = false;
  }
}

// Ghi nhan ket qua tra loi de cap nhat danh sach uu tien phia server: sai -> tu dong vao danh sach
// (reset streak); dung -> neu dang trong danh sach thi tang streak, du 3 lan dung lien tiep thi tu dong go ra.
async function recordAnswerForPriority(word, isCorrect) {
  const key = wordMarkKey(word);
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'recordAnswer',
        name: state.playerName,
        field: word.field,
        wordId: word.id,
        correct: isCorrect,
      }),
    });
    const result = await res.json();
    if (result.inPriority) state.markedWords.add(key); else state.markedWords.delete(key);

    const currentItem = state.quizQueue[state.currentIndex];
    if (currentItem && currentItem.word === word) updateMarkButtonDisplay();
  } catch (err) {
    // lỗi mạng thì thôi, không chặn người dùng làm tiếp
  }
}

function toggleReading() {
  state.showReading = !state.showReading;
  el.toggleReadingBtn.textContent = state.showReading ? '🙈 Ẩn cách đọc' : '👁 Hiện cách đọc';
  updateReadingDisplay();
}

function updateReadingDisplay() {
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;
  const isJp2Meaning = item.direction === 'jp2meaning';
  el.questionReading.textContent = isJp2Meaning && state.showReading ? (item.word.reading || '') : '';
}

function revealAnswers() {
  const item = state.quizQueue[state.currentIndex];
  const isJp2Meaning = item.direction === 'jp2meaning';
  const correctValue = isJp2Meaning ? item.word.meaning : item.word.word;

  const otherWords = state.filteredWords.filter(w => w !== item.word);
  const distractorValues = shuffle(otherWords)
    .map(w => (isJp2Meaning ? w.meaning : w.word))
    .filter((v, i, arr) => v !== correctValue && arr.indexOf(v) === i)
    .slice(0, 3);

  const choices = shuffle([correctValue, ...distractorValues]);

  el.answers.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => selectAnswer(choice, correctValue, btn));
    el.answers.appendChild(btn);
  });

  el.answers.classList.remove('hidden');
  el.revealBtn.classList.add('hidden');
}

function selectAnswer(choice, correctValue, btnEl) {
  const item = state.quizQueue[state.currentIndex];
  const isCorrect = choice === correctValue;

  [...el.answers.children].forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correctValue) btn.classList.add('correct');
  });
  if (!isCorrect) btnEl.classList.add('wrong');

  const resultText = isCorrect ? '✅ Chính xác!' : `❌ Sai rồi. Đáp án đúng: ${correctValue}`;
  const exampleText = item.word.example ? `Ví dụ: ${item.word.example}` : '';
  const exampleMeaningText = item.word.example_meaning ? `Nghĩa: ${item.word.example_meaning}` : '';
  finalizeAnswer(item.word, isCorrect, resultText, exampleText, exampleMeaningText);
}

// Xu ly phan chung sau khi tra loi (dung cho ca 2 che do): cap nhat diem, danh sach sai,
// hien khung feedback, ghi nhan uu tien, va tu dong chuyen cau neu bat.
function finalizeAnswer(data, isCorrect, resultText, line1, line2) {
  state.answeredCount += 1;

  const field = data.field || 'Khác';
  if (!state.fieldTally[field]) state.fieldTally[field] = { correct: 0, total: 0 };
  state.fieldTally[field].total += 1;

  if (isCorrect) {
    state.correctCount += 1;
    state.fieldTally[field].correct += 1;
  } else {
    state.wrongList.push(data);
  }

  el.nextBtnResult.textContent = resultText;
  el.feedbackExample.textContent = line1 || '';
  el.feedbackExampleMeaning.textContent = line2 || '';
  el.feedback.classList.remove('hidden');
  el.nextBtn.classList.remove('hidden');
  el.nextBtn.classList.toggle('wrong-result', !isCorrect);

  recordAnswerForPriority(data, isCorrect);

  if (state.autoAdvance) startAutoAdvanceCountdown();
}

function startAutoAdvanceCountdown() {
  let remaining = 3;
  el.nextBtnLabel.textContent = `Câu tiếp theo (${remaining})`;
  state.autoAdvanceTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearAutoAdvanceTimer();
      nextQuestion();
    } else {
      el.nextBtnLabel.textContent = `Câu tiếp theo (${remaining})`;
    }
  }, 1000);
}

function clearAutoAdvanceTimer() {
  if (state.autoAdvanceTimer) clearInterval(state.autoAdvanceTimer);
  state.autoAdvanceTimer = null;
}

function nextQuestion() {
  clearAutoAdvanceTimer();
  state.currentIndex += 1;
  if (state.currentIndex >= state.quizQueue.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

// Thoat giua chung ve trang chu (vd chon nham chu de) - bai dang lam do khong duoc ghi nhan,
// khong goi submitResult nen khong tinh diem/lich su/streak cho luot nay.
function exitQuiz() {
  const confirmed = confirm('Thoát về trang chủ? Bài đang làm dở sẽ không được tính.');
  if (!confirmed) return;
  clearAutoAdvanceTimer();
  stopTimer();
  showScreen('setup');
}

async function finishQuiz() {
  const elapsedMs = stopTimer();
  const accuracy = state.answeredCount > 0 ? Math.round((state.correctCount / state.answeredCount) * 1000) / 10 : 0;

  el.resultName.textContent = `Người chơi: ${state.playerName}`;
  el.resultScore.textContent = `Điểm lượt này: ${state.correctCount}`;
  el.resultAccuracy.textContent = `Tỉ lệ chính xác lượt này: ${accuracy}%`;
  el.resultTime.textContent = `Thời gian làm bài: ${formatTime(elapsedMs)}`;

  el.resultPointsEarned.textContent = `🎉 Bạn vừa ghi thêm ${state.correctCount} điểm rèn luyện!`;
  el.resultRankMessage.textContent = 'Đang tính hạng...';
  el.resultCongrats.classList.remove('hidden');

  if (state.wrongList.length > 0) {
    el.wrongListWrap.classList.remove('hidden');
    el.wrongListTitle.textContent = state.mode === 'test' ? 'Các câu trả lời sai' : 'Các từ trả lời sai';
    el.wrongList.innerHTML = state.wrongList.map(w => {
      if (state.mode === 'test') {
        const correctText = w['choice' + w.correct] || '';
        return `<li>${escapeHtml(w.question)} — Đáp án đúng: ${escapeHtml(correctText)}</li>`;
      }
      return `<li>${escapeHtml(w.word)} (${escapeHtml(w.reading || '')}) — ${escapeHtml(w.meaning)}</li>`;
    }).join('');
  } else {
    el.wrongListWrap.classList.add('hidden');
  }

  showScreen('result');
  submitResult(Math.round(elapsedMs / 1000));
}

async function submitResult(durationSeconds) {
  const entries = Object.keys(state.fieldTally).map(field => ({
    field,
    total: state.fieldTally[field].total,
    correct: state.fieldTally[field].correct,
  }));

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: state.playerName,
        direction: document.querySelector('input[name="direction"]:checked').value,
        durationSeconds,
        entries,
      }),
    });
    loadLeaderboard(el.leaderboardFilter.value);
    loadNameSuggestions();

    // Bao hang tong (khong phu thuoc bo loc dang chon o widget) de chuc mung + tao dong luc co gang tiep
    const allBoard = await fetchLeaderboardData('all');
    const rankIndex = allBoard.findIndex(item => item.name === state.playerName);
    el.resultRankMessage.textContent = rankIndex === -1
      ? ''
      : `🏅 Bạn đang xếp hạng #${rankIndex + 1} toàn hệ thống — cố gắng lên nhé!`;

    const streak = rankIndex === -1 ? 0 : (allBoard[rankIndex].streak || 0);
    el.resultStreakMessage.textContent = streak > 1
      ? `${getStreakIcon(streak)} Chuỗi ${streak} ngày liên tiếp — đừng để tắt lửa nhé!`
      : streak === 1
        ? '🔥 Bắt đầu chuỗi ngày học rồi đó, mai nhớ quay lại nhé!'
        : '';
  } catch (err) {
    el.resultRankMessage.textContent = '';
    el.resultStreakMessage.textContent = '';
  }
}

function showScreen(name) {
  el.setupScreen.classList.toggle('hidden', name !== 'setup');
  el.quizScreen.classList.toggle('hidden', name !== 'quiz');
  el.resultScreen.classList.toggle('hidden', name !== 'result');
  updateLeaderboardVisibility();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Chon "count" tu de tao cau hoi, uu tien tu trong danh sach uu tien nhung KHONG QUA
// MAX_PRIORITY_SHARE (mac dinh 50%) tong so cau, tranh viec chung chiem het ca bai.
// Trong pham vi gioi han do, tu nao duoc chon van hoan toan ngau nhien (khong co dinh).
function buildQuizSelection(items, count, isPriorityFn) {
  const priorityItems = items.filter(isPriorityFn);
  const normalItems = items.filter(item => !isPriorityFn(item));

  const maxPriorityCount = Math.floor(count * MAX_PRIORITY_SHARE);
  const priorityCount = Math.min(priorityItems.length, maxPriorityCount, count);

  const chosenPriority = shuffle(priorityItems.slice()).slice(0, priorityCount);
  const remaining = count - chosenPriority.length;
  const chosenNormal = shuffle(normalItems.slice()).slice(0, remaining);

  return shuffle([...chosenPriority, ...chosenNormal]);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
