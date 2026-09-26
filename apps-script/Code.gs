// Dán toàn bộ file này vào Apps Script (Extensions > Apps Script) của Google Sheet
// Mỗi lĩnh vực (BJT, IT Passport, SG, FE, ...) là 1 sheet riêng, tên sheet = tên lĩnh vực.
// Có 3 loại sheet, tự nhận diện qua dòng tiêu đề (không cần đặt tên theo quy ước riêng):
//   - Sheet Từ vựng: cột word | reading | meaning | example | example_meaning
//   - Sheet Test trắc nghiệm: cột question | choice1 | choice2 | choice3 | choice4 | correct | explanation
//   - Sheet Ghép từ: cột left1-4 | right1-4 (rightN là đáp án đúng của leftN) | explanation
// Ngoài ra cần 1 sheet tên "History" để lưu lịch sử làm bài (xem README).

var HISTORY_SHEET = 'History';
var MARKED_SHEET = 'MarkedWords';
// 'Streaks': tab con lai tu 1 phien ban cu (da bo, streak gio tinh thang tu History) - giu trong danh
// sach nay de neu ai da lo tao tab do thi no van khong bi hien nham thanh 1 linh vuc tren web.
var RESERVED_SHEETS = ['History', 'MarkedWords', 'Streaks'];
var STREAK_GRACE_DAYS = 2; // cach ngay hien tai <= so nay van tinh la con chuoi, qua so nay moi reset ve 1
var FIELD_COLUMNS = ['id', 'word', 'reading', 'meaning', 'example', 'example_meaning'];
var TEST_COLUMNS = ['id', 'question', 'choice1', 'choice2', 'choice3', 'choice4', 'correct', 'explanation'];
var MATCHING_COLUMNS = ['id', 'left1', 'left2', 'left3', 'left4', 'right1', 'right2', 'right3', 'right4', 'explanation'];
var PRIORITY_GRADUATE_STREAK = 2; // dung lien tiep bao nhieu lan thi tu dong go khoi danh sach uu tien
var DATA_VERSION_KEY = 'dataVersion'; // luu trong Script Properties, dung de frontend biet du lieu da doi chua

// Thêm menu "Từ vựng" mỗi khi mở Google Sheet, để tạo lĩnh vực mới bằng 1 click
// thay vì phải tự tạo tab và gõ tay đúng tên cột.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Từ vựng')
    .addItem('➕ Thêm lĩnh vực mới', 'addNewField')
    .addItem('📥 Import CSV vào lĩnh vực', 'showImportCsvDialog')
    .addToUi();
}

function addNewField() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Thêm lĩnh vực mới',
    'Nhập tên lĩnh vực. Nếu môn học có nhiều bài, đặt tên có dấu "-" (vd: BJT - Bài 1) để web tự nhóm theo môn:',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  var name = response.getResponseText().trim();
  if (!name) {
    ui.alert('Tên lĩnh vực không được để trống.');
    return;
  }
  if (name === HISTORY_SHEET) {
    ui.alert('Tên này trùng với sheet "History" (dùng để lưu lịch sử), vui lòng chọn tên khác.');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(name)) {
    ui.alert('Lĩnh vực "' + name + '" đã tồn tại.');
    return;
  }

  var typeResponse = ui.prompt(
    'Loại lĩnh vực',
    'Gõ "1" cho Từ vựng, "2" cho Test trắc nghiệm, "3" cho Ghép từ (để trống = Từ vựng):',
    ui.ButtonSet.OK_CANCEL
  );
  if (typeResponse.getSelectedButton() !== ui.Button.OK) return;
  var typeChoice = typeResponse.getResponseText().trim();
  var columns = typeChoice === '2' ? TEST_COLUMNS : typeChoice === '3' ? MATCHING_COLUMNS : FIELD_COLUMNS;
  var typeLabel = typeChoice === '2' ? 'Test trắc nghiệm' : typeChoice === '3' ? 'Ghép từ' : 'Từ vựng';

  var sheet = ss.insertSheet(name);
  sheet.appendRow(columns);
  sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columns.length);
  bumpVersion();

  ui.alert('Đã tạo lĩnh vực "' + name + '" (' + typeLabel + '). Nhập dữ liệu vào sheet này — trang web sẽ tự nhận lĩnh vực mới, không cần sửa code hay deploy lại.');
}

