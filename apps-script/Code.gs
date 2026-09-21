// Dán toàn bộ file này vào Apps Script (Extensions > Apps Script) của Google Sheet
// Mỗi lĩnh vực (BJT, IT Passport, SG, FE, ...) là 1 sheet riêng, tên sheet = tên lĩnh vực.
// Mỗi sheet lĩnh vực cần cột: word | reading | meaning | example | example_meaning
// Ngoài ra cần 1 sheet tên "History" để lưu lịch sử làm bài (xem README).

var HISTORY_SHEET = 'History';
var RESERVED_SHEETS = ['History'];
var FIELD_COLUMNS = ['id', 'word', 'reading', 'meaning', 'example', 'example_meaning'];

// Thêm menu "Từ vựng" mỗi khi mở Google Sheet, để tạo lĩnh vực mới bằng 1 click
// thay vì phải tự tạo tab và gõ tay đúng tên cột.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Từ vựng')
    .addItem('➕ Thêm lĩnh vực mới', 'addNewField')
    .addToUi();
}

function addNewField() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('Thêm lĩnh vực mới', 'Nhập tên lĩnh vực (vd: BJT, IT Passport, SG, FE):', ui.ButtonSet.OK_CANCEL);
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

  var sheet = ss.insertSheet(name);
  sheet.appendRow(FIELD_COLUMNS);
  sheet.getRange(1, 1, 1, FIELD_COLUMNS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, FIELD_COLUMNS.length);

  ui.alert('Đã tạo lĩnh vực "' + name + '". Nhập từ vựng vào sheet này — trang web sẽ tự nhận lĩnh vực mới, không cần sửa code hay deploy lại.');
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'fields') return jsonResponse(getFields());
  if (action === 'leaderboard') return jsonResponse(getLeaderboard(e.parameter.field));
  if (action === 'names') return jsonResponse(getAllNames());
  if (action === 'history') return jsonResponse(getHistoryForName(e.parameter.name));
  return jsonResponse(getWords());
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var entries = data.entries || [];
  var duration = Number(data.durationSeconds) || 0;
  entries.forEach(function (entry) {
    appendHistory(data.name, data.direction, entry.field, entry.total, entry.correct, duration);
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

// Gộp từ vựng từ tất cả các sheet lĩnh vực, mỗi từ được gắn thêm field = tên sheet
function getWords() {
  var fields = getFields();
  var words = [];

  fields.forEach(function (fieldName) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(fieldName);
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

function appendHistory(name, direction, field, total, correct, durationSeconds) {
  var sheet = getHistorySheet();
  total = Number(total) || 0;
  correct = Number(correct) || 0;
  durationSeconds = Number(durationSeconds) || 0;
  var accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

  sheet.appendRow([new Date(), name, field, direction, total, correct, accuracy, durationSeconds]);
}

// fieldFilter rỗng/undefined => tính tổng tất cả lĩnh vực. Có giá trị => chỉ tính lĩnh vực đó.
function getLeaderboard(fieldFilter) {
  var sheet = getHistorySheet();
  var values = sheet.getDataRange().getValues();
  values.shift(); // bỏ header

  var totals = {};
  values.forEach(function (row) {
    var name = row[1];
    var field = row[2];
    if (!name) return;
    if (fieldFilter && field !== fieldFilter) return;

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

// Lịch sử tất cả các lượt chơi của 1 tên, moi nhat truoc
function getHistoryForName(name) {
  var sheet = getHistorySheet();
  var values = sheet.getDataRange().getValues();
  values.shift(); // bỏ header

  var sessions = values
    .filter(function (row) { return row[1] === name; })
    .map(function (row) {
      var ts = row[0];
      return {
        timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
        field: row[2],
        direction: row[3],
        total: Number(row[4]) || 0,
        correct: Number(row[5]) || 0,
        accuracy: Number(row[6]) || 0,
        durationSeconds: Number(row[7]) || 0
      };
    });

  sessions.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  return sessions;
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

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
