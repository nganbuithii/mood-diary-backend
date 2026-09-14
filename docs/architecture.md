# Mood Diary — Kiến trúc

Tài liệu này là bản rút gọn của kế hoạch kiến trúc đã thống nhất trước khi
khởi tạo project (tham khảo cách tổ chức từ một backend NestJS/Fastify DDD
nội bộ, không copy business logic — chỉ lấy pattern).

## 1. Nguyên tắc

Modular Monolith (NestJS), áp Clean/Hexagonal **theo độ phức tạp thật của
từng module**, không áp máy móc cho mọi module.

| Module | Layering | Lý do |
|---|---|---|
| `auth` | Đầy đủ 4 layer (`domain/application/infrastructure/presentation`) + Command/Handler thủ công cho Register/Login/RefreshToken/Logout | Có business rule thật (refresh rotation, reuse detection, hashing) — đáng test độc lập |
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

## 5. Database schema MVP

```
User            (id, email UNIQUE, passwordHash, displayName, createdAt, updatedAt)
RefreshToken    (id, userId FK, tokenHash, familyId, revokedAt?, replacedByTokenId?, expiresAt, createdAt)
DiaryEntry      (id, userId FK, title?, content, moodType enum, moodIntensity int, createdAt, updatedAt)
Tag             (id, userId FK, name, createdAt)
DiaryTag        (diaryId FK, tagId FK)   -- composite PK, bảng nối
```

| Constraint/Index | Lý do |
|---|---|
| `User.email` UNIQUE | Chặn duplicate account ở DB (race condition khi 2 request đăng ký cùng lúc) |
| `RefreshToken(familyId)` index | Reuse detection cần revoke nhanh toàn bộ family |
| `DiaryTag(diaryId, tagId)` composite PK | Chặn gắn trùng tag ở tầng DB |
| `DiaryEntry(userId, createdAt DESC)` composite index | Phục vụ query timeline cursor-paginated |
| `Tag(userId, name)` UNIQUE | Chặn user tạo trùng tên tag |

Chưa tạo `Mood`/`Streak`/`Achievement` — thuộc phạm vi mở rộng sau.

## 6. Roadmap

- **Phase 0 — Init** (đã xong): skeleton monorepo, `GET /health`, Next.js
  home, Docker Compose, Prisma schema, env validation, lint/test wiring.
- **Phase 1** — Auth & Users (refresh rotation + reuse detection, ownership).
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
- **ESLint 10 (flat config)**: dự án dùng `eslint.config.js` (không phải
  `.eslintrc.js`) vì ESLint 9+ đã bỏ format cũ.

Đây cũng là một bài học thực tế đáng ghi nhớ: trước khi lock version cho một
dependency quan trọng, luôn kiểm tra release notes/breaking changes thay vì
mặc định cài `latest`.
