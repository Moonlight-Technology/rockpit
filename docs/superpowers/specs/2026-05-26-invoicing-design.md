# Invoicing Feature Design

**Date**: 2026-05-26
**Status**: Proposed
**Scope**: Company mode invoicing from approved quotations

## 1. Summary

Tambahkan domain invoicing di company mode untuk menagih deal yang sudah disetujui. Invoice hanya boleh dibuat dari quotation dengan status `APPROVED`. Satu quotation boleh menghasilkan banyak invoice, dan setiap invoice menyimpan snapshot line item serta totalnya sendiri.

Untuk MVP:

- invoice dibuat dari quotation detail
- invoice dikelola di halaman `Invoices` terpisah
- line item awal disalin dari quotation lalu boleh diedit sebelum save
- total seluruh invoice aktif untuk satu quotation tidak boleh melebihi total quotation
- status invoice: `DRAFT`, `SENT`, `PAID`, `CANCELLED`
- status `PAID` di-set manual, belum terhubung ke money manager

## 2. Problem

Saat ini alur company mode berhenti di `lead` dan `quotation`. Setelah quotation disetujui, belum ada entitas penagihan yang:

- merepresentasikan tagihan aktual ke klien
- mendukung termin atau beberapa invoice dari satu deal
- menjaga agar akumulasi tagihan tidak melebihi nilai quotation yang disetujui
- memberi workspace operasional terpisah untuk status penagihan

Akibatnya, proses setelah deal masih harus dicatat di luar sistem atau dicampur secara manual di area quotation.

## 3. Goals

1. Menambahkan invoice sebagai entitas penagihan turunan dari approved quotation.
2. Mendukung satu quotation menghasilkan banyak invoice.
3. Menyimpan snapshot invoice yang mandiri dari perubahan quotation setelah invoice dibuat.
4. Menjaga guard agar total invoice aktif tidak melebihi total quotation sumber.
5. Menyediakan halaman invoice terpisah untuk listing, detail, dan update status.

## 4. Non-goals

- Partial payment atau beberapa pembayaran per invoice.
- Sinkronisasi otomatis dengan company money manager.
- Due date, tax, atau fee tambahan di invoice.
- Revision system untuk invoice.
- Pembuatan invoice manual tanpa quotation.
- Project menjadi source of truth billing.

## 5. Recommended Approach

Pendekatan yang dipilih adalah **quotation-centric invoicing**.

Artinya:

- quotation `APPROVED` menjadi satu-satunya sumber pembuatan invoice
- invoice menyimpan `quotationId` sebagai relasi utama
- invoice boleh banyak per quotation untuk mendukung DP, termin, atau pelunasan
- project, jika ada, hanya menjadi konteks turunan dari lead/project conversion, bukan sumber aturan billing

Alasan pendekatan ini:

- paling sesuai dengan flow sales yang sudah ada
- menjaga nominal invoice tetap punya sumber yang jelas
- membuat rule overbilling sederhana dan dapat ditegakkan di server
- scope MVP tetap kecil dan tidak memaksa domain project atau money manager ikut berubah

## 6. Domain Boundaries

- `Quotation` tetap menjadi sumber deal, angka referensi, dan plafon billing.
- `Invoice` menjadi sumber status penagihan aktual.
- `Lead` tetap dipakai sebagai konteks CRM dan query pendukung.
- `Money manager` tidak ikut menentukan status invoice di MVP.
- `Project` tidak menjadi pusat alur invoice di versi ini.

Implikasinya, invoicing perlu service dan endpoint sendiri. Perilaku invoice tidak boleh ditumpuk sebagai variasi status di quotation.

## 7. Data Model

### 7.1 `CompanyInvoice`

Tambahkan model baru:

```prisma
model CompanyInvoice {
  id              String               @id @default(cuid())
  companyId       String
  quotationId     String
  leadId          String
  createdByUserId String
  invoiceNumber   String
  status          CompanyInvoiceStatus @default(DRAFT)
  subtotal        Int
  total           Int
  notes           String               @default("")
  issuedAt        DateTime?
  paidAt          DateTime?
  cancelledAt     DateTime?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  company         Company              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  quotation       CompanyQuotation     @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  lead            CompanyLead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  createdBy       User                 @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  lines           CompanyInvoiceLine[]

  @@index([companyId, createdAt])
  @@index([quotationId, status])
  @@unique([companyId, invoiceNumber])
}
```

