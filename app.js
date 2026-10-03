const NAME_STORAGE_KEY = 'jpquiz_name';
const NAME_PATTERN = /^[A-Za-z0-9]+$/;
const MAX_PRIORITY_SHARE = 0.3; // từ trong danh sách ưu tiên chiếm tối đa 30% số câu 1 lượt chơi, tránh độc chiếm cả bài

const state = {
  category: null, // 'bjt' | 'itp' | 'n5' | 'other' | null (null = con dang o man hinh chon linh vuc lon)
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
  hideAnswer: false, // chi dung o che do Hoc bai: tick vao thi an nghia/vi du de tu on lai
  hideWordInList: false, // chi dung o bang "Xem danh sach tu" cua On tu vung: tick vao thi an tu + vi du, chi de lai nghia de tu nho tu
  autoAdvance: true,
  quizStartTime: 0,
  timerInterval: null,
  autoAdvanceTimer: null,
  markedWords: new Set(), // key = `${field}|${wordId}`
  masteredWords: new Set(), // key = `${field}|${wordId}` - da thuoc, khong muon gap lai (rieng theo tung nguoi choi)
};

const el = {
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingOverlayText: document.getElementById('loading-overlay-text'),
  loadingRingBar: document.getElementById('loading-ring-bar'),
  loadingProgressText: document.getElementById('loading-progress-text'),
  nameInput: document.getElementById('name-input'),
  nameSuggestions: document.getElementById('name-suggestions'),
  nameError: document.getElementById('name-error'),
  categoryScreen: document.getElementById('category-screen'),
  categoryList: document.getElementById('category-list'),
  greetingBanner: document.getElementById('greeting-banner'),
  quoteJp: document.getElementById('quote-jp'),
  quoteVi: document.getElementById('quote-vi'),
  backToCategoryBtn: document.getElementById('back-to-category-btn'),
  setupCategoryTitle: document.getElementById('setup-category-title'),
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
  hideAnswerRow: document.getElementById('hide-answer-row'),
  hideAnswerCheckbox: document.getElementById('hide-answer-checkbox'),
  hideWordRow: document.getElementById('hide-word-row'),
  hideWordCheckbox: document.getElementById('hide-word-checkbox'),
  toggleReadingBtn: document.getElementById('toggle-reading-btn'),
  wordListBtn: document.getElementById('word-list-btn'),
  wordListWrap: document.getElementById('word-list-wrap'),
  wordListBody: document.getElementById('word-list-body'),
  markWordBtn: document.getElementById('mark-word-btn'),
  masteredWordBtn: document.getElementById('mastered-word-btn'),
  questionCard: document.getElementById('question-card'),
  timerRing: document.getElementById('timer-ring'),
  timerCountdown: document.getElementById('timer-countdown'),
  questionText: document.getElementById('question-text'),
  speakBtn: document.getElementById('speak-btn'),
  questionImage: document.getElementById('question-image'),
  audioPlayBtn: document.getElementById('audio-play-btn'),
  audioPlayIcon: document.getElementById('audio-play-icon'),
  audioPlayLabel: document.getElementById('audio-play-label'),
  questionAudio: document.getElementById('question-audio'),
  questionReading: document.getElementById('question-reading'),
  imageLightbox: document.getElementById('image-lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
  revealBtn: document.getElementById('reveal-btn'),
  answers: document.getElementById('answers'),
  matchingContainer: document.getElementById('matching-container'),
  matchingLeftCol: document.getElementById('matching-left-col'),
  matchingRightCol: document.getElementById('matching-right-col'),
  matchingCheckBtn: document.getElementById('matching-check-btn'),
  feedback: document.getElementById('feedback'),
  nextBtnResult: document.getElementById('next-btn-result'),
  nextBtnLabel: document.getElementById('next-btn-label'),
  feedbackMeaning: document.getElementById('feedback-meaning'),
  feedbackExample: document.getElementById('feedback-example'),
  feedbackExampleMeaning: document.getElementById('feedback-example-meaning'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),

  resultName: document.getElementById('result-name'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultAccuracyLabel: document.getElementById('result-accuracy-label'),
  resultTime: document.getElementById('result-time'),
  resultCongrats: document.getElementById('result-congrats'),
  resultPointsEarned: document.getElementById('result-points-earned'),
  resultStreakMessage: document.getElementById('result-streak-message'),
  wrongListWrap: document.getElementById('wrong-list-wrap'),
  wrongListTitle: document.getElementById('wrong-list-title'),
  wrongList: document.getElementById('wrong-list'),
  replayBtn: document.getElementById('replay-btn'),

  leaderboardWidget: document.getElementById('leaderboard-widget'),
  topTodayLine: document.getElementById('top-today-line'),
  leaderboardList: document.getElementById('leaderboard-list'),
  leaderboardFilter: document.getElementById('leaderboard-filter'),
  leaderboardToggle: document.getElementById('leaderboard-toggle'),
  leaderboardTabs: document.querySelectorAll('.lb-tab'),

  historyModal: document.getElementById('history-modal'),
  historyModalTitle: document.getElementById('history-modal-title'),
  historyModalClose: document.getElementById('history-modal-close'),
  historyLoading: document.getElementById('history-loading'),
  historyEmpty: document.getElementById('history-empty'),
  historyTable: document.getElementById('history-table'),
  historyTableBody: document.getElementById('history-table-body'),

  appVersion: document.getElementById('app-version'),
  visitCounter: document.getElementById('visit-counter'),
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
// nen sau 1 nhip ngan se chuyen dong chu trang thai sang xoay vong cac cau cham ngon tieng Nhat
// (LOADING_QUOTE_DELAY_MS) de nguoi dung co dong luc trong luc cho, thay vi chi bao "doi chut" vo vi.
const LOADING_RING_CIRCUMFERENCE = 169.6; // 2 * PI * 27 (r cua vong tron trong SVG)
const LOADING_PROGRESS_CAP = 96;
const LOADING_QUOTE_DELAY_MS = 1200;
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
  el.loadingOverlay.classList.remove('hidden', 'fade-out');

  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  setLoadingProgress(0);
  loadingProgressTimer = setInterval(() => {
    const remaining = LOADING_PROGRESS_CAP - loadingProgressValue;
    if (remaining <= 0.1) return; // da sat cap, dung hang o day cho den khi co ket qua that
    setLoadingProgress(loadingProgressValue + Math.max(remaining * 0.06, 0.15));
  }, 200);

  clearLoadingStallTimers();
  loadingStallTimers = [setTimeout(startLoadingQuoteRotation, LOADING_QUOTE_DELAY_MS)];
}

// Thay vi bao "dang tai hoi lau, vui long doi..." nhu truoc, hien 1 cau cham ngon tieng Nhat (dung
// chung danh sach MOTIVATIONAL_QUOTES voi man hinh chon linh vuc) de tao dong luc hoc tap trong luc
// cho - CHI 1 cau/lan tai, khong xoay vong lien tuc trong cung 1 lan cho (de doc khong bi roi mat).
// Moi lan goi ham nay (= moi lan hien loading overlay) se sang cau KE TIEP trong danh sach, nen cac
// lan tai khac nhau se thay cau khac nhau.
let loadingQuoteIndex = -1; // -1 = chua khoi tao - khoi tao tre (lazy) o lan goi dau, tranh dung toi
                            // MOTIVATIONAL_QUOTES (khai bao ben duoi file) ngay luc nap script (TDZ error)
function startLoadingQuoteRotation() {
  if (loadingQuoteIndex === -1) loadingQuoteIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  const q = MOTIVATIONAL_QUOTES[loadingQuoteIndex];
  el.loadingOverlayText.innerHTML = `<span class="loading-quote-jp">${escapeHtml(q.jp)}</span><span class="loading-quote-vi">${escapeHtml(q.vi)}</span>`;
  loadingQuoteIndex = (loadingQuoteIndex + 1) % MOTIVATIONAL_QUOTES.length;
}

// Mo dan (opacity) roi moi that su an (them class hidden) thay vi cat phut - cho ca 2 truong hop
// deu tranh cam giac giat cuc luc bien mat.
function fadeOutLoadingOverlay() {
  el.loadingOverlay.classList.add('fade-out');
  setTimeout(() => {
    el.loadingOverlay.classList.add('hidden');
    el.loadingOverlay.classList.remove('fade-out');
  }, 200);
}

// An overlay NGAY (chi mo dan nhanh), dung khi that bai/loi - khong can cho hieu ung 100% vi khong co
// gi de "hoan thanh".
function hideLoadingOverlay() {
  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  clearLoadingStallTimers();
  fadeOutLoadingOverlay();
}

// Dung khi THANH CONG: cho vong tron chay hien het len 100% de nguoi dung thay ro da xong, dung lai
// 1 chut o do, roi moi mo dan va an overlay - tranh cam giac giat cuc/nhu bi loi khi an dot ngot luc
// con dang do (vd moi 30%) hoac cat phut ngay khi vua cham 100%.
function finishLoadingOverlay() {
  if (loadingProgressTimer) clearInterval(loadingProgressTimer);
  loadingProgressTimer = null;
  clearLoadingStallTimers();
  setLoadingProgress(100);
  setTimeout(fadeOutLoadingOverlay, 350);
}

function getAppVersion() {
  const script = document.querySelector('script[src*="app.js"]');
  const match = script && script.src.match(/[?&]v=([\w.]+)/);
  return match ? match[1] : '?';
}

// Phan loai linh vuc lon dua theo TIEN TO ten sheet (khong can doi ten sheet nao, chi doc du lieu
// da co san tu fieldCounts). Thu tu kiem tra: BJT -> IT Passport -> N5 -> con lai la Other.
// LUU Y: neu doi quy tac nay, phai doi ca ham getCategoryFromField() tuong ung trong Code.gs
// (dung de loc bang xep hang theo category o backend) cho khop.
const CATEGORY_DEFS = [
  { id: 'bjt', label: 'BJT', icon: '💼', tagline: 'Kỳ thi năng lực kinh doanh tiếng Nhật', match: f => f.trim().toLowerCase().startsWith('bjt') },
  { id: 'itp', label: 'IT Passport', icon: '💻', tagline: 'Chứng chỉ CNTT cơ bản', match: f => f.trim().toLowerCase().startsWith('it passport') },
  { id: 'n5', label: 'N5', icon: '🌱', tagline: 'Nền tảng JLPT mới bắt đầu', match: f => f.trim().toLowerCase().startsWith('n5') },
  { id: 'other', label: 'Khác', icon: '🗂️', tagline: 'Các chủ đề còn lại', match: () => true },
];

function getCategoryId(fieldName) {
  const found = CATEGORY_DEFS.find(c => c.id !== 'other' && c.match(fieldName));
  return found ? found.id : 'other';
}

const MOTIVATIONAL_QUOTES = [
  { jp: '「継続は力なり」', vi: 'Kiên trì chính là sức mạnh.' },
  { jp: '「千里の道も一歩から」', vi: 'Con đường ngàn dặm bắt đầu từ một bước chân.' },
  { jp: '「七転び八起き」', vi: 'Vấp ngã bảy lần, đứng dậy tám lần.' },
  { jp: '「学問に王道なし」', vi: 'Học tập không có con đường tắt.' },
  { jp: '「塵も積もれば山となる」', vi: 'Bụi nhỏ góp lại thành núi — mỗi từ học hôm nay đều có giá trị!' },
];
let quoteIndex = 0;

function showQuote(index) {
  el.quoteJp.textContent = MOTIVATIONAL_QUOTES[index].jp;
  el.quoteVi.textContent = MOTIVATIONAL_QUOTES[index].vi;
}

function startQuoteRotation() {
  showQuote(0);
  setInterval(() => {
    quoteIndex = (quoteIndex + 1) % MOTIVATIONAL_QUOTES.length;
    showQuote(quoteIndex);
  }, 10000);
}

// Chao ngay khi quay lai (dua vao ten da luu) kem streak hien tai, lay tu bang xep hang TONG toan he
// thong (khong phu thuoc category) de dung ngay khi con o man hinh chon linh vuc lon.
function renderGreetingBanner() {
  const savedName = localStorage.getItem(NAME_STORAGE_KEY);
  if (!savedName) return;
  const entry = lastLeaderboardList.find(item => item.name === savedName);
  if (!entry) return;
  const streakText = entry.streak > 0
    ? ` 🔥 Chuỗi ${entry.streak} ngày — đừng bỏ lỡ hôm nay nhé!`
    : ' Hôm nay học gì nào?';
  el.greetingBanner.textContent = `👋 Chào ${savedName}!${streakText}`;
  el.greetingBanner.classList.remove('hidden');
}

// Hien 4 the linh vuc lon kem tong so muc (goi qua tat ca loai: tu vung/test/ghep tu) de nguoi dung
// hinh dung truoc do co bao nhieu de hoc, chua can chon che do.
function renderCategoryScreen() {
  const counts = {};
  CATEGORY_DEFS.forEach(c => { counts[c.id] = 0; });
  allFieldsWithCounts.forEach(f => {
    counts[getCategoryId(f.field)] += f.count;
  });

  el.categoryList.innerHTML = CATEGORY_DEFS.map(c => `
    <button type="button" class="category-card" data-category="${c.id}">
      <span class="category-card-icon">${c.icon}</span>
      <span class="category-card-label">${escapeHtml(c.label)}</span>
      <span class="category-card-tagline">${escapeHtml(c.tagline)}</span>
      <span class="category-card-count">${counts[c.id]} mục</span>
    </button>
  `).join('');

  el.categoryList.querySelectorAll('.category-card').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.category));
  });
}

