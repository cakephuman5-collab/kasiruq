/**
 * =========================================================
 * KASIRUQ - Code.gs  (Backend Google Apps Script)
 * ---------------------------------------------------------
 * Script ini dipasang di dalam Google Sheets KASIRUQ
 * (Extensions > Apps Script), lalu di-deploy sebagai Web App.
 *
 * Alur:  Frontend (PWA)  --POST JSON-->  doPost()  -->  Google Sheets
 *
 * Tab yang dipakai: Users, Menu, Transaksi, DetailTransaksi,
 *                   LogStok, Pengaturan
 * =========================================================
 */

var TZ = 'Asia/Jakarta';
var SESSION_TTL = 21600;   // 6 jam, diperpanjang setiap ada aktivitas
var MAX_FAILS = 5;         // salah password 5x -> dikunci 5 menit

var HEADERS = {
  Users: ['id_user', 'nama', 'username', 'password_hash', 'role', 'aktif'],
  Menu: ['id_menu', 'nama', 'kategori', 'harga', 'stok', 'aktif'],
  Transaksi: ['kode', 'tanggal', 'waktu', 'id_user', 'nama_kasir', 'total', 'metode', 'uang_dibayar', 'kembalian', 'status'],
  DetailTransaksi: ['kode', 'id_menu', 'nama_menu', 'kategori', 'jumlah', 'harga', 'subtotal'],
  LogStok: ['tanggal', 'waktu', 'id_menu', 'jenis', 'jumlah', 'catatan', 'id_user'],
  Pengaturan: ['kunci', 'nilai']
};

/* =========================================================
   ENTRY POINT WEB APP
   ========================================================= */

function doGet() {
  return json_({ ok: true, app: 'KASIRUQ', message: 'API aktif' });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(req.action || '');
    var data = req.data || {};

    if (action === 'login') return json_(login_(data));

    var user = auth_(req.token);
    if (!user) return json_({ ok: false, code: 'AUTH', message: 'Sesi habis, silakan login lagi' });

    switch (action) {
      case 'logout':
        CacheService.getScriptCache().remove('s_' + req.token);
        return json_({ ok: true });
      case 'getMenu':
        return json_({ ok: true, menu: getMenu_() });
      case 'checkout':
        return json_(checkout_(user, data));
      case 'getDashboard':
        return json_({ ok: true, data: dashboard_() });
      default:
        return json_({ ok: false, message: 'Aksi tidak dikenal' });
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, message: 'Terjadi kesalahan di server' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   HELPER SHEET
   ========================================================= */

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Tab tidak ditemukan: ' + name);
  return sh;
}

function headerRow_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
}

function colIndex_(sh, header) {
  var i = headerRow_(sh).indexOf(header);
  if (i < 0) throw new Error('Kolom "' + header + '" tidak ada di tab ' + sh.getName());
  return i + 1;
}

/** Baca tab menjadi array objek. maxRows = hanya N baris terakhir. */
function readTable_(name, maxRows) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow();
  var headers = headerRow_(sh);
  if (lastRow < 2 || !headers.length) return [];
  var start = 2;
  if (maxRows && lastRow - 1 > maxRows) start = lastRow - maxRows + 1;
  var vals = sh.getRange(start, 1, lastRow - start + 1, headers.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) continue;   // lewati baris kosong
    var o = { _row: start + i };
    for (var j = 0; j < headers.length; j++) { if (headers[j]) o[headers[j]] = vals[i][j]; }
    out.push(o);
  }
  return out;
}