### 7.2 `CompanyInvoiceLine`

```prisma
model CompanyInvoiceLine {
  id          String         @id @default(cuid())
  invoiceId   String
  description String
  quantity    Int
  unitPrice   Int
  position    Int

  invoice     CompanyInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId, position])
}
```

### 7.3 Enum

```prisma
enum CompanyInvoiceStatus {
  DRAFT
  SENT
  PAID
  CANCELLED
}
```

### 7.4 Notes

- `leadId` disimpan langsung di invoice untuk mempermudah query list dan menjaga stabilitas bila nanti query detail quotation berubah.
- Invoice menyimpan `subtotal` dan `total` sebagai snapshot. Nilai ini tidak dihitung ulang dari quotation setelah invoice tersimpan.
- `issuedAt` diisi saat pertama kali invoice menjadi `SENT`.
- `paidAt` diisi saat pertama kali invoice menjadi `PAID`.
- `cancelledAt` diisi saat pertama kali invoice menjadi `CANCELLED`.

## 8. Business Rules

### 8.1 Creation Rules

- Invoice hanya boleh dibuat dari quotation dengan status `APPROVED`.
- Satu quotation boleh punya banyak invoice.
- Line item invoice awalnya disalin dari quotation sumber, lalu user boleh mengedit sebelum save.
- Invoice baru menghitung `subtotal` dan `total` dari line item yang dikirim saat create, bukan memaksa total quotation penuh.

### 8.2 Billing Ceiling

- Total seluruh invoice **aktif** dari satu quotation tidak boleh melebihi `quotation.total`.
- Invoice aktif yang dihitung ke plafon: `DRAFT`, `SENT`, `PAID`.
- Invoice `CANCELLED` tidak dihitung ke plafon.
- Validasi plafon dilakukan di server dalam transaction create invoice.

Contoh:

- quotation total = 10.000.000
- invoice A `SENT` total 3.000.000
- invoice B `DRAFT` total 2.000.000
- invoice C baru maksimal hanya boleh 5.000.000

### 8.3 Status Rules

Transisi valid untuk MVP:

- `DRAFT -> SENT`
- `DRAFT -> CANCELLED`
- `SENT -> PAID`
- `SENT -> CANCELLED`

Transisi yang tidak diizinkan:

- `PAID -> *`
- `CANCELLED -> *`
- `DRAFT -> PAID`
- `PAID -> DRAFT`
- `CANCELLED -> DRAFT`

Alasan:

- `PAID` dan `CANCELLED` diperlakukan sebagai final state
- histori tetap sederhana
- menghindari kebutuhan audit atau rollback pembayaran di MVP

### 8.4 Editability

- MVP tidak menyediakan endpoint edit konten invoice setelah create.
- Jika isi invoice salah, user membatalkan invoice lalu membuat invoice baru.
- Status update dipisahkan dari create, dan hanya mengubah status serta timestamp terkait.

## 9. Numbering

Invoice perlu nomor sendiri, terpisah dari quotation number. Rekomendasi format:

`{companyPrefix}/INV/{yyyy/MM}/{sequence}`

Contoh:

`ITEK/INV/2026/05/001`

Pendekatannya mengikuti pola quotation numbering yang sudah ada agar implementasi konsisten dan mudah dipahami.

## 10. API Design

### 10.1 `GET /api/companies/[companyId]/invoices`

Mengembalikan daftar invoice untuk company.

Minimal data list:

- `id`
- `invoiceNumber`
- `status`
- `total`
- `issuedAt`
- `paidAt`
- `createdAt`
- summary lead
- summary quotation source

### 10.2 `POST /api/companies/[companyId]/invoices`

Create invoice baru dari approved quotation.

Body:

```ts
{
  quotationId: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes?: string;
}
```