function selectCategory(categoryId) {
  state.category = categoryId;
  const def = CATEGORY_DEFS.find(c => c.id === categoryId);
  el.setupCategoryTitle.textContent = `${def.icon} ${def.label}`;
  renderFieldCheckboxes();
  leaderboardExpanded = false;
  el.leaderboardFilter.value = 'all';
  loadLeaderboard('all');
  showScreen('setup');
}

function goToCategoryScreen() {
  state.category = null;
  leaderboardExpanded = false;
  el.leaderboardFilter.value = 'all';
  loadLeaderboard('all');
  showScreen('category');
}

const LEADERBOARD_COLLAPSED_COUNT = 3;
const LEADERBOARD_MAX_COUNT = 10; // tren so nay khong hien nua, ke ca khi bam "Xem them"
let leaderboardExpanded = false;
let lastLeaderboardList = [];
let fullLeaderboardList = []; // ban day du (khong cat top 10) - can de doi sang "Top thoi gian" khong phai goi lai API
let leaderboardSortMode = 'score'; // 'score' | 'time'

function setLeaderboardSortMode(mode) {
  if (mode === leaderboardSortMode) return;
  leaderboardSortMode = mode;
  el.leaderboardTabs.forEach(t => t.classList.toggle('active', t.dataset.sort === mode));
  leaderboardExpanded = false;
  renderLeaderboard(fullLeaderboardList);
}

// It ai tu bam doi tab "Diem"/"Thoi gian" nen tu dong doi luan phien moi 15s de ca 2 kieu xep hang
// deu duoc moi nguoi thay qua, khong can thao tac gi.
function startLeaderboardTabRotation() {
  setInterval(() => {
    setLeaderboardSortMode(leaderboardSortMode === 'score' ? 'time' : 'score');
  }, 15000);
}

init();

