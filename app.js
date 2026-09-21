const NAME_STORAGE_KEY = 'jpquiz_name';
const NAME_PATTERN = /^[A-Za-z0-9]+$/;

const state = {
  allWords: [],
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
};

const el = {
  nameInput: document.getElementById('name-input'),
  nameSuggestions: document.getElementById('name-suggestions'),
  nameError: document.getElementById('name-error'),
  groupList: document.getElementById('group-list'),
  countSelect: document.getElementById('count-select'),
  setupError: document.getElementById('setup-error'),
  startBtn: document.getElementById('start-btn'),

  setupScreen: document.getElementById('setup-screen'),
  quizScreen: document.getElementById('quiz-screen'),
  resultScreen: document.getElementById('result-screen'),

  quizProgressText: document.getElementById('quiz-progress-text'),
  quizTimer: document.getElementById('quiz-timer'),
  autoAdvanceCheckbox: document.getElementById('auto-advance-checkbox'),
  toggleReadingBtn: document.getElementById('toggle-reading-btn'),
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
  wrongList: document.getElementById('wrong-list'),
  replayBtn: document.getElementById('replay-btn'),

  leaderboardWidget: document.getElementById('leaderboard-widget'),
  leaderboardList: document.getElementById('leaderboard-list'),
  leaderboardFilter: document.getElementById('leaderboard-filter'),
  leaderboardToggle: document.getElementById('leaderboard-toggle'),
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
  el.autoAdvanceCheckbox.addEventListener('change', () => {
    state.autoAdvance = el.autoAdvanceCheckbox.checked;
    if (!state.autoAdvance && state.autoAdvanceTimer) {
      clearAutoAdvanceTimer();
      el.nextBtn.textContent = 'Câu tiếp theo';
    } else if (state.autoAdvance && !el.feedback.classList.contains('hidden') && !state.autoAdvanceTimer) {
      startAutoAdvanceCountdown();
    }
  });

  await loadWords();
  loadLeaderboard('all');
  loadNameSuggestions();
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

async function loadWords() {
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL);
    const data = await res.json();
    state.allWords = data.filter(w => w.word && w.meaning);
    renderFields();
  } catch (err) {
    el.groupList.innerHTML = '<p class="error-text">Không tải được danh sách từ. Kiểm tra lại APPS_SCRIPT_URL trong config.js.</p>';
  }
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
        <span class="lb-name">${escapeHtml(item.name)}</span>
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

function renderFields() {
  const counts = {};
  state.allWords.forEach(w => {
    if (!w.field) return;
    counts[w.field] = (counts[w.field] || 0) + 1;
  });
  const fields = Object.keys(counts);

  // Đổ danh sách lĩnh vực vào bộ lọc xếp hạng (giữ nguyên lựa chọn "Tổng" ở đầu)
  el.leaderboardFilter.innerHTML = '<option value="all">Tổng</option>' +
    fields.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

  if (fields.length === 0) {
    el.groupList.innerHTML = '<p class="muted">Chưa có dữ liệu từ vựng.</p>';
    return;
  }

  const allOption = `<label><input type="checkbox" name="field" value="__all__" checked> Tất cả (${state.allWords.length} từ)</label>`;
  const fieldOptions = fields.map(f => `<label><input type="checkbox" name="field" value="${escapeHtml(f)}"> ${escapeHtml(f)} (${counts[f]} từ)</label>`).join('');
  el.groupList.innerHTML = allOption + fieldOptions;

  const allCheckbox = el.groupList.querySelector('input[value="__all__"]');
  const fieldCheckboxes = () => [...el.groupList.querySelectorAll('input[name="field"]:not([value="__all__"])')];

  allCheckbox.addEventListener('change', () => {
    if (allCheckbox.checked) fieldCheckboxes().forEach(cb => cb.checked = false);
  });
  fieldCheckboxes().forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) allCheckbox.checked = false;
    });
  });
}

function getSelectedFields() {
  const allCheckbox = el.groupList.querySelector('input[value="__all__"]');
  if (!allCheckbox || allCheckbox.checked) return null; // null = tất cả lĩnh vực
  return [...el.groupList.querySelectorAll('input[name="field"]:checked')].map(cb => cb.value);
}

function startQuiz() {
  const name = el.nameInput.value.trim();
  el.nameError.textContent = '';
  el.setupError.textContent = '';

  if (!NAME_PATTERN.test(name)) {
    el.nameError.textContent = 'Tên chỉ được chứa chữ cái A-Z, a-z và số, không dấu cách hoặc ký tự đặc biệt.';
    return;
  }

  const selectedFields = getSelectedFields();
  const pool = selectedFields ? state.allWords.filter(w => selectedFields.includes(w.field)) : state.allWords.slice();

  if (pool.length < 4) {
    el.setupError.textContent = 'Cần ít nhất 4 từ trong lĩnh vực đã chọn để tạo câu hỏi trắc nghiệm.';
    return;
  }

  localStorage.setItem(NAME_STORAGE_KEY, name);
  state.playerName = name;
  state.filteredWords = pool;

  const countValue = el.countSelect.value;
  const count = countValue === 'all' ? pool.length : Math.min(Number(countValue), pool.length);

  const direction = document.querySelector('input[name="direction"]:checked').value;
  const shuffled = shuffle(pool.slice()).slice(0, count);
  state.quizQueue = shuffled.map(word => ({
    word,
    direction: direction === 'mix' ? (Math.random() < 0.5 ? 'jp2meaning' : 'meaning2jp') : direction,
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

  el.answers.classList.add('hidden');
  el.answers.innerHTML = '';
  el.feedback.classList.add('hidden');
  el.revealBtn.classList.remove('hidden');
  el.nextBtn.textContent = 'Câu tiếp theo';

  el.questionText.textContent = item.direction === 'jp2meaning' ? item.word.word : item.word.meaning;
  updateReadingDisplay();
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

  state.answeredCount += 1;

  const field = item.word.field || 'Khác';
  if (!state.fieldTally[field]) state.fieldTally[field] = { correct: 0, total: 0 };
  state.fieldTally[field].total += 1;

  if (isCorrect) {
    state.correctCount += 1;
    state.fieldTally[field].correct += 1;
  } else {
    state.wrongList.push(item.word);
  }

  el.feedbackResult.textContent = isCorrect ? '✅ Chính xác!' : `❌ Sai rồi. Đáp án đúng: ${correctValue}`;
  el.feedbackExample.textContent = item.word.example ? `Ví dụ: ${item.word.example}` : '';
  el.feedbackExampleMeaning.textContent = item.word.example_meaning ? `Nghĩa: ${item.word.example_meaning}` : '';
  el.feedback.classList.remove('hidden');

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
    el.wrongList.innerHTML = state.wrongList.map(w => `<li>${escapeHtml(w.word)} (${escapeHtml(w.reading || '')}) — ${escapeHtml(w.meaning)}</li>`).join('');
  } else {
    el.wrongListWrap.classList.add('hidden');
  }

  showScreen('result');
  submitResult();
}

async function submitResult() {
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
