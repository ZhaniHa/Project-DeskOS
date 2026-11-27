/* DeskOS shell: window manager, taskbar, start menu, ikon desktop, tray. */
(function () {
  'use strict';

  var zTop = 10;
  var wins = new Map();   // id app -> { el, app }
  var startMenu = null;
  var drag = null;        // { el, ox, oy } saat jendela digeser
  var resize = null;      // { el, x, y, w, h } saat jendela diubah ukurannya

  function $(id) { return document.getElementById(id); }
  function appById(id) { return window.OS.apps.find(function (a) { return a.id === id; }); }
  function taskbarTop() {
    var taskbar = $('taskbar');
    return taskbar ? taskbar.getBoundingClientRect().top : window.innerHeight;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- jendela ---------- */

  function focusWin(w) {
    w.el.style.zIndex = ++zTop;
    updateTaskbar();
  }

  function showError(container, app, error) {
    container.textContent = '';
    var box = el('div', 'app-section');
    box.style.color = '#b91c1c';
    box.textContent = 'Gagal memuat modul: ' + (error && error.message ? error.message : String(error));
    container.appendChild(box);
    window.kirimLog('SISTEM', 'Error pada ' + app.title + ': ' + (error && error.message ? error.message : error));
  }

  function clampWin(win) {
    var maxWidth = Math.max(0, window.innerWidth - 24);
    win.style.width = Math.min(win.offsetWidth, maxWidth) + 'px';
    var maxLeft = Math.max(12, window.innerWidth - win.offsetWidth - 12);
    win.style.left = Math.min(win.offsetLeft, maxLeft) + 'px';
    var maxTop = Math.max(12, taskbarTop() - 212);
    win.style.top = Math.min(win.offsetTop, maxTop) + 'px';
    var maxHeight = Math.max(0, taskbarTop() - win.offsetTop - 12);
    win.style.height = Math.min(win.offsetHeight, maxHeight) + 'px';
  }

  function openApp(id) {
    var app = appById(id);
    if (!app) return;
    var existing = wins.get(id);
    if (existing) {
      existing.el.style.display = 'flex';
      clampWin(existing.el);
      focusWin(existing);
      return;
    }

    var win = el('div', 'window');
    win.dataset.app = id;
    var availableWidth = Math.max(0, window.innerWidth - 24);
    var width = Math.min(app.width, availableWidth);
    win.style.width = width + 'px';
    var n = wins.size;
    var maxLeft = Math.max(12, window.innerWidth - width - 12);
    win.style.left = Math.min(140 + (n % 5) * 36, maxLeft) + 'px';
    var maxTop = Math.max(12, taskbarTop() - 212);
    win.style.top = Math.min(50 + (n % 5) * 30, maxTop) + 'px';
    win.style.height = Math.max(0, Math.min(app.height, taskbarTop() - parseFloat(win.style.top) - 12)) + 'px';

    var bar = el('div', 'titlebar');
    bar.appendChild(el('span', 'titlebar-title', app.title));
    var btns = el('div', 'titlebar-buttons');
    var bMin = el('button', 'tb-min', '─'); bMin.title = 'Minimize';
    var bClose = el('button', 'tb-close', '✕'); bClose.title = 'Close';
    btns.appendChild(bMin); btns.appendChild(bClose);
    bar.appendChild(btns);

    var content = el('div', 'window-content');
    var handle = el('div', 'resize-handle');
    win.appendChild(bar); win.appendChild(content); win.appendChild(handle);
    $('windows').appendChild(win);

    var w = { el: win, app: app };
    wins.set(id, w);

    bar.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button')) return;
      drag = { el: win, id: e.pointerId, ox: e.clientX - win.offsetLeft, oy: e.clientY - win.offsetTop };
      if (bar.setPointerCapture) { try { bar.setPointerCapture(e.pointerId); } catch (_) {} }
      e.preventDefault();
    });
    handle.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      focusWin(w);
      resize = { el: win, id: e.pointerId, x: e.clientX, y: e.clientY, w: win.offsetWidth, h: win.offsetHeight };
      if (handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId); } catch (_) {} }
      e.preventDefault(); e.stopPropagation();
    });
    win.addEventListener('pointerdown', function () { focusWin(w); });
    bMin.addEventListener('click', function () { win.style.display = 'none'; updateTaskbar(); });
    bClose.addEventListener('click', function () { closeApp(id); });

    win.style.zIndex = ++zTop;
    try { app.mount(content); } catch (err) { showError(content, app, err); }
    updateTaskbar();
  }

  function closeApp(id) {
    var w = wins.get(id);
    if (!w) return;
    try { w.app.unmount(); } catch (err) {
      window.kirimLog('SISTEM', 'Error unmount ' + w.app.title + ': ' + (err && err.message ? err.message : err));
    }
    w.el.remove();
    wins.delete(id);
    updateTaskbar();
  }

  document.addEventListener('pointermove', function (e) {
    if (drag && e.pointerId === drag.id) {
      var maxLeft = Math.max(0, window.innerWidth - drag.el.offsetWidth);
      drag.el.style.left = Math.min(maxLeft, Math.max(0, e.clientX - drag.ox)) + 'px';
      var maxTop = Math.max(0, taskbarTop() - drag.el.offsetHeight - 12);
      drag.el.style.top = Math.min(maxTop, Math.max(0, e.clientY - drag.oy)) + 'px';
    }
    if (resize && e.pointerId === resize.id) {
      var maxWidth = Math.max(0, window.innerWidth - resize.el.offsetLeft - 12);
      var minWidth = Math.min(320, maxWidth);
      resize.el.style.width = Math.min(maxWidth, Math.max(minWidth, resize.w + e.clientX - resize.x)) + 'px';
      var maxHeight = Math.max(0, taskbarTop() - resize.el.offsetTop - 12);
      var minHeight = Math.min(200, maxHeight);
      resize.el.style.height = Math.min(maxHeight, Math.max(minHeight, resize.h + e.clientY - resize.y)) + 'px';
    }
  });
  function endPointer(e) {
    if (drag && (!e || e.pointerId === undefined || e.pointerId === drag.id)) drag = null;
    if (resize && (!e || e.pointerId === undefined || e.pointerId === resize.id)) resize = null;
  }
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);
  window.addEventListener('blur', function () { drag = null; resize = null; });
  window.addEventListener('resize', function () {
    wins.forEach(function (w) {
      if (w.el.style.display === 'none') return;
      clampWin(w.el);
    });
  });

  /* ---------- taskbar ---------- */

  function topVisible() {
    var top = null;
    wins.forEach(function (w) {
      if (w.el.style.display === 'none') return;
      if (!top || parseInt(w.el.style.zIndex, 10) > parseInt(top.el.style.zIndex, 10)) top = w;
    });
    return top;
  }

  function updateTaskbar() {
    var list = $('task-list');
    if (!list) return;
    var top = topVisible();
    list.textContent = '';
    wins.forEach(function (w, id) {
      var b = el('button', 'task-btn' + (w === top ? ' active' : ''), w.app.title);
      b.dataset.app = id;
      b.addEventListener('click', function () {
        if (w === topVisible()) { w.el.style.display = 'none'; updateTaskbar(); }
        else { w.el.style.display = 'flex'; clampWin(w.el); focusWin(w); }
      });
      list.appendChild(b);
    });
  }

  /* ---------- ikon desktop dan start menu ---------- */

  var PALETTE = ['#1e293b', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'];

  function renderIcons() {
    var icons = $('icons');
    icons.textContent = '';
    window.OS.apps.forEach(function (app, i) {
      var d = el('div', 'desktop-icon');
      var g = el('span', 'glyph');
      g.style.background = app.color || PALETTE[i % PALETTE.length];
      g.innerHTML = app.icon;           // icon berasal dari kode modul (bukan input pengguna)
      d.appendChild(g);
      d.appendChild(el('span', 'label', app.title));
      d.addEventListener('click', function () { openApp(app.id); });
      icons.appendChild(d);
    });
    renderStartMenu();
  }

  function renderStartMenu() {
    if (!startMenu) return;
    startMenu.textContent = '';
    startMenu.appendChild(el('div', 'start-title', 'Aplikasi'));
    window.OS.apps.forEach(function (app) {
      var item = el('div', 'start-item');
      var ic = el('span', 'start-icon'); ic.innerHTML = app.icon;
      item.appendChild(ic);
      item.appendChild(el('span', '', app.title));
      item.addEventListener('click', function () { startMenu.style.display = 'none'; openApp(app.id); });
      startMenu.appendChild(item);
    });
  }

  /* ---------- tray ---------- */

  function updateTray() {
    var m = $('tray-metrics');
    if (m) {
      var o = window.OS;
      m.textContent = 't=' + o.tick + ' · dispatch=' + o.metrics.dispatch + ' · pf=' + o.metrics.faults + ' · disk=' + o.metrics.diskOps;
    }
    var c = $('tray-clock');
    if (c) {
      var d = new Date();
      c.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
  }

  /* ---------- boot ---------- */

  function init() {
    startMenu = el('div');
    startMenu.id = 'start-menu';
    startMenu.style.display = 'none';
    $('desktop').appendChild(startMenu);

    $('start-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      startMenu.style.display = startMenu.style.display === 'none' ? 'flex' : 'none';
    });
    document.addEventListener('click', function () { startMenu.style.display = 'none'; });

    window.addEventListener('shell:apps-changed', renderIcons);
    window.addEventListener('shell:metrics-changed', updateTray);
    setInterval(updateTray, 1000);
    renderIcons();
    updateTray();
  }

  window.Shell = { openApp: openApp, closeApp: closeApp };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
