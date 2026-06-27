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
  buildBudgetFilter();

  // Cek apakah sudah punya URL
  setTimeout(() => {
    hideSplash();
    if (!getGasUrl()) {
      showToast("⚙️ Atur URL Spreadsheet di Pengaturan dulu ya!", "warn", 4000);
      goTo("settings");
    } else {
      loadDashboard();
      loadTransaksi();
      loadRekening();
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
  if (page === "budget") loadBudget();
  if (page === "rekening") loadRekening();

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

  // Kirim sebagai flat URL params + data JSON — dua cara sekaligus untuk maksimal kompatibilitas
  // GAS tidak support CORS POST, jadi kita pakai GET dengan semua data di URL
  const flatParams = { action };

  // Flatten body ke params individual (untuk field sederhana)
  Object.entries(body).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      flatParams[k] = String(v);
    }
  });

  // Juga kirim sebagai JSON encoded untuk parseBody sebagai fallback
  flatParams["data"] = JSON.stringify(body);

  const qs = new URLSearchParams(flatParams);
  const fullUrl = url + "?" + qs.toString();

  const res = await fetch(fullUrl, { method: "GET", redirect: "follow" });

  if (!res.ok) throw new Error("HTTP error: " + res.status);

  let result;
  try {
    const text = await res.text();
    // Coba parse JSON
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      // GAS redirect kadang balik HTML — coba ambil JSON dari dalam
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error("Response bukan JSON:", text.substring(0, 200));
        throw new Error("Response tidak valid dari server. Pastikan Web App sudah di-deploy ulang.");
      }
    }
  } catch (e) {
    if (e.message.includes("Response")) throw e;
    throw new Error("Gagal membaca response: " + e.message);
  }

  // Log response untuk debug
  console.log("postAPI response (" + action + "):", JSON.stringify(result).substring(0, 200));

  if (result && result.status === "error") throw new Error(result.message || "Terjadi kesalahan di server");
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
  const isTransfer = tx.jenis === "Transfer";
  const isIncome   = tx.jenis === "Pemasukan";
  const ikon = isTransfer ? "ti-transfer" : (IKON_KATEGORI[tx.kategori] || "ti-receipt");

  const iconWrapClass = isTransfer ? "transfer" : (isIncome ? "" : "exp");
  const amountClass   = isTransfer ? "transfer" : (isIncome ? "income" : "expense");
  const amountPrefix  = isTransfer ? "⇄ " : (isIncome ? "+" : "-");
  const subText       = tx.catatan || tx.metode || tx.sumber_tujuan || "—";

  return `<div class="tx-card ${amountClass}" onclick="showTxDetail('${tx.id}')">
    <div class="tx-icon-wrap ${iconWrapClass}">
      <i class="ti ${ikon}"></i>
    </div>
    <div class="tx-meta">
      <div class="tx-name">${tx.kategori}${tx.subkategori ? " · " + tx.subkategori : ""}${isTransfer ? " <span class=\"badge-transfer\">Transfer</span>" : ""}</div>
      <div class="tx-sub">${subText}</div>
    </div>
    <div class="tx-amount ${amountClass}">
      ${amountPrefix}${fmtRp(tx.nominal)}
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

  // Set loading state
  ["rep-kat-list","rep-subkat-list","rep-rekening-list","rep-masuk-kat"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  });

  try {
    const res = await callAPI("getTransaksi", params);
    const list = res.data || [];

    // ── Hitung semua agregat sekaligus ──
    let masuk = 0, keluar = 0, ctrMasuk = 0, ctrKeluar = 0;
    const perKat    = {};   // { kategori: total }
    const perSubkat = {};   // { "Kategori > Sub": total }
    const perRek    = {};   // { metode: {masuk, keluar} }
    const perKatMasuk = {}; // { kategori: total } untuk pemasukan

    list.forEach(tx => {
      const n   = parseFloat(tx.nominal) || 0;
      const kat = tx.kategori || "Lainnya";
      const sub = tx.subkategori ? (kat + " › " + tx.subkategori) : null;
      const rek = tx.metode || "Tidak diketahui";

      // Transfer — hanya catat di rekening, tidak di cashflow laporan
      if (tx.jenis === "Transfer") {
        if (!perRek[rek]) perRek[rek] = { masuk: 0, keluar: 0, count: 0, transfer: 0 };
        perRek[rek].transfer = (perRek[rek].transfer || 0) + n;
        perRek[rek].count++;
        return;
      }

      if (!perRek[rek]) perRek[rek] = { masuk: 0, keluar: 0, count: 0, transfer: 0 };
      perRek[rek].count++;

      if (tx.jenis === "Pemasukan") {
        masuk += n; ctrMasuk++;
        perKatMasuk[kat] = (perKatMasuk[kat] || 0) + n;
        perRek[rek].masuk += n;
      } else {
        keluar += n; ctrKeluar++;
        perKat[kat] = (perKat[kat] || 0) + n;
        if (sub) perSubkat[sub] = (perSubkat[sub] || 0) + n;
        perRek[rek].keluar += n;
      }
    });

    // ── Update ringkasan ──
    set("rep-masuk",  fmtRp(masuk));
    set("rep-keluar", fmtRp(keluar));
    set("rep-masuk-count",  ctrMasuk + " transaksi");
    set("rep-keluar-count", ctrKeluar + " transaksi");
    set("rep-total-count",  list.length);
    const cf = masuk - keluar;
    const cfEl = document.getElementById("rep-cashflow");
    if (cfEl) { cfEl.textContent = (cf >= 0 ? "+" : "") + fmtRp(cf); cfEl.style.color = cf >= 0 ? "#2d9b6a" : "#e05252"; }

    // ── Pemasukan per kategori ──
    const katMasukArr = Object.entries(perKatMasuk)
      .map(([nama, total]) => ({ nama, total }))
      .sort((a, b) => b.total - a.total);
    renderKatListIncome(katMasukArr, "rep-masuk-kat", masuk);

    // ── Pengeluaran per kategori ──
    const katArr = Object.entries(perKat)
      .map(([nama, total]) => ({ nama, total }))
      .sort((a, b) => b.total - a.total);
    renderKatList(katArr, "rep-kat-list");

    // ── Detail per subkategori (grouped by kategori) ──
    renderSubkatDetail(perKat, perSubkat, list);

    // ── Per rekening/metode ──
    renderRekeningReport(perRek);

    // Link spreadsheet
    const sid = localStorage.getItem("fk_sheet_id");
    const link = document.getElementById("sheets-link");
    if (link) link.href = sid ? `https://docs.google.com/spreadsheets/d/${sid}/edit` : "#";

  } catch (e) {
    showToast("Gagal memuat laporan: " + e.message, "error");
  }
}

