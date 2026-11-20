# Kế hoạch chuyển sang Next.js và lưu dữ liệu bằng server

| Mục | Nội dung |
|---|---|
| Ngày | 20/11/2026 |
| Trạng thái | Chờ làm |
| Thay cho | Bước F5 cũ (lưu bằng `localStorage`, xuất và nhập file) |

## 1. Mục tiêu

- App chuyển từ Vite sang Next.js, để giao diện và API nằm chung một dự án.
- Dữ liệu đánh dấu và ghim được lưu vào một file JSON trên server.
- Mọi tính năng của F2 đến F4 vẫn chạy y như cũ.

## 2. Các quyết định

| Chủ đề | Quyết định |
|---|---|
| Phiên bản | `next@16.4.6`, giữ React 19.3.1 và TypeScript 7.0.2. |
| Router | App Router, trong thư mục `src/app`. |
| Giao diện | Giữ nguyên các component React đang có trong `src/ui`, `src/map` và `src/domain`. |
| Bản đồ | Toàn bộ app chạy trên trình duyệt. File `src/app/ClientApp.tsx` nạp `App` bằng `dynamic(..., { ssr: false })`. Đây là cách repo `next-leaflet-starter` dùng. |
| Thư viện bản đồ | Vẫn dùng `leaflet` trực tiếp, không dùng `react-leaflet`. |
| API | Một file `src/app/api/data/route.ts` có `GET` và `PUT`. |
| Nơi lưu | File `data/user-data.json` ở gốc dự án. Thư mục `data/` đã nằm trong `.gitignore`. |
| Kiểm tra dữ liệu | Một schema `zod` trong `src/domain/schema.ts`. API từ chối dữ liệu sai để file không bị hỏng. |
| Test | Giữ `vitest`. Giữ `vite` vì `vitest` cần gói này. Bỏ `@vitejs/plugin-react`. |
| Chạy thật | `npm run build` rồi `npm start` trên máy của bạn. |

Những phần cố ý **không làm** để giữ app đơn giản:

- Số `revision` để chống ghi đè khi mở hai tab.
- File sao lưu, cách ghi file tạm rồi đổi tên, và hàng đợi ghi.
- Tự thử lại khi lưu lỗi.
- Chế độ `output: 'standalone'`.
- Nút Xuất và Nhập file JSON. Bạn có thể sao chép trực tiếp file `data/user-data.json`.

## 3. Bước N1: Chuyển sang Next.js

### 3.1. Gói cài đặt

| Việc | Gói |
|---|---|
| Thêm | `next@16.4.6` |
| Bỏ | `@vitejs/plugin-react` |
| Giữ | `vite` và `vitest` (chỉ dùng để chạy test) |

Mình cài bằng `npx npm@11`, vì npm 10.8.2 trên máy bị lỗi khi cài gói.

### 3.2. File thêm mới

| File | Nội dung |
|---|---|
| `next.config.ts` | Cấu hình tối thiểu, chỉ bật `reactStrictMode`. |
| `src/app/layout.tsx` | Thẻ `<html lang="vi">`, tiêu đề "Bản đồ hành trình", và import `src/styles/tokens.css`. |
| `src/app/page.tsx` | Server Component. File này chỉ hiện `<ClientApp />`. |
| `src/app/ClientApp.tsx` | Có dòng `'use client'`. File này nạp `App` bằng `dynamic(() => import('../App'), { ssr: false })`. |
| `vitest.config.ts` | Chỉ chứa phần cấu hình test, chuyển từ `vite.config.ts` sang. |

### 3.3. File bỏ đi

| File | Lý do |
|---|---|
| `index.html` | Next.js tự tạo trang HTML. |
| `src/main.tsx` | Vai trò gắn React vào trang chuyển sang `layout.tsx` và `page.tsx`. |
| `vite.config.ts` | Được thay bằng `next.config.ts` và `vitest.config.ts`. |
| `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.test.json` | Gộp lại thành một `tsconfig.json` theo cấu hình Next.js khuyên dùng. File này gồm cả `src` và `scripts`, và có kiểu `node`. |

### 3.4. File sửa

| File | Thay đổi |
|---|---|
| `src/map/mapData.ts` | Bỏ `import.meta.env.BASE_URL` của Vite. Đường dẫn dữ liệu bản đồ đổi thành `/data/...`. |
| `package.json` | Lệnh `dev` thành `next dev`, `build` thành `next build`, `start` thành `next start`. Lệnh `test` và `data` giữ nguyên. |
| `.gitignore` | Thêm `.next/` và `next-env.d.ts`. |
| `D:\Side\.claude\launch.json` | Đổi cổng xem trước từ 5173 sang 3000. |

### 3.5. Cách xác minh

| Kiểm tra | Điều kiện đạt |
|---|---|
| `npm run build` | Không lỗi, kể cả bước kiểm tra kiểu bằng TypeScript 7. |
| Test | Kết quả giống trước khi chuyển: 78 test qua, chỉ còn test độ phủ 98% của tỉnh cũ thất bại. |
| Trình duyệt | Mở được bản đồ thế giới. Zoom vào Việt Nam thấy 34 tỉnh. Đánh dấu được TP. Hồ Chí Minh. Tìm "Hội An" rồi thêm ghim được. Sửa và xóa ghim được. Console không có lỗi. |

## 4. Bước N2: Thêm API

### 4.1. File thêm mới

| File | Nội dung |
|---|---|
| `src/domain/schema.ts` | Schema `zod` cho `UserData`, đúng theo kiểu ở `src/domain/types.ts`. |
| `src/app/api/data/route.ts` | Hai hàm `GET` và `PUT`. |