/** Tambah baris di bawah data terakhir, mengikuti urutan header di sheet. */
function appendObjects_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name);
  var headers = headerRow_(sh);
  var rows = objs.map(function (o) {
    return headers.map(function (h) { return o[h] === undefined ? '' : o[h]; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function isTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

function fmtDate_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim().slice(0, 10);
}

function fmtTime_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'HH:mm:ss');
  return String(v || '').trim().slice(0, 8);
}

/* =========================================================
   PASSWORD & LOGIN
   ========================================================= */

function hash_(salt, pw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function makeHash_(pw) {
  var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  return salt + '$' + hash_(salt, pw);
}

function verifyPassword_(pw, stored) {
  stored = String(stored || '');
  var i = stored.indexOf('$');
  if (i < 1) return false;                       // belum ada password
  return hash_(stored.slice(0, i), pw) === stored.slice(i + 1);
}

function login_(d) {
  var username = String(d.username || '').trim().toLowerCase();
  var password = String(d.password || '');
  if (!username || !password) return { ok: false, message: 'Isi username dan password dulu ya' };

  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + username;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILS) return { ok: false, message: 'Terlalu banyak percobaan. Coba lagi 5 menit lagi.' };

  var u = readTable_('Users').filter(function (r) {
    return String(r.username).trim().toLowerCase() === username;
  })[0];

  if (!u || !isTrue_(u.aktif) || !verifyPassword_(password, u.password_hash)) {
    cache.put(failKey, String(fails + 1), 300);
    return { ok: false, message: 'Username atau password salah' };
  }
  var role = String(u.role);
  if (role !== 'Kasir' && role !== 'Pemilik') return { ok: false, message: 'Role akun tidak valid' };

  cache.remove(failKey);
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  var user = { id_user: String(u.id_user), nama: String(u.nama), username: String(u.username).trim().toLowerCase(), role: role };
  cache.put('s_' + token, JSON.stringify(user), SESSION_TTL);
  return { ok: true, user: user, token: token };
}

function auth_(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var raw = cache.get('s_' + token);
  if (!raw) return null;
  cache.put('s_' + token, raw, SESSION_TTL);      // perpanjang sesi
  return JSON.parse(raw);
}

/** Dipanggil dari menu KASIRUQ > Atur password pengguna */
function setPassword_(username, pw) {
  username = String(username || '').trim().toLowerCase();
  if (String(pw || '').length < 6) throw new Error('Password minimal 6 karakter');
  var u = readTable_('Users').filter(function (r) {
    return String(r.username).trim().toLowerCase() === username;
  })[0];
  if (!u) throw new Error('Username "' + username + '" tidak ditemukan di tab Users');
  var sh = sheet_('Users');
  sh.getRange(u._row, colIndex_(sh, 'password_hash')).setValue(makeHash_(pw));
  CacheService.getScriptCache().remove('fail_' + username);
}

/* =========================================================
   MENU
   ========================================================= */

/** stok kosong = tidak dipantau (null). Angka = dipantau & dikurangi saat jual. */
function stokOf_(m) {
  var s = m.stok;
  if (s === '' || s === null || s === undefined) return null;
  var n = Number(s);
  return isNaN(n) ? null : n;
}

function getMenu_() {
  return readTable_('Menu')
    .filter(function (m) { return isTrue_(m.aktif); })
    .map(function (m) {
      return {
        id_menu: String(m.id_menu),
        nama: String(m.nama),
        kategori: String(m.kategori),
        harga: Number(m.harga) || 0,
        stok: stokOf_(m)
      };
    });
}

/* =========================================================
   CHECKOUT
   ========================================================= */

function nextKode_(tgl) {
  var prefix = 'KSQ-' + tgl.replace(/-/g, '') + '-';
  var sh = sheet_('Transaksi');
  var last = sh.getLastRow();
  var max = 0;
  if (last >= 2) {
    var from = Math.max(2, last - 1999);
    var vals = sh.getRange(from, colIndex_(sh, 'kode'), last - from + 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      var k = String(vals[i][0]);
      if (k.indexOf(prefix) === 0) {
        var n = parseInt(k.slice(prefix.length), 10);
        if (n > max) max = n;
      }
    }
  }
  return prefix + String(max + 1).padStart(4, '0');
}

function checkout_(user, d) {
  var cache = CacheService.getScriptCache();
  var reqKey = d.request_id ? 'req_' + user.id_user + '_' + String(d.request_id) : '';
  if (reqKey) {
    var prev = cache.get(reqKey);
    if (prev) return { ok: true, trx: JSON.parse(prev), duplicate: true };
  }

  var items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) return { ok: false, message: 'Keranjang masih kosong' };
  if (items.length > 50) return { ok: false, message: 'Terlalu banyak item' };
  var metode = String(d.metode || '');
  if (metode !== 'Tunai' && metode !== 'QRIS') return { ok: false, message: 'Metode bayar tidak valid' };

  // gabungkan item dengan id sama
  var want = Object.create(null);               // tanpa prototype: id aneh seperti __proto__ tidak bisa menyelinap
  for (var i = 0; i < items.length; i++) {
    if (!items[i]) return { ok: false, message: 'Data pesanan tidak valid' };
    var id = String(items[i].id_menu);
    var q = Math.floor(Number(items[i].jumlah));
    if (!(q >= 1) || q > 999) return { ok: false, message: 'Jumlah item tidak valid' };
    want[id] = (want[id] || 0) + q;
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, message: 'Server sedang sibuk, coba lagi sebentar' }; }

  try {
    if (reqKey) {                                   // cek ulang setelah dapat kunci
      var again = cache.get(reqKey);
      if (again) return { ok: true, trx: JSON.parse(again), duplicate: true };
    }

    var menu = readTable_('Menu').filter(function (m) { return isTrue_(m.aktif); });
    var byId = {};
    menu.forEach(function (m) { byId[String(m.id_menu)] = m; });

    var lines = [];
    var total = 0;
    var ids = Object.keys(want);
    for (var k = 0; k < ids.length; k++) {
      var m = byId[ids[k]];
      if (!m) return { ok: false, message: 'Ada menu yang tidak valid atau sudah nonaktif' };
      var qty = want[ids[k]];
      var stok = stokOf_(m);
      if (stok !== null && stok < qty) {
        return { ok: false, message: 'Stok ' + m.nama + ' tidak cukup (sisa ' + stok + ')' };
      }
      var harga = Number(m.harga) || 0;              // harga selalu dari sheet, bukan dari browser
      var sub = harga * qty;
      total += sub;
      lines.push({
        id_menu: String(m.id_menu), nama: String(m.nama), kategori: String(m.kategori),
        jumlah: qty, harga: harga, subtotal: sub,
        row: m._row, stokBaru: stok === null ? null : stok - qty
      });
    }

    if (!lines.length || !(total > 0)) return { ok: false, message: 'Keranjang masih kosong' };

    var bayar = metode === 'QRIS' ? total : Number(d.uang_dibayar);
    if (!(bayar >= total)) return { ok: false, message: 'Uang pelanggan kurang' };
    if (bayar > 1000000000) return { ok: false, message: 'Nominal uang tidak wajar' };

    var now = new Date();
    var tgl = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
    var wkt = Utilities.formatDate(now, TZ, 'HH:mm:ss');
    var kode = nextKode_(tgl);
    // tanda ' di depan = simpan sebagai teks (tidak diubah Sheets jadi tanggal/jam)
    var tTgl = "'" + tgl, tWkt = "'" + wkt;

    appendObjects_('Transaksi', [{
      kode: kode, tanggal: tTgl, waktu: tWkt, id_user: user.id_user, nama_kasir: user.nama,
      total: total, metode: metode, uang_dibayar: bayar, kembalian: bayar - total, status: 'Selesai'
    }]);
    appendObjects_('DetailTransaksi', lines.map(function (l) {
      return { kode: kode, id_menu: l.id_menu, nama_menu: l.nama, kategori: l.kategori, jumlah: l.jumlah, harga: l.harga, subtotal: l.subtotal };
    }));

    var tracked = lines.filter(function (l) { return l.stokBaru !== null; });
    appendObjects_('LogStok', tracked.map(function (l) {
      return { tanggal: tTgl, waktu: tWkt, id_menu: l.id_menu, jenis: 'penjualan', jumlah: -l.jumlah, catatan: kode, id_user: user.id_user };
    }));
    if (tracked.length) {
      var shMenu = sheet_('Menu');
      var stokCol = colIndex_(shMenu, 'stok');
      tracked.forEach(function (l) { shMenu.getRange(l.row, stokCol).setValue(l.stokBaru); });
    }
    SpreadsheetApp.flush();

    var trx = {
      kode: kode, tanggal: tgl, waktu: wkt, id_user: user.id_user, nama_kasir: user.nama,
      items: lines.map(function (l) {
        return { id_menu: l.id_menu, nama: l.nama, kategori: l.kategori, jumlah: l.jumlah, harga: l.harga, subtotal: l.subtotal };
      }),
      total: total, metode: metode, uang_dibayar: bayar, kembalian: bayar - total, status: 'Selesai'
    };
    if (reqKey) cache.put(reqKey, JSON.stringify(trx), 21600);
    cache.remove('dash');
    return { ok: true, trx: trx };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function dashboard_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('dash');
  if (hit) return JSON.parse(hit);

  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var trx = readTable_('Transaksi', 3000).map(function (t) {
    return {
      kode: String(t.kode), tanggal: fmtDate_(t.tanggal), waktu: fmtTime_(t.waktu),
      nama_kasir: String(t.nama_kasir), metode: String(t.metode),
      total: Number(t.total) || 0, status: String(t.status)
    };
  }).filter(function (t) { return t.status === 'Selesai'; });

  var todayTrx = trx.filter(function (t) { return t.tanggal === today; });
  var kodeToday = {};
  todayTrx.forEach(function (t) { kodeToday[t.kode] = true; });

  var ayam = 0, nasi = 0, sambal = 0;
  if (todayTrx.length) {
    readTable_('DetailTransaksi', 10000).forEach(function (r) {
      if (!kodeToday[String(r.kode)]) return;
      var q = Number(r.jumlah) || 0;
      var kat = String(r.kategori);
      if (kat === 'Ayam') ayam += q; else if (kat === 'Nasi') nasi += q; else if (kat === 'Sambal') sambal += q;
    });
  }

  var p = today.split('-').map(Number);
  var labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var grafik = [];
  for (var back = 6; back >= 0; back--) {
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] - back));
    var key = dt.toISOString().slice(0, 10);
    grafik.push({
      tanggal: key,
      label: back === 0 ? 'Hari ini' : labels[dt.getUTCDay()],
      total: trx.filter(function (t) { return t.tanggal === key; })
        .reduce(function (a, t) { return a + t.total; }, 0)
    });
  }

  var terbaru = todayTrx.slice()
    .sort(function (a, b) { return b.kode.localeCompare(a.kode); })
    .slice(0, 5)
    .map(function (t) { return { kode: t.kode, waktu: t.waktu, nama_kasir: t.nama_kasir, metode: t.metode, total: t.total }; });

  var out = {
    tanggal: today,
    total_hari: todayTrx.reduce(function (a, t) { return a + t.total; }, 0),
    jumlah_trx: todayTrx.length,
    ayam: ayam, nasi: nasi, sambal: sambal,
    grafik: grafik, terbaru: terbaru
  };
  cache.put('dash', JSON.stringify(out), 30);
  return out;
}