function renderKatListIncome(list, targetId, totalMasuk) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!list || !list.length) { el.innerHTML = '<div class="empty-state-sm">Belum ada pemasukan</div>'; return; }
  const total = totalMasuk || list.reduce((s, k) => s + k.total, 0) || 1;
  el.innerHTML = list.map((k, i) => {
    const pct = Math.round((k.total / total) * 100);
    const ikon = IKON_KATEGORI[k.nama] || "ti-receipt";
    return `<div class="rep-row">
      <div class="rep-row-left">
        <i class="ti ${ikon}" style="font-size:15px;color:#2d9b6a;width:18px"></i>
        <span class="rep-row-name">${k.nama}</span>
      </div>
      <div class="rep-row-bar-wrap">
        <div class="rep-bar-track"><div class="rep-bar-fill" style="width:${pct}%;background:#2d9b6a"></div></div>
      </div>
      <span class="rep-row-pct">${pct}%</span>
      <span class="rep-row-amt income">${fmtRp(k.total)}</span>
    </div>`;
  }).join("");
}

function renderSubkatDetail(perKat, perSubkat, allTx) {
  const el = document.getElementById("rep-subkat-list");
  if (!el) return;

  // Group subkat by parent kategori
  const grouped = {}; // { kat: { sub: total } }
  Object.entries(perSubkat).forEach(([key, total]) => {
    const parts = key.split(" › ");
    const kat = parts[0], sub = parts[1];
    if (!grouped[kat]) grouped[kat] = {};
    grouped[kat][sub] = total;
  });

  // Juga ambil transaksi tanpa subkategori
  allTx.forEach(tx => {
    if (tx.jenis !== "Pengeluaran") return;
    const kat = tx.kategori || "Lainnya";
    const n   = parseFloat(tx.nominal) || 0;
    if (!tx.subkategori) {
      if (!grouped[kat]) grouped[kat] = {};
      grouped[kat]["(tanpa subkategori)"] = (grouped[kat]["(tanpa subkategori)"] || 0) + n;
    }
  });

  if (!Object.keys(grouped).length) {
    el.innerHTML = '<div class="empty-state-sm">Belum ada data subkategori</div>';
    return;
  }

  // Urutkan kategori berdasarkan total pengeluaran (terbesar dulu)
  const katsSorted = Object.keys(grouped).sort((a, b) => (perKat[b] || 0) - (perKat[a] || 0));

  el.innerHTML = katsSorted.map(kat => {
    const subs = grouped[kat];
    const katTotal = perKat[kat] || Object.values(subs).reduce((s, v) => s + v, 0);
    const subsSorted = Object.entries(subs).sort((a, b) => b[1] - a[1]);
    const ikon = IKON_KATEGORI[kat] || "ti-receipt";

    const subRows = subsSorted.map(([sub, total]) => {
      const pct = katTotal > 0 ? Math.round((total / katTotal) * 100) : 0;
      return `<div class="subkat-row">
        <div class="subkat-dot"></div>
        <span class="subkat-name">${sub}</span>
        <div class="rep-bar-track subkat-bar"><div class="rep-bar-fill" style="width:${pct}%;background:#4caf82;opacity:.7"></div></div>
        <span class="subkat-pct">${pct}%</span>
        <span class="subkat-amt">${fmtRp(total)}</span>
      </div>`;
    }).join("");

    return `<div class="subkat-group">
      <div class="subkat-group-header">
        <div class="subkat-group-left">
          <div class="tx-icon-wrap exp" style="width:30px;height:30px;border-radius:8px;background:#fff0f0">
            <i class="ti ${ikon}" style="font-size:15px;color:#e05252"></i>
          </div>
          <div>
            <div class="subkat-group-name">${kat}</div>
            <div class="subkat-group-total">${fmtRp(katTotal)}</div>
          </div>
        </div>
        <i class="ti ti-chevron-down subkat-toggle" onclick="toggleSubkat(this)"></i>
      </div>
      <div class="subkat-body">${subRows}</div>
    </div>`;
  }).join("");
}

