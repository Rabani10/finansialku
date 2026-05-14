// ============================================================
//  FinansialKu — Konfigurasi Aplikasi
//  File: config.js
//
//  ⚠️  EDIT FILE INI SETELAH DEPLOY GOOGLE APPS SCRIPT
// ============================================================

const APP_CONFIG = {
  // ─── ISI INI DENGAN URL WEB APP ANDA ───────────────────────
  // Cara dapatkan URL: buka Apps Script → Deploy → Manage Deployments
  // Contoh: "https://script.google.com/macros/s/AKfycbx.../exec"
  GAS_URL: localStorage.getItem("fk_gas_url") || "",

  // ─── OPSIONAL: ID Spreadsheet (untuk tombol "Buka Sheets") ──
  // Ambil dari URL Spreadsheet: docs.google.com/spreadsheets/d/ID_DI_SINI/edit
  SPREADSHEET_ID: localStorage.getItem("fk_sheet_id") || "",

  // ─── Nama aplikasi & versi ──────────────────────────────────
  APP_NAME    : "FinansialKu",
  APP_VERSION : "1.0.0",

  // ─── Format mata uang ───────────────────────────────────────
  LOCALE   : "id-ID",
  CURRENCY : "IDR"
};

// ─── KATEGORI & SUBKATEGORI ─────────────────────────────────
const KATEGORI = {
  Pemasukan: {
    "Gaji"           : [],
    "Freelance"      : [],
    "Bonus"          : [],
    "Refund"         : [],
    "Pendapatan Lain": []
  },
  Pengeluaran: {
    "Makanan & Minuman" : [],
    "Belanja"           : ["Online", "Offline"],
    "Transportasi"      : ["BBM", "Ojol", "Service"],
    "Tagihan & Utilitas": ["Listrik", "Air", "Internet", "AI"],
    "Pulsa & Paket Data": [],
    "Kesehatan"         : ["RS", "Klinik", "Obat"],
    "Hiburan"           : ["Film", "Game", "Streaming", "Webtoon", "Spotify"],
    "Gaya Hidup"        : ["Nongkrong", "Hobi", "Salon", "Rokok"],
    "Pendidikan"        : [],
    "Donasi / Zakat"    : [],
    "Transfer Keluar"   : [],
    "Biaya Admin / Fee" : [],
    "Lainnya"           : []
  }
};

// ─── IKON PER KATEGORI ──────────────────────────────────────
const IKON_KATEGORI = {
  "Gaji"              : "ti-briefcase",
  "Freelance"         : "ti-device-laptop",
  "Bonus"             : "ti-gift",
  "Refund"            : "ti-corner-down-left",
  "Pendapatan Lain"   : "ti-coin",
  "Makanan & Minuman" : "ti-soup",
  "Belanja"           : "ti-shopping-bag",
  "Transportasi"      : "ti-motorbike",
  "Tagihan & Utilitas": "ti-bolt",
  "Pulsa & Paket Data": "ti-device-mobile",
  "Kesehatan"         : "ti-heart-rate-monitor",
  "Hiburan"           : "ti-device-tv",
  "Gaya Hidup"        : "ti-coffee",
  "Pendidikan"        : "ti-book",
  "Donasi / Zakat"    : "ti-hand-love",
  "Transfer Keluar"   : "ti-arrow-up-circle",
  "Biaya Admin / Fee" : "ti-building-bank",
  "Lainnya"           : "ti-dots-circle-horizontal"
};

// ─── WARNA CHART PER KATEGORI ───────────────────────────────
const WARNA_KATEGORI = [
  "#4caf82", "#ef9f27", "#f0997b", "#7f77dd",
  "#5dcaa5", "#d4537e", "#378add", "#ba7517"
];
