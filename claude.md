# CLAUDE.md — AI coding & review guideline cho Mood Diary

File này là **operating rule cho Claude** khi code/review trong repo này. Không lặp lại nội dung
`docs/architecture.md` — chỉ tham chiếu tới đó. Khi có mâu thuẫn: `docs/architecture.md` là
source of truth cho architecture/schema/roadmap; file này chỉ quy định **cách Claude hành xử**
(coding style, review format, mức độ được phép tự suy đoán).

## 1. Project context

- NestJS Modular Monolith, PostgreSQL + Prisma.
- Clean/Hexagonal Architecture áp theo độ phức tạp **thật** của từng module — KHÔNG áp máy móc
  đủ 4 layer cho module không cần (layering cụ thể từng module: `docs/architecture.md` §1).
- DDD pattern (Entity, Value Object, Repository port) chỉ dùng ở module có business rule thật
  (`auth`, `diaries`). CRUD phẳng (`users`, `tags`) không cần đủ pattern.
- Không dùng `@nestjs/cqrs`, CommandBus/QueryBus, microservice, event-driven — đã chốt
  (`docs/architecture.md` §2). Không tự đề xuất lại trừ khi user chủ động hỏi.

## 2. Source of truth

- `docs/architecture.md`: architecture, module boundaries, dependency direction, roadmap/phase.
  (Lưu ý: file thực tế nằm ở `docs/architecture.md`, không phải `ARCHITECTURE.md` ở root repo —
  nếu sau này có ai tạo `ARCHITECTURE.md` ở root, phải hợp nhất/trỏ về file này, tránh 2 bản song song.)
- `prisma/schema.prisma`: database schema — đọc trước khi review/code bất kỳ entity/query nào.
- Requirement không rõ trong architecture doc / issue / PR description → hỏi lại hoặc ghi
  `Needs clarification`, không tự suy đoán business rule.

## 3. Dependency rules

- Chiều phụ thuộc bắt buộc: `Presentation → Application → Domain`; `Infrastructure` implement
  port của `Domain` qua DI token (pattern mẫu: `USER_REPOSITORY`, `PASSWORD_HASHER`,
  `TOKEN_ISSUER` trong `src/modules/auth`).
- Domain/Application không import `@prisma/client` hoặc concern HTTP-specific (Request/Response,
  decorator gắn với transport layer) trực tiếp. Dùng decorator DI thuần (`@Injectable`, `@Inject`)
  ở Application là OK — đây là convention hiện tại của repo, không phải vi phạm cần sửa.
- Business rule không đặt trong Controller hoặc trong Prisma Repository — Controller chỉ map
  DTO ↔ use-case; Repository chỉ thực thi persistence + map Prisma error sang domain error.

## 4. Coding rules

- Ưu tiên code đơn giản, explicit, dễ test hơn là "linh hoạt cho tương lai".
- Không over-engineer: không thêm interface/abstraction/factory/service mới nếu chưa có ≥2
  implementation thật hoặc chưa có nhu cầu test-double cụ thể ngay bây giờ.
- Trước khi tạo pattern mới, tìm module tương tự đã có trong repo (`auth` là ví dụ đầy đủ nhất)
  và theo đúng naming/style đó.
- Không tự thêm dependency mới vào `package.json` nếu không được yêu cầu — đặc biệt các gói đã
  bị chốt version trong `docs/architecture.md` §7 (NestJS 11.x, Prisma 6.x, ESLint 10 flat config).

## 5. Database rules

- Ghi nhiều bảng trong 1 use-case → transaction boundary xác định ở application/use-case layer,
  không rải `prisma.$transaction` rải rác nhiều nơi.
- Ownership: mọi query đọc/sửa/xoá resource của user phải filter theo `userId` — không tin `id`
  trong path/body mà không kiểm tra chủ sở hữu.
- Race condition: không chỉ chặn ở application (check-then-act); phải có unique
  constraint/index tương ứng ở DB, và Repository phải catch lỗi constraint (`P2002`...) map
  sang domain error thay vì để lỗi Prisma leak lên trên (pattern mẫu:
  `PrismaUserRepository.create()`).