function toggleSubkat(iconEl) {
  const body = iconEl.closest(".subkat-group").querySelector(".subkat-body");
  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  iconEl.style.transform = isOpen ? "rotate(-90deg)" : "rotate(0)";
}

function renderRekeningReport(perRek) {
  const el = document.getElementById("rep-rekening-list");
  if (!el) return;
  const entries = Object.entries(perRek).sort((a, b) => (b[1].masuk + b[1].keluar) - (a[1].masuk + a[1].keluar));
  if (!entries.length) { el.innerHTML = '<div class="empty-state-sm">Belum ada data</div>'; return; }
  el.innerHTML = entries.map(([nama, d]) => {
    const net = d.masuk - d.keluar;
    return `<div class="rep-row" style="align-items:flex-start;flex-wrap:wrap;gap:4px">
      <div class="rep-row-left" style="min-width:90px">
        <i class="ti ti-wallet" style="font-size:14px;color:#8aA896;width:18px"></i>
        <div>
          <div class="rep-row-name">${nama}</div>
          <div style="font-size:10px;color:#8aA896">${d.count} transaksi</div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:120px">
        ${d.masuk > 0 ? `<div style="font-size:11px;color:#2d9b6a">↑ Masuk: ${fmtRp(d.masuk)}</div>` : ""}
        ${d.keluar > 0 ? `<div style="font-size:11px;color:#e05252">↓ Keluar: ${fmtRp(d.keluar)}</div>` : ""}
        ${d.transfer > 0 ? `<div style="font-size:11px;color:#d97706">⇄ Transfer: ${fmtRp(d.transfer)}</div>` : ""}
      </div>
      <span style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace;color:${net>=0?"#2d9b6a":"#e05252"}">${net>=0?"+":""}${fmtRp(net)}</span>
    </div>`;
  }).join('<div style="height:1px;background:var(--bdr);margin:4px 0"></div>');
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


// ─── REKENING ─────────────────────────────────────────────────
let _rekeningData = [];
let _rekeningTipeFil = "";

const TIPE_WARNA = {
  "Bank"      : "#1a73e8",
  "E-Wallet"  : "#00aed6",
  "Cash"      : "#4caf82",
  "Investasi" : "#d97706",
  "Lainnya"   : "#888888"
};

const TIPE_IKON = {
  "Bank"      : "ti-building-bank",
  "E-Wallet"  : "ti-device-mobile",
  "Cash"      : "ti-wallet",
  "Investasi" : "ti-chart-line",
  "Lainnya"   : "ti-credit-card"
};

async function loadRekening() {
  const el = document.getElementById("rek-list");
  if (el) el.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Memuat rekening...</span></div>';

  try {
    const res = await callAPI("getRekening");
    _rekeningData = res.data || [];

    // Debug: log ke console
    console.log("getRekening response:", JSON.stringify(res).substring(0, 300));

    // Update hero total
    set("rek-total", fmtRp(res.total_saldo || 0));

    // Hitung aktif dengan cara yang lebih toleran
    const aktifList = _rekeningData.filter(r => {
      if (typeof r.aktif === "boolean") return r.aktif;
      const s = String(r.aktif).trim().toUpperCase();
      return s === "TRUE" || s === "1";
    });
    set("rek-aktif-count", aktifList.length + " rekening aktif");

    // Normalize field aktif ke boolean murni
    _rekeningData = _rekeningData.map(r => ({
      ...r,
      aktif: typeof r.aktif === "boolean" ? r.aktif
             : ["TRUE","1","YES"].includes(String(r.aktif).trim().toUpperCase())
    }));

    // Populate dropdown metode di form transaksi
    populateMetodeDropdown(_rekeningData);

    renderRekeningList(_rekeningData, _rekeningTipeFil);

  } catch (e) {
    console.error("loadRekening error:", e);
    if (el) el.innerHTML = '<div class="empty-state-sm">Gagal memuat: ' + e.message + '<br><small>Pastikan URL Web App sudah benar dan di-deploy ulang.</small></div>';
  }
}

function populateMetodeDropdown(list) {
  const sel = document.getElementById("f-metode");
  if (!sel) return;
  const aktif = (list || _rekeningData).filter(r => r.aktif);
  sel.innerHTML = '<option value="">-- Pilih Rekening --</option>';
  aktif.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.nama;
    opt.textContent = r.nama + " (" + r.tipe + ")";
    sel.appendChild(opt);
  });
}

