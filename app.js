// ============================================================
//  FinansialKu — Logika Aplikasi Utama
//  File: app.js
// ============================================================

// ─── STATE ──────────────────────────────────────────────────
let STATE = {
  jenisDipilih    : "Pemasukan",
  periodeDashboard: "bulan",
  allTransaksi    : [],
  filteredTx      : [],
  jenisFil        : "",
  dashboardData   : null,
  syncing         : false
};

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setTodayDate();
  populateKategori("Pemasukan");
  buildReportFilter();

  // Cek apakah sudah punya URL
  setTimeout(() => {
    hideSplash();
    if (!getGasUrl()) {
      showToast("⚙️ Atur URL Spreadsheet di Pengaturan dulu ya!", "warn", 4000);
      goTo("settings");
    } else {
      loadDashboard();
      loadTransaksi();
    }
  }, 1500);
});

function hideSplash() {
  const splash = document.getElementById("splash");
  splash.style.opacity = "0";
  splash.style.transition = "opacity .4s";
  setTimeout(() => {
    splash.style.display = "none";
    document.getElementById("app").style.display = "block";
  }, 400);
}

// ─── NAVIGASI ────────────────────────────────────────────────
function goTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  document.getElementById("page-" + page).classList.add("active");
  const navEl = document.getElementById("nav-" + page);
  if (navEl) navEl.classList.add("active");

  const fab = document.getElementById("fab");
  fab.style.display = page === "add" ? "none" : "flex";

  if (page === "transactions") loadTransaksi();
  if (page === "reports") loadReports();
  if (page === "home") loadDashboard();

  window.scrollTo(0, 0);
}

// ─── API HELPER ──────────────────────────────────────────────
function getGasUrl() {
  return APP_CONFIG.GAS_URL || localStorage.getItem("fk_gas_url") || "";
}

async function callAPI(action, params = {}) {
  const url = getGasUrl();
  if (!url) throw new Error("URL Web App belum diatur. Buka Pengaturan.");

  const qs = new URLSearchParams({ action, ...params });
  const fullUrl = url + "?" + qs.toString();

  const res = await fetch(fullUrl, {
    method: "GET",
    redirect: "follow"
  });

  if (!res.ok) throw new Error("HTTP error: " + res.status);
  const data = await res.json();
  if (data.status === "error") throw new Error(data.message);
  return data;
}

// Semua request pakai GET agar tidak kena blokir CORS Google Apps Script
async function postAPI(action, body = {}) {
  const url = getGasUrl();
  if (!url) throw new Error("URL Web App belum diatur. Buka Pengaturan.");

  // Encode data sebagai parameter GET — GAS tidak support POST dari browser (CORS)
  const params = { action, data: JSON.stringify(body) };
  const qs = new URLSearchParams(params);
  const fullUrl = url + "?" + qs.toString();

  const res = await fetch(fullUrl, { method: "GET", redirect: "follow" });

  if (!res.ok) throw new Error("HTTP error: " + res.status);
  const result = await res.json();
  if (result.status === "error") throw new Error(result.message);
  return result;
}

// ─── DASHBOARD ───────────────────────────────────────────────
async function loadDashboard() {
  if (STATE.syncing) return;
  STATE.syncing = true;
  setSyncStatus("Menyinkron...");

  try {
    const data = await callAPI("getDashboard");
    STATE.dashboardData = data;

    // Hero
    set("hero-saldo", fmtRp(data.saldo));
    set("hero-masuk", fmtRp(data.pemasukan_bulan));
    set("hero-keluar", fmtRp(data.pengeluaran_bulan));

    // Stat
    updateStatCards(data);

    // Chart tren
    renderBarChart(data.tren_bulanan || []);

    // Kategori
    renderKatList(data.per_kategori || [], "kat-list");

    // Transaksi terbaru (5)
    const txRes = await callAPI("getTransaksi", { limit: 5 });
    renderTxList(txRes.data || [], "home-tx-list", true);

    setSyncStatus("✓ Tersinkron " + fmtTime(new Date()));
  } catch (e) {
    setSyncStatus("⚠ Gagal sinkron");
    showToast("Gagal memuat data: " + e.message, "error");
  } finally {
    STATE.syncing = false;
  }
}

