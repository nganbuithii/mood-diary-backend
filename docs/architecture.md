# Mood Diary — Kiến trúc

Tài liệu này là bản rút gọn của kế hoạch kiến trúc đã thống nhất trước khi
khởi tạo project (tham khảo cách tổ chức từ một backend NestJS/Fastify DDD
nội bộ, không copy business logic — chỉ lấy pattern).

## 1. Nguyên tắc

Modular Monolith (NestJS), áp Clean/Hexagonal **theo độ phức tạp thật của
từng module**, không áp máy móc cho mọi module.

| Module | Layering | Lý do |
|---|---|---|
| `auth` | Đầy đủ 4 layer (`domain/application/infrastructure/presentation`) + Command/Handler thủ công cho Register/Login/RefreshToken/Logout/ForgotPassword/ResetPassword/ChangePassword | Có business rule thật (refresh rotation, reuse detection, hashing) — đáng test độc lập |
| `users` | Đủ 4 layer, nhưng `application` chỉ là 1 Service class | CRUD profile/settings đơn giản, chưa có logic đáng cô lập |
| `diaries` | Đầy đủ 4 layer + Command/Handler cho Create/Update/Delete, Query Service riêng cho đọc (timeline, get-by-id) | Module nghiệp vụ chính — transaction boundary (diary+tags), search/pagination |
| `tags` | Như `users` | CRUD phẳng, không rule phức tạp |
| `analytics` | Chỉ `application(query service)/infrastructure/presentation`, không có domain entity riêng | Thuần đọc/tổng hợp từ `diaries`, không sở hữu invariant riêng |

`Mood` không tách module — là field (`moodType` enum + `moodIntensity`) trên
`DiaryEntry`, vì chưa có use case nào cần mood tồn tại độc lập khỏi diary.

## 2. CQRS — khi nào dùng, khi nào không

- **Command + Handler thủ công** (không dùng thư viện `@nestjs/cqrs`) khi:
  (a) ghi xuyên nhiều bảng cần transaction boundary rõ (`CreateDiaryEntry` =
  diary + tags), (b) đủ business rule để đáng unit-test độc lập
  (`RegisterUser` = hash password + check email trùng + tạo refresh token
  family).
- **Service method đơn giản** khi thao tác chỉ là 1 write đơn bảng không có
  invariant phức tạp (`UpdateUserProfile`, `CreateTag`, `DeleteTag`).
- **Query Service + Query Repository riêng** khỏi write repository cho
  `GetDiaryTimeline`, `GetMoodStatistics` — không phải vì "CQRS chuẩn" mà vì
  lợi ích thật: query cần tối ưu riêng (index, raw aggregate), không nên
  trộn với logic ghi.
- Không dùng `@nestjs/cqrs` CommandBus/QueryBus — thêm 1 lớp dispatch
  in-process không mang lại lợi ích gì cho monolith gọi trực tiếp.

## 3. Dependency direction

```
Presentation (Controller, DTO, Guard)
        ↓ gọi
Application (Use-case Service / Command Handler / Query Service)
        ↓ gọi qua interface
Domain (Entity, Value Object, Repository PORT interface, Domain Error)
        ↑ implement interface
Infrastructure (Prisma Repository IMPL, adapter)
```

Domain và Application không import `@prisma/client` hay NestJS decorator
trực tiếp — NestJS DI wire Infrastructure vào Application qua token. Nhờ vậy
unit test Application/Domain dùng in-memory fake repository, không cần DB
thật.

## 4. Request lifecycle ví dụ: `POST /diaries`

1. `DiariesController.create()` — qua `JwtAuthGuard`, validate DTO.
2. Controller map DTO → `CreateDiaryCommand`, gọi `CreateDiaryHandler.execute()`.
3. Handler: validate invariant qua entity, mở transaction qua
   `TransactionManager` port, gọi `DiaryRepository.create()` +
   `TagRepository.attachMany()` trong cùng transaction, commit.