function filterRekening(el, tipe) {
  _rekeningTipeFil = tipe;
  document.querySelectorAll("#rek-filter .chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  renderRekeningList(_rekeningData, tipe);
}

function renderRekeningList(list, tipeFilter) {
  const el = document.getElementById("rek-list");
  if (!el) return;

  let filtered = list.filter(r => r.aktif === true);
  if (tipeFilter) filtered = filtered.filter(r => r.tipe === tipeFilter);

  if (!filtered.length) {
    // Cek apakah ada data tapi semua non-aktif
    const adaDataNonAktif = list.length > 0 && list.every(r => !r.aktif);
    if (adaDataNonAktif) {
      el.innerHTML = '<div class="empty-state-sm">Semua rekening dinonaktifkan. Buka Pengaturan rekening untuk mengaktifkan kembali.</div>';
    } else if (list.length === 0) {
      el.innerHTML = '<div class="empty-state"><i class="ti ti-wallet"></i><div class="empty-title">Belum ada rekening</div><div class="empty-sub">Tap + untuk tambah rekening baru</div></div>';
    } else {
      // Ada data tapi filter tipe tidak cocok
      el.innerHTML = '<div class="empty-state-sm">Tidak ada rekening dengan tipe ini.</div>';
    }
    return;
  }

  // Group by tipe
  const groups = {};
  filtered.forEach(r => {
    if (!groups[r.tipe]) groups[r.tipe] = [];
    groups[r.tipe].push(r);
  });

  el.innerHTML = Object.entries(groups).map(([tipe, items]) => {
    const cards = items.map(r => {
      const saldo = r.saldo_realtime !== undefined ? r.saldo_realtime : r.saldo_awal;
      const warna = r.warna || TIPE_WARNA[r.tipe] || "#888";
      const ikon  = TIPE_IKON[r.tipe] || "ti-credit-card";
      const saldoColor = saldo >= 0 ? "#2d9b6a" : "#e05252";
      return "<div class=\"rek-card\" onclick=\"showRekeningDetail(\'" + r.id + "\')\">"
        + "<div class=\"rek-card-top\">"
        + "<div class=\"rek-card-icon\" style=\"background:" + warna + "20;border:1.5px solid " + warna + "40\"><i class=\"ti " + ikon + "\" style=\"color:" + warna + "\"></i></div>"
        + "<div class=\"rek-card-info\">"
        + "<div class=\"rek-card-name\">" + r.nama + "</div>"
        + "<div class=\"rek-card-tipe\">" + r.tipe + (r.catatan ? " · " + r.catatan : "") + "</div>"
        + "</div>"
        + "<div class=\"rek-card-right\">"
        + "<div class=\"rek-card-saldo\" style=\"color:" + saldoColor + "\">" + fmtRp(saldo) + "</div>"
        + "<div class=\"rek-card-actions\">"
        + "<button class=\"rek-action-btn\" onclick=\"event.stopPropagation();showAdjust(\'" + r.id + "\',\'" + r.nama + "\')\" title=\"Sesuaikan saldo\"><i class=\"ti ti-adjustments-alt\"></i></button>"
        + "<button class=\"rek-action-btn\" onclick=\"event.stopPropagation();openEditRekening(\'" + r.id + "\')\" title=\"Edit\"><i class=\"ti ti-pencil\"></i></button>"
        + "</div></div></div>"
        + (r.catatan ? "" : "")
        + "</div>";
    }).join("");

    return "<div class=\"rek-group\">"
      + "<div class=\"rek-group-label\"><i class=\"ti " + (TIPE_IKON[tipe]||"ti-credit-card") + "\" style=\"font-size:13px\"></i> " + tipe + "</div>"
      + cards + "</div>";
  }).join("");
}

function showRekeningDetail(id) {
  const rek = _rekeningData.find(r => r.id === id);
  if (!rek) return;
  loadRekeningTx(rek.nama, rek.nama + " — " + fmtRp(rek.saldo_realtime || rek.saldo_awal));
}

async function loadRekeningTx(nama, title) {
  const section = document.getElementById("rek-tx-section");
  const listEl  = document.getElementById("rek-tx-list");
  const titleEl = document.getElementById("rek-tx-title");
  if (!section || !listEl) return;

  section.style.display = "block";
  if (titleEl) titleEl.textContent = title || nama;
  listEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Memuat...</span></div>';
  section.scrollIntoView({ behavior: "smooth" });

  try {
    const res = await callAPI("getRekeningDetail", { nama, limit: 30 });
    if (!res.data || !res.data.length) {
      listEl.innerHTML = '<div class="empty-state-sm">Belum ada transaksi di rekening ini</div>';
      return;
    }
    listEl.innerHTML = res.data.map(tx => txCard(tx)).join("");
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state-sm">Gagal: ' + e.message + '</div>';
  }
}

function closeRekeningTx() {
  const section = document.getElementById("rek-tx-section");
  if (section) section.style.display = "none";
}

// ─── Modal Tambah / Edit Rekening ───────────────────────────
function showModalRekening() {
  document.getElementById("mr-id").value = "";
  document.getElementById("mr-nama").value = "";
  document.getElementById("mr-tipe").value = "Bank";
  document.getElementById("mr-saldo").value = "";
  document.getElementById("mr-catatan").value = "";
  document.getElementById("mr-warna").value = "#4caf82";
  document.querySelectorAll(".color-opt").forEach(c => c.classList.toggle("active", c.dataset.color === "#4caf82"));
  document.getElementById("mr-title").textContent = "Tambah Rekening";
  document.getElementById("mr-del-btn").style.display = "none";
  document.getElementById("modal-rekening").style.display = "flex";
}

function openEditRekening(id) {
  const r = _rekeningData.find(x => x.id === id);
  if (!r) return;
  document.getElementById("mr-id").value      = r.id;
  document.getElementById("mr-nama").value    = r.nama;
  document.getElementById("mr-tipe").value    = r.tipe;
  document.getElementById("mr-saldo").value   = r.saldo_awal;
  document.getElementById("mr-catatan").value = r.catatan || "";
  document.getElementById("mr-warna").value   = r.warna || "#4caf82";
  document.querySelectorAll(".color-opt").forEach(c => c.classList.toggle("active", c.dataset.color === (r.warna || "#4caf82")));
  document.getElementById("mr-title").textContent = "Edit Rekening";
  document.getElementById("mr-del-btn").style.display = "block";
  document.getElementById("modal-rekening").style.display = "flex";
}

function pickColor(el) {
  document.querySelectorAll(".color-opt").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("mr-warna").value = el.dataset.color;
}

async function saveRekening() {
  const id     = document.getElementById("mr-id").value;
  const nama   = document.getElementById("mr-nama").value.trim();
  const tipe   = document.getElementById("mr-tipe").value;
  const saldo  = document.getElementById("mr-saldo").value;
  const catatan= document.getElementById("mr-catatan").value.trim();
  const warna  = document.getElementById("mr-warna").value;

  if (!nama) { showToast("Nama rekening wajib diisi", "error"); return; }
  if (!tipe) { showToast("Pilih tipe rekening", "error"); return; }

  const payload = { nama, tipe, saldo_awal: parseFloat(saldo) || 0, warna, catatan };

  console.log("saveRekening payload:", JSON.stringify(payload));
  try {
    let res;
    if (id) {
      res = await postAPI("updateRekening", { id, ...payload });
      console.log("updateRekening response:", JSON.stringify(res));
      showToast("Rekening diperbarui!", "success");
    } else {
      res = await postAPI("addRekening", payload);
      console.log("addRekening response:", JSON.stringify(res));
      showToast("✅ Rekening ditambahkan!", "success");
    }
    closeModal("modal-rekening");
    setTimeout(() => loadRekening(), 2000);
  } catch (e) {
    console.error("saveRekening error:", e);
    showToast("Gagal: " + e.message, "error", 5000);
  }
}

async function deleteRekeningItem() {
  const id = document.getElementById("mr-id").value;
  if (!id) return;
  if (!confirm("Nonaktifkan rekening ini?\nData transaksi tidak akan dihapus.")) return;
  try {
    await postAPI("deleteRekening", { id });
    showToast("Rekening dinonaktifkan", "success");
    closeModal("modal-rekening");
    setTimeout(() => loadRekening(), 1500);
  } catch (e) {
    showToast("Gagal: " + e.message, "error");
  }
}

// ─── Adjust Saldo ───────────────────────────────────────────
function showAdjust(id, nama) {
  document.getElementById("adj-rek-nama").value = nama;
  document.getElementById("adj-rek-name").textContent = nama;
  document.getElementById("adj-nominal").value = "";
  document.getElementById("adj-catatan").value = "";
  document.getElementById("modal-adjust").style.display = "flex";
}

async function simpanAdjust() {
  const nama    = document.getElementById("adj-rek-nama").value;
  const nominal = document.getElementById("adj-nominal").value;
  const catatan = document.getElementById("adj-catatan").value;

  if (!nominal || nominal === "0") { showToast("Masukkan nominal penyesuaian", "error"); return; }

  try {
    await postAPI("adjustSaldo", { rekening_nama: nama, nominal: parseFloat(nominal), catatan });
    showToast("Saldo disesuaikan!", "success");
    closeModal("modal-adjust");
    loadRekening();
  } catch (e) {
    showToast("Gagal: " + e.message, "error");
  }
}


// ─── TRANSFER ANTAR REKENING ──────────────────────────────────
function showModalTransfer() {
  if (!_rekeningData || !_rekeningData.length) {
    showToast("Muat data rekening dulu", "warn");
    loadRekening();
    return;
  }

  const aktif = _rekeningData.filter(r => r.aktif);
  if (aktif.length < 2) {
    showToast("Butuh minimal 2 rekening aktif untuk transfer", "warn");
    return;
  }

  // Populate dropdowns dari data rekening yang sudah dimuat
  const opts = aktif.map(r => {
    const saldo = r.saldo_realtime !== undefined ? r.saldo_realtime : r.saldo_awal;
    return `<option value="${r.nama}" data-saldo="${saldo}">${r.nama} (${fmtRp(saldo)})</option>`;
  }).join("");

  document.getElementById("tf-dari").innerHTML = '<option value="">-- Pilih Rekening Asal --</option>' + opts;
  document.getElementById("tf-ke").innerHTML   = '<option value="">-- Pilih Rekening Tujuan --</option>' + opts;
  document.getElementById("tf-nominal").value  = "";
  document.getElementById("tf-catatan").value  = "";
  document.getElementById("tf-tanggal").value  = new Date().toISOString().split("T")[0];

  // Reset preview
  document.getElementById("tp-from").textContent   = "Pilih rekening asal";
  document.getElementById("tp-to").textContent     = "Pilih rekening tujuan";
  document.getElementById("tp-amount").textContent = "Rp 0";

  document.getElementById("modal-transfer").style.display = "flex";
}

function updateTransferPreview() {
  const dari    = document.getElementById("tf-dari").value;
  const ke      = document.getElementById("tf-ke").value;
  const nominal = parseFloat(document.getElementById("tf-nominal").value) || 0;

  const fromEl   = document.getElementById("tp-from");
  const toEl     = document.getElementById("tp-to");
  const amountEl = document.getElementById("tp-amount");

  fromEl.textContent   = dari || "Pilih rekening asal";
  toEl.textContent     = ke   || "Pilih rekening tujuan";
  amountEl.textContent = nominal > 0 ? fmtRp(nominal) : "Rp 0";

  // Validasi — rekening sama
  const saveBtn = document.getElementById("tf-save-btn");
  if (dari && ke && dari === ke) {
    fromEl.style.color = "#e05252";
    toEl.style.color   = "#e05252";
    if (saveBtn) saveBtn.disabled = true;
  } else {
    fromEl.style.color = "";
    toEl.style.color   = "";
    if (saveBtn) saveBtn.disabled = false;
  }

  // Warning saldo tidak cukup
  if (dari && nominal > 0) {
    const rek = _rekeningData.find(r => r.nama === dari);
    if (rek) {
      const saldo = rek.saldo_realtime !== undefined ? rek.saldo_realtime : rek.saldo_awal;
      fromEl.textContent = dari + " (" + fmtRp(saldo) + ")";
      if (nominal > saldo) {
        fromEl.style.color = "#e05252";
        if (saveBtn) saveBtn.disabled = true;
      } else {
        fromEl.style.color = "#2d9b6a";
        if (saveBtn) saveBtn.disabled = false;
      }
    }
  }
}

async function simpanTransfer() {
  const dari    = document.getElementById("tf-dari").value;
  const ke      = document.getElementById("tf-ke").value;
  const nominal = document.getElementById("tf-nominal").value;
  const tanggal = document.getElementById("tf-tanggal").value;
  const catatan = document.getElementById("tf-catatan").value;

  // Validasi
  if (!dari)    { showToast("Pilih rekening asal", "error"); return; }
  if (!ke)      { showToast("Pilih rekening tujuan", "error"); return; }
  if (dari === ke) { showToast("Rekening asal dan tujuan tidak boleh sama", "error"); return; }
  if (!nominal || parseFloat(nominal) <= 0) { showToast("Masukkan jumlah transfer", "error"); return; }

  // Cek saldo cukup
  const rekAsal = _rekeningData.find(r => r.nama === dari);
  if (rekAsal) {
    const saldo = rekAsal.saldo_realtime !== undefined ? rekAsal.saldo_realtime : rekAsal.saldo_awal;
    if (parseFloat(nominal) > saldo) {
      showToast("Saldo " + dari + " tidak cukup (" + fmtRp(saldo) + ")", "error");
      return;
    }
  }

  const btn = document.getElementById("tf-save-btn");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner-sm"></div> Memproses...';

  try {
    const res = await postAPI("addTransfer", {
      dari_rekening : dari,
      ke_rekening   : ke,
      nominal       : parseFloat(nominal),
      tanggal       : tanggal,
      catatan       : catatan
    });

    showToast("✅ Transfer " + fmtRp(parseFloat(nominal)) + " berhasil!", "success", 3500);
    closeModal("modal-transfer");

    // Refresh data
    await loadRekening();
    loadDashboard();

  } catch (e) {
    showToast("Gagal transfer: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-transfer" style="font-size:15px"></i> Transfer';
  }
}

// ─── BUDGET ──────────────────────────────────────────────────
let budgetBulanAktif = "";

function getBulanIni() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}

function buildBudgetFilter() {
  const el = document.getElementById("budget-filter");
  if (!el) return;
  const bln = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const now = new Date();
  let html = "";
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
    const label = i===0 ? "Bulan Ini" : bln[d.getMonth()]+" "+d.getFullYear();
    html += "<button class=\"chip "+(i===0?"active":"")+"\" onclick=\"setBudgetBulan(this,\'"+val+"\')\">"+label+"</button>";
  }
  const dep = new Date(now.getFullYear(), now.getMonth()+1, 1);
  const dv = dep.getFullYear()+"-"+String(dep.getMonth()+1).padStart(2,"0");
  html += "<button class=\"chip\" onclick=\"setBudgetBulan(this,\'"+dv+"\')\">Bulan Depan</button>";
  el.innerHTML = html;
  budgetBulanAktif = getBulanIni();
}