function updateStatCards(data) {
  // Dipanggil hanya saat pertama load dashboard (period = bulan)
  // Untuk ganti period, setPeriod() akan panggil loadDashboardPeriod() langsung
  set("stat-masuk", fmtRp(data.pemasukan_bulan));
  set("stat-keluar", fmtRp(data.pengeluaran_bulan));
  const cf = (data.pemasukan_bulan || 0) - (data.pengeluaran_bulan || 0);
  const cfEl = document.getElementById("stat-cashflow");
  if (cfEl) {
    cfEl.textContent = (cf >= 0 ? "+" : "") + fmtRp(cf);
    cfEl.style.color = cf >= 0 ? "#2d9b6a" : "#e05252";
  }
}

function renderBarChart(tren) {
  const el = document.getElementById("bar-chart");
  if (!el) return;
  if (!tren || tren.length === 0) {
    el.innerHTML = '<div class="chart-empty">Belum ada data tren</div>';
    return;
  }

  const maxVal = Math.max(...tren.map(t => Math.max(t.pemasukan, t.pengeluaran)), 1);
  const bulanNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

  el.innerHTML = tren.map(t => {
    const hp = Math.round((t.pemasukan / maxVal) * 80);
    const hk = Math.round((t.pengeluaran / maxVal) * 80);
    const bln = t.bulan ? bulanNames[parseInt(t.bulan.split("-")[1]) - 1] || t.bulan : "-";
    return `<div class="bar-col">
      <div class="bar-group">
        <div class="bar income-bar" style="height:${hp || 2}px" title="Pemasukan: ${fmtRp(t.pemasukan)}"></div>
        <div class="bar expense-bar" style="height:${hk || 2}px" title="Pengeluaran: ${fmtRp(t.pengeluaran)}"></div>
      </div>
      <div class="bar-label">${bln}</div>
    </div>`;
  }).join("");
}

function renderKatList(list, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = '<div class="empty-state-sm">Belum ada data</div>';
    return;
  }
  const total = list.reduce((s, k) => s + k.total, 0) || 1;
  el.innerHTML = list.slice(0, 5).map((k, i) => {
    const pct = Math.round((k.total / total) * 100);
    return `<div class="kat-row">
      <span class="kat-name">${k.nama}</span>
      <div class="kat-track"><div class="kat-fill" style="width:${pct}%;background:${WARNA_KATEGORI[i % WARNA_KATEGORI.length]}"></div></div>
      <span class="kat-pct">${pct}%</span>
    </div>`;
  }).join("");
}

// ─── TRANSAKSI LIST ──────────────────────────────────────────
async function loadTransaksi() {
  const el = document.getElementById("tx-list");
  if (!el) return;
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Memuat...</span></div>';

  try {
    const params = {};
    if (STATE.jenisFil) params.jenis = STATE.jenisFil;
    const res = await callAPI("getTransaksi", params);
    STATE.allTransaksi = res.data || [];
    STATE.filteredTx = STATE.allTransaksi;
    renderTxList(STATE.filteredTx, "tx-list", false);
  } catch (e) {
    el.innerHTML = `<div class="empty-state-sm">Gagal memuat: ${e.message}</div>`;
  }
}