4. Repository (infrastructure) thực thi Prisma call, map Prisma model ↔
   domain entity qua Mapper.
5. Handler trả entity, Controller map sang response DTO, HTTP 201.
6. Cross-cutting: global exception filter map domain error → HTTP status;
   interceptor gắn correlation id; global `ValidationPipe` chặn DTO sai.

## 5. Database schema

Nguồn chuẩn là `prisma/schema.prisma`. Bảng dưới là bản tóm tắt, cập nhật
2026-10-01.

```
User               (id, email UNIQUE, passwordHash, displayName, avatarUrl?, createdAt, updatedAt)
RefreshToken       (id, userId FK, tokenHash UNIQUE, familyId, revokedAt?, replacedByTokenId?, expiresAt, createdAt)
PasswordResetToken (id, userId FK, tokenHash UNIQUE, usedAt?, expiresAt, createdAt)
MoodEntry          (id, userId FK, entryDate DATE, mood enum, note?, photoUrls text[],
                    songExternalId?, songTitle?, songArtist?, songArtworkUrl?, songPreviewUrl?,
                    isFavorite, deletedAt?, createdAt, updatedAt)

enum Mood: VERY_SAD | SAD | NEUTRAL | HAPPY | VERY_HAPPY
```

Mọi bảng con đều `onDelete: Cascade` theo `User`: xoá user là xoá hết token
và entry của user đó.

| Constraint/Index | Lý do |
|---|---|
| `User.email` UNIQUE | Chặn trùng tài khoản ở DB (race khi 2 request đăng ký cùng lúc) |
| `RefreshToken.tokenHash` UNIQUE | Chỉ lưu hash của refresh token; tra token khi refresh/logout |
| `RefreshToken(userId)`, `RefreshToken(familyId)` index | Revoke toàn bộ token của user (đổi mật khẩu) hoặc của một family (reuse detection) |
| `PasswordResetToken.tokenHash` UNIQUE | Chỉ lưu hash (SHA-256) của reset token, không lưu raw |
| `MoodEntry(userId, entryDate)` UNIQUE | Quy tắc "một ngày một trang"; cũng là khoá định danh entry trong API (ADR-001) và khoá cho upsert |
| `MoodEntry(userId, mood, entryDate)` index | Feed lọc theo mood, mới nhất trước |
| `MoodEntry(userId, isFavorite, entryDate)` index | Feed favorites, mới nhất trước |

Ghi chú về `MoodEntry`:

- `entryDate` là ngày theo lịch địa phương của user (`DATE`, không có giờ).
- Các cột `song*` là bản chụp bài hát lúc chọn, nên entry vẫn hiển thị được
  khi bài hát bị gỡ khỏi catalog.
- `photoUrls` là URL Cloudinary trong thư mục `mood-diary/diary-photos/`,
  tối đa 3 ảnh.
- `deletedAt` khác null nghĩa là entry đã bị soft delete (ADR-002).

Chưa có `Tag`/`DiaryTag`, `Streak`/`Achievement`. Streak được tính lại từ
các entry ở mỗi request, không lưu.

## 6. Roadmap

- **Phase 0 — Init** (đã xong): skeleton monorepo, `GET /health`, Next.js
  home, Docker Compose, Prisma schema, env validation, lint/test wiring.
- **Phase 1** — Auth & Users (refresh rotation + reuse detection, ownership,
  forgot/reset password qua email — nodemailer SMTP, rate limit riêng cho 2
  endpoint này qua `@nestjs/throttler`, change-password cho user đã login —
  cả 2 luồng đổi mật khẩu đều revoke toàn bộ refresh token sau khi đổi).
- **Phase 2** — Diary CRUD + Tags (cursor pagination, transaction boundary).
- **Phase 3** — Database depth (composite index, `EXPLAIN ANALYZE`, N+1).
- **Phase 4** — Security hardening (rate limit, helmet, CORS, brute-force).
- **Phase 5** — Testing pass (unit + integration cho transaction boundary).
- **Phase 6** — Docker/CI hoàn thiện, deploy.
- **Phase 7** (Junior+) — Redis cache, structured logging + correlation id.
- **Phase 8** (stretch) — FE polish, queue/notification nếu còn động lực.