// Mở hộp thoại cho phép dán nội dung CSV (id,word,reading,meaning,example,example_meaning)
// và import thẳng vào 1 lĩnh vực (tạo mới hoặc gộp vào lĩnh vực có sẵn).
function showImportCsvDialog() {
  var fields = getFields();
  var optionsHtml = fields.map(function (f) {
    var safe = String(f).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return '<option value="' + safe + '">' + safe + '</option>';
  }).join('');

  var html = HtmlService.createHtmlOutput(
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;padding:4px}' +
    'label{display:block;margin-top:10px;font-weight:bold}' +
    'select,input[type=text],textarea{width:100%;box-sizing:border-box;margin-top:4px;padding:6px;font-family:inherit;font-size:13px}' +
    'textarea{height:220px;font-family:monospace}' +
    'button{margin-top:12px;padding:8px 16px;cursor:pointer}' +
    '#msg{margin-top:10px;font-weight:bold}' +
    '</style>' +
    '<label>Lĩnh vực</label>' +
    '<select id="fieldSelect" onchange="toggleNewField()">' +
    '<option value="__new__">+ Tạo lĩnh vực mới...</option>' +
    optionsHtml +
    '</select>' +
    '<input type="text" id="newFieldName" placeholder="Tên lĩnh vực mới, vd: BJT - Bài 3">' +
    '<label>Dán nội dung CSV — Từ vựng: id,word,reading,meaning,example,example_meaning — Test: id,question,choice1,choice2,choice3,choice4,correct,explanation — Ghép từ: id,left1,left2,left3,left4,right1,right2,right3,right4,explanation (tự nhận diện qua dòng tiêu đề)</label>' +
    '<textarea id="csvContent" placeholder="id,word,reading,meaning,example,example_meaning"></textarea>' +
    '<button onclick="doImport()">Import</button>' +
    '<div id="msg"></div>' +
    '<script>' +
    'function toggleNewField(){' +
    '  var sel = document.getElementById("fieldSelect").value;' +
    '  document.getElementById("newFieldName").style.display = sel === "__new__" ? "block" : "none";' +
    '}' +
    'function doImport(){' +
    '  var sel = document.getElementById("fieldSelect").value;' +
    '  var newName = document.getElementById("newFieldName").value.trim();' +
    '  var field = sel === "__new__" ? newName : sel;' +
    '  var csv = document.getElementById("csvContent").value;' +
    '  var msg = document.getElementById("msg");' +
    '  if(!field){ msg.textContent = "Vui lòng nhập tên lĩnh vực."; return; }' +
    '  if(!csv.trim()){ msg.textContent = "Vui lòng dán nội dung CSV."; return; }' +
    '  msg.textContent = "Đang import...";' +
    '  google.script.run.withSuccessHandler(function(res){ msg.textContent = res; })' +
    '    .withFailureHandler(function(err){ msg.textContent = "Lỗi: " + err.message; })' +
    '    .importCsvToField(field, csv);' +
    '}' +
    '</script>'
  ).setWidth(480).setHeight(480);

  SpreadsheetApp.getUi().showModalDialog(html, 'Import CSV vào lĩnh vực');
}

