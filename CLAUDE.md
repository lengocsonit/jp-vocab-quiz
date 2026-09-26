# Quy tắc tạo dữ liệu từ vựng/câu hỏi cho dự án này

Khi tạo dữ liệu (CSV) cho bất kỳ loại sheet nào trong dự án này (Từ vựng / Test trắc nghiệm / Ghép từ), luôn tuân thủ:

1. **Nghĩa phải chính xác tuyệt đối.** Không đoán mò hoặc suy diễn nghĩa/cách đọc tiếng Nhật nếu không chắc chắn. Nếu không chắc, đánh dấu ⚠️ ngay đầu nội dung liên quan (vd đầu ô `explanation`) để người dùng tự kiểm tra lại — tuyệt đối không tự bịa cho có.
2. **Ngắn gọn nhưng đủ phân biệt.** Đặc biệt với sheet Test trắc nghiệm hoặc Ghép từ (nhiều đáp án/từ gần nghĩa): mỗi mô tả phải nêu rõ sắc thái riêng của từ/đáp án đó, tránh viết chung chung khiến các đáp án nhìn giống nhau, gây hiểu nhầm.
3. **Luôn kèm cách đọc (hiragana/furigana) ở đúng cột riêng dành cho việc đó** — `reading` với sheet Từ vựng, `left1_reading`...`left4_reading` với sheet Ghép từ. Không nhét cách đọc chung vào cùng ô với từ (dạng `包装する(ほうそうする)`), vì như vậy tính năng "bật/tắt cách đọc" trên web sẽ không tắt được.
4. Với sheet Test/Ghép từ có nhiều đáp án/từ gần nghĩa: nên thêm 1 câu ví dụ tiếng Nhật tự nhiên nối các từ/đáp án đó lại thành 1 câu chuyện dễ nhớ vào cột `explanation`, kèm cách đọc ngay trong câu đó (vd `工場(こうじょう)で...`).

Xem [README.md](README.md) để biết đầy đủ cột của từng loại sheet.
