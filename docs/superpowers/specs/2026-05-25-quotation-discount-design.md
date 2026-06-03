# Quotation Discount Design

**Date**: 2026-05-25
**Status**: Proposed
**Scope**: Company mode quotations

## 1. Summary

Tambahkan discount global pada quotation di company mode. Discount berlaku untuk seluruh quotation, bukan per line item, dan user dapat memilih dua mode input:

- nominal tetap dalam rupiah
- persentase dari subtotal

Total akhir quotation dihitung sebagai:

`total = max(subtotal - discountAmount, 0)`

`subtotal` tetap berasal dari penjumlahan seluruh `lineTotal`. `discountAmount` adalah nominal rupiah yang sudah dihitung dan disimpan pada revision quotation saat save.

## 2. Goals

- Menambahkan discount global yang bisa dipilih user sebagai `Rp` atau `%`.
- Menjaga histori revision quotation tetap immutable dan mudah dibaca ulang.
- Menampilkan breakdown `subtotal`, `discount`, dan `total` di editor dan halaman detail quotation.
- Membuat revision baru mewarisi konfigurasi discount dari revision sebelumnya.

## 3. Non-goals

- Discount per line item.
- Pajak, service fee, atau komponen biaya tambahan lain.
- Multi-discount atau stacking discount.
- Rule approval khusus berdasarkan besar discount.
- Format discount bertingkat seperti `10% + Rp100.000`.

## 4. Product Rules

- Discount berlaku di level quotation, setelah subtotal semua line dihitung.
- User memilih tepat satu tipe discount:
  - `FIXED`: input rupiah
  - `PERCENTAGE`: input persen
- `FIXED` menerima integer `>= 0`.
- `PERCENTAGE` menerima angka `>= 0` dan `<= 100`.
- `discountAmount` selalu disimpan sebagai nominal rupiah hasil kalkulasi final.
- Jika discount lebih besar dari subtotal, `discountAmount` di-clamp ke subtotal sehingga `total = 0`.
- Jika subtotal `0`, total tetap `0`.
- Revision baru mewarisi `discountType` dan `discountValue` dari revision sebelumnya, lalu `discountAmount` dihitung ulang dari line items revision baru.

## 5. Data Model

File: `prisma/schema.prisma`

Tambahkan enum baru:

```prisma
enum CompanyQuotationDiscountType {
  FIXED
  PERCENTAGE
}
```

Tambahkan field baru ke `model CompanyQuotation`:

```prisma
model CompanyQuotation {
  // existing fields
  subtotal        Int
  discountType    CompanyQuotationDiscountType @default(FIXED)
  discountValue   Int                         @default(0)
  discountAmount  Int                         @default(0)
  total           Int
  // existing fields
}
```

Alasan penyimpanan:

- `discountType` menyimpan mode pilihan user.
- `discountValue` menyimpan intent mentah user:
  - `FIXED` => nominal rupiah
  - `PERCENTAGE` => angka persen bulat
- `discountAmount` menyimpan nominal efektif yang dipakai revision itu.

Pendekatan ini menjaga dokumen lama tetap stabil walaupun subtotal revision lain berubah atau aturan render berubah di masa depan.

## 6. Calculation Rules

Tambahkan helper kalkulasi di domain quotation, misalnya:

```ts
type DiscountType = "FIXED" | "PERCENTAGE";

function calculateQuotationDiscount(input: {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
}) {
  // returns { discountAmount, total }
}
```

Aturan:

- `subtotal = sum(line.quantity * line.unitPrice)`
- `FIXED`:
  - `discountAmount = min(discountValue, subtotal)`
- `PERCENTAGE`:
  - `raw = floor((subtotal * discountValue) / 100)`
  - `discountAmount = min(raw, subtotal)`
- `total = max(subtotal - discountAmount, 0)`

Catatan:

- Gunakan integer penuh untuk menghindari pecahan rupiah.
- Untuk `%`, pembulatan ke bawah (`floor`) menjaga hasil tetap deterministic.

## 7. API Contract

File yang terdampak:

- `src/lib/validators/company-quotation.ts`
- `src/app/api/companies/[companyId]/quotations/route.ts`
- `src/app/api/companies/[companyId]/quotations/[quotationId]/route.ts`
- `src/lib/company-quotation-service.ts`

### 7.1 Create quotation

Payload `POST /api/companies/[companyId]/quotations` ditambah:

```ts
{
  leadId: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  status?: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  reviveLead?: boolean;
  discountType?: "FIXED" | "PERCENTAGE";
  discountValue?: number;
}
```

Default:

- `discountType = "FIXED"`
- `discountValue = 0`

### 7.2 Create revision

Payload `POST /api/companies/[companyId]/quotations/[quotationId]` juga menerima:

```ts
{
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  status?: "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
  reviveLead?: boolean;
  discountType?: "FIXED" | "PERCENTAGE";
  discountValue?: number;
}
```