## 7. Quyết định version cụ thể (chốt khi init, 2026-09-14)

Hệ sinh thái đã tiến khá xa so với các bản "quen thuộc" — một số gói mới
nhất phá vỡ tương thích, nên đã chốt lại như sau thay vì dùng `latest` mù
quáng:

- **NestJS 11.x** (không dùng 12.x): `@nestjs/testing` và `@nestjs/config`
  bản 12 phát hành dưới dạng ESM thuần, không chạy được với Jest ở chế độ
  CommonJS mặc định → gây lỗi `Must use import to load ES Module`. 11.x vẫn
  là CJS, ổn định, tài liệu/cộng đồng vẫn dùng phổ biến.
- **Prisma 6.x** (không dùng 7.x): Prisma 7 bỏ `datasource.url` trong
  `schema.prisma`, chuyển sang bắt buộc `prisma.config.ts` + driver adapter
  — một thay đổi kiến trúc lớn, còn quá mới để xây nền tảng học tập lên đó.
  6.x vẫn dùng pattern `url = env("DATABASE_URL")` quen thuộc.
- **`@nestjs/schedule` 6.x** (không dùng 12.x, thêm 2026-10-01): bản 12
  phát hành dạng ESM thuần (`"type": "module"`), cùng vấn đề với Jest như
  `@nestjs/testing` 12. Bản 6.x vẫn là CJS và hỗ trợ Nest 11.
- **ESLint 10 (flat config)**: dự án dùng `eslint.config.js` (không phải
  `.eslintrc.js`) vì ESLint 9+ đã bỏ format cũ.

Đây cũng là một bài học thực tế đáng ghi nhớ: trước khi lock version cho một
dependency quan trọng, luôn kiểm tra release notes/breaking changes thay vì
mặc định cài `latest`.

## 8. Quyết định thiết kế (ADR)

Mỗi mục ghi lại một quyết định đã chốt, lý do, và điều kiện để xem xét lại.
Muốn đổi quyết định thì sửa mục tương ứng (ghi ngày đổi), không xoá.

### ADR-001 — Định danh diary entry theo ngày, không theo `id` (2026-10-01)

**Quyết định:** các API thao tác trên một entry của chính user định danh entry
bằng ngày, không bằng `id`:
`POST /diaries` (upsert theo `date` trong body), `PATCH /diaries/:date/favorite`,
`DELETE /diaries/:date`. Response vẫn trả `id`.

**Bối cảnh:** sản phẩm theo quy tắc "một ngày một trang", đã khoá ở DB bằng
`@@unique([userId, entryDate])` trên `MoodEntry`. Vì vậy cặp
(user, ngày) xác định duy nhất một entry, tương đương `id`.

**Lý do:**

- Bám theo domain: API nói đúng ngôn ngữ sản phẩm ("xoá ngày 20/9"), lịch,
  deep link `/diary?date=` và cache phía FE cũng tra theo ngày.
- Nhất quán: mọi thao tác trên entry dùng cùng một kiểu định danh. Trộn hai kiểu
  (tạo theo ngày, xoá theo id) dễ gây nhầm.
- Ownership đúng ngay từ cấu trúc: `userId` lấy từ access token, query luôn là
  `WHERE userId = ? AND entryDate = ?`, nên không thể chạm vào entry của
  người khác. Định danh theo `id` thì mỗi query phải tự nhớ thêm điều kiện
  `userId`; quên một chỗ là thành lỗ hổng IDOR.
- YAGNI: chưa có use case cần định danh bằng `id`.

**Lưu ý khi dùng:** `date` là **ngày theo lịch địa phương của user**
(`YYYY-MM-DD`, do client gửi), không phải timestamp. Server lưu dạng `DATE`
và parse chặt bằng `parseCalendarDate` (từ chối ngày không tồn tại như
`2026-02-30`).