async function init() {
  const savedName = localStorage.getItem(NAME_STORAGE_KEY);
  if (savedName) el.nameInput.value = savedName;
  el.appVersion.textContent = `v${getAppVersion()}`;

  el.startBtn.addEventListener('click', startQuiz);
  el.revealBtn.addEventListener('click', revealAnswers);
  el.matchingCheckBtn.addEventListener('click', checkMatchingAnswers);
  el.nextBtn.addEventListener('click', nextQuestion);
  el.prevBtn.addEventListener('click', previousQuestion);
  el.replayBtn.addEventListener('click', () => showScreen('setup'));
  el.leaderboardFilter.addEventListener('change', () => {
    leaderboardExpanded = false;
    loadLeaderboard(el.leaderboardFilter.value);
  });
  el.leaderboardToggle.addEventListener('click', () => {
    leaderboardExpanded = !leaderboardExpanded;
    renderLeaderboard(fullLeaderboardList);
  });
  el.leaderboardTabs.forEach(tab => {
    tab.addEventListener('click', () => setLeaderboardSortMode(tab.dataset.sort));
  });
  el.exitQuizBtn.addEventListener('click', exitQuiz);
  el.backToCategoryBtn.addEventListener('click', goToCategoryScreen);
  el.toggleReadingBtn.addEventListener('click', toggleReading);
  el.wordListBtn.addEventListener('click', toggleWordList);
  el.speakBtn.addEventListener('click', () => speakJapanese(el.speakBtn.dataset.text || ''));
  el.markWordBtn.addEventListener('click', toggleMarkCurrentWord);
  el.masteredWordBtn.addEventListener('click', toggleMasteredCurrentWord);
  el.autoAdvanceCheckbox.addEventListener('change', () => {
    state.autoAdvance = el.autoAdvanceCheckbox.checked;
    if (!state.autoAdvance && state.autoAdvanceTimer) {
      clearAutoAdvanceTimer();
      el.nextBtnLabel.textContent = 'Câu tiếp theo';
    } else if (state.autoAdvance && !el.feedback.classList.contains('hidden') && !state.autoAdvanceTimer) {
      startAutoAdvanceCountdown();
    }
  });
  el.hideAnswerCheckbox.addEventListener('change', () => {
    state.hideAnswer = el.hideAnswerCheckbox.checked;
    if (state.mode === 'study') el.feedback.classList.toggle('hidden', state.hideAnswer);
  });
  el.hideWordCheckbox.addEventListener('change', () => {
    state.hideWordInList = el.hideWordCheckbox.checked;
    renderWordListTable();
  });
  el.leaderboardList.addEventListener('click', (e) => {
    const nameBtn = e.target.closest('.lb-name');
    if (nameBtn) openHistoryModal(nameBtn.dataset.name);
  });
  el.historyModalClose.addEventListener('click', closeHistoryModal);
  el.historyModal.addEventListener('click', (e) => {
    if (e.target === el.historyModal) closeHistoryModal();
  });
  el.questionImage.addEventListener('click', () => {
    el.lightboxImg.src = el.questionImage.src;
    el.imageLightbox.classList.remove('hidden');
  });
  el.imageLightbox.addEventListener('click', () => {
    el.imageLightbox.classList.add('hidden');
    el.lightboxImg.src = '';
  });
  el.audioPlayBtn.addEventListener('click', () => {
    if (el.questionAudio.paused) el.questionAudio.play(); else el.questionAudio.pause();
  });
  el.questionAudio.addEventListener('play', () => {
    el.audioPlayIcon.textContent = '⏸';
    el.audioPlayLabel.textContent = 'Đang phát...';
  });
  el.questionAudio.addEventListener('pause', () => {
    el.audioPlayIcon.textContent = '▶';
    el.audioPlayLabel.textContent = 'Nghe audio';
  });
  el.questionAudio.addEventListener('ended', () => {
    el.audioPlayIcon.textContent = '▶';
    el.audioPlayLabel.textContent = 'Nghe lại';
  });
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', onModeChange);
  });
  syncModeCardSelection();

  // Tải song song, không chờ tuần tự — 3 lượt gọi này độc lập với nhau.
  // Chan thao tac cho den khi fieldCounts xong (can de biet co gi de chon) - leaderboard/goi y ten
  // khong chan vi khong anh huong den viec bam "Bat dau".
  showLoadingOverlay('Đang tải danh sách lĩnh vực...');
  loadFieldCounts().finally(finishLoadingOverlay);
  loadLeaderboard('all').then(renderGreetingBanner);
  loadNameSuggestions();
  loadVisitStats();
  startQuoteRotation();
  startLeaderboardTabRotation();
}

// Ghi nhan 1 luot truy cap (moi lan tai trang chu goi 1 lan) va hien tong so + so luot hom nay.
// Khong chan overlay vi khong anh huong den viec bam "Bat dau".
async function loadVisitStats() {
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=visit`);
    const stats = await res.json();
    el.visitCounter.textContent = `👀 Hôm nay: ${stats.today} · Tổng: ${stats.total}`;
    el.visitCounter.classList.remove('hidden');
  } catch (err) {
    // im lặng bỏ qua nếu chưa lấy được số liệu truy cập
  }
}

async function openHistoryModal(name) {
  el.historyModalTitle.textContent = `Lịch sử làm bài (5 gần nhất) — ${name}`;
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
        <td>${formatPercent(s.accuracy)}%</td>
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

// Lay danh sach tu (field+id) ma "name" nay da danh dau "da thuoc, khong muon gap lai" - rieng theo
// tung nguoi choi, dung de loc khoi pool cau hoi ngay khi bat dau 1 luot choi moi (xem startQuiz()).
async function loadMasteredWords(name) {
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=masteredWords&name=${encodeURIComponent(name)}`);
    const mastered = await res.json();
    return new Set(mastered.map(m => `${m.field}|${m.wordId}`));
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
      renderCategoryScreen();
      renderFieldCheckboxes();
      return;
    }

    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=fieldCounts`);
    allFieldsWithCounts = await res.json();
    localStorage.setItem(VERSION_CACHE_KEY, currentVersion);
    localStorage.setItem(FIELD_CACHE_KEY, JSON.stringify(allFieldsWithCounts));
    renderCategoryScreen();
    renderFieldCheckboxes();
  } catch (err) {
    // Loi co the xay ra khi con dang o man hinh category (dau tien) hoac setup - hien thong bao +
    // nut thu lai o CA HAI noi vi khong biet truoc dang o man nao.
    const errorHtml = `
      <p class="error-text">Không tải được danh sách lĩnh vực, vui lòng thử lại.</p>
      <button type="button" class="retry-fields-btn secondary-btn">Thử lại</button>
    `;
    el.categoryList.innerHTML = errorHtml;
    el.groupList.innerHTML = errorHtml;
    document.querySelectorAll('.retry-fields-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const loadingHtml = '<div class="loading-row"><span class="spinner"></span> Đang tải danh sách lĩnh vực...</div>';
        el.categoryList.innerHTML = loadingHtml;
        el.groupList.innerHTML = loadingHtml;
        showLoadingOverlay('Đang tải danh sách lĩnh vực...');
        loadFieldCounts().finally(finishLoadingOverlay);
      });
    });
  }
}

// Che do "Hoc bai" dung chung du lieu/schema voi "On tu vung" (loai sheet 'vocab'), chi khac cach
// hien thi va khong xao tron - nen khi loc theo loai sheet phai quy ve 'vocab'.
function modeToSheetType(mode) {
  return mode === 'study' ? 'vocab' : mode;
}

function onModeChange() {
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  el.directionField.classList.toggle('hidden', state.mode !== 'vocab');
  el.countLabel.textContent = state.mode === 'test' ? 'Số câu muốn làm'
    : state.mode === 'listening' ? 'Số câu muốn nghe'
    : state.mode === 'matching' ? 'Số bộ ghép muốn làm'
    : state.mode === 'study' ? 'Số từ muốn học'
    : 'Số từ muốn ôn';
  syncModeCardSelection();
  renderFieldCheckboxes();
}

// To dam the "the" (mode-card) dang duoc chon - dung class thay vi CSS :has() de chac chan chay
// duoc tren moi trinh duyet.
function syncModeCardSelection() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.classList.toggle('selected', card.querySelector('input').checked);
  });
}

// Khi da chon 1 category, bang xep hang tu dong loc theo category do (kem field/Mon con neu co
// chon them) - "Tổng" luc nay nghia la tong trong category, khong phai tong toan he thong nua.
async function fetchLeaderboardData(fieldFilter) {
  const params = new URLSearchParams({ action: 'leaderboard' });
  if (fieldFilter && fieldFilter !== 'all') params.set('field', fieldFilter);
  if (state.category) params.set('category', state.category);
  const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
  return res.json();
}

async function loadLeaderboard(fieldFilter) {
  try {
    const data = await fetchLeaderboardData(fieldFilter);
    renderLeaderboard(data);
  } catch (err) {
    // im lặng bỏ qua nếu leaderboard chưa sẵn sàng
  }

  // "Top hom nay" LUON tinh tren TOAN BO linh vuc (khong phu thuoc category/Mon dang loc) - goi rieng,
  // khong dung chung du lieu voi fetchLeaderboardData() vi ham do bi scope theo state.category.
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=leaderboard`);
    renderTopToday(await res.json());
  } catch (err) {
    el.topTodayLine.classList.add('hidden');
  }
}

