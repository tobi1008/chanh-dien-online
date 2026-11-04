# Chánh Điện Tịnh Tâm

Chánh điện online 2.5D cho TikTok LIVE. Mỗi người xem bình luận là bước vào chánh điện, ngồi xuống bồ đoàn tụng kinh. Ai tặng quà sẽ được ghi tên hồi hướng trên màn hình. Có nhạc thiền, chuông, mõ và kinh hiện định kỳ.

Mã nguồn chia sẻ miễn phí (MIT). Có hai phần:

| Thư mục | Là gì |
|---|---|
| `index.html`, `assets/` | Bản web tĩnh cho mọi người tự vào ngồi tụng (đăng lên Cloudflare Pages) |
| `live/` | Bộ công cụ phát LIVE: server Node, overlay 9:16, bảng điều khiển |

## Chạy bộ LIVE trên máy phát

Cần Node.js 20 trở lên.

```bash
cd live
npm install
npm start
```

1. Mở `http://localhost:3000/live/control.html` (bảng điều khiển).
2. Bấm **Mở màn hình overlay 9:16**, rồi bấm **Bật âm thanh** một lần trong cửa sổ đó (trình duyệt chặn tự phát tiếng).
3. Trong TikTok LIVE Studio: *Add source → Window capture* → chọn cửa sổ overlay. Với OBS thì dùng *Browser source* trỏ tới `http://localhost:3000/live/overlay.html`, kích thước 1080×1920.
4. Bật LIVE trên TikTok, nhập `@username` vào bảng điều khiển, bấm **Kết nối**.

Chưa live vẫn kiểm tra được trong tab **Kiểm tra**: thử một người vào xem, bình luận, tặng quà. Bấm **Làm trống toàn bộ bồ đoàn** trước khi lên sóng.

### Đóng gói cho máy Windows (không cần cài Node)

```bash
bash pack/build-windows.sh
```

Tạo `dist/ChanhDienLive-windows-x64.zip` (khoảng 44 MB): có sẵn `node.exe` (Node 24 LTS, kiểm tra SHA-256 với nodejs.org), server, thư viện và `Mo-Chanh-Dien.bat`. Trên máy Windows 10/11 chỉ cần giải nén, bấm đúp `Mo-Chanh-Dien.bat`, làm theo `HUONG-DAN.txt`.

### Phát hành bản cập nhật

Mỗi lần push lên `main` có sửa `live/`, `assets/` hoặc `pack/`, GitHub Actions (`.github/workflows/release.yml`) tự chạy `pack/release.sh`: đóng gói zip và tạo GitHub Release mới. Máy Windows đang dùng bản zip vào bảng điều khiển → **Kiểm tra cập nhật** → **Cập nhật ngay**. Mất khoảng 2–3 phút sau khi push, xem tiến độ ở tab *Actions* trên GitHub.

Sửa `index.html` (bản web) hay `README.md` thì không tạo Release, vì zip không chứa các file đó. Muốn phát hành tay: tab *Actions* → *Release Windows* → *Run workflow*, hoặc chạy `bash pack/release.sh` trên máy có `gh` đã đăng nhập.

### Người xem làm được gì

