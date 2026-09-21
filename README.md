# Ôn từ vựng tiếng Nhật

Web tĩnh (HTML/CSS/JS), miễn phí, dữ liệu lưu trên Google Sheet, deploy qua GitHub Pages.

## 1. Tạo Google Sheet

Mỗi **lĩnh vực** (BJT, IT Passport, SG, FE, ...) là **1 sheet (tab) riêng** — tên tab chính là tên lĩnh vực hiển thị trên web.

**Nếu 1 môn có nhiều bài** (vd BJT chia làm nhiều bài học), đặt tên tab theo quy ước `Môn - Bài` (vd: `BJT - Bài 1`, `BJT - Bài 2`, `IT Passport - Bài 1`). Web sẽ tự nhận diện phần trước dấu `-` là **môn**, và nhóm các bài lại — màn hình thiết lập sẽ có 1 dropdown chọn môn trước, sau đó mới hiện danh sách bài của môn đó, đỡ bị dài khi có nhiều bài. Tab đặt tên không theo quy ước này (vd `SG`, `FE`) vẫn hoạt động bình thường, chỉ là tự nó là 1 môn có đúng 1 bài trùng tên.

1. Tạo 1 Google Sheet mới.
2. Với mỗi lĩnh vực, tạo 1 tab mới, đặt tên tab đúng bằng tên lĩnh vực (ví dụ: `BJT`, `IT Passport`, `SG`, `FE`). Mỗi tab nhập các cột theo đúng thứ tự:
   `id | word | reading | meaning | example | example_meaning`
   (Có thể import file mẫu [`data/words-template.csv`](data/words-template.csv) vào từng tab qua File > Import > Insert new sheet(s)/Replace current sheet, rồi xoá dòng ví dụ và điền từ thật. Cột `id` chỉ cần đánh số thứ tự trong phạm vi tab đó, dùng để bạn tự quản lý/tra cứu từ, không bắt buộc phải duy nhất toàn bộ hệ thống.)
3. Muốn mở rộng thêm lĩnh vực mới sau này: sau khi đã deploy Apps Script ở Bước 2, mở lại Google Sheet sẽ thấy menu **"Từ vựng" > "➕ Thêm lĩnh vực mới"** — chỉ cần gõ tên lĩnh vực (vd: `FE`), hệ thống tự tạo tab mới với đúng cột `id | word | reading | meaning | example | example_meaning` (không cần tạo tay hay sửa code). Trang web sẽ tự nhận lĩnh vực mới ngay lần tải sau.
4. Nếu đã có sẵn danh sách từ dạng CSV (vd nhờ AI tạo ra), dùng menu **"Từ vựng" > "📥 Import CSV vào lĩnh vực"**: dán nội dung CSV vào ô textarea, chọn lĩnh vực (tạo mới hoặc gộp thêm vào lĩnh vực có sẵn), bấm Import — khỏi cần copy dán tay từng dòng hay dùng File > Import.
4. Tạo thêm 1 tab tên `History` (không được trùng tên với bất kỳ lĩnh vực nào), dòng đầu tiên nhập tiêu đề cột (chỉ để dễ đọc, script tự bỏ qua dòng này):
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

- Mỗi câu hỏi mặc định ẩn 4 đáp án — bấm "Hiện đáp án" mới hiện ra để chọn. Ngay sau khi chọn 1 đáp án, hệ thống báo đúng/sai và tự động hiện kèm câu ví dụ + nghĩa của ví dụ của từ đó để củng cố.
- Mỗi lần sửa/thêm từ mới, hoặc thêm lĩnh vực mới: chỉ cần sửa trực tiếp trên Google Sheet (thêm tab mới cho lĩnh vực mới), không cần sửa code hay deploy lại.
- Mỗi lượt chơi tự ghi vào tab `History` — nếu 1 lượt chơi gồm nhiều lĩnh vực (chọn nhiều lĩnh vực cùng lúc), mỗi lĩnh vực được ghi thành 1 dòng riêng để tính điểm theo từng lĩnh vực chính xác.
- Bảng xếp hạng Top 10 (góc phải trang chủ) cộng dồn điểm theo tên qua tất cả các lượt chơi. Mặc định xem theo **Tổng** (cộng dồn mọi lĩnh vực), có thể đổi dropdown để xem xếp hạng riêng theo từng lĩnh vực.
- Tên người chơi chỉ chấp nhận chữ cái A-Z, a-z và số.

## Cấu trúc thư mục

```
index.html            Giao diện chính (setup / quiz / kết quả)
style.css             Style
app.js                Toàn bộ logic quiz, chấm điểm, gọi API
config.js             Nơi khai báo URL Apps Script
apps-script/Code.gs   Code backend dán vào Google Apps Script
data/words-template.csv  File mẫu để biết đúng định dạng cột cho MỖI tab lĩnh vực
```
