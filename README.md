# Ôn từ vựng tiếng Nhật

Web tĩnh (HTML/CSS/JS), miễn phí, dữ liệu lưu trên Google Sheet, deploy qua GitHub Pages.

## 1. Tạo Google Sheet

Mỗi **lĩnh vực** (BJT, IT Passport, SG, FE, ...) là **1 sheet (tab) riêng** — tên tab chính là tên lĩnh vực hiển thị trên web.

**Nếu 1 môn có nhiều bài** (vd BJT chia làm nhiều bài học), chỉ cần đặt tên tab có dấu `-` (vd: `BJT - Bài 1`, `BJT-P1 S3`). Web tự nhận diện phần trước dấu `-` đầu tiên là **môn**, phần sau là tên **bài**, rồi nhóm lại — trong "Chọn lĩnh vực" mỗi môn hiện 1 dòng gộp (kèm tổng số từ), bấm vào dòng đó (hoặc mũi tên ▸) mới xổ ra danh sách bài bên trong, đỡ bị dài khi có nhiều bài. Bảng xếp hạng cũng lọc theo Môn (gộp điểm mọi bài cùng môn) thay vì từng bài lẻ. Tab đặt tên không có dấu `-` (vd `SG`, `FE`) vẫn hoạt động bình thường, chỉ là tự nó là 1 môn có đúng 1 bài trùng tên.

> Lưu ý: nếu muốn điểm bảng xếp hạng của lĩnh vực Test tách riêng, không gộp chung với lĩnh vực Từ vựng cùng tên môn, hãy đặt tiền tố khác nhau (vd môn từ vựng đặt `BJT - ...`, môn test đặt `Test BJT - ...`) — vì việc gộp Môn hiện chỉ dựa theo tên, không phân biệt loại lĩnh vực.

Có **2 loại lĩnh vực**, tự nhận diện qua dòng tiêu đề (không cần đặt tên sheet theo quy ước riêng để phân biệt):

- **Từ vựng** (chế độ "📚 Ôn từ vựng"): cột `id | word | reading | meaning | example | example_meaning`
- **Test trắc nghiệm cố định** (chế độ "📝 Làm bài test", vd câu hỏi phân biệt từ gần nghĩa dạng BJT): cột `id | question | choice1 | choice2 | choice3 | choice4 | correct | explanation` — trong đó `question` dùng `___` làm chỗ trống, `choice1-4` là 4 đáp án cố định giữ nguyên thứ tự, `correct` là số 1-4, `explanation` là giải thích hiện ra sau khi chọn đáp án.

1. Tạo 1 Google Sheet mới.
2. Với mỗi lĩnh vực, tạo 1 tab mới, đặt tên tab tuỳ ý (ví dụ: `BJT`, `IT Passport`, `SG`, `FE`, `Test - BJT Bài 15`). Mỗi tab nhập đúng cột theo loại tương ứng ở trên.
   (Có thể import file mẫu [`data/words-template.csv`](data/words-template.csv) cho lĩnh vực từ vựng vào từng tab qua File > Import > Insert new sheet(s)/Replace current sheet, rồi xoá dòng ví dụ và điền từ thật. Cột `id` chỉ cần đánh số thứ tự trong phạm vi tab đó, dùng để bạn tự quản lý/tra cứu, không bắt buộc phải duy nhất toàn bộ hệ thống.)
3. Muốn mở rộng thêm lĩnh vực mới sau này: sau khi đã deploy Apps Script ở Bước 2, mở lại Google Sheet sẽ thấy menu **"Từ vựng" > "➕ Thêm lĩnh vực mới"** — gõ tên lĩnh vực, chọn loại (Từ vựng hoặc Test trắc nghiệm), hệ thống tự tạo tab mới với đúng cột tương ứng (không cần tạo tay hay sửa code). Trang web sẽ tự nhận lĩnh vực mới ngay lần tải sau.
4. Nếu đã có sẵn danh sách từ hoặc bộ câu hỏi test dạng CSV (vd nhờ AI tạo ra), dùng menu **"Từ vựng" > "📥 Import CSV vào lĩnh vực"**: dán nội dung CSV vào ô textarea, chọn lĩnh vực (tạo mới hoặc gộp thêm vào lĩnh vực có sẵn), bấm Import — loại lĩnh vực (từ vựng/test) khi tạo mới sẽ tự nhận diện qua dòng tiêu đề của CSV, khỏi cần chọn tay.
5. Tạo thêm 1 tab tên `History` (không được trùng tên với bất kỳ lĩnh vực nào), dòng đầu tiên nhập tiêu đề cột (chỉ để dễ đọc, script tự bỏ qua dòng này):
   `timestamp | name | field | direction | total | correct | accuracy | duration_seconds`

## 2. Deploy Google Apps Script (backend đọc/ghi dữ liệu)