function renderTxList(list, targetId, mini = false) {
  const el = document.getElementById(targetId);
  if (!el) return;

  if (!list || list.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="ti ti-notes-off"></i><div class="empty-title">Belum ada transaksi</div><div class="empty-sub">Tap tombol + untuk mencatat</div></div>';
    return;
  }

  // Group by tanggal (non-mini)
  if (!mini) {
    const groups = {};
    list.forEach(tx => {
      const tgl = tx.tanggal ? String(tx.tanggal).substring(0, 10) : "Tidak diketahui";
      if (!groups[tgl]) groups[tgl] = [];
      groups[tgl].push(tx);
    });

    el.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(tgl => `
      <div class="tx-date-label">${fmtDate(tgl)}</div>
      ${groups[tgl].map(tx => txCard(tx)).join("")}
    `).join("");
  } else {
    el.innerHTML = list.map(tx => txCard(tx)).join("");
  }
}

function txCard(tx) {
  const isIncome = tx.jenis === "Pemasukan";
  const ikon = IKON_KATEGORI[tx.kategori] || "ti-receipt";
  return `<div class="tx-card ${isIncome ? "income" : "expense"}" onclick="showTxDetail('${tx.id}')">
    <div class="tx-icon-wrap ${isIncome ? "" : "exp"}">
      <i class="ti ${ikon}"></i>
    </div>
    <div class="tx-meta">
      <div class="tx-name">${tx.kategori}${tx.subkategori ? " · " + tx.subkategori : ""}</div>
      <div class="tx-sub">${tx.catatan || tx.metode || tx.sumber_tujuan || "—"}</div>
    </div>
    <div class="tx-amount ${isIncome ? "income" : "expense"}">
      ${isIncome ? "+" : "-"}${fmtRp(tx.nominal)}
    </div>
  </div>`;
}

// ─── FORM TAMBAH TRANSAKSI ───────────────────────────────────
function setJenis(jenis) {
  STATE.jenisDipilih = jenis;
  document.getElementById("btn-income").classList.toggle("active", jenis === "Pemasukan");
  document.getElementById("btn-income").classList.toggle("income", jenis === "Pemasukan");
  document.getElementById("btn-expense").classList.toggle("active", jenis === "Pengeluaran");
  document.getElementById("btn-expense").classList.toggle("expense", jenis === "Pengeluaran");
  populateKategori(jenis);
}

function populateKategori(jenis) {
  const sel = document.getElementById("f-kategori");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Kategori --</option>';
  const cats = KATEGORI[jenis] || {};
  Object.keys(cats).forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    sel.appendChild(opt);
  });
  document.getElementById("f-subkategori").innerHTML = '<option value="">-- Pilih --</option>';
}

function updateSubkat() {
  const kat = document.getElementById("f-kategori").value;
  const sel = document.getElementById("f-subkategori");
  sel.innerHTML = '<option value="">-- Pilih --</option>';
  const subs = (KATEGORI[STATE.jenisDipilih] || {})[kat] || [];
  subs.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    sel.appendChild(opt);
  });
}

function setTodayDate() {
  const el = document.getElementById("f-tanggal");
  if (el) el.value = new Date().toISOString().split("T")[0];
}

