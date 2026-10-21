/* =========================================================
   KASIRUQ - app.js
   Shell aplikasi + halaman Dashboard & Kasir.
   Halaman lain masih placeholder (dibuat di tahap berikutnya).
   ========================================================= */
(function () {
  'use strict';

  var API = window.KasiruqAPI;
  var user = API.getSession();
  if (!user) { location.replace('index.html'); return; }

  /* ---------- helper ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
  function num(n) { return Number(n || 0).toLocaleString('id-ID'); }
  function jam(w) { return String(w).slice(0, 5); }
  function tglId(t) { var p = String(t).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  var toastTimer;
  function toast(msg, bad) {
    var old = $('.toast'); if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- navigasi ---------- */
  var BOTH = ['Kasir', 'Pemilik'];
  var NAV = [
    { id: 'dashboard', ic: '🏠', label: 'Dashboard', short: 'Beranda', roles: BOTH },
    { id: 'kasir', ic: '🛒', label: 'Kasir', short: 'Kasir', roles: BOTH },
    { id: 'riwayat', ic: '🧾', label: 'Riwayat Transaksi', short: 'Riwayat', roles: BOTH },
    { id: 'menu', ic: '🍗', label: 'Data Menu', short: 'Menu', roles: ['Pemilik'] },
    { id: 'laporan', ic: '📈', label: 'Laporan', short: 'Laporan', roles: ['Pemilik'] },
    { id: 'pengguna', ic: '👥', label: 'Pengguna', short: 'User', roles: ['Pemilik'] }
  ].filter(function (n) { return n.roles.indexOf(user.role) > -1; });

  var initial = esc(user.nama.charAt(0).toUpperCase());

  $('#app').innerHTML =
    '<aside class="side">' +
      '<div class="brand"><div class="brand-badge">🍗</div><div><div class="brand-name">KASIRUQ</div><div class="brand-sub">Kasir Farouq Fried Chicken</div></div></div>' +
      '<nav class="side-nav" aria-label="Menu utama">' +
        NAV.map(function (n) {
          return '<a class="nav-item" href="#' + n.id + '" data-id="' + n.id + '"><span class="ic">' + n.ic + '</span>' + esc(n.label) + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="side-foot">' +
        '<div class="user-chip"><div class="avatar">' + initial + '</div><div><b>' + esc(user.nama) + '</b><small>' + esc(user.role) + '</small></div></div>' +
        (API.IS_DEMO ? '<button class="btn btn-ghost btn-sm" data-act="reset">Reset data demo</button>' : '') +
        '<button class="btn btn-soft" data-act="logout">Keluar</button>' +
      '</div>' +
    '</aside>' +
    '<div class="content">' +
      '<header class="top">' +
        '<div class="brand"><div class="brand-badge">🍗</div><div><div class="brand-name">KASIRUQ</div><div class="brand-sub">Kasir Farouq Fried Chicken</div></div></div>' +
        '<button class="avatar" id="avBtn" aria-label="Menu akun" aria-expanded="false">' + initial + '</button>' +
        '<div class="pop" id="pop" hidden>' +
          '<div class="user-chip"><div class="avatar">' + initial + '</div><div><b>' + esc(user.nama) + '</b><small>' + esc(user.role) + '</small></div></div>' +
          (API.IS_DEMO ? '<button class="btn btn-ghost btn-sm" data-act="reset">Reset data demo</button>' : '') +
          '<button class="btn btn-soft btn-sm" data-act="logout">Keluar</button>' +
        '</div>' +
      '</header>' +
      '<main class="main" id="view"></main>' +
    '</div>' +
    '<nav class="bottom-nav" aria-label="Navigasi bawah">' +
      NAV.map(function (n) {
        return '<a class="bn-item" href="#' + n.id + '" data-id="' + n.id + '"><span class="ic">' + n.ic + '</span>' + esc(n.short) + '</a>';
      }).join('') +
    '</nav>';

  var view = $('#view');

  document.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'logout') { API.logout(); location.replace('index.html'); }
      if (act.dataset.act === 'reset') {
        if (confirm('Reset semua data demo ke kondisi awal?')) { API.resetDemo(); location.reload(); }
      }
      return;
    }
    var av = e.target.closest('#avBtn');
    var pop = $('#pop');
    if (av) { pop.hidden = !pop.hidden; av.setAttribute('aria-expanded', String(!pop.hidden)); return; }
    if (pop && !pop.hidden && !e.target.closest('#pop')) pop.hidden = true;
  });

  /* ---------- router ---------- */
  var token = 0;
  function route() {
    var id = (location.hash || '#dashboard').slice(1);
    var item = NAV.filter(function (n) { return n.id === id; })[0] || NAV[0];
    $$('[data-id]').forEach(function (a) {
      var on = a.dataset.id === item.id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var my = ++token;
    window.scrollTo(0, 0);
    var fn = VIEWS[item.id];
    if (fn) fn(function () { return my === token; }); else placeholder(item);
  }
  window.addEventListener('hashchange', route);

  function placeholder(item) {
    view.innerHTML =
      '<div class="card soon"><span class="em">' + item.ic + '</span>' +
      '<h2>' + esc(item.label) + '</h2>' +
      '<p>Halaman ini dikerjakan di tahap berikutnya. Untuk sekarang, coba <a href="#kasir" style="color:var(--red);font-weight:700">Kasir</a> dan <a href="#dashboard" style="color:var(--red);font-weight:700">Dashboard</a>.</p></div>';
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */
  function viewDashboard(alive) {
    var tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    view.innerHTML =
      '<div class="page-head"><div><h1>Halo, ' + esc(user.nama) + ' 👋</h1><p>' + esc(tgl) + '</p></div>' +
      (API.IS_DEMO ? '<span class="badge-demo">DATA DEMO</span>' : '') + '</div>' +
      '<div class="skeleton"></div><div class="skeleton"></div>';

    API.getDashboard().then(function (d) {
      if (!alive()) return;
      var max = Math.max.apply(null, d.grafik.map(function (g) { return g.total; }).concat([1]));
      var bars = d.grafik.map(function (g, i) {
        var h = Math.max(3, Math.round(g.total / max * 130));
        return '<div class="bar' + (i === d.grafik.length - 1 ? ' now' : '') + '">' +
          '<b>' + (g.total ? Math.round(g.total / 1000) + 'rb' : '0') + '</b>' +
          '<i style="height:' + h + 'px"></i><span>' + esc(g.label) + '</span></div>';
      }).join('');

      var recent = d.terbaru.length ? d.terbaru.map(function (t) {
        return '<div class="trx"><div><b>' + esc(t.kode) + '</b><small>' + jam(t.waktu) + ' • ' + esc(t.nama_kasir) + '</small><br><span class="pill ' + esc(t.metode) + '">' + esc(t.metode) + '</span></div>' +
          '<div class="amt">' + rp(t.total) + '</div></div>';
      }).join('') : '<div class="empty"><span class="em">🧾</span>Belum ada transaksi hari ini.<br>Yuk mulai di halaman Kasir!</div>';

      view.innerHTML =
        '<div class="page-head"><div><h1>Halo, ' + esc(user.nama) + ' 👋</h1><p>' + esc(tgl) + '</p></div>' +
        (API.IS_DEMO ? '<span class="badge-demo">DATA DEMO</span>' : '') + '</div>' +
        '<div class="hero-card"><small>Penjualan hari ini</small><div class="big">' + rp(d.total_hari) + '</div><div class="foot">dari ' + num(d.jumlah_trx) + ' transaksi</div></div>' +
        '<div class="stats">' +
          '<div class="stat"><div class="tile t-trx">🧾</div><b>' + num(d.jumlah_trx) + '</b><span>Transaksi</span></div>' +
          '<div class="stat"><div class="tile t-ayam">🍗</div><b>' + num(d.ayam) + '</b><span>Ayam terjual</span></div>' +
          '<div class="stat"><div class="tile t-nasi">🍚</div><b>' + num(d.nasi) + '</b><span>Nasi terjual</span></div>' +
          '<div class="stat"><div class="tile t-sambal">🌶️</div><b>' + num(d.sambal) + '</b><span>Sambal terjual</span></div>' +
        '</div>' +
        '<div class="cols">' +
          '<section class="card"><h2>Penjualan 7 hari terakhir</h2><div class="bars">' + bars + '</div></section>' +
          '<section class="card"><h2>Transaksi terbaru</h2>' + recent + '</section>' +
        '</div>';
    }).catch(function (err) {
      if (!alive()) return;
      view.innerHTML = '<div class="card soon"><span class="em">📡</span><h2>Gagal memuat data</h2><p>' + esc(err.message) +
        '</p><button class="btn btn-primary" id="retry" style="margin-top:14px">Coba lagi</button></div>';
      $('#retry').addEventListener('click', route);
    });
  }

  /* =========================================================
     KASIR
     ========================================================= */
  var K = { menu: [], cart: {}, cat: 'Semua', q: '', metode: 'Tunai', uang: 0, busy: false, reqId: null };
  var EMOJI = { Ayam: '🍗', Nasi: '🍚', Sambal: '🌶️' };
  var TILE = { Ayam: 't-ayam', Nasi: 't-nasi', Sambal: 't-sambal' };

  function menuById(id) { return K.menu.filter(function (m) { return m.id_menu === id; })[0]; }
  function cartLines() {
    return Object.keys(K.cart).map(function (id) {
      var m = menuById(id);
      return m ? { m: m, qty: K.cart[id] } : null;
    }).filter(Boolean);
  }
  function cartTotal() { return cartLines().reduce(function (a, l) { return a + l.m.harga * l.qty; }, 0); }
  function cartCount() { return cartLines().reduce(function (a, l) { return a + l.qty; }, 0); }

  function viewKasir(alive) {
    view.innerHTML =
      '<div class="page-head"><div><h1>Kasir</h1><p>Pilih menu, masukkan ke keranjang, lalu checkout.</p></div></div>' +
      '<div class="kasir">' +
        '<section>' +
          '<label class="search"><span aria-hidden="true">🔍</span><input id="q" type="search" placeholder="Cari menu…" autocomplete="off" aria-label="Cari menu"></label>' +
          '<div class="chips" id="chips" role="tablist"></div>' +
          '<div class="grid" id="grid"><div class="skeleton"></div><div class="skeleton"></div></div>' +
        '</section>' +
        '<aside class="cart" id="cart" aria-label="Keranjang">' +
          '<div class="cart-head"><h2>Keranjang 🛒</h2><div class="acts"><button class="link" id="clear">Kosongkan</button><button class="x" id="closeCart" aria-label="Tutup keranjang">✕</button></div></div>' +
          '<div class="cart-items" id="cartItems"></div>' +
          '<div class="cart-foot">' +
            '<div class="row total"><span>Total</span><b id="total">Rp 0</b></div>' +
            '<div class="seg" id="seg" role="group" aria-label="Metode pembayaran"><button data-m="Tunai">💵 Tunai</button><button data-m="QRIS">📱 QRIS</button></div>' +
            '<div id="cashBox"><label class="field-label" for="cash">Uang pelanggan</label>' +
              '<input class="input" id="cash" inputmode="numeric" placeholder="0" autocomplete="off"><div class="quick" id="quick"></div></div>' +
            '<div class="note" id="qrisNote" hidden>Pastikan pembayaran QRIS sudah masuk sebelum menekan Checkout.</div>' +
            '<div class="row change" id="changeRow"><span id="changeLbl">Kembalian</span><b id="change">Rp 0</b></div>' +
            '<button class="btn btn-primary btn-block" id="pay" disabled>Checkout</button>' +
          '</div>' +
        '</aside>' +
      '</div>' +
      '<div class="scrim" id="scrim" hidden></div>' +
      '<button class="cart-bar" id="cartBar" hidden><span id="barInfo"></span><b id="barTotal"></b></button>';

    bindKasir();
    API.getMenu().then(function (menu) {
      if (!alive()) return;
      K.menu = menu;
      /* buang item keranjang yang menunya sudah tidak ada / stok berkurang */
      Object.keys(K.cart).forEach(function (id) {
        var m = menuById(id);
        if (!m || (m.stok !== null && m.stok < 1)) delete K.cart[id]; else if (m.stok !== null && K.cart[id] > m.stok) K.cart[id] = m.stok;
      });
      renderChips(); renderGrid(); renderCart();
    }).catch(function (err) {
      if (!alive()) return;
      $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1"><span class="em">📡</span>' + esc(err.message) +
        '<br><button class="btn btn-soft btn-sm" id="retry" style="margin-top:10px">Coba lagi</button></div>';
      $('#retry').addEventListener('click', route);
    });
  }

  function bindKasir() {
    $('#q').addEventListener('input', function (e) { K.q = e.target.value; renderGrid(); });
    $('#chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      K.cat = b.dataset.cat; renderChips(); renderGrid();
    });
    $('#grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]'); if (b) addToCart(b.dataset.add, 1);
    });
    $('#cartItems').addEventListener('click', function (e) {
      var b = e.target.closest('[data-d]'); if (b) addToCart(b.dataset.id, Number(b.dataset.d));
    });
    $('#clear').addEventListener('click', function () { K.cart = {}; K.uang = 0; K.reqId = null; renderGrid(); renderCart(); });
    $('#seg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      K.metode = b.dataset.m; K.uang = 0; renderPay();
    });
    $('#cash').addEventListener('input', function (e) {
      var digits = e.target.value.replace(/\D/g, '').slice(0, 9);
      K.uang = Number(digits || 0);
      e.target.value = digits ? K.uang.toLocaleString('id-ID') : '';
      renderPay(true);
    });
    $('#quick').addEventListener('click', function (e) {
      var b = e.target.closest('[data-q]'); if (!b) return;
      K.uang = b.dataset.q === 'pas' ? cartTotal() : Number(b.dataset.q);
      renderPay();
    });
    $('#cartBar').addEventListener('click', openCart);
    $('#closeCart').addEventListener('click', closeCart);
    $('#scrim').addEventListener('click', closeCart);
    $('#pay').addEventListener('click', checkout);
  }

  function openCart() { $('#cart').classList.add('open'); $('#scrim').hidden = false; }
  function closeCart() { var c = $('#cart'); if (c) c.classList.remove('open'); var s = $('#scrim'); if (s) s.hidden = true; }

  function addToCart(id, d) {
    var m = menuById(id); if (!m) return;
    var cur = K.cart[id] || 0;
    var next = cur + d;
    if (d > 0 && m.stok !== null && next > m.stok) { toast('Stok ' + m.nama + ' tinggal ' + m.stok, true); return; }
    if (next < 1) delete K.cart[id]; else K.cart[id] = next;
    K.reqId = null;
    renderGrid(); renderCart();
  }

  function renderChips() {
    var cats = ['Semua'].concat(K.menu.map(function (m) { return m.kategori; })
      .filter(function (c, i, a) { return a.indexOf(c) === i; }));
    $('#chips').innerHTML = cats.map(function (c) {
      return '<button class="chip' + (K.cat === c ? ' on' : '') + '" data-cat="' + esc(c) + '" role="tab" aria-selected="' + (K.cat === c) + '">' + esc(c) + '</button>';
    }).join('');
  }

  function renderGrid() {
    var q = K.q.trim().toLowerCase();
    var list = K.menu.filter(function (m) {
      return (K.cat === 'Semua' || m.kategori === K.cat) && (!q || m.nama.toLowerCase().indexOf(q) > -1);
    });
    if (!list.length) {
      $('#grid').innerHTML = '<div class="empty" style="grid-column:1/-1"><span class="em">🤔</span>Menu tidak ditemukan</div>';
      return;
    }
    $('#grid').innerHTML = list.map(function (m) {
      var qty = K.cart[m.id_menu] || 0;
      var tracked = m.stok !== null;
      var cls = 'prod' + (tracked && m.stok < 1 ? ' out' : tracked && m.stok <= 10 ? ' low' : '');
      var stok = !tracked ? 'Tersedia' : (m.stok < 1 ? 'Habis' : (m.stok <= 10 ? 'Sisa ' + m.stok : 'Stok ' + m.stok));
      return '<button class="' + cls + '" data-add="' + esc(m.id_menu) + '" aria-label="Tambah ' + esc(m.nama) + '">' +
        (qty ? '<span class="qb">' + qty + '</span>' : '') +
        '<div class="tile ' + (TILE[m.kategori] || '') + '">' + (EMOJI[m.kategori] || '🍽️') + '</div>' +
        '<div class="name">' + esc(m.nama) + '</div>' +
        '<div class="price">' + rp(m.harga) + '</div>' +
        '<div class="stok">' + stok + '</div></button>';
    }).join('');
  }

  function renderCart() {
    var lines = cartLines();
    $('#cartItems').innerHTML = lines.length ? lines.map(function (l) {
      return '<div class="line"><div class="line-info"><b>' + esc(l.m.nama) + '</b><small>' + rp(l.m.harga) + '</small></div>' +
        '<div class="stepper"><button data-d="-1" data-id="' + esc(l.m.id_menu) + '" aria-label="Kurangi ' + esc(l.m.nama) + '">−</button>' +
        '<span>' + l.qty + '</span>' +
        '<button data-d="1" data-id="' + esc(l.m.id_menu) + '" aria-label="Tambah ' + esc(l.m.nama) + '">+</button></div>' +
        '<div class="line-sub">' + rp(l.m.harga * l.qty) + '</div></div>';
    }).join('') : '<div class="empty"><span class="em">🛒</span>Belum ada pesanan.<br>Ketuk menu untuk menambahkan.</div>';

    var total = cartTotal(), count = cartCount();
    var bar = $('#cartBar');
    bar.hidden = count === 0;
    $('#barInfo').textContent = '🛒 ' + count + ' item • Lihat keranjang';
    $('#barTotal').textContent = rp(total);
    if (!count) closeCart();
    renderPay();
  }

  function renderPay(keepInput) {
    var total = cartTotal(), qris = K.metode === 'QRIS';
    $('#total').textContent = rp(total);
    $$('#seg [data-m]').forEach(function (b) { b.classList.toggle('on', b.dataset.m === K.metode); });
    $('#cashBox').hidden = qris;
    $('#qrisNote').hidden = !qris;
    if (!keepInput) $('#cash').value = K.uang ? K.uang.toLocaleString('id-ID') : '';

    var quick = [{ k: 'pas', l: 'Uang pas' }, { k: 10000, l: '10.000' }, { k: 20000, l: '20.000' }, { k: 50000, l: '50.000' }, { k: 100000, l: '100.000' }];
    $('#quick').innerHTML = quick.map(function (x) { return '<button data-q="' + x.k + '">' + x.l + '</button>'; }).join('');

    var row = $('#changeRow'), ok;
    if (qris) {
      $('#changeLbl').textContent = 'Kembalian';
      $('#change').textContent = rp(0);
      row.classList.remove('short');
      ok = total > 0;
    } else if (K.uang >= total) {
      $('#changeLbl').textContent = 'Kembalian';
      $('#change').textContent = rp(K.uang - total);
      row.classList.remove('short');
      ok = total > 0;
    } else {
      $('#changeLbl').textContent = 'Kurang';
      $('#change').textContent = rp(total - K.uang);
      row.classList.add('short');
      ok = false;
    }
    var pay = $('#pay');
    pay.disabled = !ok || K.busy;
    pay.textContent = K.busy ? 'Menyimpan…' : (total ? 'Checkout • ' + rp(total) : 'Checkout');
  }

  function checkout() {
    if (K.busy) return;
    var total = cartTotal();
    var items = Object.keys(K.cart).map(function (id) { return { id_menu: id, jumlah: K.cart[id] }; });
    if (!K.reqId) K.reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    K.busy = true; renderPay(true);
    API.checkout({ items: items, metode: K.metode, uang_dibayar: K.metode === 'QRIS' ? total : K.uang, request_id: K.reqId })
      .then(function (res) {
        if (!res.ok) throw new Error(res.message || 'Checkout gagal');
        K.cart = {}; K.uang = 0; K.reqId = null;
        closeCart();
        showNota(res.trx);
        return API.getMenu().then(function (menu) { K.menu = menu; }).catch(function () {});
      })
      .catch(function (err) { toast(err.message || 'Terjadi kesalahan', true); })
      .then(function () {
        K.busy = false;
        if ($('#grid')) { renderGrid(); renderCart(); }
      });
  }

  /* ---------- nota ---------- */
  function showNota(t) {
    var rows = t.items.map(function (i) {
      return '<div class="it"><div>' + esc(i.nama) + '</div><div class="r"><span>' + i.jumlah + ' x ' + num(i.harga) + '</span><span>' + num(i.subtotal) + '</span></div></div>';
    }).join('');
    var m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML =
      '<div class="nota-card">' +
        '<div class="ok-head"><span class="em">✅</span><b>Transaksi berhasil!</b><p>Data sudah tersimpan.</p></div>' +
        '<div class="nota" id="nota-print">' +
          '<div class="c"><b>FAROUQ FRIED CHICKEN</b><br>Kasir Farouq Fried Chicken<br>08.00 - 20.00 WIB</div><hr>' +
          '<div class="r"><span>Kode</span><span>' + esc(t.kode) + '</span></div>' +
          '<div class="r"><span>Tanggal</span><span>' + tglId(t.tanggal) + ' ' + jam(t.waktu) + '</span></div>' +
          '<div class="r"><span>Kasir</span><span>' + esc(t.nama_kasir) + '</span></div><hr>' +
          rows + '<hr>' +
          '<div class="r tot"><span>TOTAL</span><span>' + num(t.total) + '</span></div>' +
          '<div class="r"><span>Bayar (' + esc(t.metode) + ')</span><span>' + num(t.uang_dibayar) + '</span></div>' +
          '<div class="r"><span>Kembali</span><span>' + num(t.kembalian) + '</span></div><hr>' +
          '<div class="c">Terima kasih,<br>selamat menikmati! 🍗</div>' +
        '</div>' +
        '<div class="modal-acts"><button class="btn btn-soft" id="nPrint">🖨️ Cetak</button><button class="btn btn-primary" id="nDone">Transaksi baru</button></div>' +
      '</div>';
    document.body.appendChild(m);
    $('#nPrint', m).addEventListener('click', function () { window.print(); });
    $('#nDone', m).addEventListener('click', function () { m.remove(); });
    $('#nDone', m).focus();
  }

  var VIEWS = { dashboard: viewDashboard, kasir: viewKasir };
  route();
})();
