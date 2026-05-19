# Lead ↔ Quotation Relationship — Design Spec

**Date**: 2026-05-19
**Status**: Approved (pending implementation)
**Scope**: Company mode — Leads & Quotations features

## 1. Problem

Saat ini Lead dan Quotation di codebase tergabung lewat foreign key (`Quotation.leadId → Lead.id`) tapi **tidak ada side-effect lintas-entitas**. Akibatnya:

- Quotation bisa `APPROVED` sementara lead-nya masih `NEW`/`QUALIFIED`.
- Lead bisa di-`LOST` sementara quotation `DRAFT`/`SENT`-nya masih hidup.
- Tidak ada guard yang mencegah pembuatan quotation di lead `LOST`.
- `Lead.wonAt` hanya di-set saat lead-to-project conversion, bukan saat quotation di-approve.

Selain itu, perilaku quotation saat ini menggabungkan dua konsep berbeda menjadi satu aksi:
- **Setiap perubahan apapun (termasuk hanya update status)** memicu pembuatan revisi baru.
- Akibatnya `revisionNumber` di sistem tidak sinkron dengan nomor revisi dokumen yang dipegang klien.

## 2. Goals

1. Quotation `APPROVED` otomatis mempromosikan lead ke `WON` (single source of truth: kolom kanban).
2. Pemisahan tegas antara **revision** (perubahan konten) dan **status transition** (perubahan workflow state).
3. Guard pembuatan quotation pada lead `LOST` dengan opsi revive eksplisit.
4. Preserve manual control: lead movement tidak pernah memaksa quotation berubah, dan demotion lead selalu manual.

## 3. Non-goals

- Strict state machine validation (DRAFT → SENT → APPROVED). Pertahankan permissive untuk MVP.
- Audit log perubahan status.
- Email notification saat status berubah.
- Validasi "lines identik dengan revisi sebelumnya = tolak revisi baru".
- Shortcut "approve quotation" di halaman lead detail.
- Auto-LOST lead saat quotation REJECTED.
- Funnel sync `DRAFT`/`SENT` → `PROPOSAL`/`NEGOTIATION` (tetap manual).
- Auto-revert lead saat status quotation di-undo (mis. APPROVED → DRAFT lagi). Demotion selalu manual.

## 4. Behavioral Rules (Source of Truth)

| Trigger | Efek ke Lead | Catatan |
|---|---|---|
| Quotation menjadi `APPROVED` (via PATCH status pada revisi terbaru, **atau** via POST create/new-revision dengan `status: "APPROVED"` di body) | Lead pindah ke kolom "Won", `stage=WON`, `wonAt=now()` | Hanya jalan kalau lead belum WON. |
| Quotation transisi ke `REJECTED` | Tidak ada efek | Manual control. |
| Quotation `DRAFT` / `SENT` (create atau status change) | Tidak ada efek | Funnel sync manual. |
| POST new quotation pada lead `LOST` | API tolak `409 LEAD_LOST_REQUIRES_REVIVE` | FE konfirmasi → retry `reviveLead=true` → lead ke kolom "Negotiation", lalu quotation dibuat. |
| POST new quotation pada lead `WON` | Diizinkan, lead tetap WON | Untuk re-quote scope change pasca-deal. |
| PATCH status apapun pada lead `LOST` | Diizinkan, lead tetap LOST | Tidak butuh revive. |
| Status APPROVED diubah balik ke DRAFT/SENT/REJECTED (transisi pada revisi yang sama) | Lead **tidak** revert | Demotion selalu manual. |
| Lead pindah manual ke stage manapun | Tidak menyentuh quotation | Independent lifecycle. |

### Invariants

- **Kolom "Won" tidak ada di board**: PATCH APPROVED tetap sukses, lead tidak dipindah, response memuat `warnings: [{ code: "WON_COLUMN_MISSING" }]`. FE tampilkan toast info.
- **Kolom "Negotiation" tidak ada saat revive**: API return `400 NEGOTIATION_COLUMN_NOT_FOUND`. FE prompt user pilih kolom tujuan manual.
- **Hanya revisi terbaru yang boleh status-update**: PATCH pada revisi non-latest → `409 NOT_LATEST_REVISION`.
- **Idempotent**: PATCH status sama dengan current → no-op, return 200 dengan data current, tidak trigger side-effect.

## 5. Schema Changes

File: `prisma/schema.prisma`, model `CompanyQuotation`.

```prisma
model CompanyQuotation {
  // existing fields ...
  status        CompanyQuotationStatus @default(DRAFT)
  issuedAt      DateTime?              // existing; retained for backward compat (deprecate later)
  sentAt        DateTime?              // NEW
  approvedAt    DateTime?              // NEW
  rejectedAt    DateTime?              // NEW
}
```

**Migration**:
- `ALTER TABLE company_quotation ADD COLUMN sent_at TIMESTAMP NULL, ADD COLUMN approved_at TIMESTAMP NULL, ADD COLUMN rejected_at TIMESTAMP NULL;`
- Backfill data lama: untuk row dengan `status=SENT|APPROVED|REJECTED` dan `issuedAt` tidak null, copy `issuedAt` ke timestamp yang sesuai dengan status saat ini.
- Aman dijalankan saat live (additive only, nullable).