async function simpanTransaksi() {
  const btn = document.getElementById("save-btn");
  const nominal = document.getElementById("f-nominal").value;
  const tanggal = document.getElementById("f-tanggal").value;
  const kategori = document.getElementById("f-kategori").value;

  // Validasi
  if (!nominal || parseFloat(nominal) <= 0) { showToast("Nominal harus diisi dan lebih dari 0", "error"); return; }
  if (!tanggal) { showToast("Tanggal harus diisi", "error"); return; }
  if (!kategori) { showToast("Kategori harus dipilih", "error"); return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-sm"></div> Menyimpan...';

  try {
    const payload = {
      jenis        : STATE.jenisDipilih,
      tanggal      : tanggal,
      kategori     : kategori,
      subkategori  : document.getElementById("f-subkategori").value,
      nominal      : parseFloat(nominal),
      metode       : document.getElementById("f-metode").value,
      sumber_tujuan: document.getElementById("f-sumber").value,
      catatan      : document.getElementById("f-catatan").value
    };

    await postAPI("addTransaksi", payload);

    showToast("✅ Tersimpan ke Spreadsheet!", "success");
    resetForm();
    goTo("home");

  } catch (e) {
    showToast("Gagal simpan: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i> Simpan ke Spreadsheet';
  }
}

function resetForm() {
  document.getElementById("f-nominal").value = "";
  document.getElementById("f-catatan").value = "";
  document.getElementById("f-sumber").value = "";
  document.getElementById("f-metode").value = "";
  setTodayDate();
  setJenis("Pemasukan");
}

// ─── DETAIL & HAPUS TRANSAKSI ────────────────────────────────
async function showTxDetail(id) {
  const tx = STATE.allTransaksi.find(t => t.id === id);
  if (!tx) return;

  const isIncome = tx.jenis === "Pemasukan";
  document.getElementById("modal-tx-content").innerHTML = `
    <div class="tx-detail-header">
      <div class="tx-detail-icon ${isIncome ? "" : "exp"}">
        <i class="ti ${IKON_KATEGORI[tx.kategori] || "ti-receipt"}"></i>
      </div>
      <div class="tx-detail-amount ${isIncome ? "income" : "expense"}">
        ${isIncome ? "+" : "-"}${fmtRp(tx.nominal)}
      </div>
      <div class="tx-detail-label">${tx.kategori}${tx.subkategori ? " · " + tx.subkategori : ""}</div>
    </div>
    <table class="tx-detail-table">
      <tr><td>Tanggal</td><td>${fmtDate(tx.tanggal)}</td></tr>
      <tr><td>Jenis</td><td>${tx.jenis}</td></tr>
      <tr><td>Metode</td><td>${tx.metode || "—"}</td></tr>
      <tr><td>Sumber/Tujuan</td><td>${tx.sumber_tujuan || "—"}</td></tr>
      <tr><td>Catatan</td><td>${tx.catatan || "—"}</td></tr>
      <tr><td>ID</td><td style="font-size:10px;word-break:break-all">${tx.id}</td></tr>
    </table>
  `;

  document.getElementById("modal-tx-del").onclick = () => hapusTx(id);
  document.getElementById("modal-tx").style.display = "flex";
}

async function hapusTx(id) {
  if (!confirm("Hapus transaksi ini? Data di Spreadsheet juga akan dihapus.")) return;
  try {
    await postAPI("deleteTransaksi", { id });
    showToast("Transaksi dihapus", "success");
    closeModal("modal-tx");
    loadTransaksi();
    loadDashboard();
  } catch (e) {
    showToast("Gagal hapus: " + e.message, "error");
  }
}

// ─── PENCARIAN ───────────────────────────────────────────────
function toggleSearch() {
  const bar = document.getElementById("search-bar");
  if (bar.style.display === "none") {
    bar.style.display = "flex";
    document.getElementById("search-input").focus();
  } else {
    clearSearch();
  }
}

async function doSearch(q) {
  if (!q || q.length < 2) {
    renderTxList(STATE.allTransaksi, "tx-list");
    return;
  }
  try {
    const res = await callAPI("search", { q });
    renderTxList(res.data || [], "tx-list");
  } catch (_) {}
}

function clearSearch() {
  const bar = document.getElementById("search-bar");
  bar.style.display = "none";
  document.getElementById("search-input").value = "";
  renderTxList(STATE.allTransaksi, "tx-list");
}

function toggleFilter() {
  showToast("Filter tanggal: gunakan filter chip di atas", "info", 2000);
}

function filterJenis(el, jenis) {
  STATE.jenisFil = jenis;
  document.querySelectorAll("#page-transactions .chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  loadTransaksi();
}

// ─── LAPORAN ─────────────────────────────────────────────────
function buildReportFilter() {
  const el = document.getElementById("report-filter");
  if (!el) return;
  const bulanNames = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const now = new Date();
  let html = '<button class="chip active" onclick="setReportPeriod(this)" data-month="">Bulan Ini</button>';
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const label = bulanNames[d.getMonth()] + " " + d.getFullYear();
    html += `<button class="chip" onclick="setReportPeriod(this)" data-month="${val}">${label}</button>`;
  }
  el.innerHTML = html;
}

async function loadReports(bulan) {
  const params = {};
  if (bulan) params.bulan = bulan;
  else {
    const now = new Date();
    params.bulan = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  try {
    const res = await callAPI("getTransaksi", params);
    const list = res.data || [];

    let masuk = 0, keluar = 0;
    const perKat = {};
    list.forEach(tx => {
      const n = parseFloat(tx.nominal) || 0;
      if (tx.jenis === "Pemasukan") masuk += n;
      else { keluar += n; perKat[tx.kategori] = (perKat[tx.kategori] || 0) + n; }
    });

    set("rep-masuk", fmtRp(masuk));
    set("rep-keluar", fmtRp(keluar));
    const cf = masuk - keluar;
    const cfEl = document.getElementById("rep-cashflow");
    if (cfEl) { cfEl.textContent = (cf >= 0 ? "+" : "") + fmtRp(cf); cfEl.style.color = cf >= 0 ? "#2d9b6a" : "#e05252"; }

    const katArr = Object.entries(perKat).map(([nama, total]) => ({ nama, total })).sort((a, b) => b.total - a.total);
    renderKatList(katArr, "rep-kat-list");

    // Link spreadsheet
    const sid = localStorage.getItem("fk_sheet_id");
    const link = document.getElementById("sheets-link");
    if (link) link.href = sid ? `https://docs.google.com/spreadsheets/d/${sid}/edit` : "#";

  } catch (e) {
    showToast("Gagal memuat laporan: " + e.message, "error");
  }
}

function setReportPeriod(el) {
  document.querySelectorAll("#report-filter .chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  loadReports(el.dataset.month || undefined);
}

function exportCSV() {
  const list = STATE.allTransaksi;
  if (!list || !list.length) { showToast("Belum ada data untuk diekspor", "warn"); return; }

  const cols = ["ID","Tanggal","Jenis","Kategori","Subkategori","Nominal","Metode","Catatan","Sumber_Tujuan","Created_At"];
  const rows = [cols.join(",")];
  list.forEach(tx => {
    rows.push([
      tx.id, tx.tanggal, tx.jenis, tx.kategori, tx.subkategori || "",
      tx.nominal, tx.metode || "", (tx.catatan || "").replace(/,/g, ";"),
      (tx.sumber_tujuan || "").replace(/,/g, ";"), tx.created_at
    ].join(","));
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "finansialku-" + new Date().toISOString().split("T")[0] + ".csv";
  a.click();
  showToast("CSV berhasil diunduh", "success");
}

// ─── PENGATURAN ──────────────────────────────────────────────
function loadSettings() {
  const url = localStorage.getItem("fk_gas_url") || "";
  const name = localStorage.getItem("fk_name") || "Pengguna";
  const sid = localStorage.getItem("fk_sheet_id") || "";

  set("p-name", name);
  set("s-name-desc", name);
  set("p-email", url ? "Web App terhubung ✓" : "Belum dikonfigurasi");
  set("s-url-desc", url ? url.substring(0, 42) + "..." : "Belum dikonfigurasi");

  const pill = document.getElementById("sync-pill");
  if (pill) {
    pill.innerHTML = url ? '<span class="dot-live"></span>Online' : '<span class="dot-offline"></span>Offline';
    pill.className = "sync-pill " + (url ? "online" : "");
  }

  if (sid) {
    const link = document.getElementById("sheets-link");
    if (link) link.href = `https://docs.google.com/spreadsheets/d/${sid}/edit`;
  }
}

function showUrlSetup() {
  const inp = document.getElementById("modal-url-input");
  if (inp) inp.value = localStorage.getItem("fk_gas_url") || "";
  document.getElementById("modal-url").style.display = "flex";
}

function saveUrl() {
  const inp = document.getElementById("modal-url-input");
  const url = (inp.value || "").trim();
  if (!url) { showToast("URL tidak boleh kosong", "error"); return; }
  if (!url.startsWith("https://script.google.com")) {
    showToast("URL harus dari script.google.com", "error"); return;
  }
  localStorage.setItem("fk_gas_url", url);
  APP_CONFIG.GAS_URL = url;
  closeModal("modal-url");
  loadSettings();
  showToast("URL berhasil disimpan ✓", "success");
  loadDashboard();
}

function showNameSetup() {
  const inp = document.getElementById("modal-name-input");
  if (inp) inp.value = localStorage.getItem("fk_name") || "";
  document.getElementById("modal-name").style.display = "flex";
}

function saveName() {
  const name = (document.getElementById("modal-name-input").value || "").trim();
  if (!name) { showToast("Nama tidak boleh kosong", "error"); return; }
  localStorage.setItem("fk_name", name);
  closeModal("modal-name");
  loadSettings();
  showToast("Nama diperbarui ✓", "success");
}

function clearData() {
  if (!confirm("Hapus semua data lokal?\n(Data di Google Sheets tidak akan terpengaruh)")) return;
  localStorage.clear();
  showToast("Data lokal dihapus", "success");
  loadSettings();
}

// ─── MODAL ───────────────────────────────────────────────────
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

// ─── FILTER PERIODE DASHBOARD ────────────────────────────────
function setPeriod(el, period) {
  STATE.periodeDashboard = period;
  document.querySelectorAll("#home-filter .chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  loadDashboardPeriod(period);
}

async function loadDashboardPeriod(period) {
  // Hitung rentang tanggal berdasarkan periode
  const now = new Date();
  let dari, sampai;

  if (period === "hari") {
    dari = sampai = toYMD(now);

  } else if (period === "minggu") {
    // Senin s/d Minggu minggu ini
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const diffMon = (day === 0) ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diffMon);
    dari = toYMD(mon);
    sampai = toYMD(now);

  } else {
    // bulan — default
    dari = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
    sampai = toYMD(now);
  }

  try {
    const res = await callAPI("getTransaksi", { tanggal_dari: dari, tanggal_sampai: sampai });
    const list = res.data || [];

    let masuk = 0, keluar = 0;
    const perKat = {};
    list.forEach(tx => {
      const n = parseFloat(tx.nominal) || 0;
      if (tx.jenis === "Pemasukan") masuk += n;
      else {
        keluar += n;
        perKat[tx.kategori] = (perKat[tx.kategori] || 0) + n;
      }
    });

    // Update stat cards
    set("stat-masuk", fmtRp(masuk));
    set("stat-keluar", fmtRp(keluar));
    const cf = masuk - keluar;
    const cfEl = document.getElementById("stat-cashflow");
    if (cfEl) {
      cfEl.textContent = (cf >= 0 ? "+" : "") + fmtRp(cf);
      cfEl.style.color = cf >= 0 ? "#2d9b6a" : "#e05252";
    }

    // Update kategori pengeluaran
    const katArr = Object.entries(perKat)
      .map(([nama, total]) => ({ nama, total }))
      .sort((a, b) => b.total - a.total);
    renderKatList(katArr, "kat-list");

    // Update transaksi terbaru
    renderTxList(list.slice(0, 5), "home-tx-list", true);

  } catch (e) {
    showToast("Gagal filter: " + e.message, "error");
  }
}

function toYMD(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

// ─── TOAST ───────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = "success", duration = 2800) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

// ─── SYNC STATUS ─────────────────────────────────────────────
function setSyncStatus(msg) {
  set("last-sync", msg);
  set("s-last-sync", msg);
}

// ─── FORMAT HELPERS ──────────────────────────────────────────
function fmtRp(n) {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const today = new Date();
  const isTdy = dt.toDateString() === today.toDateString();
  if (isTdy) return "Hari Ini";
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (dt.toDateString() === yest.toDateString()) return "Kemarin";
  return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function fmtTime(d) {
  return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
