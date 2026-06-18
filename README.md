# L&F Inventory Management System 📦

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://inventorysystem-bpht.onrender.com)
![Node.js](https://img.shields.io/badge/Node.js-Backend-success)
![MySQL](https://img.shields.io/badge/MySQL-Database-blue)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple)

Hệ thống quản lý kho hàng toàn diện (Full-stack) được xây dựng dành cho các doanh nghiệp vừa và nhỏ. Dự án được triển khai thực tế trên nền tảng Cloud 24/7.

## 🚀 Tính Năng Nổi Bật (Key Features)
- **Kiểm soát truy cập (Role-based Access Control):** Phân quyền chi tiết cho `Admin`, `Manager`, và `Viewer`.
- **Quản lý sản phẩm & Tồn kho:** Thêm, sửa, xóa sản phẩm và theo dõi số lượng tồn kho theo thời gian thực.
- **Theo dõi giao dịch:** Ghi nhận lịch sử Nhập/Xuất kho chi tiết (Ai nhập, khi nào, số lượng bao nhiêu).
- **Dashboard Thống kê trực quan:** Sử dụng `Chart.js` để hiển thị biểu đồ phân tích giá trị tồn kho và tình trạng hàng hóa.
- **Tìm kiếm thông minh:** Tìm kiếm bỏ qua dấu tiếng Việt (Ví dụ: gõ "man hinh" vẫn ra "Màn hình").
- **Xuất báo cáo:** Hỗ trợ xuất dữ liệu tồn kho ra file PDF chuyên nghiệp.

## 🛠 Công Nghệ Sử Dụng (Tech Stack)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Chart.js.
- **Backend:** Node.js, Express.js.
- **Database:** MySQL (Cloud Hosted via Aiven).
- **Deployment:** Render.com (Serverless).

## 💡 Tài Khoản Trải Nghiệm (Demo Accounts)
Bạn có thể truy cập hệ thống và sử dụng các tài khoản sau để trải nghiệm các quyền hạn khác nhau:
- **Tài khoản Admin** (Toàn quyền): `admin` / Mật khẩu: `0899545788`
- **Tài khoản Quản lý** (Không thể xóa): `manager` / Mật khẩu: `manager123`
- **Tài khoản Khách** (Chỉ xem): Bạn có thể tự Đăng ký tài khoản mới trên giao diện.

## 💻 Cài Đặt Tại Local (Local Setup)
Nếu bạn muốn chạy dự án này trên máy tính cá nhân:
1. Clone repository này về máy.
2. Mở thư mục `backend`, chạy lệnh `npm install` để cài thư viện.
3. Điền thông tin Database MySQL vào file `.env` (Hoặc import file `database.sql` vào MySQL cục bộ).
4. Chạy lệnh `node server.js` để khởi động Server.
5. Truy cập `http://localhost:3000` trên trình duyệt.

---
*Dự án được phát triển nhằm mục đích tối ưu hóa quy trình quản lý kho bãi, giảm thiểu sai sót và tăng hiệu suất làm việc.*