- **Vào xem live**: được chào bằng ảnh đại diện + tên và ngồi xuống bồ đoàn. Chỉ có người xem thật, không có bot hay người mẫu.
- **Không giới hạn số người**: chánh điện tự nới rộng 24 → 36 → 64 → 100 rồi tiếp tục theo bước 50. Khi quá 100 người, chỉ hiện bảng tên của người đang bình luận, vừa vào hoặc tặng quà để màn hình đỡ rối.
- **Rời live**: TikTok không báo ai rời đi, chỉ báo số người đang xem. Khi số người ngồi nhiều hơn số người xem, người im lặng lâu nhất sẽ rời chánh điện trước (người tặng quà ra sau cùng, ai vừa hoạt động trong 1 phút được giữ lại). Quay lại thì được ngồi lại. Tắt được bằng mục *Theo số người đang xem*.
- **Bình luận bất kỳ**: hiện bong bóng chữ trên đầu nhân vật (người chưa ngồi thì được ngồi luôn). Bình luận dài tự xuống dòng (tối đa 5 dòng), có emoji và sticker TikTok.
- **Bình luận đúng một từ** `nam`, `nữ`, `sư`, `ni`, `tiểu`, `bà`, `cao tăng`: đổi hình nhân vật. Câu "Nam mô A Di Đà Phật" không bị hiểu nhầm thành "nam".
- **Tặng quà**: banner ghi tên hồi hướng (lấy lời nguyện từ bình luận gần nhất của người đó nếu có), hiệu ứng theo giá trị quà, cộng điểm vào bảng Công Đức. Người tặng đứng dậy lên bàn thờ dâng lễ (quà hoa như Rose thì dâng hoa sen, quà khác thì dâng hương), màn hình zoom cận vào người đó khoảng 4 giây rồi trở lại toàn cảnh. Nhiều người tặng liền nhau thì lần lượt từng người. Chỉ người tặng quà mới được zoom, gõ "thắp nhang" thì không.
- **Xin xăm**: miễn phí, mỗi người được xin 1 lần trong buổi live. Gõ `xin xăm` thì lên bàn thờ lắc ống xăm, có zoom, rồi hiện quẻ: số xăm, mức, 4 câu thơ và lời giải. Xin lần nữa thì hiện bong bóng nhỏ trên đầu người đó nhắc chỉ được 1 lần (không banner, không chuông). Bộ 30 quẻ nằm trong `live/xam.mjs`, sửa hay thêm thoải mái. Tắt được trong bảng điều khiển.
- **Thả tim**: tim bay trên đầu nhân vật.
- **Cảnh nền**: 8 cảnh *Chánh điện*, *Rừng trúc*, *Hồ sen đêm trăng*, *Đỉnh núi bình minh*, *Cội Bồ Đề hoàng hôn*, *Sân chùa tuyết*, *Thác nước*, *Mai vàng ngày xuân*, chọn trong tab **🏯 Cảnh & quà**. Bật *Tự động chuyển cảnh* thì cứ mỗi N phút chuyển sang cảnh kế tiếp (mờ dần), bỏ qua các cảnh đã bỏ dấu *tự chuyển*. Mọi cảnh giữ cùng bố cục nên thắp nhang, xin xăm, zoom quà vẫn chạy như cũ. Cảnh vẽ bằng code nằm trong `live/scenes.js`; rừng trúc là ảnh `assets/bamboo.jpg`; tượng Phật `assets/buddha.png` được tách từ `assets/hall.jpg`.
- **Ảnh nền tự tải**: tab **🏯 Cảnh & quà** → **Tải ảnh nền lên** (.jpg / .png / .webp, tối đa 20 MB, ảnh dọc 9:16 đẹp nhất). Mỗi ảnh thành một cảnh mới, lưu trong `assets/bg` (không vào git, không vào bản đóng gói). Bật *Vẽ bàn thờ và tượng Phật lên ảnh tự tải* để dâng hương, dâng hoa, xin quẻ vẫn có chỗ; tắt nếu ảnh đã có sẵn bàn thờ.
- **Menu hướng dẫn**: sửa ngay trong tab **🏯 Cảnh & quà** → *Menu hướng dẫn trên màn hình* (tối đa 8 dòng). Chữ trong `*dấu sao*` được tô vàng và là từ khóa thật: mỗi dòng chọn một hành động (dâng hương, dâng hoa, rút quẻ, lên bục vái lạy hoặc chỉ hiển thị), người xem gõ đúng từ đó là chạy. Các từ khóa có sẵn (dâng hương, thắp nhang, dâng hoa, quẻ tử vi, xin xăm, lạy, vái…) luôn dùng được.
- **Lạy / Vái**: người đó đi lên bục trước bàn thờ, cúi người vái 3 lần rồi về chỗ (chung hàng chờ và giới hạn 45 giây với dâng hương). Câu bình luận vẫn được giữ làm lời nguyện khi tặng quà.
- **Nhạc nền**: mọi file `.mp3`, `.m4a`, `.ogg`, `.wav` trong `assets/music` hiện thành danh sách trong tab **🔔 Âm thanh & kinh**, chép thêm bài vào (hoặc bấm **Tải nhạc lên**, tối đa 60 MB mỗi bài) là danh sách tự cập nhật, bấm 🗑 để xóa bài. Bấm tên bài để phát ngay. Bật *Tự động chuyển bài* thì hết bài sẽ phát ngẫu nhiên bài khác có đánh dấu *tự chuyển* (mỗi vòng mỗi bài một lần, không lặp liền); tắt thì lặp lại bài đang phát. Mỗi lần mở server bắt đầu bằng một bài ngẫu nhiên, từ đoạn giữa bài. Chỉ dùng nhạc bạn có quyền (tự tạo hoặc miễn phí bản quyền), nhạc có bản quyền có thể bị TikTok tắt tiếng hoặc cảnh báo.
- **Kiểu áo người xem**: áo lam xám, lam xanh, nâu, trắng, tràng vàng, hồng phấn. Chọn một hay nhiều kiểu; chọn nhiều thì mỗi người xem mặc một kiểu trong số đó. Bà cụ và các sư giữ nguyên áo.

