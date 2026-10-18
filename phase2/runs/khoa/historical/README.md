# Historical — chưa phải kết quả trên dataset chung

Giữ nguyên log đo 24 câu trước review và cấu hình tương ứng. K01–K15 dùng main 2c4110a, K16–K24 dùng PR finance 530d5da với dữ liệu giảng viên/rèn luyện khác main. Kết quả 24/24 chỉ thuộc lần đo hai snapshot này, không dùng làm kết quả benchmark chung.

Bộ hiện tại nằm ở phase2/test-cases.csv (15 câu, main). Chín ca finance nằm ở ../finance-pending.csv, provisional, chờ rebase/merge PR #2 và tính lại trên dataset chung. Các đường dẫn cwd trong configs/ là bản lưu lịch sử máy đã đo; runner hiện tại không dùng chúng.

Các tệp JSONL và comparison.csv ở đây không bị sửa nội dung. Không chép test-cases-24.csv vào benchmark chung.