function setBudgetBulan(el, bulan) {
  budgetBulanAktif = bulan;
  document.querySelectorAll("#budget-filter .chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  loadBudget();
}

async function loadBudget() {
  if (!budgetBulanAktif) buildBudgetFilter();
  const el = document.getElementById("budget-list");
  if (el) el.innerHTML = "<div class=\"loading-state\"><div class=\"spinner\"></div><span>Memuat budget...</span></div>";
  try {
    const res = await callAPI("getBudgetProgress", { bulan: budgetBulanAktif });
    renderBudgetSummary(res);
    renderBudgetList(res.data || [], res.message);
  } catch (e) {
    if (el) el.innerHTML = "<div class=\"empty-state-sm\">Gagal memuat: "+e.message+"</div>";
  }
}

function renderBudgetSummary(res) {
  set("bsum-limit", fmtRp(res.total_limit || 0));
  set("bsum-used",  fmtRp(res.total_terpakai || 0));
  set("bsum-sisa",  fmtRp(res.total_sisa || 0));
  const pct = Math.min(res.total_pct || 0, 100);
  const fillEl = document.getElementById("bsum-fill");
  const pctEl  = document.getElementById("bsum-pct");
  if (pctEl) pctEl.textContent = (res.total_pct || 0) + "%";
  if (fillEl) {
    fillEl.style.width = pct + "%";
    fillEl.style.background = pct >= 100 ? "#e05252" : pct >= 80 ? "#d97706" : "#2d9b6a";
  }
  const siEl = document.getElementById("bsum-sisa");
  if (siEl) siEl.style.color = (res.total_sisa || 0) >= 0 ? "#2d9b6a" : "#e05252";
}

function renderBudgetList(list, emptyMsg) {
  const el = document.getElementById("budget-list");
  if (!el) return;
  if (!list || list.length === 0) {
    el.innerHTML = "<div class=\"empty-state\"><i class=\"ti ti-target\"></i><div class=\"empty-title\">"+(emptyMsg||"Belum ada budget")+"</div><div class=\"empty-sub\">Tap + untuk set budget per kategori</div></div>";
    return;
  }
  el.innerHTML = list.map(function(b) {
    const pct = Math.min(b.pct, 100);
    const barColor = b.status==="over" ? "#e05252" : b.status==="warning" ? "#d97706" : "#2d9b6a";
    const badgeCls = b.status==="over" ? "badge-over" : b.status==="warning" ? "badge-warn" : "badge-aman";
    const badgeTxt = b.status==="over" ? "Melebihi!" : b.status==="warning" ? "Hampir habis" : "Aman";
    const ikon     = IKON_KATEGORI[b.kategori] || "ti-receipt";
    const sisakol  = b.sisa >= 0 ? "#2d9b6a" : "#e05252";
    return "<div class=\"budget-card\" onclick=\"editBudget_(\'"+b.id+"\',"+b.limit_budget+")\">"
      + "<div class=\"bc-top\"><div class=\"bc-left\"><div class=\"tx-icon-wrap\" style=\"background:#f0faf4\"><i class=\"ti "+ikon+"\" style=\"color:#2d9b6a\"></i></div>"
      + "<div><div class=\"bc-name\">"+b.kategori+"</div><div class=\"bc-sub\">"+fmtRp(b.terpakai)+" dari "+fmtRp(b.limit_budget)+"</div></div></div>"
      + "<div style=\"text-align:right\"><div class=\"budget-badge "+badgeCls+"\">"+badgeTxt+"</div><div class=\"bc-pct\">"+b.pct+"%</div></div></div>"
      + "<div class=\"bc-track\"><div class=\"bc-fill\" style=\"width:"+pct+"%;background:"+barColor+"\"></div></div>"
      + "<div class=\"bc-bottom\"><span>Sisa: <b style=\"color:"+sisakol+"\">"+fmtRp(b.sisa)+"</b></span>"
      + (b.catatan ? "<span style=\"font-size:11px;color:#8aA896\">"+b.catatan+"</span>" : "")
      + "</div></div>";
  }).join("");
  // store budget data for editing
  window._budgetData = {};
  list.forEach(function(b){ window._budgetData[b.id] = b; });
}

function editBudget_(id, limit) {
  const b = window._budgetData && window._budgetData[id];
  if (!b) return;
  document.getElementById("mb-id").value = b.id;
  document.getElementById("mb-bulan").value = budgetBulanAktif || getBulanIni();
  document.getElementById("mb-kategori").value = b.kategori;
  document.getElementById("mb-limit").value = b.limit_budget;
  document.getElementById("mb-catatan").value = b.catatan || "";
  document.getElementById("modal-budget-title").textContent = "Edit Budget";
  document.getElementById("mb-del-btn").style.display = "block";
  document.getElementById("modal-budget").style.display = "flex";
}

function showModalBudget() {
  document.getElementById("mb-id").value = "";
  document.getElementById("mb-bulan").value = budgetBulanAktif || getBulanIni();
  document.getElementById("mb-kategori").value = "";
  document.getElementById("mb-limit").value = "";
  document.getElementById("mb-catatan").value = "";
  document.getElementById("modal-budget-title").textContent = "Set Budget Kategori";
  document.getElementById("mb-del-btn").style.display = "none";
  document.getElementById("modal-budget").style.display = "flex";
}

async function saveBudget() {
  const bulan    = document.getElementById("mb-bulan").value;
  const kategori = document.getElementById("mb-kategori").value;
  const limit    = document.getElementById("mb-limit").value;
  const catatan  = document.getElementById("mb-catatan").value;
  if (!bulan)                           { showToast("Pilih bulan dulu", "error"); return; }
  if (!kategori)                        { showToast("Pilih kategori dulu", "error"); return; }
  if (!limit || parseFloat(limit) <= 0) { showToast("Masukkan limit budget", "error"); return; }
  try {
    await postAPI("setBudget", { bulan, kategori, limit_budget: parseFloat(limit), catatan });
    showToast("Budget tersimpan!", "success");
    closeModal("modal-budget");
    loadBudget();
  } catch (e) {
    showToast("Gagal simpan: " + e.message, "error");
  }
}

async function deleteBudgetItem() {
  const id = document.getElementById("mb-id").value;
  if (!id) return;
  if (!confirm("Hapus budget ini?")) return;
  try {
    await postAPI("deleteBudget", { id });
    showToast("Budget dihapus", "success");
    closeModal("modal-budget");
    loadBudget();
  } catch (e) {
    showToast("Gagal hapus: " + e.message, "error");
  }
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
      if (tx.jenis === "Transfer") return; // Transfer tidak masuk cashflow
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