### Bộ lọc từ tục tĩu

Tab **🛡️ Bộ lọc** trong bảng điều khiển. Lọc cả tên và bình luận bằng danh sách tiếng Việt + tiếng Anh có sẵn (`live/filter.mjs`), bắt được kiểu lách như `đ.m`, `v c l`, `l0z`, `lồnnn`, viết không dấu, mà không chặn nhầm từ sạch như "lớn", "buổi", "tổ sư", "bà vãi".

- Bình luận có từ cấm bị ẩn (hoặc hiện với `***`), không bao giờ được dùng làm lời nguyện.
- Tên có từ cấm hiện là "Phật tử ẩn danh".
- Vi phạm đủ số lần (mặc định 3) thì tự bị mời ra và chặn. Có thể chặn tay từ danh sách người xem.
- Thêm từ cấm riêng, thử một câu ngay trên bảng điều khiển.

Cài đặt được lưu vào `live/config.json` và giữ nguyên sau khi khởi động lại.

## Bảo mật

Dự án được viết để ai tải về chạy cũng an toàn mặc định:

- **Không dùng tài khoản TikTok.** Server chỉ đọc sự kiện công khai của phòng live theo username. Không cần, không hỏi và không lưu mật khẩu, cookie hay session. Không gửi tin nhắn thay bạn.
- **Chỉ mở trên máy mình.** Server lắng nghe `127.0.0.1`, máy khác trong mạng hay Internet không truy cập được. Muốn mở ra ngoài phải tự đặt biến `HOST`. Không nên làm vậy khi chưa thêm đăng nhập.
- **Chặn trang web lạ điều khiển.** WebSocket chỉ nhận kết nối từ chính trang của server (kiểm tra `Origin`), và header `Host` phải là localhost (chống DNS rebinding). Một trang web khác đang mở trong cùng trình duyệt không gửi được lệnh. Cửa sổ overlay chỉ nhận dữ liệu, không gửi lệnh được.
- **File tĩnh có danh sách trắng.** Chỉ phục vụ `/assets` và `/live`. Chặn file ẩn (`.git`, `.env`), `node_modules`, mã server, `package.json` và mọi đường dẫn `../`.
- **Không tin dữ liệu vào.** Tên người xem, bình luận và tên quà đều bị cắt độ dài. Cài đặt chỉ nhận đúng khóa, đúng kiểu, trong giới hạn. Mọi chữ trên màn hình vẽ bằng `textContent` hoặc canvas, không chèn HTML, nên bình luận chứa mã độc chỉ hiện ra như chữ thường.
- **Phụ thuộc ghim phiên bản** trong `live/package.json`: `ws`, `tiktok-live-connector`. Không có khóa API nào trong mã.

