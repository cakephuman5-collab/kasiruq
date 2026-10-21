/* KASIRUQ - login.js */
(function () {
  'use strict';
  var API = window.KasiruqAPI;
  if (API.getSession()) { location.replace('app.html'); return; }

  var form = document.getElementById('form');
  var user = document.getElementById('username');
  var pass = document.getElementById('password');
  var err = document.getElementById('err');
  var btn = document.getElementById('btn');
  var eye = document.getElementById('eye');
  var hint = document.getElementById('demoHint');
  if (hint && !API.IS_DEMO) hint.hidden = true;

  eye.addEventListener('click', function () {
    var show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    eye.textContent = show ? '🙈' : '👁️';
    eye.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    if (!user.value.trim() || !pass.value) {
      err.textContent = 'Isi username dan password dulu ya';
      err.hidden = false;
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Masuk…';
    API.login(user.value, pass.value).then(function (res) {
      if (res.ok) { location.replace('app.html'); return; }
      err.textContent = res.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Masuk';
      pass.select();
    });
  });
})();
