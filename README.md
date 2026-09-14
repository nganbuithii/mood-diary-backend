# Mood Diary — Backend

API cho Mood Diary (nhật ký cảm xúc) — NestJS + PostgreSQL + Prisma + Redis,
dự án cá nhân để học Backend bài bản (Modular Monolith, Clean/Hexagonal có
chọn lọc, transaction boundary, security, testing, Docker).

Frontend (Next.js) nằm ở repo riêng: `mood-diary-frontend`. Repo này chỉ chứa
Backend + hạ tầng của nó (Postgres/Redis qua Docker Compose).

Kiến trúc chi tiết (dependency direction, CQRS khi nào dùng, DB schema, request
lifecycle, roadmap theo phase): xem [`docs/architecture.md`](docs/architecture.md).

## Tech stack

| Layer | Chọn | Vì sao |
|---|---|---|
| Framework | NestJS 11 | DI sẵn có giúp áp dụng Clean/Hexagonal mà không cần tự dựng container thủ công |
| DB | PostgreSQL + Prisma 6 | Xem `docs/architecture.md#7` — Prisma 7 đổi cách cấu hình datasource, chưa đủ ổn định để xây nền học tập lên đó |
| Cache/Queue (sau) | Redis | Chỉ dùng khi có use case cache/queue thật (Phase 7), không thêm từ đầu |
| Validation | Zod (env) + class-validator (DTO) | Env schema riêng, DTO dùng class-validator vì tích hợp sẵn với NestJS pipe |

## Kiến trúc (tóm tắt)

Modular Monolith, mỗi module áp Clean/Hexagonal **theo độ phức tạp thật**:

- `auth`, `diaries`: đầy đủ `domain/application/infrastructure/presentation`
  + Command/Handler thủ công (không dùng `@nestjs/cqrs`) cho write phức tạp.
- `users`, `tags`: đủ 4 layer nhưng `application` chỉ là 1 Service class.
- `analytics`: chỉ `application/infrastructure/presentation`, không có domain
  entity riêng — thuần đọc/tổng hợp dữ liệu từ `diaries`.

Dependency direction: `Presentation → Application → Domain ← Infrastructure`.
Domain/Application không import `@prisma/client` hay NestJS decorator trực
tiếp.

## Local setup

**Yêu cầu:** Node.js 20+, pnpm, Docker Desktop (đang chạy).

```bash
# 1. Cài dependencies
pnpm install

# 2. Tạo file env
cp .env.example .env

# 3. Bật Postgres + Redis
docker compose up -d postgres redis

# 4. Migrate database
pnpm prisma:generate
pnpm prisma:migrate

# 5. Chạy dev
pnpm start:dev     # http://localhost:3001  (Swagger: /docs, health: /health)
```

`docker compose up -d` (không chỉ định service) sẽ chạy cả `backend` trong
container luôn nếu muốn mô phỏng môi trường gần giống production.

## Scripts

| Lệnh | Vai trò |
|---|---|
| `pnpm lint` | ESLint |
| `pnpm test` | Unit test (Jest) |
| `pnpm test:e2e` | E2E test (Jest + Supertest, boot toàn bộ Nest app) |
| `pnpm build` | Build production (`dist/`) |
| `pnpm prisma:generate` / `prisma:migrate` | Prisma client / migration |

## Trạng thái hiện tại

- [x] Phase 0 — Init: skeleton, `GET /health`, Swagger, env validation,
      Prisma schema MVP, Docker Compose, lint/test wiring.
- [ ] Phase 1 — Auth & Users (refresh token rotation + reuse detection).
- [ ] Phase 2 — Diary CRUD + Tags (cursor pagination, transaction boundary).
- [ ] Phase 3+ — xem roadmap đầy đủ trong `docs/architecture.md`.