// Nguoi co diem kiem duoc TRONG NGAY HOM NAY cao nhat (todayGain), KHONG phai tong diem tich luy -
// phai tinh tren list DAY DU tu backend (truoc khi renderLeaderboard cat con top 10 theo hoat dong
// gan nhat), vi nguoi dang "top hom nay" chua chac nam trong top 10 do.
function renderTopToday(list) {
  const top = (list || []).reduce((best, item) => (
    item.todayGain > 0 && (!best || item.todayGain > best.todayGain) ? item : best
  ), null);

  if (!top) {
    el.topTodayLine.classList.add('hidden');
    return;
  }
  el.topTodayLine.innerHTML = `🔥 Top hôm nay: <b>${escapeHtml(top.name)}</b> ${top.score}<span class="top-today-gain">(+${top.todayGain})</span>`;
  el.topTodayLine.classList.remove('hidden');
}

// Cap bac theo tong diem tich luy, hien icon dep hon thay cho 1 icon cup phang duy nhat -
// tao dong luc "len hang" khi choi nhieu hon, thay vi chi la 1 con so kho.
const SCORE_TIERS = [
  { min: 20000, icon: '💎', label: 'Huyền thoại' },
  { min: 10000, icon: '👑', label: 'Bậc thầy' },
  { min: 6000, icon: '🌟', label: 'Cao thủ' },
  { min: 3000, icon: '⚔️', label: 'Chiến binh' },
  { min: 1000, icon: '📖', label: 'Học viên' },
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

// Huy chuong/hang dua theo scoreRank (tinh theo diem so tu backend) - doc lap voi vi tri thuc te
// trong danh sach nay (danh sach nay dang sap theo thoi gian hoat dong gan nhat).
const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_CLASSES = { 1: 'rank-gold', 2: 'rank-silver', 3: 'rank-bronze' };

// che do 'time': sap theo TONG THOI GIAN LUYEN TAP giam dan (durationRank) - khac che do 'score'
// (mac dinh) la sap theo hoat dong gan nhat (giu nguyen thu tu backend tra ve, chi gan huy chuong
// theo scoreRank). Dung lai FULL list (khong phai ban da cat top 10) de khong bo sot ai top thoi gian
// nhung lau roi chua choi lai (giong bug tung gap voi "Top hom nay").
function renderLeaderboard(list) {
  fullLeaderboardList = list || [];
  const sourceList = leaderboardSortMode === 'time'
    ? fullLeaderboardList.slice().sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0))
    : fullLeaderboardList;

  // Toi da 10 nguoi, ke ca khi mo rong "Xem them" - qua so nay khong hien nua
  lastLeaderboardList = sourceList.slice(0, LEADERBOARD_MAX_COUNT);
  hasLeaderboardData = lastLeaderboardList.length > 0;
  if (!hasLeaderboardData) {
    el.leaderboardList.innerHTML = '';
    el.leaderboardToggle.classList.add('hidden');
    updateLeaderboardVisibility();
    return;
  }
  const visibleList = leaderboardExpanded ? lastLeaderboardList : lastLeaderboardList.slice(0, LEADERBOARD_COLLAPSED_COUNT);

  el.leaderboardList.innerHTML = visibleList.map((item) => {
    const rank = leaderboardSortMode === 'time' ? item.durationRank : item.scoreRank;
    const medal = RANK_MEDALS[rank];
    const rightContent = leaderboardSortMode === 'time'
      ? `<span class="lb-time" title="Tổng thời gian đã luyện tập (tính trên tất cả lượt chơi)">⏱ ${formatDurationHuman(item.durationSeconds || 0)}</span>`
      : `<span class="lb-score" title="Cấp bậc: ${escapeHtml(getScoreTier(item.score).label)} — tổng điểm rèn luyện tích luỹ">${getScoreTier(item.score).icon} ${item.score}${item.todayGain > 0 ? ` <span class="lb-gain" title="Điểm kiếm được hôm nay">(+${item.todayGain})</span>` : ''}</span>
        <span class="lb-acc" title="Tỉ lệ trả lời đúng (tính trên tất cả lượt chơi)">${formatPercent(item.accuracy)}%</span>`;
    return `
    <li class="${RANK_CLASSES[rank] || ''}">
      <span class="lb-left">
        ${medal ? `<span class="lb-medal" title="Hạng ${rank}">${medal}</span>` : `<span class="lb-rank" title="Hạng ${rank}">${rank}</span>`}
        <span class="lb-name-wrap">
          <button class="lb-name" data-name="${escapeHtml(item.name)}" title="Bấm để xem lịch sử làm bài">${escapeHtml(item.name)}</button>
          ${renderActivityStatus(item.lastActive)}
          ${renderStreakBadge(item.streak)}
        </span>
      </span>
      <span class="lb-right">
        ${rightContent}
      </span>
    </li>`;
  }).join('');

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
  return `<span class="${cls}" title="Hoạt động dựa trên lượt nộp bài gần nhất">${icon}${escapeHtml(status.text)}</span>`;
}

// Trang thai hoat dong va streak co tinh RIENG TUNG DONG (khong noi chung 1 dong bang dau "·") vi
// lb-name-wrap la flex-column: moi the <span> con la 1 dong rieng, luon bat dau cung 1 vi tri can trai
// du chu truoc do (vd "54 phut truoc" vs "6 gio truoc") dai ngan khac nhau - tranh bi lech cot giua cac dong.
function renderStreakBadge(streak) {
  if (!streak || streak <= 0) return '';
  return `<span class="lb-streak" title="Chuỗi ngày làm bài liên tiếp">${getStreakIcon(streak)} ${streak}</span>`;
}

function updateLeaderboardVisibility() {
  el.leaderboardWidget.classList.toggle('hidden', !hasLeaderboardData);
}