/* =========================================================
   MENU DI GOOGLE SHEETS  (KASIRUQ > ...)
   ========================================================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('KASIRUQ')
    .addItem('Atur password pengguna', 'aturPassword')
    .addItem('Cek konfigurasi', 'cekKonfigurasi')
    .addToUi();
}

function aturPassword() {
  var ui = SpreadsheetApp.getUi();
  var u = ui.prompt('Atur password', 'Username pengguna (contoh: pemilik atau kasir1):', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  var username = u.getResponseText().trim().toLowerCase();
  var p = ui.prompt('Atur password', 'Password baru untuk "' + username + '" (minimal 6 karakter).\nPastikan tidak ada orang lain yang melihat layar.', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  try {
    setPassword_(username, p.getResponseText());
    ui.alert('Berhasil', 'Password untuk "' + username + '" sudah disimpan (dalam bentuk hash).', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Gagal', String(err.message || err), ui.ButtonSet.OK);
  }
}

function cekKonfigurasi() {
  var ui = SpreadsheetApp.getUi();
  var problems = [];
  Object.keys(HEADERS).forEach(function (name) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sh) { problems.push('Tab "' + name + '" tidak ditemukan'); return; }
    var h = headerRow_(sh);
    HEADERS[name].forEach(function (col, i) {
      if (h[i] !== col) problems.push('Tab ' + name + ': kolom ke-' + (i + 1) + ' harus "' + col + '" (sekarang "' + (h[i] || '') + '")');
    });
  });
  var users = problems.length ? [] : readTable_('Users');
  users.forEach(function (u) {
    if (!String(u.password_hash || '').length) problems.push('User "' + u.username + '" belum punya password (KASIRUQ > Atur password pengguna)');
  });
  ui.alert(problems.length ? 'Perlu diperbaiki' : 'Semua OK',
    problems.length ? problems.join('\n') : 'Struktur tab dan akun sudah benar.', ui.ButtonSet.OK);
}
