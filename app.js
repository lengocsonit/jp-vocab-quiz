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
  feedbackResult: document.getElementById('feedback-result'),
  feedbackExample: document.getElementById('feedback-example'),
  feedbackExampleMeaning: document.getElementById('feedback-example-meaning'),
  nextBtn: document.getElementById('next-btn'),

  resultName: document.getElementById('result-name'),
  resultScore: document.getElementById('result-score'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultTime: document.getElementById('result-time'),
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
};

const LEADERBOARD_COLLAPSED_COUNT = 5;
let leaderboardExpanded = false;
let lastLeaderboardList = [];

init();

async function init() {
  const savedName = localStorage.getItem(NAME_STORAGE_KEY);
  if (savedName) el.nameInput.value = savedName;

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
  el.toggleReadingBtn.addEventListener('click', toggleReading);
  el.markWordBtn.addEventListener('click', toggleMarkCurrentWord);
  el.autoAdvanceCheckbox.addEventListener('change', () => {
    state.autoAdvance = el.autoAdvanceCheckbox.checked;
    if (!state.autoAdvance && state.autoAdvanceTimer) {
      clearAutoAdvanceTimer();
      el.nextBtn.textContent = 'Câu tiếp theo';
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

  // Tải song song, không chờ tuần tự — 3 lượt gọi này độc lập với nhau
  loadFieldCounts();
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

async function loadFieldCounts() {
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=fieldCounts`);
    allFieldsWithCounts = await res.json();
    renderFieldCheckboxes();
  } catch (err) {
    el.groupList.innerHTML = '<p class="error-text">Không tải được danh sách lĩnh vực. Kiểm tra lại APPS_SCRIPT_URL trong config.js.</p>';
  }
}

function onModeChange() {
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  el.directionField.classList.toggle('hidden', state.mode === 'test');
  el.countLabel.textContent = state.mode === 'test' ? 'Số câu muốn làm' : 'Số từ muốn ôn';
  renderFieldCheckboxes();
}

async function loadLeaderboard(fieldFilter) {
  try {
    const url = fieldFilter && fieldFilter !== 'all'
      ? `${CONFIG.APPS_SCRIPT_URL}?action=leaderboard&field=${encodeURIComponent(fieldFilter)}`
      : `${CONFIG.APPS_SCRIPT_URL}?action=leaderboard`;
    const res = await fetch(url);
    const data = await res.json();
    renderLeaderboard(data);
  } catch (err) {
    // im lặng bỏ qua nếu leaderboard chưa sẵn sàng
  }
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
  const crownColors = ['#e63946', '#c0c0c0', '#cd7f32']; // đỏ, bạc, đồng cho hạng 1-2-3
  const visibleList = leaderboardExpanded ? lastLeaderboardList : lastLeaderboardList.slice(0, LEADERBOARD_COLLAPSED_COUNT);

  el.leaderboardList.innerHTML = visibleList.map((item, i) => `
    <li>
      <span class="lb-left">
        ${crownColors[i] ? crownIcon(crownColors[i]) : `<span class="lb-rank">${i + 1}</span>`}
        <button class="lb-name" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>
      </span>
      <span class="lb-right">
        <span class="lb-score">🏆 ${item.score}</span>
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

function crownIcon(color) {
  return `<svg class="lb-crown" width="14" height="14" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><path d="M2 20h20l-2-9-5 4-3-7-3 7-5-4-2 9z"/></svg>`;
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
    el.startBtn.disabled = false;
    el.startBtn.textContent = 'Bắt đầu';
    el.setupError.textContent = 'Không tải được câu hỏi, vui lòng thử lại.';
    return;
  }

  el.startBtn.disabled = false;
  el.startBtn.textContent = 'Bắt đầu';

  if (pool.length < 4) {
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
  el.nextBtn.textContent = 'Câu tiếp theo';

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

  el.feedbackResult.textContent = resultText;
  el.feedbackExample.textContent = line1 || '';
  el.feedbackExampleMeaning.textContent = line2 || '';
  el.feedback.classList.remove('hidden');

  recordAnswerForPriority(data, isCorrect);

  if (state.autoAdvance) startAutoAdvanceCountdown();
}

function startAutoAdvanceCountdown() {
  let remaining = 3;
  el.nextBtn.textContent = `Câu tiếp theo (${remaining})`;
  state.autoAdvanceTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearAutoAdvanceTimer();
      nextQuestion();
    } else {
      el.nextBtn.textContent = `Câu tiếp theo (${remaining})`;
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

async function finishQuiz() {
  const elapsedMs = stopTimer();
  const accuracy = state.answeredCount > 0 ? Math.round((state.correctCount / state.answeredCount) * 1000) / 10 : 0;

  el.resultName.textContent = `Người chơi: ${state.playerName}`;
  el.resultScore.textContent = `Điểm lượt này: ${state.correctCount}`;
  el.resultAccuracy.textContent = `Tỉ lệ chính xác lượt này: ${accuracy}%`;
  el.resultTime.textContent = `Thời gian làm bài: ${formatTime(elapsedMs)}`;

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
  } catch (err) {
    // không chặn người dùng nếu ghi lịch sử thất bại
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
