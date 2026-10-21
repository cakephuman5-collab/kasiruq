/* =========================================================
   KASIRUQ - api.js  (demo + online)
   ---------------------------------------------------------
   Semua halaman memanggil KasiruqAPI.* dan tidak tahu data
   berasal dari mana.
   - API_URL (js/config.js) kosong  -> MODE DEMO (MOCK di bawah)
   - API_URL terisi                 -> MODE ONLINE (REMOTE, Apps Script)
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'kasiruq_demo_v1';
  var SKEY = 'kasiruq_session_v1';

  /* ---------- util ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hms(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms == null ? 250 : ms); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var mem = {};
  var store = (function () {
    try {
      localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
      return {
        get: function (k) { return localStorage.getItem(k); },
        set: function (k, v) { localStorage.setItem(k, v); },
        del: function (k) { localStorage.removeItem(k); }
      };
    } catch (e) {
      return {
        get: function (k) { return k in mem ? mem[k] : null; },
        set: function (k, v) { mem[k] = v; },
        del: function (k) { delete mem[k]; }
      };
    }
  })();

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- akun demo ----------
     HANYA UNTUK DEMO. Di versi online, password disimpan
     sebagai hash di Google Sheets dan dicek oleh server. */
  var USERS = [
    { id_user: 'U01', nama: 'Mas Faruq', username: 'pemilik', password: 'demo123', role: 'Pemilik' },
    { id_user: 'U02', nama: 'Kasir 1', username: 'kasir1', password: 'demo123', role: 'Kasir' }
  ];

  /* ---------- data awal ---------- */
  function seedData() {
    var menu = [
      { id_menu: 'M01', nama: 'Paha Atas', kategori: 'Ayam', harga: 10000, stok: 80, aktif: true },
      { id_menu: 'M02', nama: 'Paha Bawah', kategori: 'Ayam', harga: 7500, stok: 70, aktif: true },
      { id_menu: 'M03', nama: 'Sayap', kategori: 'Ayam', harga: 7500, stok: 75, aktif: true },
      { id_menu: 'M04', nama: 'Dada', kategori: 'Ayam', harga: 11000, stok: 50, aktif: true },
      { id_menu: 'M05', nama: 'Nasi', kategori: 'Nasi', harga: 3000, stok: 150, aktif: true },
      { id_menu: 'M06', nama: 'Sambal Geprek', kategori: 'Sambal', harga: 2000, stok: 120, aktif: true },
      { id_menu: 'M07', nama: 'Sambal Ijo', kategori: 'Sambal', harga: 2000, stok: 100, aktif: true }
    ];
    var by = {};
    menu.forEach(function (m) { by[m.id_menu] = m; });

    var rnd = mulberry32(20261019);
    var now = new Date();
    var trx = [];
    var counter = {};

    for (var back = 6; back >= 0; back--) {
      var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      var maxMin = 20 * 60;
      var n;
      if (back === 0) {
        maxMin = Math.min(maxMin, now.getHours() * 60 + now.getMinutes());
        n = maxMin > 8 * 60 + 10 ? Math.min(14, Math.floor((maxMin - 8 * 60) / 30) + 4) : 0;
      } else {
        n = 26 + Math.floor(rnd() * 20);
      }
      var times = [];
      for (var i = 0; i < n; i++) {
        var m = rnd() < 0.5 ? 11 * 60 + rnd() * 120 : 8 * 60 + rnd() * 12 * 60;
        if (m > maxMin) m = 8 * 60 + rnd() * (maxMin - 8 * 60);
        times.push(Math.floor(m));
      }
      times.sort(function (a, b) { return a - b; });

      times.forEach(function (mm) {
        var r = rnd();
        var lines = [];
        var first = r < 0.34 ? 'M01' : r < 0.62 ? 'M03' : r < 0.78 ? 'M02' : 'M04';
        var q1 = 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.15 ? 1 : 0);
        lines.push([first, q1]);
        var ayamTotal = q1;
        if (rnd() < 0.3) {
          var other = ['M01', 'M02', 'M03', 'M04'].filter(function (x) { return x !== first; })[Math.floor(rnd() * 3)];
          lines.push([other, 1]); ayamTotal += 1;
        }
        if (rnd() < 0.9) lines.push(['M05', rnd() < 0.85 ? ayamTotal : Math.max(1, ayamTotal - 1)]);
        if (rnd() < 0.55) lines.push([rnd() < 0.6 ? 'M06' : 'M07', 1 + (rnd() < 0.12 ? 1 : 0)]);

        var total = 0;
        var items = lines.map(function (l) {
          var mm2 = by[l[0]];
          var sub = mm2.harga * l[1];
          total += sub;
          return { id_menu: mm2.id_menu, nama: mm2.nama, kategori: mm2.kategori, jumlah: l[1], harga: mm2.harga, subtotal: sub };
        });

        var metode = rnd() < 0.65 ? 'Tunai' : 'QRIS';
        var bayar = total;
        if (metode === 'Tunai') {
          var cands = [total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, 50000, 100000]
            .filter(function (x) { return x >= total; });
          bayar = cands[Math.min(cands.length - 1, Math.floor(rnd() * rnd() * cands.length * 1.4))];
        }
        var tgl = ymd(day);
        counter[tgl] = (counter[tgl] || 0) + 1;
        var kasirMas = rnd() > 0.7;
        trx.push({
          kode: 'KSQ-' + tgl.replace(/-/g, '') + '-' + String(counter[tgl]).padStart(4, '0'),
          tanggal: tgl,
          waktu: pad(Math.floor(mm / 60)) + ':' + pad(mm % 60) + ':' + pad(Math.floor(rnd() * 60)),
          id_user: kasirMas ? 'U01' : 'U02',
          nama_kasir: kasirMas ? 'Mas Faruq' : 'Kasir 1',
          items: items,
          total: total,
          metode: metode,
          uang_dibayar: bayar,
          kembalian: bayar - total,
          status: 'Selesai'
        });
      });
    }
    return { menu: menu, trx: trx };
  }

  function load() {
    var raw = store.get(KEY);
    if (raw) {
      try {
        var db = JSON.parse(raw);
        if (db && db.menu && db.trx) return db;
      } catch (e) { /* data rusak: buat ulang */ }
    }
    var fresh = seedData();
    save(fresh);
    return fresh;
  }
  function save(db) { store.set(KEY, JSON.stringify(db)); }

  /* ---------- API ---------- */
  var MOCK = {
    IS_DEMO: true,

    login: function (username, password) {
      return wait(450).then(function () {
        var u = USERS.filter(function (x) {
          return x.username === String(username || '').trim().toLowerCase() && x.password === password;
        })[0];
        if (!u) return { ok: false, message: 'Username atau password salah' };
        var s = { id_user: u.id_user, nama: u.nama, username: u.username, role: u.role };
        store.set(SKEY, JSON.stringify(s));
        return { ok: true, user: s };
      });
    },

    logout: function () { store.del(SKEY); },

    getSession: function () {
      try { var s = store.get(SKEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
    },

    getMenu: function () {
      return wait(150).then(function () {
        return clone(load().menu.filter(function (m) { return m.aktif; }));
      });
    },

    checkout: function (payload) {
      return wait(500).then(function () {
        var session = MOCK.getSession();
        if (!session) return { ok: false, message: 'Sesi habis, silakan login lagi' };
        if (!payload || !payload.items || !payload.items.length) return { ok: false, message: 'Keranjang masih kosong' };

        var db = load();
        var lines = [];
        var total = 0;
        for (var i = 0; i < payload.items.length; i++) {
          var it = payload.items[i];
          var q = Math.floor(Number(it.jumlah));
          var m = db.menu.filter(function (x) { return x.id_menu === it.id_menu && x.aktif; })[0];
          if (!m || !(q >= 1)) return { ok: false, message: 'Ada menu yang tidak valid' };
          if (m.stok < q) return { ok: false, message: 'Stok ' + m.nama + ' tidak cukup (sisa ' + m.stok + ')' };
          var sub = m.harga * q;          /* total dihitung ulang di "server" */
          total += sub;
          lines.push({ id_menu: m.id_menu, nama: m.nama, kategori: m.kategori, jumlah: q, harga: m.harga, subtotal: sub });
        }
        if (payload.metode !== 'Tunai' && payload.metode !== 'QRIS') return { ok: false, message: 'Metode bayar tidak valid' };
        var bayar = payload.metode === 'QRIS' ? total : Number(payload.uang_dibayar);
        if (!(bayar >= total)) return { ok: false, message: 'Uang pelanggan kurang' };

        lines.forEach(function (l) {
          db.menu.filter(function (x) { return x.id_menu === l.id_menu; })[0].stok -= l.jumlah;
        });

        var now = new Date();
        var tgl = ymd(now);
        var urut = db.trx.filter(function (t) { return t.tanggal === tgl; }).length + 1;
        var t = {
          kode: 'KSQ-' + tgl.replace(/-/g, '') + '-' + String(urut).padStart(4, '0'),
          tanggal: tgl,
          waktu: hms(now),
          id_user: session.id_user,
          nama_kasir: session.nama,
          items: lines,
          total: total,
          metode: payload.metode,
          uang_dibayar: bayar,
          kembalian: bayar - total,
          status: 'Selesai'
        };
        db.trx.push(t);
        save(db);
        return { ok: true, trx: clone(t) };
      });
    },

    getDashboard: function () {
      return wait(250).then(function () {
        var db = load();
        var now = new Date();
        var hari = ymd(now);
        var sah = db.trx.filter(function (t) { return t.status === 'Selesai'; });
        var today = sah.filter(function (t) { return t.tanggal === hari; });

        function sumKat(kat) {
          return today.reduce(function (a, t) {
            return a + t.items.reduce(function (b, i) { return b + (i.kategori === kat ? i.jumlah : 0); }, 0);
          }, 0);
        }

        var labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        var grafik = [];
        for (var back = 6; back >= 0; back--) {
          var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
          var key = ymd(d);
          grafik.push({
            tanggal: key,
            label: back === 0 ? 'Hari ini' : labels[d.getDay()],
            total: sah.filter(function (t) { return t.tanggal === key; })
              .reduce(function (a, t) { return a + t.total; }, 0)
          });
        }

        var terbaru = today.slice().reverse().slice(0, 5).map(function (t) {
          return { kode: t.kode, waktu: t.waktu, nama_kasir: t.nama_kasir, metode: t.metode, total: t.total };
        });

        return {
          tanggal: hari,
          total_hari: today.reduce(function (a, t) { return a + t.total; }, 0),
          jumlah_trx: today.length,
          ayam: sumKat('Ayam'),
          nasi: sumKat('Nasi'),
          sambal: sumKat('Sambal'),
          grafik: grafik,
          terbaru: terbaru
        };
      });
    },

    resetDemo: function () { store.del(KEY); }
  };


  /* =========================================================
     MODE ONLINE: bicara ke Google Apps Script (Code.gs)
     Aktif jika API_URL di js/config.js terisi.
     ========================================================= */
  var CFG = window.KASIRUQ_CONFIG || {};
  var API_URL = String(CFG.API_URL || '').trim();
  var TKEY = 'kasiruq_token_v1';

  function clearSession() { store.del(SKEY); store.del(TKEY); }

  function call(action, data) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 30000) : null;
    /* body berupa teks biasa (tanpa header khusus) supaya tidak memicu preflight CORS */
    var body = JSON.stringify({ action: action, token: store.get(TKEY) || '', data: data || {} });
    return fetch(API_URL, { method: 'POST', body: body, redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .catch(function () {
        return { ok: false, message: 'Tidak bisa terhubung ke server. Cek internet lalu coba lagi.' };
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (res && res.code === 'AUTH') { clearSession(); location.replace('index.html'); }
        return res;
      });
  }

  var REMOTE = {
    IS_DEMO: false,

    login: function (username, password) {
      return call('login', { username: username, password: password }).then(function (res) {
        if (res.ok) {
          store.set(TKEY, res.token);
          store.set(SKEY, JSON.stringify(res.user));
          return { ok: true, user: res.user };
        }
        return { ok: false, message: res.message || 'Login gagal' };
      });
    },

    logout: function () { call('logout').catch(function () {}); clearSession(); },

    getSession: function () {
      try { var s = store.get(SKEY); return s && store.get(TKEY) ? JSON.parse(s) : null; } catch (e) { return null; }
    },

    getMenu: function () {
      return call('getMenu').then(function (res) {
        if (!res.ok) throw new Error(res.message || 'Gagal memuat menu');
        return res.menu;
      });
    },

    checkout: function (payload) { return call('checkout', payload); },

    getDashboard: function () {
      return call('getDashboard').then(function (res) {
        if (!res.ok) throw new Error(res.message || 'Gagal memuat dashboard');
        return res.data;
      });
    },

    resetDemo: function () {}
  };

  window.KasiruqAPI = API_URL ? REMOTE : MOCK;
})();