**Xem xét lại khi:**

- Cho phép **nhiều entry trong một ngày**. Khi đó ngày không còn duy nhất:
  chuyển sang `id`, bỏ upsert theo ngày.
- Làm tính năng **chia sẻ hoặc xem entry của người khác** (Friends). Entry
  của người khác dùng `id` (UUID) qua route riêng, ví dụ `/entries/:id`,
  có kiểm tra quyền riêng. Route `/diaries/:date` vẫn là "nhật ký của tôi".

Chuyển sang `id` là thay đổi **chỉ thêm**: thêm route mới song song, không
phá client cũ, nên không cần làm trước.

### ADR-002 — Xoá entry là soft delete (2026-10-01)

**Quyết định:** `DELETE /diaries/:date` chỉ ghi `MoodEntry.deletedAt`, không
xoá dòng và không xoá ảnh trên Cloudinary. Chưa có API khôi phục.

**Hệ quả:**

- Mọi truy vấn đọc trong `PrismaDiaryEntryRepository` lọc
  `deletedAt: null`: lịch tháng, feed, favorites, streak, little memory.
  Streak được tính lại mỗi request nên tự đúng sau khi xoá.
- Mỗi user mỗi ngày vẫn chỉ có một dòng (giữ unique `(userId, entryDate)`,
  không cần partial unique index). Viết lại vào ngày đã xoá sẽ dùng lại dòng
  đó với nội dung mới hoàn toàn: ảnh, bài hát và favorite của entry cũ bị reset
  (`DiariesService.upsertEntry`). Từ lúc đó dữ liệu cũ không còn.
- Xoá entry đã xoá, hoặc favorite entry đã xoá, trả 404 như entry không tồn tại.

**Dọn dữ liệu (2026-10-01):**

- `PurgeDeletedEntriesUseCase` xoá hẳn các entry đã soft delete quá
  `DELETED_ENTRY_RETENTION_DAYS` (30 ngày): xoá ảnh trên Cloudinary trước,
  rồi mới xoá dòng. Nếu một ảnh xoá lỗi thì giữ dòng lại cho lần chạy sau,
  vì dòng là nơi duy nhất còn ghi ảnh nào cần xoá.
- Lệnh xoá dòng có điều kiện `deletedAt < cutoff`, nên entry mà user vừa
  viết lại trong lúc job đang chạy sẽ không bị xoá nhầm.
- Job chạy lúc 03:00 UTC hằng ngày (`PurgeDeletedEntriesScheduler`, dùng
  `@nestjs/schedule`). App chạy một instance nên cron trong process là đủ.
  Trên host ngủ khi không có người dùng (Render free), lần chạy có thể bị bỏ
  lỡ; lần sau sẽ dọn bù. Nếu sau này chạy nhiều instance, phải chuyển sang
  job ngoài hoặc thêm lock để không chạy trùng.
- Ảnh bị thay khi lưu entry (chọn ảnh mới khi sửa, hoặc viết lại vào ngày
  đã xoá) được `DiariesService.upsertEntry` xoá ngay sau khi lưu thành công.
  Lỗi xoá ảnh chỉ ghi log, không làm hỏng việc lưu.
- `CloudinaryDiaryPhotoStorage.delete` chỉ xoá ảnh trong thư mục
  `mood-diary/diary-photos/`, từ chối mọi URL khác.

**Còn mở:**

- Ảnh bị thay mà xoá lỗi lúc lưu sẽ nằm lại trên Cloudinary vì không còn
  dòng nào tham chiếu. Nếu cần dọn triệt để, làm job đối chiếu danh sách ảnh
  trên Cloudinary với `photoUrls` trong DB.
- Nếu cần Undo hoặc thùng rác, thêm route restore (đặt `deletedAt = null`)
  trong khoảng 30 ngày trước khi bị purge.
