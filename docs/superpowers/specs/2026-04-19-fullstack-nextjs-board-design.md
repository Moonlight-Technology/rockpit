# Fullstack Next.js Personal Project Board Design

Date: 2026-04-19  
Project: personal-journal  
Status: Approved for planning

## 1. Goal

Evolve the current frontend-only board/task prototype into a fullstack multi-user system using Next.js App Router, Auth.js credentials authentication, and PostgreSQL.  

Primary outcome:
- User can register/login.
- User can create board from home modal (Trello-inspired fields).
- On create success, user is redirected to the new board detail page.
- New board gets default columns: `To Do`, `In Progress`, `Done`.
- User can add column, rename column, add task, and drag task between columns.

## 2. Scope

In scope:
- Next.js fullstack app (UI + API route handlers).
- Auth.js credentials flow with protected app routes.
- Prisma schema and migrations for PostgreSQL.
- Board/task CRUD needed for current UX.
- Authorization checks for board access ownership/membership.

Out of scope for this phase:
- Real-time collaboration.
- Invite by email.
- Advanced Trello features (comments, attachments, checklists).
- Complex role model beyond `OWNER` and `MEMBER`.

## 3. Architecture

Stack:
- Framework: Next.js App Router
- Auth: Auth.js (credentials provider)
- ORM: Prisma
- DB: PostgreSQL
- Validation: Zod

High-level flow:
1. User authenticates via Auth.js credentials.
2. Protected pages fetch/mutate data through `/api/*` route handlers.
3. Route handlers validate input, authorize session user, call service layer.
4. Service layer reads/writes PostgreSQL via Prisma.

Separation of concerns:
- `app/*`: routing and UI composition
- `app/api/*`: HTTP boundary and auth guard
- `lib/validators/*`: request validation contracts
- `lib/board-service.ts`: domain operations for boards/columns/tasks
- `lib/prisma.ts`: Prisma client singleton

## 4. Data Model

### 4.1 User
- `id` (cuid, PK)
- `email` (unique)
- `name`
- `passwordHash`
- `createdAt`, `updatedAt`

### 4.2 Board
- `id` (cuid, PK)
- `title`
- `description`
- `theme`
- `dueDate` (nullable)
- `ownerId` (FK -> User)
- `createdAt`, `updatedAt`

### 4.3 BoardMember
- `id` (cuid, PK)
- `boardId` (FK -> Board)
- `userId` (FK -> User)
- `role` enum: `OWNER | MEMBER`
- unique compound: `(boardId, userId)`

### 4.4 BoardColumn
- `id` (cuid, PK)
- `boardId` (FK -> Board)
- `title`
- `position` (int)
- `createdAt`, `updatedAt`

### 4.5 Task
- `id` (cuid, PK)
- `boardId` (FK -> Board)
- `columnId` (FK -> BoardColumn)
- `title`
- `description` (nullable)
- `dueDate` (nullable)
- `position` (int)
- `createdAt`, `updatedAt`

Design notes:
- `position` supports deterministic ordering for columns/tasks.
- `Task` stores both `boardId` and `columnId` to simplify authorization and querying.

## 5. Auth and Authorization

Authentication:
- Auth.js credentials strategy with email/password.
- Passwords hashed with bcrypt.
- Session exposes minimal user payload: `id`, `email`, `name`.

Authorization rule:
- Session user can access board if:
  - `board.ownerId === session.user.id`, or
  - session user exists in `BoardMember` for board.

Protected routes:
- `/` (home dashboard)
- `/boards/[id]`

Unauthenticated behavior:
- redirect to `/login`

## 6. API Contract

Response envelope:
- success: `{ ok: true, data: ... }`
- failure: `{ ok: false, error: { code, message } }`

Status codes:
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `422` validation error

### 6.1 Register
`POST /api/auth/register`
- body: `{ name, email, password }`
- action: validate + hash password + create user

### 6.2 List Boards
`GET /api/boards`
- returns boards user owns or is member of