Behavior:

1. Validasi akses user terhadap company.
2. Pastikan quotation milik company dan status-nya `APPROVED`.
3. Hitung subtotal dan total invoice dari body.
4. Ambil total invoice aktif existing untuk quotation tersebut.
5. Jika total existing + invoice baru > quotation total, tolak request.
6. Generate `invoiceNumber`.
7. Simpan invoice + lines dalam single transaction.

### 10.3 `GET /api/companies/[companyId]/invoices/[invoiceId]`

Mengembalikan detail invoice dan line items snapshot.

### 10.4 `PATCH /api/companies/[companyId]/invoices/[invoiceId]`

Update status invoice saja.

Body:

```ts
{
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED";
}
```

Behavior:

1. Validasi invoice milik company.
2. Validasi transisi status.
3. Set timestamp terkait hanya pada transisi pertama ke status final/issued.
4. Return data invoice terbaru.

## 11. Error Contract

Gunakan bentuk error konsisten seperti domain company lain:

```ts
{
  ok: false,
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

Error codes minimum:

- `QUOTATION_NOT_APPROVED`
- `INVOICE_TOTAL_EXCEEDS_QUOTATION`
- `INVALID_STATUS_TRANSITION`
- `NOT_FOUND`
- `FORBIDDEN`

## 12. UI Flow

### 12.1 Quotation Detail

- Jika quotation latest status `APPROVED`, tampilkan tombol `Create invoice`.
- Tombol membuka invoice editor sheet/dialog.
- Form invoice terisi line items dari quotation terbaru yang approved.
- User boleh mengubah description, quantity, dan unit price sebelum submit.
- Submit memanggil `POST /invoices`.

### 12.2 Invoice List Page

Tambahkan halaman baru:

`/company/[companyId]/invoices`

Isi list minimal:

- invoice number
- prospect/client
- source quotation number
- total
- status
- tanggal create / issue / paid

Halaman ini menjadi workspace utama untuk monitoring tagihan.

### 12.3 Invoice Detail Page

Tambahkan halaman detail invoice untuk melihat:

- header invoice
- snapshot quotation source
- lead/prospect context
- line items
- notes
- tombol update status yang valid

### 12.4 Company Navigation

Tambahkan item nav `Invoices` di company mode agar area penagihan tidak tersembunyi di halaman quotation.

## 13. Service Design

File utama yang kemungkinan perlu ditambahkan:

- `src/lib/company-invoice-service.ts`
- validator invoice baru di `src/lib/validators/company-invoice.ts`

Tanggung jawab service:

- generate invoice number
- create invoice from quotation
- enforce billing ceiling
- list invoice data
- fetch invoice detail
- validate status transition

Pemisahan ini menjaga service quotation tetap fokus pada quotation lifecycle.

## 14. Testing

Test service/domain minimum:

1. Create invoice dari approved quotation berhasil dan menyalin line items.
2. Create invoice dari quotation non-approved ditolak.
3. Create beberapa invoice sampai total quotation terpenuhi, lalu create berikutnya ditolak.
4. Invoice `CANCELLED` tidak ikut dihitung ke plafon.
5. Transisi `DRAFT -> SENT` mengisi `issuedAt`.
6. Transisi `SENT -> PAID` mengisi `paidAt`.
7. Transisi `DRAFT -> CANCELLED` atau `SENT -> CANCELLED` mengisi `cancelledAt`.
8. Transisi invalid seperti `PAID -> DRAFT` ditolak.

UI/API tests minimum:

- quotation approved menampilkan CTA create invoice
- halaman invoices menampilkan data invoice yang dibuat
- detail invoice menampilkan snapshot lines dan status action yang sesuai

## 15. Rollout Notes

Urutan implementasi yang disarankan:

1. schema + migration
2. service + validator + API
3. quotation detail CTA + invoice create flow
4. invoices list/detail pages
5. tests

Scope ini masih cukup terfokus untuk satu implementation plan karena seluruh perilaku tetap berada di domain invoicing dan tidak menarik integrasi money manager atau project workflow.