function renderFieldCheckboxes() {
  // Khi da chon 1 category (BJT/IT Passport/N5/Other) thi CHI lam viec voi linh vuc thuoc category
  // do - ca danh sach checkbox lan bo loc Mon cua bang xep hang deu thu hep lai, tranh chon nham
  // sang linh vuc cua category khac.
  const fieldsInCategory = state.category
    ? allFieldsWithCounts.filter(f => getCategoryId(f.field) === state.category)
    : allFieldsWithCounts;

  // Bộ lọc xếp hạng liệt kê theo MÔN (gộp điểm mọi bài cùng môn), không phụ thuộc chế độ đang chọn -
  // sắp xếp tự nhiên (vd "Bài 2" trước "Bài 10") thay vì theo thứ tự tab trong Sheet (lộn xộn).
  const subjectsForLeaderboard = [...new Set(fieldsInCategory.map(f => parseFieldName(f.field).subject))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  el.leaderboardFilter.innerHTML = '<option value="all">Tổng</option>' +
    subjectsForLeaderboard.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  const unit = state.mode === 'test' || state.mode === 'listening' ? 'câu' : state.mode === 'matching' ? 'bộ' : 'từ';
  const relevantFields = fieldsInCategory.filter(f => f.type === modeToSheetType(state.mode));

  if (relevantFields.length === 0) {
    const modeLabel = state.mode === 'test' ? 'bộ test' : state.mode === 'listening' ? 'bài luyện nghe' : state.mode === 'matching' ? 'bộ ghép từ' : 'từ vựng';
    el.groupList.innerHTML = `<p class="muted">Chưa có dữ liệu ${modeLabel}.</p>`;
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

  // Sắp xếp luôn các MÔN (dòng gộp cấp ngoài) theo thứ tự tự nhiên - mặc định Map giữ nguyên thứ tự
  // tab trong Sheet (thường lộn xộn, vd "01, 03, 02" tuỳ lúc tạo tab), gây cảm giác danh sách bị xáo trộn vô lý.
  const sortedGroups = [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));

  const totalCount = relevantFields.reduce((sum, f) => sum + f.count, 0);
  let html = `<label class="field-row field-all"><input type="checkbox" value="__all__" checked><span>Tất cả (${totalCount} ${unit})</span></label>`;

  sortedGroups.forEach(([subject, lessons]) => {
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
  if (!allCheckbox || allCheckbox.checked) return null; // null = tất cả lĩnh vực trong category đang chọn
  return [...el.groupList.querySelectorAll('input[name="field"]:checked')].map(cb => cb.value);
}

// Khi tick "Tất cả" trong màn hình chọn lĩnh vực, "tất cả" phải hiểu là tất cả các bài THUỘC category
// đang chọn (BJT/IT Passport/N5/Other), không phải tất cả mọi sheet trong toàn bộ hệ thống - nếu
// không sẽ bị lẫn câu hỏi của category khác (bug đã gặp).
function getCategoryScopedFields() {
  const fieldsInCategory = state.category
    ? allFieldsWithCounts.filter(f => getCategoryId(f.field) === state.category)
    : allFieldsWithCounts;
  return fieldsInCategory.filter(f => f.type === modeToSheetType(state.mode)).map(f => f.field);
}

async function startQuiz() {
  const name = el.nameInput.value.trim();
  el.nameError.textContent = '';
  el.setupError.textContent = '';

  if (!NAME_PATTERN.test(name)) {
    el.nameError.textContent = 'Tên chỉ được chứa chữ cái A-Z, a-z và số, không dấu cách hoặc ký tự đặc biệt.';
    return;
  }

  const selectedFields = getSelectedFields() || getCategoryScopedFields();

  // Khong con fallback ve URL khong loc field nua: neu list rong (truong hop hiem - category/che do
  // nay khong co du lieu) thi coi nhu khong co cau hoi, TUYET DOI khong goi API khong loc (se keo ve
  // du lieu TOAN BO he thong, dinh ca linh vuc khac - chinh la bug da gap truoc day).
  if (selectedFields.length === 0) {
    el.setupError.textContent = 'Không có dữ liệu cho lựa chọn này.';
    return;
  }

  el.startBtn.disabled = true;
  el.startBtn.textContent = 'Đang tải câu hỏi...';
  showLoadingOverlay('Đang tải câu hỏi...');

  let pool;
  try {
    const url = `${CONFIG.APPS_SCRIPT_URL}?field=${encodeURIComponent(selectedFields.join(','))}`;
    const res = await fetch(url);
    const data = await res.json();
    pool = state.mode === 'test'
      ? data.filter(w => w.question && w.choice1)
      : state.mode === 'listening'
        ? data.filter(w => w.audio && w.choice1)
        : state.mode === 'matching'
          ? data.filter(w => w.left1 && w.right1)
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

  // Loc bo cac tu/cau nguoi choi nay da danh dau "da thuoc, khong muon gap lai" - phai lam TRUOC khi
  // kiem tra du so luong toi thieu, de khong bi tinh nham nhung tu da bi an vao so luong con lai.
  state.masteredWords = await loadMasteredWords(name);
  pool = pool.filter(w => !state.masteredWords.has(wordMarkKey(w)));

  const minRequired = (state.mode === 'matching' || state.mode === 'study') ? 1 : 4;
  if (pool.length < minRequired) {
    hideLoadingOverlay();
    el.setupError.textContent = state.mode === 'test'
      ? 'Cần ít nhất 4 câu hỏi trong lĩnh vực đã chọn.'
      : state.mode === 'listening'
        ? 'Cần ít nhất 4 câu luyện nghe trong lĩnh vực đã chọn.'
        : state.mode === 'matching'
          ? 'Lĩnh vực đã chọn chưa có bộ ghép từ nào.'
          : state.mode === 'study'
            ? 'Lĩnh vực đã chọn chưa có từ nào.'
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
  // Che do Hoc bai: KHONG xao tron, giu dung thu tu tra ve tu Sheet (dung id, cac tu lien quan
  // nam canh nhau nhu nguoi dung sap xep) - chi lay N tu dau tien, khac vocab/test/matching la luon
  // ngau nhien/uu tien.
  const selected = state.mode === 'study'
    ? pool.slice(0, count)
    : buildQuizSelection(pool, count, word => state.markedWords.has(wordMarkKey(word)));
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

  // Nut xem toan bo danh sach tu chi hop voi che do co dung cot word/meaning (Hoc bai, On tu vung)
  const canShowWordList = state.mode === 'vocab' || state.mode === 'study';
  el.wordListBtn.classList.toggle('hidden', !canShowWordList);
  el.wordListWrap.classList.add('hidden');
  el.wordListBtn.textContent = '📋 Xem danh sách từ';
  // Checkbox "An tu & vi du" chi hop ly o Hoc bai (On tu vung da co checkbox An nghia rieng)
  state.hideWordInList = false;
  el.hideWordCheckbox.checked = false;
  el.hideWordRow.classList.toggle('hidden', state.mode !== 'study');
  if (canShowWordList) renderWordListTable();

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
  el.quizProgressText.textContent = state.mode === 'study'
    ? `Từ ${state.currentIndex + 1} / ${total}`
    : `Câu ${state.currentIndex + 1} / ${total} — Điểm: ${state.correctCount}`;

  el.answers.innerHTML = '';
  el.feedbackMeaning.textContent = '';
  el.matchingContainer.classList.add('hidden');
  el.matchingLeftCol.innerHTML = '';
  el.matchingRightCol.innerHTML = '';
  el.matchingCheckBtn.classList.add('hidden');
  el.matchingCheckBtn.disabled = true;
  el.feedback.classList.add('hidden');
  el.hideAnswerRow.classList.add('hidden');
  el.prevBtn.classList.add('hidden');
  el.nextBtn.classList.add('hidden');
  el.nextBtn.classList.remove('wrong-result');
  el.nextBtnResult.textContent = '';
  el.nextBtnLabel.textContent = 'Câu tiếp theo';
  el.speakBtn.classList.add('hidden');
  el.questionImage.classList.add('hidden');
  el.questionImage.src = '';
  el.questionAudio.pause();
  el.questionAudio.removeAttribute('src');
  el.audioPlayBtn.classList.add('hidden');
  el.audioPlayIcon.textContent = '▶';
  el.audioPlayLabel.textContent = 'Nghe audio';

  el.questionCard.classList.toggle('long-text', state.mode === 'test');

  if (state.mode === 'listening') {
    el.revealBtn.classList.add('hidden');
    el.toggleReadingBtn.classList.add('hidden');
    el.questionReading.textContent = '';
    el.questionText.textContent = item.word.question || '';
    if (item.word.image) {
      el.questionImage.src = toDriveDirectUrl(item.word.image);
      el.questionImage.classList.remove('hidden');
    }
    el.questionAudio.src = toDriveDirectUrl(item.word.audio);
    el.audioPlayBtn.classList.remove('hidden');
    renderTestAnswers(item, { showLetters: true });
    el.answers.classList.remove('hidden');
  } else if (state.mode === 'test') {
    el.revealBtn.classList.add('hidden');
    el.toggleReadingBtn.classList.add('hidden');
    el.questionReading.textContent = '';
    el.questionText.textContent = item.word.question;
    setSpeakText(item.word.question);
    renderTestAnswers(item);
    el.answers.classList.remove('hidden');
  } else if (state.mode === 'matching') {
    el.revealBtn.classList.add('hidden');
    el.toggleReadingBtn.classList.remove('hidden');
    el.answers.classList.add('hidden');
    el.questionReading.textContent = '';
    el.questionText.textContent = 'Ghép mỗi từ bên trái với đáp án đúng bên phải:';
    renderMatchingPairs(item);
    el.matchingContainer.classList.remove('hidden');
    el.matchingCheckBtn.classList.remove('hidden');
  } else if (state.mode === 'study') {
    // Khong co dap an de tra loi - hien tu + nghia + vi du luon cung luc, chi de "doc qua" thoi.
    el.revealBtn.classList.add('hidden');
    el.toggleReadingBtn.classList.remove('hidden');
    el.answers.classList.add('hidden');
    el.questionText.textContent = item.word.word;
    setSpeakText(item.word.word);
    updateReadingDisplay();
    el.feedbackMeaning.textContent = item.word.meaning || '';
    el.feedbackExample.textContent = item.word.example ? `Ví dụ: ${item.word.example}` : '';
    el.feedbackExampleMeaning.textContent = item.word.example_meaning ? `Nghĩa: ${item.word.example_meaning}` : '';
    el.feedback.classList.toggle('hidden', state.hideAnswer);
    el.hideAnswerRow.classList.remove('hidden');
    el.prevBtn.classList.remove('hidden');
    el.prevBtn.disabled = state.currentIndex === 0;
    el.nextBtn.classList.remove('hidden');
    if (state.autoAdvance) startAutoAdvanceCountdown();
  } else {
    el.revealBtn.classList.remove('hidden');
    el.toggleReadingBtn.classList.remove('hidden');
    el.answers.classList.add('hidden');
    const isJp2Meaning = item.direction === 'jp2meaning';
    el.questionText.textContent = isJp2Meaning ? item.word.word : item.word.meaning;
    if (isJp2Meaning) setSpeakText(item.word.word); // chi doc duoc khi dang hien tu tieng Nhat, khong doc nghia tieng Viet
    updateReadingDisplay();
  }

  // Dem nguoc 30s ap dung Ôn từ vựng, Làm bài test va Luyện nghe - Học bài khong co dap an nen khong
  // ap dung, Ghép từ co co che cham diem khac (4 cap) nen cung khong ap dung.
  if (state.mode === 'vocab' || state.mode === 'test' || state.mode === 'listening') {
    startAnswerTimer();
  } else {
    clearAnswerTimer();
  }

  updateMarkButtonDisplay();
  // Nut "da thuoc, dung hien lai" khong hop voi Ghep tu (1 "tu" o day la ca bo 4 cap, khong phai 1 muc rieng le)
  el.masteredWordBtn.classList.toggle('hidden', state.mode === 'matching');
  if (state.mode !== 'matching') updateMasteredButtonDisplay();
}

// Vi tri hien thi 4 dap an duoc xao tron moi lan render (khong con giu nguyen thu tu trong Sheet
// nhu truoc), nhung van cham diem dung theo chi so goc (data-choice-index) khop voi cot "correct".
// showLetters (che do Luyen nghe): gan nhan A/B/C/D theo THU TU HIEN THI da xao tron (giong dang de
// thi BJT that), khong phai theo so thu tu choice goc trong Sheet.
function renderTestAnswers(item, options) {
  const showLetters = !!(options && options.showLetters);
  const data = item.word;
  const choices = shuffle([1, 2, 3, 4].map(n => ({ index: n, text: data['choice' + n] })));
  const letters = ['A', 'B', 'C', 'D'];
  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.dataset.choiceIndex = choice.index;
    btn.addEventListener('click', () => selectTestAnswer(choice.index, btn));
    if (showLetters) {
      btn.className = 'answer-btn answer-btn-lettered';
      btn.innerHTML = `<span class="answer-letter">${letters[i]}</span><span class="answer-text">${escapeHtml(choice.text)}</span>`;
    } else {
      btn.className = 'answer-btn';
      btn.textContent = choice.text;
    }
    el.answers.appendChild(btn);
  });
}

function selectTestAnswer(chosenIndex, btnEl) {
  const item = state.quizQueue[state.currentIndex];
  const data = item.word;
  const correctIndex = Number(data.correct);
  const isCorrect = chosenIndex === correctIndex;
  const correctText = data['choice' + correctIndex] || '';

  [...el.answers.children].forEach((btn) => {
    btn.disabled = true;
    if (Number(btn.dataset.choiceIndex) === correctIndex) btn.classList.add('correct');
  });
  if (!isCorrect) btnEl.classList.add('wrong');

  const resultText = isCorrect ? '✅ Chính xác!' : `❌ Sai rồi. Đáp án đúng: ${correctText}`;
  finalizeAnswer(data, isCorrect ? 1 : 0, 1, resultText, data.explanation || '', '');
}

// Trang thai 1 cau ghep tu: rightOrder la thu tu hien thi (da xao tron) cua 4 dap an ben phai,
// pairs la map { leftIndex: rightIndex_goc } cac cap da ghep, selectedLeft la o dang cho chon dap an,
// checked = true sau khi da bam "Kiem tra dap an" (khoa lai, khong cho sua nua).
let matchingState = { rightOrder: [], pairs: {}, selectedLeft: null, checked: false };

function renderMatchingPairs(item) {
  const data = item.word;
  const rightOrder = shuffle([0, 1, 2, 3]);
  matchingState = { rightOrder, pairs: {}, selectedLeft: null, checked: false };

  // Viet gon tren 1 dong (khong xuong dong/thut le trong template) vi nut nay dung white-space: pre-line
  // ke thua tu .matching-btn - neu de xuong dong/thut le trong source, cac dau xuong dong do se bi hieu
  // la line break that, lam khung nut phong to bat thuong so voi nut ben phai (chi co 1 dong text don).
  el.matchingLeftCol.innerHTML = [0, 1, 2, 3].map(i => {
    const word = data['left' + (i + 1)];
    const speakSpan = TTS_SUPPORTED ? `<span class="matching-speak-btn" data-speak="${escapeHtml(word)}" title="Nghe phát âm">🔊</span>` : '';
    return `<button type="button" class="matching-btn matching-left-btn" data-index="${i}"><span class="matching-left-text">${escapeHtml(word)}</span><span class="matching-reading${state.showReading ? '' : ' hidden'}">${escapeHtml(data['left' + (i + 1) + '_reading'] || '')}</span>${speakSpan}</button>`;
  }).join('');

  el.matchingRightCol.innerHTML = rightOrder.map(origIndex => `
    <button type="button" class="matching-btn matching-right-btn" data-index="${origIndex}">${escapeHtml(data['right' + (origIndex + 1)])}</button>
  `).join('');

  el.matchingLeftCol.querySelectorAll('.matching-left-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMatchingLeftClick(Number(btn.dataset.index)));
  });
  el.matchingLeftCol.querySelectorAll('.matching-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // tranh kich hoat luon click chon/ghep cua nut cha
      speakJapanese(btn.dataset.speak);
    });
  });
  el.matchingRightCol.querySelectorAll('.matching-right-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMatchingRightClick(Number(btn.dataset.index)));
  });
}