### 4.2. Cách API hoạt động

- `GET /api/data` đọc file `data/user-data.json`. Nếu file chưa có, API trả về dữ liệu rỗng.
- `PUT /api/data` nhận dữ liệu JSON và kiểm tra bằng schema.
  - Nếu dữ liệu sai, API trả mã 400 và không đụng tới file.
  - Nếu dữ liệu đúng, API tạo thư mục `data/` nếu chưa có, ghi đè file, rồi trả mã 200.

### 4.3. Gói cài đặt

Thêm `zod@4.6.7` (giấy phép MIT).

### 4.4. Cách xác minh

Mình gọi thử API bằng `curl` khi dev server đang chạy.

| Thử | Kết quả mong đợi |
|---|---|
| `GET` khi chưa có file | Trả về dữ liệu rỗng. |
| `PUT` dữ liệu đúng | Trả mã 200. File `data/user-data.json` có đúng nội dung vừa gửi. |
| `GET` lại | Trả về đúng dữ liệu vừa ghi. |
| `PUT` dữ liệu sai | Trả mã 400. File không đổi. |

Bước này không thêm unit test.

## 5. Bước N3: Nối giao diện với API

### 5.1. File thêm mới và sửa

| File | Thay đổi |
|---|---|
| `src/services/userDataApi.ts` | Thêm mới. Có hai hàm `loadUserData()` và `saveUserData(data)`. |
| `src/domain/store.ts` | Thêm action `replaceAll` để nạp dữ liệu từ server vào app. |
| `src/App.tsx` | Tải dữ liệu từ server khi mở trang. Gửi dữ liệu lên server sau mỗi thay đổi. |

### 5.2. Quy tắc lưu

- Khi mở trang, app tải dữ liệu bản đồ và dữ liệu người dùng cùng lúc.
- Nếu không tải được dữ liệu người dùng, app hiện màn hình lỗi kèm nút "Thử lại". App **không** bắt đầu với dữ liệu rỗng. Lý do là nếu bắt đầu rỗng, lần lưu kế tiếp sẽ ghi đè mất file đang có trên server.
- Sau mỗi thay đổi, app chờ 500 ms để gom các thay đổi liên tiếp, rồi gửi một lần.
- Nếu gửi lỗi, app hiện dòng "Không lưu được dữ liệu lên server." Dòng này tự ẩn sau lần lưu thành công kế tiếp.

### 5.3. Cách xác minh trên trình duyệt

| Thao tác | Kết quả mong đợi |
|---|---|
| Đánh dấu TP. Hồ Chí Minh, thêm ghim Hội An, rồi tải lại trang | Đánh dấu và ghim vẫn còn. |
| Mở file `data/user-data.json` | File có tỉnh `79` và ghim Hội An. |
| Tắt server rồi đánh dấu thêm một tỉnh | Dòng "Không lưu được dữ liệu lên server." hiện ra. |
| Bật lại server rồi đánh dấu thêm một tỉnh | Dòng báo lỗi ẩn đi. Tải lại trang thì thấy đủ dữ liệu. |
| Mục "tải lại trang thì ghim vẫn còn" của bước F4 | Đạt. |

## 6. Bước N4: Cập nhật tài liệu

Mình cập nhật `docs/DESIGN.md` ở các mục sau:

- Mục 2 (quyết định đã chốt) và mục 3 (kiến trúc) ghi Next.js và server.
- Mục 4 (cấu trúc thư mục) ghi các file mới.
- Mục 6.3 và 6.4 thay `localStorage` và xuất nhập file bằng API và file JSON.
- Mục 12 (thư viện) thêm `next` và `zod`, bỏ `@vitejs/plugin-react`.

## 7. Cách làm việc

- Mình làm lần lượt từng bước N1, N2, N3, N4.
- Sau mỗi bước, mình gửi bạn kết quả xác minh.
- Khi bạn duyệt, mình commit và push lên nhánh `master` đang đứng.

## 8. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Next.js kiểm tra kiểu bằng lệnh `tsc` của TypeScript 7. Cách này vẫn đang ở mức thử nghiệm. | Nếu `npm run build` lỗi vì TypeScript 7, mình báo bạn và đề xuất dùng TypeScript 6.0.3. Mình không tự hạ phiên bản. |
| Khi build, `tsc` kiểm tra mọi file trong `tsconfig.json`, kể cả test và script dữ liệu. | Mình chạy `npm run build` ngay ở bước N1 để thấy lỗi sớm. |
| Next.js dùng React Strict Mode, nên effect chạy hai lần khi lập trình. | Hook bản đồ đã xử lý việc tạo và hủy bản đồ đúng cách từ trước. |
| Mở app ở hai tab rồi sửa cả hai thì tab lưu sau ghi đè tab lưu trước. | Đây là giới hạn đã biết, vì kế hoạch bỏ số `revision`. |

## 9. Những việc còn tồn đọng, không thuộc kế hoạch này

- `vitest` 5.1.1 cần Node 22.12 trở lên, trong khi máy đang dùng Node 20.20. Test vẫn phải chạy bằng `npx node@22`.
- Test độ phủ 98% của viền tỉnh cũ vẫn thất bại, do dữ liệu nguồn lệch vài km.
- Nền OpenStreetMap ghi chữ Trung Quốc ở Hoàng Sa và Trường Sa.
- Nét đứt tỉnh cũ khó nhìn.
- Danh sách ghim (`PlaceList`) chưa được gán vào bước nào.
- Bước F6 (thống kê) và F7 (giao diện điện thoại) chưa làm.