function importCsvToField(fieldName, csvText) {
  fieldName = String(fieldName).trim();
  if (!fieldName) throw new Error('Tên lĩnh vực không được để trống.');
  if (fieldName === HISTORY_SHEET) throw new Error('Không thể import vào sheet History.');

  var rows = Utilities.parseCsv(csvText);
  if (!rows || rows.length === 0) throw new Error('Không đọc được nội dung CSV.');

  var headerRow = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var isMatchingCsv = headerRow.indexOf('left1') !== -1;
  var isTestCsv = !isMatchingCsv && headerRow.indexOf('question') !== -1;
  var firstCell = headerRow[0];
  var dataRows = (firstCell === 'id' || firstCell === 'word' || firstCell === 'question' || firstCell === 'left1') ? rows.slice(1) : rows;
  if (dataRows.length === 0) throw new Error('Không có dòng dữ liệu nào để import.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(fieldName);
  var isNewSheet = !sheet;
  var columns = isMatchingCsv ? MATCHING_COLUMNS : isTestCsv ? TEST_COLUMNS : FIELD_COLUMNS;

  if (isNewSheet) {
    sheet = ss.insertSheet(fieldName);
    sheet.appendRow(columns);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var numCols = columns.length;
  var normalizedRows = dataRows.map(function (row) {
    var r = row.slice(0, numCols);
    while (r.length < numCols) r.push('');
    return r;
  });

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, normalizedRows.length, numCols).setValues(normalizedRows);
  sheet.autoResizeColumns(1, numCols);
  bumpVersion();

  var importedTypeLabel = isMatchingCsv ? 'Ghép từ' : isTestCsv ? 'Test trắc nghiệm' : 'Từ vựng';
  return 'Đã import ' + normalizedRows.length + ' dòng vào lĩnh vực "' + fieldName + '"' + (isNewSheet ? ' (mới tạo, loại ' + importedTypeLabel + ')' : '') + '.';
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'fields') return jsonResponse(getFields());
  if (action === 'fieldCounts') return jsonResponse(getFieldCounts());
  if (action === 'leaderboard') return jsonResponse(getLeaderboard(e.parameter.field));
  if (action === 'names') return jsonResponse(getAllNames());
  if (action === 'history') return jsonResponse(getHistoryForName(e.parameter.name));
  if (action === 'markedWords') return jsonResponse(getMarkedWordsForName(e.parameter.name));
  if (action === 'version') return jsonResponse({ version: getVersion() });
  return jsonResponse(getWords(e.parameter.field));
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.type === 'toggleMark') {
    return jsonResponse(toggleMark(data.name, data.field, data.wordId));
  }
  if (data.type === 'recordAnswer') {
    return jsonResponse(recordAnswerForPriority(data.name, data.field, data.wordId, !!data.correct));
  }

  var entries = data.entries || [];
  var duration = Number(data.durationSeconds) || 0;
  var timestamp = new Date(); // dung 1 moc thoi gian cho ca luot choi, du co nhieu linh vuc
  entries.forEach(function (entry) {
    appendHistory(timestamp, data.name, data.direction, entry.field, entry.total, entry.correct, duration);
  });
  return jsonResponse(getLeaderboard());
}

// Tìm sheet History dù tên tab lỡ có khoảng trắng thừa (vd "History " thay vì "History")
function getHistorySheet() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim() === HISTORY_SHEET) return sheets[i];
  }
  return null;
}

// Danh sách lĩnh vực = danh sách tên sheet, trừ sheet History (cung khoan dung khoang trang thua)
function getFields() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (name) { return RESERVED_SHEETS.indexOf(name.trim()) === -1; });
}

// Nhan dien loai sheet qua dong tieu de: co cot "question" -> Test trac nghiem, con lai -> Tu vung
function getSheetType(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) return 'vocab';
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  if (headers.indexOf('left1') !== -1) return 'matching';
  if (headers.indexOf('question') !== -1) return 'test';
  return 'vocab';
}

// So luong tu/cau hoi theo tung linh vuc (chi doc dong tieu de + so dong, khong doc toan bo noi dung)
// de man hinh thiet lap tai nhanh. Kem theo "type" de web loc dung che do (Tu vung / Test).
// Cache lai phia server (an toan, khong lo qua han vi da co bumpVersion() xoa cache ngay khi du lieu doi -
// xem onEdit/addNewField/importCsvToField). Frontend con tu cache theo "dataVersion" (xem getVersion/onEdit
// ben duoi) de nhung lan vao sau, neu du lieu chua doi, khong can tai lai fieldCounts qua mang nua.
function getFieldCounts() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('fieldCounts');
  if (cached) return JSON.parse(cached);

  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var result = sheets
    .filter(function (s) { return RESERVED_SHEETS.indexOf(s.getName().trim()) === -1; })
    .map(function (sheet) {
      return {
        field: sheet.getName(),
        count: Math.max(sheet.getLastRow() - 1, 0),
        type: getSheetType(sheet)
      };
    });

  cache.put('fieldCounts', JSON.stringify(result), 21600); // 6 tieng, muc toi da cua CacheService - chi la luoi an toan
  return result;
}