// Bam 1 tu ben trai: neu da ghep roi thi go cap do ra va cho chon lai; bam lai chinh no dang
// duoc chon thi bo chon; con lai thi chon no, cho bam tiep 1 dap an ben phai de ghep.
function handleMatchingLeftClick(leftIndex) {
  if (matchingState.checked) return;

  if (matchingState.pairs[leftIndex] !== undefined) {
    delete matchingState.pairs[leftIndex];
    matchingState.selectedLeft = leftIndex;
  } else if (matchingState.selectedLeft === leftIndex) {
    matchingState.selectedLeft = null;
  } else {
    matchingState.selectedLeft = leftIndex;
  }

  syncMatchingUI();
}

// Bam 1 dap an ben phai: neu no dang ghep voi 1 tu khac thi go cap cu ra truoc (tranh 1 dap an
// bi dung cho 2 tu); neu dang co 1 tu ben trai duoc chon thi ghep no voi dap an vua bam.
function handleMatchingRightClick(rightIndex) {
  if (matchingState.checked) return;

  const existingLeft = Object.keys(matchingState.pairs).find(li => matchingState.pairs[li] === rightIndex);
  if (existingLeft !== undefined) delete matchingState.pairs[Number(existingLeft)];

  if (matchingState.selectedLeft !== null) {
    matchingState.pairs[matchingState.selectedLeft] = rightIndex;
    matchingState.selectedLeft = null;
  }

  syncMatchingUI();
}

// Ve lai class/badge so thu tu cho tat ca nut trai-phai dung theo matchingState hien tai,
// va bat/tat nut "Kiem tra dap an" (chi bat khi da ghep du 4/4 cap).
function syncMatchingUI() {
  el.matchingLeftCol.querySelectorAll('.matching-left-btn').forEach(btn => {
    const i = Number(btn.dataset.index);
    const paired = matchingState.pairs[i] !== undefined;
    btn.classList.toggle('paired', paired);
    btn.classList.toggle('selected', matchingState.selectedLeft === i);
    setMatchingBadge(btn, paired ? i + 1 : null);
  });

  el.matchingRightCol.querySelectorAll('.matching-right-btn').forEach(btn => {
    const rightIndex = Number(btn.dataset.index);
    const pairedLeft = Object.keys(matchingState.pairs).find(li => matchingState.pairs[li] === rightIndex);
    btn.classList.toggle('paired', pairedLeft !== undefined);
    setMatchingBadge(btn, pairedLeft !== undefined ? Number(pairedLeft) + 1 : null);
  });

  el.matchingCheckBtn.disabled = Object.keys(matchingState.pairs).length < 4;
}