Các lớp trên đã được thử: đường dẫn `../`, `%2e%2e`, `.git/config`, `server.mjs`, `package.json` đều trả 404. Host giả trả 421. WebSocket từ Origin lạ bị từ chối. Lệnh gửi từ overlay bị bỏ qua. Cài đặt sai kiểu bị kẹp về giới hạn.

### Lưu ý

- `tiktok-live-connector` là thư viện cộng đồng, không phải API chính thức của TikTok. Nó có thể ngừng chạy khi TikTok đổi hệ thống. Kiểm tra điều khoản TikTok trước khi dùng cho kênh của bạn.
- Hình ảnh trong `assets/` được tạo bằng Google Flow, nhạc nền `music1`, `music2` tạo bằng Gemini; 6 bài còn lại trong `assets/music` tổng hợp hoàn toàn bằng code (`pack/make-music.py`, không dùng mẫu âm thanh nào), tự do sử dụng. Kiểm tra điều khoản của các dịch vụ đó trước khi dùng thương mại, hoặc thay bằng tài nguyên của bạn.

## Miễn trừ trách nhiệm

Dự án được chia sẻ **miễn phí, với mục đích học tập và tham khảo lập trình**. Phần mềm được cung cấp "nguyên trạng" (AS IS), không kèm bất kỳ bảo đảm nào, rõ ràng hay ngụ ý.

Khi tải về, sử dụng, chỉnh sửa hoặc phân phối lại mã nguồn này, **bạn tự chịu hoàn toàn trách nhiệm** về:

- Mọi nội dung bạn phát trên livestream hoặc đăng tải, bao gồm hình ảnh, âm thanh, lời nguyện, bình luận được hiển thị.
- Việc nhận quà, donation hoặc bất kỳ khoản thu nào từ người xem.
- Việc tuân thủ điều khoản sử dụng của TikTok và các nền tảng, dịch vụ bên thứ ba khác (thư viện đọc sự kiện TikTok là thư viện cộng đồng, không chính thức).
- Việc tuân thủ pháp luật nơi bạn sinh sống và hoạt động, kể cả quy định về hoạt động tôn giáo, quảng cáo, thuế và bản quyền.
- Mọi rủi ro và thiệt hại phát sinh, trực tiếp hay gián tiếp, như bị khóa tài khoản, bị dừng live, mất dữ liệu, tranh chấp hay khiếu nại.

Tác giả **không liên quan, không bảo trợ và không chịu trách nhiệm** đối với bất kỳ kênh, tài khoản, sản phẩm hay hoạt động nào sử dụng mã nguồn này. Dự án không đại diện cho bất kỳ chùa, tu viện hay tổ chức tôn giáo nào. Khi dùng nội dung liên quan đến Phật giáo, xin giữ sự tôn kính và không dùng vào mục đích lừa đảo, trục lợi hay xúc phạm niềm tin của người khác.

Việc sử dụng mã nguồn đồng nghĩa với việc bạn đã đọc và đồng ý với các điều trên.

> **Disclaimer (EN):** This project is shared free of charge for educational purposes only and is provided "AS IS", without warranty of any kind. Anyone who uses, modifies or redistributes it is solely responsible for their own content, streams, donations, compliance with TikTok and other platforms' terms, and applicable laws. The author is not affiliated with, does not endorse, and accepts no liability for any channel, account, product or activity built with this code, nor for any direct or indirect damages.

## Ủng hộ tác giả

Dự án chia sẻ miễn phí. Nếu thấy hữu ích và muốn góp chút công đức để tác giả duy trì và làm thêm tính năng, bạn có thể chuyển khoản:

| | |
|---|---|
| Ngân hàng | **MB Bank** |
| Số tài khoản | **999979798886** |
| Chủ tài khoản | **HUYNH HUU NHAN** |

![QR chuyển khoản MB Bank](https://img.vietqr.io/image/MB-999979798886-compact2.png?accountName=HUYNH%20HUU%20NHAN&addInfo=Ung%20ho%20Chanh%20Dien%20Online)

Xin cảm ơn và chúc bạn thân tâm an lạc. Nam mô A Di Đà Phật.

## Giấy phép

MIT, xem `LICENSE`.