// So phien ban du lieu, tang moi khi co linh vuc moi/CSV import/sua tay truc tiep tren Sheet.
// Frontend so sanh so nay voi ban da luu trong localStorage: khop thi dung lai cache trinh duyet
// (khong can goi lai fieldCounts), khong khop thi moi tai lai - thay cho viec phai cho cache het han
// hoac bam nut "Tai lai" thu cong.
function bumpVersion() {
  var props = PropertiesService.getScriptProperties();
  var current = Number(props.getProperty(DATA_VERSION_KEY)) || 0;
  props.setProperty(DATA_VERSION_KEY, String(current + 1));
  CacheService.getScriptCache().remove('fieldCounts');
}

function getVersion() {
  var props = PropertiesService.getScriptProperties();
  return Number(props.getProperty(DATA_VERSION_KEY)) || 0;
}

// Simple trigger: Google Apps Script tu goi ham nay moi khi co nguoi sua truc tiep 1 o tren Sheet
// (ke ca sua tay, khong qua menu "Them linh vuc"/"Import CSV"). Nho vay truong hop them dong vao
// 1 sheet co san cung duoc nhan dien ngay, khong con canh "cham cap nhat" nhu truoc.
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheetName = e.range.getSheet().getName().trim();
    if (RESERVED_SHEETS.indexOf(sheetName) === -1) bumpVersion();
  } catch (err) {
    // Simple trigger khong duoc phep chan viec sua sheet cua nguoi dung, nuot loi neu co
  }
}

// Gộp từ vựng từ các sheet lĩnh vực được chọn (fieldFilter dạng "A,B"), hoặc tất cả nếu không truyền.
// Chỉ đọc đúng sheet cần dùng để tải nhanh hơn khi chỉ chọn 1-2 lĩnh vực.
function getWords(fieldFilter) {
  var fields = fieldFilter
    ? fieldFilter.split(',').map(function (f) { return f.trim(); }).filter(Boolean)
    : getFields();
  var words = [];

  fields.forEach(function (fieldName) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(fieldName);
    if (!sheet) return;
    var values = sheet.getDataRange().getValues();
    if (values.length === 0) return;

    var headers = values.shift().map(function (h) { return String(h).trim().toLowerCase(); });

    values
      .filter(function (row) { return row.some(function (cell) { return String(cell).trim() !== ''; }); })
      .forEach(function (row) {
        var obj = { field: fieldName };
        headers.forEach(function (h, i) { obj[h] = row[i]; });
        words.push(obj);
      });
  });

  return words;
}

function appendHistory(timestamp, name, direction, field, total, correct, durationSeconds) {
  var sheet = getHistorySheet();
  total = Number(total) || 0;
  correct = Number(correct) || 0;
  durationSeconds = Number(durationSeconds) || 0;
  var accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

  sheet.appendRow([timestamp, name, field, direction, total, correct, accuracy, durationSeconds]);
}

// Tach ten Mon tu ten sheet: chi can co dau "-" la duoc coi la "Mon-Bai" (khop voi parseFieldName ben frontend)
function getSubjectFromField(field) {
  var idx = field.indexOf('-');
  if (idx === -1) return field;
  return field.slice(0, idx).trim();
}