## 6. API Contract

### 6.1 `POST /api/companies/[companyId]/quotations`

Create quotation pertama (rev 1) untuk sebuah lead.

**Body**:
```ts
{
  leadId: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  status?: "DRAFT" | "SENT" | "APPROVED" | "REJECTED"; // default DRAFT
  reviveLead?: boolean; // default false
}
```

**Behavior**:
1. Validasi akses user terhadap company & lead.
2. Cek `lead.stage`:
   - `LOST` + `reviveLead=false` → `409 LEAD_LOST_REQUIRES_REVIVE`.
   - `LOST` + `reviveLead=true` → cari kolom "Negotiation"; ada → pindahkan lead; tidak ada → `400 NEGOTIATION_COLUMN_NOT_FOUND`.
3. Generate `quotationNumber` (auto).
4. Insert quotation (revisionNumber=1) + lines dalam single Prisma transaction.
5. Kalau `status === "APPROVED"` pada body, **lakukan juga lead-sync** seperti di PATCH (lihat 6.3). Ini cover skenario "skip-send, langsung approve di create".

**Response**: `{ ok: true, data: <quotation>, warnings?: [...] }` atau `{ ok: false, error: { code, message, details? } }`.

### 6.2 `POST /api/companies/[companyId]/quotations/[quotationId]`

Create **revisi baru** dari quotation existing (rev N+1).

**Body**:
```ts
{
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  status?: "DRAFT" | "SENT" | "APPROVED" | "REJECTED"; // default DRAFT
  reviveLead?: boolean; // default false
}
```

**Behavior**:
1. Cek source quotation exists, leadId match.
2. Cek `lead.stage === "LOST"` → guard sama seperti 6.1.
3. Cari max `revisionNumber` untuk `(companyId, leadId, quotationNumber)`, +1.
4. Insert revisi baru + lines dalam transaction.
5. Kalau `status === "APPROVED"` di body → lead-sync (sama seperti 6.3).

### 6.3 `PATCH /api/companies/[companyId]/quotations/[quotationId]` — NEW

Update **status saja** pada quotation existing. Trigger utama lead-sync.

**Body**:
```ts
{
  status: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
}
```

Body field lain (mis. `lines`) → `400 STATUS_ONLY`.

**Behavior**:
1. Cek quotation exists, access OK.
2. Cek apakah ini revisi terbaru untuk `(leadId, quotationNumber)`. Bukan → `409 NOT_LATEST_REVISION`.
3. Kalau `status === current.status` → no-op, return 200 dengan data current.
4. Update `status` field; set timestamp yang sesuai (`sentAt`/`approvedAt`/`rejectedAt`) hanya jika sebelumnya `NULL` (first transition).
5. Kalau `status === "APPROVED"` dan `lead.stage !== "WON"`:
   - Cari kolom dengan title (case-insensitive) "won" di board lead.
   - Found → `lead.columnId = wonColumn.id`, `lead.wonAt = now()`. `stage` ikut karena derived.
   - Not found → skip pindah, push `{ code: "WON_COLUMN_MISSING" }` ke `warnings`.
6. Semua dalam single Prisma transaction.

**Response**: `{ ok: true, data: <quotation>, warnings?: [...] }`.

### 6.4 Error response shape (konsisten)

```ts
{
  ok: false,
  error: {
    code: string,                 // e.g. "LEAD_LOST_REQUIRES_REVIVE"
    message: string,              // human-readable
    details?: Record<string, unknown>
  }
}
```

Sukses dengan warning:

```ts
{
  ok: true,
  data: { /* quotation */ },
  warnings: [{ code: "WON_COLUMN_MISSING", message: "..." }]
}
```

## 7. UI Changes

### 7.1 Quotation detail page

- **Status dropdown** di header revisi terbaru:
  - Pakai `<select>` controlled state.
  - User pilih → tombol "Update status" jadi enabled (explicit save, bukan auto-save).
  - Klik "Update status" pada transisi APPROVED → tampilkan modal konfirmasi (lihat 7.3).
  - Transisi lain langsung kirim PATCH tanpa modal.
- **Tombol "Create revision"** terpisah → buka Sheet (reuse `QuotationEditorSheet`) untuk edit lines → submit POST `/quotations/[id]`.
- **Revisi lama (bukan terbaru)**: status dropdown disabled, button "Create revision" disabled. Banner di atas: "Viewing historical revision. Open latest to make changes."

### 7.2 Quotations list page

- Tambah small badge stage lead di card existing series ("WON", "LOST", dll).
- Indicator status APPROVED lebih prominent (mis. badge hijau).

### 7.3 Modal: Approve quotation

Satu varian modal saja (tidak proactive cek kolom Won). Jika kolom tidak ada, ditangani via toast warning post-hoc dari response `warnings`.

Konten:
> **Approve quotation?**
> Approving Q-001 rev 2 will mark lead "ITEKRAFT" as Won and move it to the "Won" column.
>
> [Cancel] [Approve]

### 7.4 Modal: Create quotation on LOST lead

