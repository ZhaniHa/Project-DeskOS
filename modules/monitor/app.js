// modules/monitor/app.js
// Tahap 4: perekaman event os:* dan getState().
(function () {
  'use strict';

  var container = null;   // elemen jendela saat terbuka, null saat tertutup
  var events = [];        // rekaman event { name, tick, detail } (state modul, bukan di DOM)
  var helpOpen = false;
  var sedangRender = false;
  var MAX_EVENTS = 500;

  // ---------- Pembantu DOM (semua teks lewat textContent) ----------

  function buat(tag, kelas, teks) {
    var e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined && teks !== null) e.textContent = String(teks);
    return e;
  }

  function sel(tr, teks) {
    tr.appendChild(buat('td', '', teks));
  }

  function kepala(teksList) {
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    teksList.forEach(function (t) { tr.appendChild(buat('th', '', t)); });
    thead.appendChild(tr);
    return thead;
  }

  // ---------- Pemformatan angka (di app.js, bukan di logic.js) ----------

  function persen(x) {
    return (x * 100).toFixed(1).replace(/\.0$/, '') + '%';
  }

  function dua(x) {
    return Number(x).toFixed(2);
  }

  // Teks detail satu event untuk tabel "15 event terakhir"
  function teksDetail(ev) {
    var d = ev.detail || {};
    if (ev.name === 'os:dispatch') return d.start + '-' + d.end;
    if (ev.name === 'os:page-fault') return 'page=' + d.page;
    return 'page=' + d.page + ';target=' + d.target + ';seek=' + d.seek;
  }

  // ---------- Ekspor berkas ----------

  function unduh(namaBerkas, isi, tipe) {
    var blob = new Blob([isi], { type: tipe });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = namaBerkas;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    try {
      var hasil = window.MonitorLogic.toCsv(events);
      if (!hasil.ok) {
        window.kirimLog('Monitor', 'gagal ekspor CSV: ' + hasil.error.message);
        return;
      }
      unduh('deskos-log.csv', hasil.result.csv, 'text/csv');
      window.kirimLog('Monitor', 'ekspor deskos-log.csv (' + events.length + ' event)');
    } catch (e) {
      window.kirimLog('Monitor', 'error saat ekspor CSV: ' + e.message);
    }
  }

  function exportLog() {
    try {
      var teks;
      var sumber = window.OS && window.OS.events;
      if (Array.isArray(sumber)) {
        // OS.events dari shell (bisa berupa string atau objek)
        teks = sumber.map(function (x) {
          return typeof x === 'string' ? x : JSON.stringify(x);
        }).join('\n');
      } else {
        // Cadangan: pakai rekaman milik modul sendiri
        teks = events.map(function (ev) {
          return '[t=' + ev.tick + '] ' + ev.name + ' ' +
                 (ev.detail && ev.detail.pid) + ' ' + teksDetail(ev);
        }).join('\n');
      }
      unduh('deskos-log.txt', teks, 'text/plain');
      window.kirimLog('Monitor', 'ekspor deskos-log.txt');
    } catch (e) {
      window.kirimLog('Monitor', 'error saat ekspor log: ' + e.message);
    }
  }

  // ---------- Bagian-bagian UI ----------

  function kartu(label, nilai) {
    var k = buat('div', 'moni-card');
    k.appendChild(buat('div', 'moni-card-value', nilai));
    k.appendChild(buat('div', 'moni-card-label', label));
    return k;
  }

  function bagianKartu(ringkasan) {
    var sec = buat('div', 'app-section');
    var grid = buat('div', 'moni-cards');
    grid.appendChild(kartu('Dispatch', ringkasan.counts.dispatch));
    grid.appendChild(kartu('Page Fault', ringkasan.counts.faults));
    grid.appendChild(kartu('Disk Ops', ringkasan.counts.diskOps));
    grid.appendChild(kartu('Fault Rate', persen(ringkasan.faultRate)));
    grid.appendChild(kartu('Rata-rata Seek', dua(ringkasan.avgSeek)));
    sec.appendChild(grid);
    return sec;
  }

  function bagianPerPid(ringkasan) {
    var sec = buat('div', 'app-section');
    sec.appendChild(buat('div', 'app-label', 'Per PID'));
    if (ringkasan.perPid.length === 0) {
      sec.appendChild(buat('div', 'empty', 'Belum ada data'));
      return sec;
    }
    var tabel = buat('table', 'app-table');
    tabel.appendChild(kepala(['PID', 'Dispatch', 'Page Fault']));
    var tbody = document.createElement('tbody');
    ringkasan.perPid.forEach(function (p) {
      var tr = document.createElement('tr');
      sel(tr, p.pid);
      sel(tr, p.dispatches);
      sel(tr, p.faults);
      tbody.appendChild(tr);
    });
    tabel.appendChild(tbody);
    sec.appendChild(tabel);
    return sec;
  }

  function bagianEventTerakhir() {
    var sec = buat('div', 'app-section');
    sec.appendChild(buat('div', 'app-label', '15 Event Terakhir'));
    if (events.length === 0) {
      sec.appendChild(buat('div', 'empty', 'Belum ada event'));
      return sec;
    }
    var tabel = buat('table', 'app-table');
    tabel.appendChild(kepala(['Tick', 'Event', 'PID', 'Detail']));
    var tbody = document.createElement('tbody');
    // Yang terbaru di atas
    var terakhir = events.slice(-15).reverse();
    terakhir.forEach(function (ev) {
      var tr = document.createElement('tr');
      sel(tr, ev.tick);
      sel(tr, ev.name);
      sel(tr, ev.detail && ev.detail.pid);
      sel(tr, teksDetail(ev));
      tbody.appendChild(tr);
    });
    tabel.appendChild(tbody);
    sec.appendChild(tabel);
    if (events.length === MAX_EVENTS) {
      sec.appendChild(buat('div', 'app-label', 'Ringkasan dibatasi pada ' + MAX_EVENTS + ' event terbaru.'));
    }
    return sec;
  }

  function ambilStatus(id) {
    try {
      if (window.OS && typeof window.OS.getState === 'function') {
        return window.OS.getState(id);
      }
    } catch (e) { /* abaikan, anggap tidak tersedia */ }
    return null;
  }

  function bagianStatusAplikasi() {
    var sec = buat('div', 'app-section');
    sec.appendChild(buat('div', 'app-label', 'Status Aplikasi'));
    var tabel = buat('table', 'app-table');
    tabel.appendChild(kepala(['Aplikasi', 'Status']));
    var tbody = document.createElement('tbody');
    [['CPU', 'scheduler'], ['Memory', 'memory'], ['Disk', 'disk']].forEach(function (a) {
      var st = ambilStatus(a[1]);
      var tr = document.createElement('tr');
      sel(tr, a[0]);
      sel(tr, st === null || st === undefined ? 'tidak tersedia' : JSON.stringify(st));
      tbody.appendChild(tr);
    });
    tabel.appendChild(tbody);
    sec.appendChild(tabel);
    return sec;
  }

  function bagianTombol() {
    var sec = buat('div', 'app-section');
    var baris = buat('div', 'app-row');
    var b1 = buat('button', 'btn-primary', 'Export CSV');
    var b2 = buat('button', 'btn-secondary', 'Export Log');
    b1.type = 'button';
    b2.type = 'button';
    b1.title = 'Unduh seluruh rekaman event dalam format CSV';
    b2.title = 'Unduh log sistem dalam format teks (.txt)';
    b1.addEventListener('click', exportCsv);
    b2.addEventListener('click', exportLog);
    baris.appendChild(b1);
    baris.appendChild(b2);
    sec.appendChild(baris);
    return sec;
  }

  function hintText() {
    if (events.length === 0) {
      return 'System Monitor merekam aktivitas CPU, Memory, dan Disk secara real-time. Jalankan Dispatch di CPU untuk mulai melihat data.';
    }
    return 'System Monitor aktif: ' + events.length + ' event terekam (' + Math.min(events.length, 15) + ' terbaru ditampilkan di tabel).';
  }

  function buildHelp() {
    var panel = buat('div', 'app-help');
    var sections = [
      ['Modul ini untuk apa?', [
        'System Monitor merekam event lintas modul (os:dispatch, os:page-fault, os:disk-served) dan menampilkan ringkasan performa DeskOS secara real-time.'
      ]],
      ['Cara pakai', [
        '1. Jalankan simulasi dari modul CPU (Dispatch), Memory (Next Reference), atau Disk (Service Next).',
        '2. Rekaman tetap berjalan meskipun jendela System Monitor sempat ditutup.',
        '3. Gunakan Export CSV atau Export Log untuk mengunduh hasil rekaman simulasi.'
      ]],
      ['Arti metrik & tampilan', [
        'Dispatch / Page Fault / Disk Ops: total kejadian sejak Reset terakhir.',
        'Fault Rate: rasio Page Fault terhadap jumlah Dispatch.',
        'Rata-rata Seek: rata-rata perpindahan head Disk per operasi layanan.',
        'Per PID & 15 Event Terakhir: rincian beban tiap proses dan riwayat event terbaru.',
        'Status Aplikasi: ringkasan state terkini dari modul CPU, Memory, dan Disk.'
      ]]
    ];
    sections.forEach(function (s) {
      panel.appendChild(buat('div', 'app-help-h', s[0]));
      s[1].forEach(function (line) { panel.appendChild(buat('p', 'app-help-p', line)); });
    });
    var backBtn = buat('button', 'btn-primary', 'Kembali ke monitor');
    backBtn.type = 'button';
    backBtn.title = 'Tutup bantuan';
    backBtn.addEventListener('click', function () {
      helpOpen = false;
      render();
    });
    panel.appendChild(backBtn);
    return panel;
  }

  // Gambar ulang dari state modul (state disimpan di variabel modul, bukan di DOM).
  function render() {
    if (!container || sedangRender) return;
    sedangRender = true;
    try {
      container.textContent = '';

      if (helpOpen) {
        container.appendChild(buildHelp());
        return;
      }

      var topbar = buat('div', 'app-topbar');
      topbar.appendChild(buat('div', 'app-hint', hintText()));
      var helpBtn = buat('button', 'app-help-btn', '?');
      helpBtn.type = 'button';
      helpBtn.title = 'Bantuan: cara membaca System Monitor';
      helpBtn.setAttribute('aria-label', 'Bantuan');
      helpBtn.addEventListener('click', function () {
        helpOpen = true;
        render();
      });
      topbar.appendChild(helpBtn);
      container.appendChild(topbar);

      var hasil = window.MonitorLogic.summarize(events);
      var ringkasan = hasil.ok ? hasil.result : {
        counts: { dispatch: 0, faults: 0, diskOps: 0 },
        faultRate: 0, avgSeek: 0, perPid: []
      };

      container.appendChild(bagianKartu(ringkasan));
      container.appendChild(bagianPerPid(ringkasan));
      container.appendChild(bagianEventTerakhir());
      container.appendChild(bagianStatusAplikasi());
      container.appendChild(bagianTombol());
    } finally {
      sedangRender = false;
    }
  }

  // ---------- Perekaman event (Tahap 4) ----------

  // Nilai tick saat ini dari shell; 0 bila tidak valid (supaya rekaman tetap lolos validasi logic.js)
  function tickSekarang() {
    var t = window.OS && window.OS.tick;
    return (typeof t === 'number' && isFinite(t) && Math.floor(t) === t && t >= 0) ? t : 0;
  }

  // Membuat pendengar untuk satu nama event. Didaftarkan sekali saat file dimuat.
  function rekam(nama) {
    window.addEventListener(nama, function (e) {
      try {
        var detail = (e && e.detail) || {};
        // pid wajib string (kontrak logic.js); bila tidak, abaikan event ini
        if (typeof detail.pid !== 'string') {
          window.kirimLog('Monitor', 'event ' + nama + ' diabaikan: pid bukan string');
          return;
        }
        var tick = tickSekarang();
        var entry = { name: nama, tick: tick, detail: detail };
        var last = events.length > 0 ? events[events.length - 1] : null;
        if (nama === 'os:dispatch' && last && last.name === 'os:page-fault' &&
            last.tick === tick && last.detail && last.detail.pid === detail.pid) {
          events.splice(events.length - 1, 0, entry);
        } else {
          events.push(entry);
        }
        if (events.length > MAX_EVENTS) events.shift();
        render();   // render() sendiri berhenti bila container === null
      } catch (err) {
        window.kirimLog('Monitor', 'error saat merekam ' + nama + ': ' + err.message);
      }
    });
  }

  rekam('os:dispatch');
  rekam('os:page-fault');
  rekam('os:disk-served');
  window.addEventListener('os:log', function () {
    if (container) render();
  });

  // Listener event os:* didaftarkan SEKALI di sini (bukan di mount),
  // supaya tetap berjalan walaupun jendela modul sedang ditutup.
  window.addEventListener('os:reset', function () {
    try {
      events = [];
      helpOpen = false;
      render();
    } catch (e) {
      window.kirimLog('Monitor', 'error saat reset: ' + e.message);
    }
  });

  window.registerApp({
    id: 'monitor',
    title: 'System Monitor',
    width: 600,
    height: 560,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M7 21h10M12 17v4"></path><path d="m6 11 3-3 3 5 3-4 3 2"></path></svg>',
    mount: function (el) {
      container = el;
      render();
    },
    unmount: function () { container = null; },
    // Ringkasan state sesuai kontrak: { events, counts: { dispatch, faults, diskOps } }
    getState: function () {
      var hasil = window.MonitorLogic.summarize(events);
      var c = hasil.ok ? hasil.result.counts : { dispatch: 0, faults: 0, diskOps: 0 };
      return {
        events: events.length,
        counts: { dispatch: c.dispatch, faults: c.faults, diskOps: c.diskOps }
      };
    },
  });
})();