// fieldFilter rỗng/undefined => tính tổng tất cả lĩnh vực. Có giá trị => tính theo MÔN (gộp mọi bài cùng môn).
function getLeaderboard(fieldFilter) {
  var sheet = getHistorySheet();
  var values = sheet.getDataRange().getValues();
  values.shift(); // bỏ header

  var totals = {};
  var playDatesByName = {}; // name -> { 'yyyy-MM-dd': true }, gom TOAN BO lich su (khong phu thuoc fieldFilter) de tinh streak

  values.forEach(function (row) {
    var name = row[1];
    var field = row[2];
    var timestamp = row[0];
    if (!name) return;

    if (!playDatesByName[name]) playDatesByName[name] = {};
    playDatesByName[name][toDateString(timestamp)] = true;

    if (fieldFilter && getSubjectFromField(field) !== fieldFilter) return;

    if (!totals[name]) totals[name] = { name: name, correct: 0, total: 0, lastActive: 0 };
    totals[name].correct += Number(row[5]) || 0;
    totals[name].total += Number(row[4]) || 0;

    var ts = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
    if (ts && ts > totals[name].lastActive) totals[name].lastActive = ts;
  });

  var list = Object.keys(totals).map(function (name) {
    var t = totals[name];
    return {
      name: t.name,
      score: t.correct,
      lastActive: t.lastActive ? new Date(t.lastActive).toISOString() : null,
      streak: computeStreakFromDates(Object.keys(playDatesByName[name] || {})),
      accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 1000) / 10 : 0
    };
  });

  list.sort(function (a, b) { return b.score - a.score; });
  return list; // tra ve toan bo, frontend tu gioi han hien Top 5 + nut "Xem them"
}

// Lịch sử tất cả các lượt chơi của 1 tên, moi nhat truoc.
// 1 luot choi co the ghi nhieu dong (moi linh vuc 1 dong) neu chon nhieu linh vuc cung luc,
// nen can gop lai theo cung 1 moc thoi gian de hien thi dung 1 dong / luot choi thuc te.
function getHistoryForName(name) {
  var sheet = getHistorySheet();
  var values = sheet.getDataRange().getValues();
  values.shift(); // bỏ header

  var sessions = {};
  values
    .filter(function (row) { return row[1] === name; })
    .forEach(function (row) {
      var ts = row[0];
      var key = ts instanceof Date ? ts.toISOString() : String(ts);
      if (!sessions[key]) {
        sessions[key] = {
          timestamp: key,
          fields: [],
          direction: row[3],
          total: 0,
          correct: 0,
          durationSeconds: Number(row[7]) || 0
        };
      }
      sessions[key].fields.push(row[2]);
      sessions[key].total += Number(row[4]) || 0;
      sessions[key].correct += Number(row[5]) || 0;
    });

  var list = Object.keys(sessions).map(function (key) {
    var s = sessions[key];
    return {
      timestamp: s.timestamp,
      field: s.fields.join(', '),
      direction: s.direction,
      total: s.total,
      correct: s.correct,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0,
      durationSeconds: s.durationSeconds
    };
  });

  list.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  return list;
}

// Danh sách tên duy nhất đã từng chơi (dùng để gợi ý trong ô nhập tên)
function getAllNames() {
  var sheet = getHistorySheet();
  var values = sheet.getDataRange().getValues();
  values.shift(); // bỏ header

  var seen = {};
  values.forEach(function (row) {
    var name = row[1];
    if (name) seen[name] = true;
  });

  return Object.keys(seen);
}

// Sheet luu danh sach tu uu tien "on lai" theo tung ten, tu tao neu chua co.
// Cot: name | field | word_id | updated_at | correct_streak
// Mot tu vao danh sach nay do: (a) nguoi dung tu bam nut danh dau, hoac (b) tra loi sai tu dong them vao.
// Tra loi dung lien tiep PRIORITY_GRADUATE_STREAK lan trong khi dang o danh sach uu tien -> tu dong go ra.
// Tra loi sai bat ky luc nao -> reset correct_streak ve 0 (van nam trong danh sach).
function getMarkedSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MARKED_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MARKED_SHEET);
    sheet.appendRow(['name', 'field', 'word_id', 'updated_at', 'correct_streak']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findMarkedRow(values, name, field, wordId) {
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === name && values[i][1] === field && String(values[i][2]) === String(wordId)) {
      return i;
    }
  }
  return -1;
}

