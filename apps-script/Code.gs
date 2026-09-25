// Dán toàn bộ file này vào Apps Script (Extensions > Apps Script) của Google Sheet
// Mỗi lĩnh vực (BJT, IT Passport, SG, FE, ...) là 1 sheet riêng, tên sheet = tên lĩnh vực.
// Có 2 loại sheet, tự nhận diện qua dòng tiêu đề (không cần đặt tên theo quy ước riêng):
//   - Sheet Từ vựng: cột word | reading | meaning | example | example_meaning
//   - Sheet Test trắc nghiệm: cột question | choice1 | choice2 | choice3 | choice4 | correct | explanation
// Ngoài ra cần 1 sheet tên "History" để lưu lịch sử làm bài (xem README).

var HISTORY_SHEET = 'History';
var MARKED_SHEET = 'MarkedWords';
var RESERVED_SHEETS = ['History', 'MarkedWords'];
var FIELD_COLUMNS = ['id', 'word', 'reading', 'meaning', 'example', 'example_meaning'];
var TEST_COLUMNS = ['id', 'question', 'choice1', 'choice2', 'choice3', 'choice4', 'correct', 'explanation'];
var PRIORITY_GRADUATE_STREAK = 2; // dung lien tiep bao nhieu lan thi tu dong go khoi danh sach uu tien

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
    'Gõ "1" cho Từ vựng, "2" cho Test trắc nghiệm (để trống = Từ vựng):',
    ui.ButtonSet.OK_CANCEL
  );
  if (typeResponse.getSelectedButton() !== ui.Button.OK) return;
  var isTest = typeResponse.getResponseText().trim() === '2';
  var columns = isTest ? TEST_COLUMNS : FIELD_COLUMNS;

  var sheet = ss.insertSheet(name);
  sheet.appendRow(columns);
  sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, columns.length);
  invalidateFieldCountsCache();

  ui.alert('Đã tạo lĩnh vực "' + name + '" (' + (isTest ? 'Test trắc nghiệm' : 'Từ vựng') + '). Nhập dữ liệu vào sheet này — trang web sẽ tự nhận lĩnh vực mới, không cần sửa code hay deploy lại.');
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
    '<label>Dán nội dung CSV — Từ vựng: id,word,reading,meaning,example,example_meaning — hoặc Test: id,question,choice1,choice2,choice3,choice4,correct,explanation (tự nhận diện qua dòng tiêu đề)</label>' +
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
  var isTestCsv = headerRow.indexOf('question') !== -1;
  var firstCell = headerRow[0];
  var dataRows = (firstCell === 'id' || firstCell === 'word' || firstCell === 'question') ? rows.slice(1) : rows;
  if (dataRows.length === 0) throw new Error('Không có dòng dữ liệu nào để import.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(fieldName);
  var isNewSheet = !sheet;
  var columns = isTestCsv ? TEST_COLUMNS : FIELD_COLUMNS;

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
  invalidateFieldCountsCache();

  return 'Đã import ' + normalizedRows.length + ' dòng vào lĩnh vực "' + fieldName + '"' + (isNewSheet ? ' (mới tạo, loại ' + (isTestCsv ? 'Test trắc nghiệm' : 'Từ vựng') + ')' : '') + '.';
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'fields') return jsonResponse(getFields());
  if (action === 'fieldCounts') return jsonResponse(getFieldCounts());
  if (action === 'leaderboard') return jsonResponse(getLeaderboard(e.parameter.field));
  if (action === 'names') return jsonResponse(getAllNames());
  if (action === 'history') return jsonResponse(getHistoryForName(e.parameter.name));
  if (action === 'markedWords') return jsonResponse(getMarkedWordsForName(e.parameter.name));
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
  return headers.indexOf('question') !== -1 ? 'test' : 'vocab';
}

// So luong tu/cau hoi theo tung linh vuc (chi doc dong tieu de + so dong, khong doc toan bo noi dung)
// de man hinh thiet lap tai nhanh. Kem theo "type" de web loc dung che do (Tu vung / Test).
// Cache lai 6 tieng (muc toi da CacheService cho phep) vi day la phan cham nhat khi co nhieu sheet
// (moi sheet ton 1 luot goi API rieng de doc dong tieu de). Cache duoc xoa ngay khi co linh vuc moi
// (xem invalidateFieldCountsCache), nen de thoi gian cache dai khong lo sai lech, chi thinh thoang
// so luong tu/cau cua 1 linh vuc co san co the cham cap nhat toi da 6 tieng neu chi them dong moi vao sheet.
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

  cache.put('fieldCounts', JSON.stringify(result), 21600); // 6 tieng, muc toi da cua CacheService
  return result;
}

// Xoa cache fieldCounts moi khi co linh vuc moi/du lieu moi, de web thay ngay khong can doi cache het han
function invalidateFieldCountsCache() {
  CacheService.getScriptCache().remove('fieldCounts');
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
  values.forEach(function (row) {
    var name = row[1];
    var field = row[2];
    if (!name) return;
    if (fieldFilter && getSubjectFromField(field) !== fieldFilter) return;

    if (!totals[name]) totals[name] = { name: name, correct: 0, total: 0 };
    totals[name].correct += Number(row[5]) || 0;
    totals[name].total += Number(row[4]) || 0;
  });

  var list = Object.keys(totals).map(function (name) {
    var t = totals[name];
    return {
      name: t.name,
      score: t.correct,
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

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