### 7.3 Response shape

Payload quotation detail/list yang sudah dikembalikan service perlu menyertakan:

- `discountType`
- `discountValue`
- `discountAmount`

Tidak perlu endpoint baru.

## 8. Validation

Validator quotation diperluas:

```ts
const quotationDiscountTypeSchema = z.enum(["FIXED", "PERCENTAGE"]);
```

Rule validasi:

- `discountType` optional, default `FIXED`
- `discountValue` optional, default `0`
- jika `discountType === "FIXED"` maka `discountValue` harus integer `>= 0`
- jika `discountType === "PERCENTAGE"` maka `discountValue` harus integer `>= 0 && <= 100`

Validasi dilakukan di schema level atau `superRefine` supaya pasangan `discountType` + `discountValue` konsisten.

## 9. UI Changes

### 9.1 Quotation editor

File utama: `src/components/company/quotation-editor.tsx`

Tambahkan state baru:

- `discountType`
- `discountValue`

Tambahkan blok form di bawah daftar line item:

- kontrol select / toggle untuk tipe:
  - `Nominal (Rp)`
  - `Percentage (%)`
- input angka sesuai tipe
- helper text:
  - jika `%`, tampilkan nominal potongan hasil perhitungan
  - jika `Rp`, tampilkan langsung nilai potongannya

Ringkasan editor berubah menjadi:

- `Subtotal`
- `Discount`
- `Total`

Button submit mengirim `discountType` dan `discountValue` bersama `lines`.

### 9.2 Detail quotation page

File utama: `src/app/company/[companyId]/quotations/[quotationId]/page.tsx`

Bagian total di bawah tabel line items ditambah:

- `Subtotal`
- `Discount`
- `Total`

Untuk label discount:

- `FIXED` => mis. `Discount (Rp)`
- `PERCENTAGE` => mis. `Discount (10%)`

### 9.3 Revision creation flow

Saat membuka form “Create next revision”, editor mewarisi:

- `initialLines`
- `initialDiscountType`
- `initialDiscountValue`

Dengan begitu owner bisa mengubah harga line item tanpa mengisi ulang discount dari nol.

### 9.4 Quotation list page

List page tidak perlu breakdown penuh. Cukup tetap memakai `total` seperti sekarang. Tidak ada kebutuhan badge atau kolom baru khusus discount di v1.

## 10. Service Changes

File utama: `src/lib/company-quotation-service.ts`

Perubahan inti:

- ekstrak helper kalkulasi subtotal + discount + total
- saat create quotation pertama:
  - hitung `subtotal`
  - hitung `discountAmount`
  - simpan `discountType`, `discountValue`, `discountAmount`, `total`
- saat create revision:
  - lakukan perhitungan yang sama dari input revision baru
- semua include/select yang mengembalikan detail quotation ikut memuat field discount baru

Tidak ada perubahan perilaku status transition. Discount tidak memengaruhi logika lead sync atau approval flow.

## 11. Testing

### 11.1 Unit tests

Tambahkan test untuk helper kalkulasi:

- `FIXED` discount mengurangi subtotal sesuai nominal
- `FIXED` discount di atas subtotal di-clamp
- `PERCENTAGE` discount menghitung nominal dengan benar
- `PERCENTAGE` 100% menghasilkan total `0`
- subtotal `0` menghasilkan total `0`

Tambahkan validator tests:

- default discount adalah `FIXED` + `0`
- `%` di atas `100` ditolak
- nominal negatif ditolak

### 11.2 Integration/domain tests

Perluas `src/lib/company-quotation-service.test.ts` untuk memastikan data calculation helper stabil dan reusable.

Jika ada test untuk create payload parsing atau service create flow, tambahkan assertion bahwa:

- `discountAmount` tersimpan benar
- `total` memakai subtotal setelah discount
- revision baru bisa membawa discount type/value sendiri

### 11.3 Manual checks

1. Buat quotation baru tanpa discount: total harus sama dengan subtotal.
2. Buat quotation baru dengan discount `Rp500.000`.
3. Buat quotation baru dengan discount `10%`.
4. Masukkan nominal lebih besar dari subtotal: total harus `0`.
5. Buat revision dari quotation existing: discount lama muncul sebagai nilai awal.
6. Ubah line item di revision dengan `%` tetap: nominal discount dihitung ulang dari subtotal baru.

## 12. Rollout Notes

- Perubahan schema bersifat additive.
- Existing quotation lama perlu nilai default:
  - `discountType = FIXED`
  - `discountValue = 0`
  - `discountAmount = 0`
- UI lama tetap aman karena quotation tanpa discount akan terlihat seperti sebelumnya.

## 13. Recommendation

Gunakan model penyimpanan `discountType + discountValue + discountAmount`.

Ini memberi tiga keuntungan:

- intent user tetap terbaca
- angka final revision tetap immutable
- render list/detail tidak perlu menghitung ulang discount dari nol untuk memahami histori quotation