1. Trong Google Sheet vừa tạo: `Extensions > Apps Script`.
2. Xoá code mẫu, dán toàn bộ nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) vào.
3. Bấm `Deploy > New deployment`.
   - Chọn loại: `Web app`.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
4. Bấm Deploy, cấp quyền khi được hỏi (chọn tài khoản Google của bạn, bấm Advanced > Go to... > Allow).
5. Copy URL Web App (dạng `https://script.google.com/macros/s/xxxxx/exec`).

## 3. Gắn URL vào web

Mở file [`config.js`](config.js), thay giá trị `APPS_SCRIPT_URL` bằng URL vừa copy ở bước trên.

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/xxxxx/exec"
};
```

> Lưu ý: GitHub Pages cache file tĩnh khoảng 10 phút, trình duyệt cũng cache thêm. Mỗi lần sửa `config.js` (hoặc `app.js`), hãy tăng số `?v=` ở 2 dòng `<script src="config.js?v=...">` và `<script src="app.js?v=...">` trong [`index.html`](index.html) để đảm bảo người dùng luôn lấy bản mới nhất thay vì bị cache bản cũ.

## 4. Deploy web lên GitHub Pages

Repo này đã sẵn sàng cho GitHub Pages:

1. Push code lên GitHub (repo đã được tạo sẵn — xem hướng dẫn push ở cuối README nếu cần).
2. Vào repo trên GitHub > `Settings > Pages`.
3. Ở mục `Source`, chọn nhánh `main`, thư mục `/ (root)`, bấm Save.
4. Sau 1-2 phút, trang sẽ có ở địa chỉ `https://<username>.github.io/<ten-repo>/`.

## 5. Cách dùng

- Trang chủ có 2 chế độ: **📚 Ôn từ vựng** (mặc định) và **📝 Làm bài test**. Chọn chế độ nào thì danh sách "Chọn lĩnh vực" chỉ hiện đúng loại lĩnh vực tương ứng.
- **Chế độ Ôn từ vựng**: mỗi câu hỏi mặc định ẩn 4 đáp án — bấm "Hiện đáp án" mới hiện ra để chọn. Ngay sau khi chọn 1 đáp án, hệ thống báo đúng/sai và tự động hiện kèm câu ví dụ + nghĩa của ví dụ của từ đó để củng cố.
- **Chế độ Làm bài test**: 4 đáp án hiện luôn cùng câu hỏi (không có bước "Hiện đáp án"), giữ nguyên thứ tự như trong Sheet (không xáo trộn vị trí). Chọn xong hiện luôn phần giải thích (`explanation`) đã soạn sẵn.
- Mỗi lần sửa/thêm từ mới, hoặc thêm lĩnh vực mới: chỉ cần sửa trực tiếp trên Google Sheet (thêm tab mới cho lĩnh vực mới), không cần sửa code hay deploy lại.
- Mỗi lượt chơi tự ghi vào tab `History` — nếu 1 lượt chơi gồm nhiều lĩnh vực (chọn nhiều lĩnh vực cùng lúc), mỗi lĩnh vực được ghi thành 1 dòng riêng để tính điểm theo từng lĩnh vực chính xác.
- Bảng xếp hạng Top 10 (góc phải trang chủ) cộng dồn điểm theo tên qua tất cả các lượt chơi. Mặc định xem theo **Tổng** (cộng dồn mọi lĩnh vực), có thể đổi dropdown để xem xếp hạng riêng theo từng lĩnh vực.
- Tên người chơi chỉ chấp nhận chữ cái A-Z, a-z và số.
- **Danh sách ưu tiên (ôn lại từ khó nhớ)**, lưu riêng theo từng tên vào tab `MarkedWords` (tự tạo, không cần thiết lập gì thêm):
  - Một từ vào danh sách ưu tiên theo 2 cách: **tự động** khi trả lời sai, hoặc **thủ công** bấm nút "☆ Đánh dấu ôn lại" ở mỗi câu.
  - Trả lời **đúng liên tiếp 2 lần** một từ đang trong danh sách ưu tiên → tự động gỡ khỏi danh sách (coi như đã thuộc). Trả lời **sai** bất kỳ lúc nào → về lại từ đầu (cần đúng thêm 2 lần liên tiếp nữa).
  - Ở các lượt chơi sau, từ trong danh sách ưu tiên được ưu tiên chọn ra nhiều hơn, nhưng **tối đa chỉ chiếm 30% số câu** trong 1 lượt chơi — tránh việc chúng chiếm hết cả bài, phần còn lại luôn là từ bình thường được chọn ngẫu nhiên.

## Cấu trúc thư mục

```
index.html            Giao diện chính (setup / quiz / kết quả)
style.css             Style
app.js                Toàn bộ logic quiz, chấm điểm, gọi API
config.js             Nơi khai báo URL Apps Script
apps-script/Code.gs   Code backend dán vào Google Apps Script
data/words-template.csv  File mẫu để biết đúng định dạng cột cho MỖI tab lĩnh vực
```
