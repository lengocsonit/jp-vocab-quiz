# Quy tắc tạo dữ liệu từ vựng/câu hỏi cho dự án này

Khi tạo dữ liệu (CSV) cho bất kỳ loại sheet nào trong dự án này (Từ vựng / Test trắc nghiệm / Ghép từ), luôn tuân thủ:

1. **Nghĩa phải chính xác tuyệt đối** — đúng nghĩa từ điển Nhật-Việt thật sự, không dịch máy/dịch thoáng/đoán theo mặt chữ hán. Nếu không chắc, đánh dấu ⚠️ ngay đầu nội dung liên quan (vd đầu ô `explanation`) để người dùng tự kiểm tra lại — tuyệt đối không tự bịa cho có.
2. **Nghĩa (cột `meaning`, `right1-4`, các đáp án...) phải NGẮN như 1 mục từ điển thật** (khoảng 2-6 từ tiếng Việt), không viết thành cả câu, không nhét thêm chú thích/ngữ cảnh/lý do trong ngoặc đơn vào đó. Phần phân biệt sắc thái, ngữ cảnh dùng, ví dụ minh hoạ thì đưa hết vào cột `explanation` — không nhét vào cột nghĩa. Chỉ khi nghĩa ngắn gọn KHÔNG đủ phân biệt với các từ còn lại (2 từ có cùng 1 nghĩa từ điển ngắn) mới thêm tối đa 1 từ/cụm ngắn làm rõ khác biệt (vd "đóng gói" / "đóng gói (quà)"), không viết dài hơn.
3. **Luôn kèm cách đọc (hiragana/furigana) ở đúng cột riêng dành cho việc đó** — `reading` với sheet Từ vựng, `left1_reading`...`left4_reading` với sheet Ghép từ. Không nhét cách đọc chung vào cùng ô với từ (dạng `包装する(ほうそうする)`), vì như vậy tính năng "bật/tắt cách đọc" trên web sẽ không tắt được.
4. Với sheet Test/Ghép từ có nhiều đáp án/từ gần nghĩa: nên thêm 1 câu ví dụ tiếng Nhật tự nhiên nối các từ/đáp án đó lại thành 1 câu chuyện dễ nhớ vào cột `explanation`, kèm cách đọc ngay trong câu đó (vd `工場(こうじょう)で...`).

Xem [README.md](README.md) để biết đầy đủ cột của từng loại sheet.

## Chuyển ảnh thành CSV cho sheet "Ghép từ"

Khi người dùng gửi ảnh (câu hỏi nghe/đọc, tài liệu ôn tập...) và yêu cầu tạo dữ liệu Ghép từ, luôn xuất ra đúng 1 khối CSV theo prompt sau — coi đây là quy trình chuẩn kể cả khi người dùng không dán lại nguyên văn prompt, chỉ cần họ gửi ảnh + nói muốn tạo dữ liệu Ghép từ:

```
Bạn là trợ lý tạo dữ liệu học tiếng Nhật dạng "Ghép từ" (matching) cho 1 ứng dụng ôn tập, từ ảnh chụp câu hỏi/tài liệu tôi gửi.

NHIỆM VỤ: Nhìn ảnh, tìm ra nhóm từ vựng/đáp án gần nghĩa cần phân biệt (thường có 4 phương án, hoặc 4 từ khoá chính), rồi xuất ra đúng 1 khối CSV theo cột sau (không thêm giải thích gì khác ngoài khối CSV):

id,left1,left1_reading,left2,left2_reading,left3,left3_reading,left4,left4_reading,right1,right2,right3,right4,explanation

QUY TẮC BẮT BUỘC:
1. left1-4: 4 từ/cụm từ tiếng Nhật cần phân biệt, lấy đúng nguyên văn từ ảnh (không tự đặt thêm từ nếu ảnh không có).
2. leftN_reading: cách đọc hiragana của leftN. Nếu từ đó là từ mượn katakana không có cách đọc hiragana riêng (vd ラッピング), để trống ô này.
3. rightN PHẢI là nghĩa ĐÚNG của leftN theo từ điển Nhật-Việt thật (khớp đúng theo chỉ số N, không tự xáo trộn — hệ thống sẽ tự xáo trộn khi hiển thị), không dịch máy/dịch thoáng.
4. Mỗi rightN phải NGẮN như 1 mục từ điển (khoảng 2-6 từ tiếng Việt) — KHÔNG viết thành câu, KHÔNG thêm chú thích/ngữ cảnh trong ngoặc đơn. Chỉ khi 2 từ trùng nghĩa từ điển ngắn mới thêm tối đa 1 từ/cụm ngắn làm rõ khác biệt (vd "đóng gói" / "đóng gói (quà)"). Toàn bộ phần phân biệt sắc thái chi tiết chuyển hết sang `explanation`, không nhét vào rightN.
5. explanation: viết 1 đoạn ngắn phân biệt sắc thái cả 4 từ (kèm cách đọc dạng 漢字(かな) cho từng từ được nhắc tới), rồi thêm 1 dòng bắt đầu bằng "📝 Câu ghi nhớ:" chứa 1 câu ví dụ tiếng Nhật tự nhiên nối cả 4 từ thành 1 câu chuyện dễ nhớ, có furigana đầy đủ dạng 漢字(かな).
6. Nếu không chắc chắn nghĩa/cách đọc của từ nào, hoặc ảnh không đủ rõ để xác định đáp án đúng, thêm ⚠️ ngay đầu ô explanation kèm ghi chú cần kiểm tra lại — TUYỆT ĐỐI không tự bịa cho có.
7. Nếu ảnh chứa NHIỀU bộ 4-từ khác nhau (nhiều câu hỏi), xuất mỗi bộ thành 1 dòng CSV riêng, id tăng dần 1, 2, 3...
8. Ô nào chứa dấu phẩy hoặc xuống dòng thì bọc trong dấu ngoặc kép theo đúng chuẩn CSV.

Chỉ trả lời bằng đúng khối CSV (có dòng tiêu đề ở trên), không thêm lời dẫn, không thêm giải thích ngoài lề.
```