- Trước khi thêm field cần lookup (`WHERE x = ?`), kiểm tra đã có index/unique tương ứng trong
  `prisma/schema.prisma` chưa.

## 6. Security rules (đặc biệt `auth`)

- Password hash bằng `argon2` qua `PasswordHasher` port — không tự implement hash, không
  log/trả `passwordHash` ở bất kỳ response/DTO nào.
- JWT secret + expiration lấy qua `ConfigService`/env schema (có validate độ dài secret), không
  hardcode.
- Refresh token (khi implement): lưu **hash** của token trong DB, không lưu raw token; phải có
  rotation (dùng 1 lần → revoke token cũ, issue token mới), token family (`familyId`) để revoke
  theo nhóm, reuse detection (token đã revoke mà bị dùng lại → revoke cả family), logout phải
  revoke đúng token/family tương ứng.
- Các nhánh lỗi authentication (user không tồn tại / sai password) phải có cost xử lý tương
  đương để tránh timing side-channel lộ email tồn tại (pattern mẫu: `LoginUserUseCase` luôn gọi
  `passwordHasher.verify` dù user không tồn tại).
- Phân biệt rõ authentication (biết là ai) vs authorization (có quyền làm gì) khi review — thiếu
  1 trong 2 đều phải flag.

## 7. Review rules

- Mỗi finding gắn đúng 1 severity: `CRITICAL` (auth/authz bypass, mất/corrupt data, credential
  exposure, transaction inconsistency nghiêm trọng) / `HIGH` / `MEDIUM` / `LOW` / `NOTE`.
- Phân loại rõ: bug thật vs security issue vs architecture violation vs maintainability
  improvement vs planned feature (thuộc roadmap/phase sau).
- Không nâng severity chỉ vì 1 feature chưa implement — nếu thuộc phase/PR tiếp theo, dùng `NOTE`.
- Không chắc requirement → ghi `Needs clarification`, không tự suy đoán rồi report thành bug.

## 8. Scope awareness

- Trước khi yêu cầu sửa code, xác định feature đó có thuộc scope PR/phase hiện tại không
  (roadmap: `docs/architecture.md` §6).
- Ví dụ chuẩn: `RefreshToken` model đã có trong schema nhưng Login chỉ issue access token —
  KHÔNG tự động là bug nếu refresh flow là PR/phase kế tiếp; report dạng `NOTE / Planned scope`.

## 9. Testing rules

- Business rule quan trọng (hash, check trùng email, token issuance, sau này: rotation/reuse
  detection) phải có unit test dùng fake/in-memory repository — không cần DB thật, không cần
  `@nestjs/testing` (pattern mẫu: `login-user.use-case.spec.ts`, `register-user.use-case.spec.ts`).
- Transaction boundary / behavior phụ thuộc Postgres thật (constraint, cascade...) → integration
  test khi cần, không mock Prisma tới mức test lại chính cái mock.
- Test observable behavior (input/output, error type) — không test implementation detail (số
  lần gọi hàm private, thứ tự nội bộ không ảnh hưởng kết quả).

## 10. Review output format

Mỗi finding: `Severity` · `Location (file:line)` · `Current behavior` · `Problem` · `Why` ·
`Suggested fix` · `Scope check`.

Cuối review: `Blocking issues` · `Should fix` · `Notes / future scope` ·
`Architecture consistency` · `Security` · `Test coverage` ·
`Overall: Safe to merge / Needs fixes before merge`.

## 11. Learning goal

Đây là project cá nhân để nâng backend/system design skill, không phải production enterprise
codebase.

- Khi đề xuất solution: giải thích WHY ngắn gọn (production practice nào, tại sao áp dụng ở đây).
- Ưu tiên solution đơn giản nhất đáp ứng đúng requirement hiện tại; không thêm enterprise pattern
  chỉ vì "chuẩn thường làm vậy".
- Nếu có nhiều cách khả thi, nêu trade-off ngắn để user chọn — không tự chọn cách phức tạp nhất.