function setMatchingBadge(btn, number) {
  const oldBadge = btn.querySelector('.matching-badge');
  if (oldBadge) oldBadge.remove();
  if (number === null) return;
  const badge = document.createElement('span');
  badge.className = 'matching-badge';
  badge.textContent = String(number);
  btn.prepend(badge);
}

// Cham diem 1 cau ghep tu: rightN la dap an dung cho leftN (theo dung quy uoc cot trong Sheet),
// nen 1 cap dung khi pairs[i] === i. Diem tinh tung phan (0-4), khac vocab/test la dung/sai tuyet doi.
function checkMatchingAnswers() {
  const item = state.quizQueue[state.currentIndex];
  const data = item.word;
  matchingState.checked = true;

  let correctCount = 0;
  el.matchingLeftCol.querySelectorAll('.matching-left-btn').forEach(btn => {
    const i = Number(btn.dataset.index);
    const isCorrect = matchingState.pairs[i] === i;
    if (isCorrect) correctCount += 1;
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    btn.disabled = true;
  });

  el.matchingRightCol.querySelectorAll('.matching-right-btn').forEach(btn => {
    const rightIndex = Number(btn.dataset.index);
    const pairedLeft = Object.keys(matchingState.pairs).find(li => matchingState.pairs[li] === rightIndex);
    const isCorrectPair = pairedLeft !== undefined && Number(pairedLeft) === rightIndex;
    btn.classList.add(isCorrectPair ? 'correct' : 'wrong');
    btn.disabled = true;
  });

  el.matchingCheckBtn.classList.add('hidden');

  const resultText = correctCount === 4 ? '✅ Chính xác cả 4 cặp!' : `⚠️ Đúng ${correctCount}/4 cặp.`;
  finalizeAnswer(data, correctCount, 4, resultText, data.explanation || '', '');
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

function updateMasteredButtonDisplay() {
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;
  const mastered = state.masteredWords.has(wordMarkKey(item.word));
  el.masteredWordBtn.textContent = mastered ? '✔️ Đã ẩn (bấm để hiện lại)' : '✅ Đã thuộc, đừng hiện lại';
  el.masteredWordBtn.classList.toggle('mastered', mastered);
}

// Danh dau "da thuoc" chi anh huong TU LAN CHOI SAU (pool duoc loc o startQuiz) - khong lam bien mat
// tu dang xem trong luot choi hien tai, giong cach "Danh dau on lai" cung khong doi queue dang chay.
async function toggleMasteredCurrentWord() {
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;
  const key = wordMarkKey(item.word);
  const willMaster = !state.masteredWords.has(key);

  el.masteredWordBtn.disabled = true;
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'toggleMastered',
        name: state.playerName,
        field: item.word.field,
        wordId: item.word.id,
      }),
    });
    if (willMaster) state.masteredWords.add(key); else state.masteredWords.delete(key);
    updateMasteredButtonDisplay();
  } catch (err) {
    // lỗi mạng thì thôi, không chặn người dùng làm tiếp
  } finally {
    el.masteredWordBtn.disabled = false;
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

// Doc phat am bang Web Speech API co san trong trinh duyet (Chrome/Edge co san giong tieng Nhat,
// khong can API key hay backend gi ca - mien phi hoan toan). Neu trinh duyet khong ho tro thi cac
// nut loa se khong bao gio duoc hien ra (xem TTS_SUPPORTED), khong lam gi ca khi bam nham.
const TTS_SUPPORTED = 'speechSynthesis' in window;

// Chi hien nut loa khi thuc su co chu tieng Nhat de doc (vd khong hien khi dang hien nghia tieng Viet)
function setSpeakText(text) {
  if (!TTS_SUPPORTED || !text) {
    el.speakBtn.classList.add('hidden');
    return;
  }
  el.speakBtn.dataset.text = text;
  el.speakBtn.classList.remove('hidden');
}

function speakJapanese(text) {
  if (!TTS_SUPPORTED || !text) return;
  window.speechSynthesis.cancel(); // huy cau dang doc do (neu co) truoc khi doc cau moi, tranh chong tieng
  const utterance = new SpeechSynthesisUtterance(text.replace(/_+/g, ''));
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// Bang xem truoc toan bo tu cua luot choi nay (id/tu/vi du/nghia), co scroll rieng khi danh sach dai.
// Che do Hoc bai co the tick "An tu & vi du" de chi con thay cot Nghia - tu kiem tra xem con nho
// duoc tu tieng Nhat tuong ung khong truoc khi bam lai de doi chieu.
function renderWordListTable() {
  const hideWord = state.hideWordInList && state.mode === 'study';
  el.wordListBody.innerHTML = state.quizQueue.map(item => `
    <tr><td>${escapeHtml(String(item.word.id))}</td><td>${hideWord ? '???' : escapeHtml(item.word.word)}</td><td>${hideWord ? '???' : escapeHtml(item.word.example || '')}</td><td>${escapeHtml(item.word.meaning)}</td></tr>
  `).join('');
}

function toggleWordList() {
  const willShow = el.wordListWrap.classList.contains('hidden');
  el.wordListWrap.classList.toggle('hidden');
  el.wordListBtn.textContent = willShow ? '🙈 Ẩn danh sách từ' : '📋 Xem danh sách từ';
}

function toggleReading() {
  state.showReading = !state.showReading;
  el.toggleReadingBtn.textContent = state.showReading ? '🙈 Ẩn cách đọc' : '👁 Hiện cách đọc';
  if (state.mode === 'matching') {
    updateMatchingReadingDisplay();
  } else {
    updateReadingDisplay();
  }
}

function updateReadingDisplay() {
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;
  // Che do Hoc bai luon hien tu goc (khong co huong jp2meaning/meaning2jp) nen coi nhu jp2meaning
  const isJp2Meaning = state.mode === 'study' || item.direction === 'jp2meaning';
  el.questionReading.textContent = isJp2Meaning && state.showReading ? (item.word.reading || '') : '';
}

function updateMatchingReadingDisplay() {
  el.matchingLeftCol.querySelectorAll('.matching-reading').forEach(span => {
    span.classList.toggle('hidden', !state.showReading);
  });
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
  finalizeAnswer(item.word, isCorrect ? 1 : 0, 1, resultText, exampleText, exampleMeaningText);
}

// Xu ly phan chung sau khi tra loi (dung cho ca 3 che do): cap nhat diem, danh sach sai, hien khung
// feedback, ghi nhan uu tien, va tu dong chuyen cau neu bat.
// correctPoints/totalPoints cho phep tinh diem tung phan (che do Ghep tu: dung 3/4 cap van duoc 3
// diem) - vocab/test luon truyen (1,1) hoac (0,1). Rieng viec coi la "dung tuyet doi" (vao wrongList,
// tinh vao danh sach uu tien) chi khi correctPoints === totalPoints (vd Ghep tu phai dung ca 4/4).
function finalizeAnswer(data, correctPoints, totalPoints, resultText, line1, line2) {
  clearAnswerTimer();
  state.answeredCount += totalPoints;
  const isCorrect = correctPoints === totalPoints;

  const field = data.field || 'Khác';
  if (!state.fieldTally[field]) state.fieldTally[field] = { correct: 0, total: 0 };
  state.fieldTally[field].total += totalPoints;
  state.fieldTally[field].correct += correctPoints;
  state.correctCount += correctPoints;

  if (!isCorrect) state.wrongList.push(data);

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

// Dem nguoc 30s cho moi cau (chi Ôn từ vựng/Làm bài test). Cap nhat vong tron + so dem MOI KHUNG
// HINH dua tren thoi gian THUC TE da troi qua (Date.now()), khong dung CSS transition dat san 30s -
// transition co the chay khong deu (nhanh/cham that thuong) neu trinh duyet ban ve lai (repaint
// conic-gradient kha nang, co the bi delay khi co viec khac tren main thread). Tinh theo thoi gian
// thuc luon tu dong bat kip dung toc do, khong bao gio bi lech du frame co bi drop.
const ANSWER_TIME_LIMIT_MS = 30000;
let answerTimeoutId = null;
let answerTimerRAF = null;
let answerTimerDeadline = 0;

function startAnswerTimer() {
  clearAnswerTimer();
  answerTimerDeadline = Date.now() + ANSWER_TIME_LIMIT_MS;
  el.timerRing.classList.add('active');
  el.timerCountdown.classList.remove('hidden');

  const tick = () => {
    const remainingMs = answerTimerDeadline - Date.now();
    const progress = Math.max(remainingMs, 0) / ANSWER_TIME_LIMIT_MS;
    el.timerRing.style.setProperty('--timer-progress', String(progress));
    el.timerCountdown.textContent = String(Math.max(Math.ceil(remainingMs / 1000), 0));
    if (remainingMs > 0) answerTimerRAF = requestAnimationFrame(tick);
  };
  tick();

  answerTimeoutId = setTimeout(handleAnswerTimeout, ANSWER_TIME_LIMIT_MS);
}

// Goi khi da co cau tra loi (hoac het gio, hoac chuyen sang cau khac) - dung vong dem lai, an di.
function clearAnswerTimer() {
  if (answerTimeoutId) clearTimeout(answerTimeoutId);
  answerTimeoutId = null;
  if (answerTimerRAF) cancelAnimationFrame(answerTimerRAF);
  answerTimerRAF = null;
  el.timerRing.classList.remove('active');
  el.timerRing.style.setProperty('--timer-progress', '1');
  el.timerCountdown.classList.add('hidden');
}

// Het 30s ma chua chon dap an: tu dong hien dap an dung, tinh la sai (coi nhu khong chon), sau do
// di theo dung luong finalizeAnswer nhu tra loi binh thuong - tu chuyen cau neu dang bat, khong thi
// dung yen cho bam "Cau tiep theo" thu cong.
function handleAnswerTimeout() {
  answerTimeoutId = null;
  const item = state.quizQueue[state.currentIndex];
  if (!item) return;

  if (state.mode === 'vocab') {
    if (el.answers.classList.contains('hidden')) revealAnswers();
    const isJp2Meaning = item.direction === 'jp2meaning';
    const correctValue = isJp2Meaning ? item.word.meaning : item.word.word;
    [...el.answers.children].forEach(btn => {
      btn.disabled = true;
      if (btn.textContent === correctValue) btn.classList.add('correct');
    });
    const resultText = `⌛ Hết giờ! Đáp án đúng: ${correctValue}`;
    const exampleText = item.word.example ? `Ví dụ: ${item.word.example}` : '';
    const exampleMeaningText = item.word.example_meaning ? `Nghĩa: ${item.word.example_meaning}` : '';
    finalizeAnswer(item.word, 0, 1, resultText, exampleText, exampleMeaningText);
  } else if (state.mode === 'test' || state.mode === 'listening') {
    const data = item.word;
    const correctIndex = Number(data.correct);
    const correctText = data['choice' + correctIndex] || '';
    [...el.answers.children].forEach(btn => {
      btn.disabled = true;
      if (Number(btn.dataset.choiceIndex) === correctIndex) btn.classList.add('correct');
    });
    const resultText = `⌛ Hết giờ! Đáp án đúng: ${correctText}`;
    finalizeAnswer(data, 0, 1, resultText, data.explanation || '', '');
  }
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

// Chi dung cho che do Hoc bai - xem lai tu truoc do, khong lam gi neu dang o tu dau tien.
function previousQuestion() {
  if (state.currentIndex <= 0) return;
  clearAutoAdvanceTimer();
  state.currentIndex -= 1;
  renderQuestion();
}

// Thoat giua chung ve trang chu (vd chon nham chu de) - bai dang lam do khong duoc ghi nhan,
// khong goi submitResult nen khong tinh diem/lich su/streak cho luot nay.
function exitQuiz() {
  const confirmed = confirm('Thoát về trang chủ? Bài đang làm dở sẽ không được tính.');
  if (!confirmed) return;
  clearAutoAdvanceTimer();
  clearAnswerTimer();
  el.questionAudio.pause();
  stopTimer();
  showScreen('setup');
}

async function finishQuiz() {
  clearAnswerTimer();
  el.questionAudio.pause();
  const elapsedMs = stopTimer();

  el.resultName.textContent = state.playerName;
  el.resultTime.textContent = formatTime(elapsedMs);

  // Hoc bai la doc/on thu dong, khong co dung/sai nen khong tinh diem/lich su/streak/hang -
  // chi bao lai da doc xong bao nhieu tu, khong goi submitResult.
  if (state.mode === 'study') {
    el.resultAccuracyLabel.textContent = 'Số từ đã học';
    el.resultAccuracy.textContent = String(state.quizQueue.length);
    el.resultCongrats.classList.add('hidden');
    el.wrongListWrap.classList.add('hidden');
    showScreen('result');
    return;
  }

  el.resultAccuracyLabel.textContent = 'Chính xác';
  const accuracy = state.answeredCount > 0 ? Math.round((state.correctCount / state.answeredCount) * 1000) / 10 : 0;
  el.resultAccuracy.textContent = `${formatPercent(accuracy)}%`;

  el.resultPointsEarned.textContent = `🎉 Bạn vừa ghi thêm ${state.correctCount} điểm rèn luyện!`;
  el.resultCongrats.classList.remove('hidden');

  if (state.wrongList.length > 0) {
    el.wrongListWrap.classList.remove('hidden');
    el.wrongListTitle.textContent = state.mode === 'test' || state.mode === 'listening' ? 'Các câu trả lời sai'
      : state.mode === 'matching' ? 'Các bộ ghép chưa đúng hết'
      : 'Các từ trả lời sai';
    el.wrongList.innerHTML = state.wrongList.map(w => {
      if (state.mode === 'test' || state.mode === 'listening') {
        const correctText = w['choice' + w.correct] || '';
        return `<li>${escapeHtml(w.question)} — Đáp án đúng: ${escapeHtml(correctText)}</li>`;
      }
      if (state.mode === 'matching') {
        const pairs = [1, 2, 3, 4].map(n => `${w['left' + n]} → ${w['right' + n]}`).join('; ');
        return `<li>${escapeHtml(pairs)}</li>`;
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

    // Bo thong bao xep hang #N (tinh theo thu tu hien thi/hoat dong gan day, khong phai theo diem so
    // thuc su nen de gay hieu nham) - chi con bao streak de tao dong luc, van can allBoard de tra cuu
    // streak hien tai cua nguoi choi.
    const allBoard = await fetchLeaderboardData('all');
    const myEntry = allBoard.find(item => item.name === state.playerName);
    const streak = myEntry ? (myEntry.streak || 0) : 0;
    el.resultStreakMessage.textContent = streak > 1
      ? `${getStreakIcon(streak)} Chuỗi ${streak} ngày liên tiếp — đừng để tắt lửa nhé!`
      : streak === 1
        ? '🔥 Bắt đầu chuỗi ngày học rồi đó, mai nhớ quay lại nhé!'
        : '';
  } catch (err) {
    el.resultStreakMessage.textContent = '';
  }
}

function showScreen(name) {
  el.categoryScreen.classList.toggle('hidden', name !== 'category');
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

// Chuan hoa hien thi % luon co 1 chu so thap phan (vd "96.0%" thay vi luc "96%" luc "92.7%" lung tung)
function formatPercent(n) {
  return Number(n).toFixed(1);
}

// Hien thoi gian ren luyen tich luy gon, de doc (vd "45 phút", "2h30p") thay vi hien nguyen so giay.
// LUON lam tron XUONG theo phut (vd 30 phut 40s -> "30 phút", khong lam tron len 31) - tranh cam giac
// "ao" diem/thoi gian khi nguoi dung tu cong nham.
function formatDurationHuman(totalSeconds) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  return `${hours}h${String(minutes).padStart(2, '0')}p`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Che do Luyen nghe: anh/audio duoc luu bang link chia se Google Drive (dan truc tiep tu "Get link"
// cua Drive, khong can format gi dac biet). Link chia se mac dinh (/file/d/ID/view hoac ?id=ID) KHONG
// nhung truc tiep duoc trong the <img>/<audio> - phai doi sang dang "uc?export=view&id=ID" moi phat/
// hien truc tiep duoc. Neu khong nhan dien duoc dang link Drive (vd da la link truc tiep san co o noi
// khac) thi dung nguyen link goc.
function toDriveDirectUrl(url) {
  if (!url) return '';
  const match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : String(url).trim();
}