// Bat/tat danh dau tay 1 tu cho 1 ten. Da co trong danh sach -> go ra; chua co -> them vao (streak = 0).
function toggleMark(name, field, wordId) {
  var sheet = getMarkedSheet();
  var values = sheet.getDataRange().getValues();
  var rowIndex = findMarkedRow(values, name, field, wordId);

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex + 1);
    return { marked: false };
  }

  sheet.appendRow([name, field, wordId, new Date(), 0]);
  return { marked: true };
}

// Ghi nhan ket qua tra loi 1 tu de cap nhat danh sach uu tien.
// Sai -> dam bao tu co mat trong danh sach, reset streak ve 0.
// Dung -> neu tu dang trong danh sach thi tang streak; dat PRIORITY_GRADUATE_STREAK thi go ra (da thanh thao).
function recordAnswerForPriority(name, field, wordId, isCorrect) {
  var sheet = getMarkedSheet();
  var values = sheet.getDataRange().getValues();
  var rowIndex = findMarkedRow(values, name, field, wordId);

  if (!isCorrect) {
    if (rowIndex === -1) {
      sheet.appendRow([name, field, wordId, new Date(), 0]);
    } else {
      sheet.getRange(rowIndex + 1, 4, 1, 2).setValues([[new Date(), 0]]);
    }
    return { inPriority: true };
  }

  if (rowIndex === -1) {
    return { inPriority: false }; // tu binh thuong, khong o trong danh sach uu tien
  }

  var newStreak = (Number(values[rowIndex][4]) || 0) + 1;
  if (newStreak >= PRIORITY_GRADUATE_STREAK) {
    sheet.deleteRow(rowIndex + 1);
    return { inPriority: false };
  }

  sheet.getRange(rowIndex + 1, 4, 1, 2).setValues([[new Date(), newStreak]]);
  return { inPriority: true };
}

// Danh sach {field, wordId} da duoc 1 ten danh dau "on lai", dung de tang xac suat xuat hien
function getMarkedWordsForName(name) {
  var sheet = getMarkedSheet();
  var values = sheet.getDataRange().getValues();
  values.shift(); // bo header

  return values
    .filter(function (row) { return row[0] === name; })
    .map(function (row) { return { field: row[1], wordId: String(row[2]) }; });
}

// Chuoi ngay lam bai lien tiep duoc tinh THANG TU du lieu "History" co san (khong luu sheet rieng),
// nen tu dong dung ca voi lich su cu, khong can migrate/backfill gi khi vua bat dau dung tinh nang nay.
// STREAK_GRACE_DAYS: cach ngay hien tai <= so nay van tinh la con chuoi; qua so ngay do moi coi la dut.
function todayDateString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function toDateString(value) {
  return value instanceof Date
    ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// So ngay chenh lech giua 2 chuoi yyyy-MM-dd (b - a), chi tinh theo lich, khong phu thuoc gio phut
function daysBetween(dateStrA, dateStrB) {
  var a = new Date(dateStrA + 'T00:00:00');
  var b = new Date(dateStrB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// dateStrings: danh sach cac ngay (yyyy-MM-dd, khong trung) ma 1 nguoi da nop it nhat 1 luot choi.
// Duyet nguoc tu ngay gan nhat ve qua khu, dem lien tuc khi khoang cach voi ngay ke truoc <= STREAK_GRACE_DAYS,
// dung lai khi gap lon hon. Neu ngay choi gan nhat da cach hien tai qua STREAK_GRACE_DAYS thi coi nhu dut (tra ve 0).
function computeStreakFromDates(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) return 0;
  var sorted = dateStrings.slice().sort();
  var today = todayDateString();

  if (daysBetween(sorted[sorted.length - 1], today) > STREAK_GRACE_DAYS) return 0;

  var streak = 1;
  for (var i = sorted.length - 1; i > 0; i--) {
    var gap = daysBetween(sorted[i - 1], sorted[i]);
    if (gap <= STREAK_GRACE_DAYS) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
