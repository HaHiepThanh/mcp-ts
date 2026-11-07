# Historical — chưa phải kết quả trên dataset chung

Giữ nguyên log đo 24 câu trước review và cấu hình tương ứng. K01–K15 dùng main 2c4110a, K16–K24 dùng PR finance 530d5da với dữ liệu giảng viên/rèn luyện khác main. Kết quả 24/24 chỉ thuộc lần đo hai snapshot này, không dùng làm kết quả benchmark chung.

Bộ hiện tại nằm ở phase2/test-cases.csv: 24 câu đã tính lại trên main 18f3818 sau khi PR #2 merge. Lượt 15 câu trước khi ghép finance và kỳ vọng provisional cũ nằm ở main-before-finance-integration/. Các đường dẫn cwd trong configs/ ở đây là bản lưu lịch sử máy đã đo; runner hiện tại không dùng chúng.

Các tệp JSONL và comparison.csv ở đây không bị sửa nội dung. Không chép test-cases-24.csv vào benchmark chung.
