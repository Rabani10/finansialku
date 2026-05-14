# 💚 FinansialKu — Panduan Setup Lengkap

Aplikasi pencatatan keuangan pribadi yang tersinkron otomatis dengan Google Spreadsheet.  
**Tidak perlu coding. Ikuti langkah-langkah di bawah.**

---

## 📋 Daftar Isi

1. [Persiapan Awal](#1-persiapan-awal)
2. [Setup Google Spreadsheet](#2-setup-google-spreadsheet)
3. [Setup Google Apps Script](#3-setup-google-apps-script)
4. [Deploy Web App (API)](#4-deploy-web-app-api)
5. [Upload ke GitHub Pages](#5-upload-ke-github-pages)
6. [Hubungkan Aplikasi ke Spreadsheet](#6-hubungkan-aplikasi-ke-spreadsheet)
7. [Cara Pakai di HP](#7-cara-pakai-di-hp)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Persiapan Awal

Yang Anda butuhkan:
- ✅ Akun Google (Gmail)
- ✅ Akun GitHub (gratis, untuk hosting)
- ✅ HP Android atau iPhone
- ✅ File-file dari folder ini

**Estimasi waktu setup: 15–20 menit**

---

## 2. Setup Google Spreadsheet

1. Buka [Google Drive](https://drive.google.com)
2. Klik **+ Baru → Google Spreadsheet**
3. Beri nama: **"FinansialKu — [Nama Anda]"**
4. Catat **ID Spreadsheet** dari URL browser:
   ```
   https://docs.google.com/spreadsheets/d/[ID_INI_YANG_DICATAT]/edit
   ```
   Contoh ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

5. Biarkan spreadsheet ini terbuka, kita akan kembali ke sini.

---

## 3. Setup Google Apps Script

1. Di Google Spreadsheet yang tadi dibuka, klik menu **Extensions → Apps Script**
2. Hapus semua kode yang ada di editor (kode default `function myFunction() {}`)
3. **Salin seluruh isi file `Code.gs`** dari folder ini
4. Tempel ke editor Apps Script
5. Klik ikon **💾 Save** (atau Ctrl+S)
6. Beri nama project: **"FinansialKu"** → klik OK
7. Jalankan fungsi `initSpreadsheet`:
   - Di dropdown fungsi (sebelah tombol ▶ Run), pilih **`initSpreadsheet`**
   - Klik **▶ Run**
   - Akan muncul popup izin → klik **Review Permissions**
   - Pilih akun Google Anda
   - Klik **Advanced → Go to FinansialKu (unsafe)** → klik **Allow**
   - Tunggu hingga muncul pesan sukses ✅

8. Kembali ke Spreadsheet — akan muncul 4 sheet baru:
   - **Transaksi** — tempat semua data tersimpan
   - **Kategori** — master kategori
   - **Ringkasan** — dashboard otomatis
   - **Log** — riwayat error

---

## 4. Deploy Web App (API)

Ini adalah langkah paling penting — membuat "pintu" antara aplikasi dan Spreadsheet.

1. Di Apps Script, klik tombol **Deploy → New deployment**
2. Klik ikon ⚙️ di sebelah "Select type" → pilih **Web app**
3. Isi konfigurasi:
   | Setting | Pilihan |
   |---|---|
   | Description | FinansialKu API v1 |
   | Execute as | **Me** (akun Anda) |
   | Who has access | **Anyone** |
4. Klik **Deploy**
5. Izinkan akses jika diminta
6. **SALIN URL Web App** yang muncul → simpan di notepad

   URL terlihat seperti:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXXXXX/exec
   ```
   
   ⚠️ **URL ini sangat penting — simpan baik-baik!**

7. Klik **Done**

### Test API (opsional)
Buka URL berikut di browser untuk test:
```
[URL_WEB_APP_ANDA]?action=getDashboard
```
Jika berhasil, akan tampil teks JSON. ✅

---

## 5. Upload ke GitHub Pages

GitHub Pages adalah layanan hosting gratis dari GitHub.

### Buat Akun GitHub (jika belum punya)
1. Buka [github.com](https://github.com)
2. Klik **Sign up** → ikuti instruksi
3. Verifikasi email

### Upload File Aplikasi
1. Login ke GitHub → klik **+ New repository**
2. Nama repository: `finansialku`
3. Pilih **Public**
4. Centang **Add a README file**
5. Klik **Create repository**

6. Klik **uploading an existing file** (atau drag & drop)
7. Upload file-file berikut dari folder ini:
   - `index.html`
   - `style.css`
   - `app.js`
   - `config.js`
8. Klik **Commit changes**

### Aktifkan GitHub Pages
1. Di repository, klik tab **Settings**
2. Scroll ke bawah → klik **Pages** (di sidebar kiri)
3. Di "Branch", pilih **main** → klik **Save**
4. Tunggu 1–2 menit
5. URL aplikasi Anda akan muncul:
   ```
   https://[username-github].github.io/finansialku/
   ```

---

## 6. Hubungkan Aplikasi ke Spreadsheet

1. Buka URL aplikasi di HP: `https://[username].github.io/finansialku/`
2. Aplikasi akan minta konfigurasi → atau buka menu **⚙️ Pengaturan**
3. Tap **URL Web App**
4. Tempel URL dari langkah 4 (yang diawali `https://script.google.com/...`)
5. Tap **Simpan**
6. Aplikasi akan otomatis terhubung dan memuat data ✅

---

## 7. Cara Pakai di HP

### Install sebagai Aplikasi (PWA)
**Android (Chrome):**
1. Buka URL di Chrome
2. Tap menu ⋮ → **Add to Home screen**
3. Tap **Add**
4. Ikon FinansialKu muncul di layar utama 📱

**iPhone (Safari):**
1. Buka URL di Safari
2. Tap ikon Share (kotak dengan panah ke atas)
3. Scroll → tap **Add to Home Screen**
4. Tap **Add**

### Cara Catat Transaksi
1. Tap tombol **+** (hijau, di tengah bawah)
2. Pilih jenis: **Pemasukan** atau **Pengeluaran**
3. Isi nominal, tanggal, kategori
4. Tap **Simpan ke Spreadsheet**
5. Data langsung masuk ke Google Sheets ✅

### Lihat di Google Sheets
- Buka [Google Sheets](https://sheets.google.com)
- Buka spreadsheet **"FinansialKu"**
- Sheet **Transaksi** berisi semua data
- Sheet **Ringkasan** berisi ringkasan otomatis

---

## 8. Troubleshooting

### ❌ "URL Web App belum diatur"
→ Buka Pengaturan → URL Web App → tempel URL dari Apps Script

### ❌ "Gagal memuat data"
Kemungkinan penyebab:
- URL Web App salah → pastikan URL diawali `https://script.google.com/macros/s/`
- Perlu re-deploy → di Apps Script, klik Deploy → New deployment (buat baru)
- Akses `Who has access` belum diset ke **Anyone**

### ❌ Data tidak muncul setelah simpan
→ Tunggu 3–5 detik dan refresh (tarik layar ke bawah)
→ Cek sheet "Transaksi" di Google Sheets, apakah data sudah masuk

### ❌ "initSpreadsheet gagal / error izin"
→ Coba lagi, pastikan pilih **Allow** di semua popup izin

### ❌ Spreadsheet tidak terbentuk otomatis
→ Di Apps Script, pastikan kode sudah tersimpan
→ Jalankan `initSpreadsheet` lagi dari dropdown fungsi

### 🔄 Update Aplikasi
Jika ada update, ganti file di GitHub:
1. Buka repository GitHub Anda
2. Klik nama file yang ingin diupdate
3. Klik ikon ✏️ Edit → paste konten baru → Commit changes

---

## 📞 Struktur File

```
finansialku/
├── index.html      ← Tampilan aplikasi (HTML)
├── style.css       ← Desain & warna (CSS)
├── app.js          ← Logika aplikasi (JavaScript)
├── config.js       ← Konfigurasi & kategori
├── gas/
│   └── Code.gs     ← Script Google Sheets (pasang di Apps Script)
└── README.md       ← Panduan ini
```

---

## 🔒 Keamanan

- URL Web App bersifat publik — siapa pun dengan URL bisa akses API
- Untuk keamanan lebih, tambahkan parameter `token` di Code.gs (fitur lanjutan)
- Data tersimpan di Google Sheets pribadi Anda — aman di akun Google Anda
- Tidak ada data yang tersimpan di server pihak ketiga

---

## 🚀 Fitur yang Bisa Ditambah di Masa Depan

| Fitur | Cara |
|---|---|
| Budgeting | Tambah sheet "Budget" di Spreadsheet |
| Recurring transaction | Jadwalkan dengan Apps Script Triggers |
| Export PDF | Gunakan Apps Script `DriveApp` |
| Target tabungan | Tambah sheet "Goals" |
| Reminder tagihan | Gunakan `MailApp.sendEmail()` di Apps Script |
| Backup otomatis | Apps Script Time-based trigger harian |

---

*FinansialKu v1.0.0 — Dibuat untuk pencatatan keuangan pribadi yang simpel dan tersinkron.*