Konten:
> **Lead is marked Lost**
> This lead was previously marked as Lost. Creating a new quotation will move it back to "Negotiation".
>
> [Cancel] [Revive & continue]

Klik Revive → buka `QuotationEditorSheet`; saat submit kirim POST dengan `reviveLead=true`.

### 7.5 Toast / feedback

| Aksi | Toast |
|---|---|
| Approve sukses, lead pindah | "Quotation Q-001 rev 2 approved. Lead moved to Won." |
| Approve sukses, warning WON_COLUMN_MISSING | "Quotation approved." + warning "Lead not auto-moved — column 'Won' missing." |
| Status non-approve update | "Status updated to SENT." |
| Revive sukses | "Lead revived to Negotiation." |
| Error generic | dari `error.message` di API |

## 8. Data Flow Summary

```
Flow 1 — First quotation
  FE: POST /quotations { leadId, lines, status: "DRAFT" }
  → Service: lead access check → LOST guard → insert quotation rev 1
  → (if status=APPROVED) lead-sync

Flow 2 — New revision
  FE: POST /quotations/[id] { lines, status: "DRAFT" }
  → Service: source check → LOST guard → insert rev N+1
  → (if status=APPROVED) lead-sync

Flow 3 — Status update (primary trigger)
  FE: PATCH /quotations/[id] { status: "APPROVED" }
  → Service: latest-revision check → update status + timestamp
  → (if APPROVED) lead-sync: find "Won" column, move lead, set wonAt

Flow 4 — Lead manual move
  → No quotation side-effect.
```

## 9. Edge Cases

| # | Skenario | Behavior |
|---|---|---|
| 1 | Approve, kolom "Won" tidak ada | Approve sukses, lead stay, warning toast |
| 2 | Revive LOST, kolom "Negotiation" tidak ada | 400 + modal pilih kolom tujuan manual |
| 3 | Approve quotation, lead sudah WON | No-op untuk lead. Tidak override `wonAt`. Status quotation tetap diupdate. |
| 4 | Approve revisi non-latest | 409 NOT_LATEST_REVISION |
| 5 | PATCH status sama dengan current | No-op, return 200 |
| 6 | Race: approve concurrent dengan drag lead | Last-write-wins, accept inkonsistensi rare |
| 7 | Lead di-delete saat quotation aktif | Cascade existing — no change |
| 8 | Akses revisi lama | Read-only di UI, status dropdown disabled |
| 9 | Transisi DRAFT → REJECTED langsung | Allowed (permissive), set `rejectedAt` |
| 10 | Revisi baru di lead WON | Allowed, status DRAFT, lead tetap WON |

## 10. Migration Plan (Deploy Order)

1. **DB migration**: tambah kolom `sentAt`, `approvedAt`, `rejectedAt` nullable. Backfill dari `issuedAt` + status existing.
2. **Service layer**: tambah `updateQuotationStatus()` di [src/lib/company-quotation-service.ts](../../../src/lib/company-quotation-service.ts). Tambah lead-sync helper (cari kolom Won, pindahkan lead).
3. **API routes**: tambah `PATCH` handler di [src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts](../../../src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts). Tambah handling `reviveLead` flag di POST handler(s).
4. **FE**: refactor status dropdown jadi controlled + explicit save button. Tambah modal konfirmasi APPROVED & modal revive LOST. Tambah lead stage badge di list.
5. **Smoke test manual**: end-to-end create → send → approve flow, revive lost lead flow, kolom Won missing scenario.

Tidak ada feature flag — perubahan berlaku langsung saat deploy.

## 11. Testing Strategy

Codebase belum punya test infrastructure terstruktur. Coverage minimum yang ditargetkan saat planning:

- **Unit (service layer)**: matrix transisi status (DRAFT→SENT, SENT→APPROVED, APPROVED→APPROVED, dst), sync ke lead saat APPROVED dengan kolom Won ada/tidak, guard lead LOST dengan/tanpa reviveLead.
- **Integration (API route)**: POST pada lead LOST → 409; POST + reviveLead → lead pindah; PATCH APPROVED → lead WON; PATCH pada non-latest → 409.
- **Manual smoke test**: flow lengkap dari create sampai approve, plus skenario revive.

Pemilihan framework (vitest, jest, dll.) di-defer ke fase planning.

## 12. Open Questions

- Tidak ada open question per persetujuan brainstorming. Semua keputusan utama sudah diambil.

## 13. References

- Source-of-truth stage derivation: [src/lib/company-lead-service.ts:65-81](../../../src/lib/company-lead-service.ts)
- Current quotation service: [src/lib/company-quotation-service.ts](../../../src/lib/company-quotation-service.ts)
- Schema: [prisma/schema.prisma](../../../prisma/schema.prisma) lines 226-287
- Existing UI:
  - [src/components/company/quotation-editor.tsx](../../../src/components/company/quotation-editor.tsx)
  - [src/components/company/quotation-editor-sheet.tsx](../../../src/components/company/quotation-editor-sheet.tsx)
  - [src/app/company/[companyId]/quotations/page.tsx](../../../src/app/company/[companyId]/quotations/page.tsx)