### 6.3 Create Board
`POST /api/boards`
- body:
  - `title` (required)
  - `description` (required)
  - `theme` (required)
  - `dueDate` (optional)
- action:
  - create board
  - create membership row with `OWNER`
  - create default columns in order:
    1. `To Do`
    2. `In Progress`
    3. `Done`
- returns created board id for redirect

### 6.4 Get Board Detail
`GET /api/boards/:id`
- returns board metadata + ordered columns + ordered tasks

### 6.5 Column Mutations
`PATCH /api/boards/:id/columns`
- supports:
  - add column (append at last position)
  - rename column by id

### 6.6 Task Mutations
`POST /api/boards/:id/tasks`
- add task to target column (append position)

`PATCH /api/boards/:id/tasks/reorder`
- move task within/across columns
- updates `columnId` and positions to keep stable ordering

## 7. UI Behavior

## 7.1 Home (`/`)
- Tabs remain: `Board` and `Tasks`.
- Button above tabs is dynamic:
  - `Board` active -> `Add Board`
  - `Tasks` active -> `Add Task`

Add Board modal fields:
- `Board Name` (required)
- `Description` (required)
- `Background/Theme` (required)
- `Due Date` (optional)

Submit behavior:
1. validate fields
2. call `POST /api/boards`
3. redirect immediately to `/boards/{newBoardId}`

### 7.2 Board Detail (`/boards/[id]`)
- Show columns and tasks from API.
- Drag task between columns.
- Add task per column.
- Add new column.
- Rename existing column inline.
- Use optimistic UI for responsive interactions with rollback on API failure.

## 8. File/Module Plan

Target structure:
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(app)/boards/[id]/page.tsx`
- `src/app/api/auth/register/route.ts`
- `src/app/api/boards/route.ts`
- `src/app/api/boards/[id]/route.ts`
- `src/app/api/boards/[id]/columns/route.ts`
- `src/app/api/boards/[id]/tasks/route.ts`
- `src/app/api/boards/[id]/tasks/reorder/route.ts`
- `src/lib/auth.ts`
- `src/lib/prisma.ts`
- `src/lib/validators/*.ts`
- `src/lib/board-service.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*`

## 9. Error Handling Strategy

Validation errors:
- return field-safe messages from zod parse failures.

Domain errors:
- board not found, column not found, task not found -> `404`.

Authorization errors:
- board exists but not accessible to user -> `403`.

Conflict/race during reorder:
- use transaction for reorder operations to keep consistent positions.

## 10. Testing Strategy

Unit tests:
- validators for register/create-board/rename-column/reorder-task.

Integration tests:
- auth guard (`401`)
- board authorization (`403`)
- create board auto-creates 3 default columns
- reorder task changes both `columnId` and `position`

Manual smoke:
- register -> login -> create board via modal -> redirect to board detail
- add/rename column
- add/move task

## 11. Migration Plan from Mock Data

1. Keep current UI layout/components.
2. Replace static board source with `GET /api/boards`.
3. Replace board detail local mutations with API-backed mutations.
4. Remove `src/lib/boards.ts` mock usage after API integration stabilizes.
5. Preserve existing visual behavior while switching data source.

## 12. Risks and Mitigations

Risk: drag-and-drop reorder bugs with position drift.  
Mitigation: centralized reorder function + DB transaction + deterministic reindex.

Risk: auth/session complexity in route handlers.  
Mitigation: helper guard function in `lib/auth.ts` to standardize session checks.

Risk: API/UI mismatch during migration.  
Mitigation: typed response contracts and staged replacement (home first, detail second).

## 13. Acceptance Criteria

1. User can register/login/logout.
2. Non-authenticated users cannot access app pages.
3. `Add Board` modal captures required fields and optional due date.
4. Board creation redirects to new board detail.
5. New board always starts with `To Do`, `In Progress`, `Done`.
6. User can add column and rename column in board detail.
7. User can add task and drag task across columns.
8. Data persists in PostgreSQL and is scoped by board access rules.
