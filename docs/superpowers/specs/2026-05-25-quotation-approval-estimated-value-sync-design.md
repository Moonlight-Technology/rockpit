# Quotation Approval Estimated Value Sync Design

**Date**: 2026-05-25
**Status**: Proposed
**Scope**: Company mode quotations and lead value metrics

## 1. Summary

Saat quotation di-approve, `lead.estimatedValue` harus disinkronkan ke `quotation.total` dari revision yang di-approve. Rule ini berlaku untuk semua jalur approval:

- create quotation baru dengan `status: "APPROVED"`
- create revision baru dengan `status: "APPROVED"`
- patch status revision terbaru menjadi `APPROVED`

Sync nilai lead diperlakukan sebagai side-effect approval yang terpisah dari perpindahan stage lead ke `WON`.

## 2. Problem

Saat ini codebase memakai dua sumber angka:

- `lead.estimatedValue` untuk metrik overview, leads page, dan project source lead
- `quotation.total` untuk halaman quotations

Akibatnya, setelah quotation direvisi dan disetujui, nilai yang tampil di area lead dan metrik tetap bisa tertinggal pada estimasi lama karena `estimatedValue` tidak ikut tersinkron.

## 3. Goals

- Menjadikan quotation approved sebagai sumber angka resmi untuk `lead.estimatedValue`.
- Memastikan semua jalur approval menerapkan sinkronisasi yang sama.
- Menjaga rule existing: demotion atau undo approval tidak otomatis mengembalikan nilai lama.

## 4. Non-goals

- Sync `estimatedValue` pada quotation `DRAFT`, `SENT`, atau `REJECTED`.
- Menyimpan histori nilai estimasi lama per approval.
- Recompute otomatis nilai lead saat approval dibatalkan.
- Menambahkan UI baru khusus untuk menunjukkan “synced from quotation”.

## 5. Behavioral Rules

- Jika quotation dibuat langsung sebagai `APPROVED`, setelah quotation tersimpan, update `lead.estimatedValue = quotation.total`.
- Jika revision baru dibuat langsung sebagai `APPROVED`, setelah revision tersimpan, update `lead.estimatedValue = quotation.total` revision baru.
- Jika status quotation revision terbaru diubah ke `APPROVED` via PATCH, update `lead.estimatedValue = quotation.total` revision itu.
- Jika quotation berubah dari `APPROVED` ke status lain, `lead.estimatedValue` tidak direvert.
- Jika approval juga memindahkan lead ke `WON`, kedua side-effect berjalan dalam transaction yang sama.
- Jika kolom `Won` tidak ditemukan, approval tetap sukses dan `lead.estimatedValue` tetap harus ter-update; hanya perpindahan stage yang menghasilkan warning.

## 6. Design

File utama: `src/lib/company-quotation-service.ts`

Tambahkan helper internal yang memusatkan side-effect approval lead, misalnya:

```ts
async function syncLeadForApprovedQuotation(input: {
  tx: Prisma.TransactionClient;
  leadId: string;
  total: number;
  now: Date;
  leadStage: CompanyLeadStage;
  boardColumns: Array<{ id: string; title: string }>;
}) {
  // update estimatedValue always
  // update stage/column/wonAt when possible
  // return warnings if Won column missing
}
```

Perilaku helper:

1. selalu update `estimatedValue` ke `total`
2. jika lead belum `WON`, coba pindah ke kolom `WON`
3. jika kolom `WON` tidak ada:
   - jangan rollback approval
   - jangan rollback `estimatedValue`
   - kembalikan warning `WON_COLUMN_MISSING`

Alasan memusatkan ke helper:

- menghindari tiga jalur approval punya perilaku berbeda
- menjaga future change tetap terpusat
- membuat test domain lebih mudah

## 7. Affected Read Paths

Tidak perlu ubah halaman overview atau leads karena keduanya sudah membaca `lead.estimatedValue`.

Efek yang otomatis ikut berubah:

- `openPipelineValue`
- `wonValueThisMonth`
- angka pipeline di cards/lead board
- source lead value di projects page

## 8. Testing

Tambahkan test domain/service untuk membuktikan:

- approval via create quotation menyinkronkan `estimatedValue`
- approval via create revision menyinkronkan `estimatedValue`
- approval via PATCH status menyinkronkan `estimatedValue`
- warning `WON_COLUMN_MISSING` tidak mencegah `estimatedValue` ikut update
- undo approval tidak merevert `estimatedValue`

## 9. Recommendation

Pisahkan side-effect approval menjadi:

- sync nilai lead: wajib
- sync stage ke `WON`: best effort dengan warning

Itu memberi perilaku yang paling stabil untuk data bisnis: angka deal mengikuti quotation yang disetujui, tanpa tergantung pada konfigurasi board yang kebetulan lengkap atau tidak.
