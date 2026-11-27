// modules/disk/app.js
// UI + event terintegrasi modul Disk Scheduling. Perhitungan ada di logic.js (DiskLogic).
(function () {
  'use strict';

  var ALGOS = ['FCFS', 'SSTF', 'SCAN'];
  var ALGO_DESC = {
    FCFS: 'Layani sesuai urutan datang. Adil, tetapi head bisa bolak-balik jauh.',
    SSTF: 'Selalu pilih request yang paling dekat dari head. Hemat gerakan, tetapi request yang jauh bisa menunggu lama.',
    SCAN: 'Head menyapu ke satu arah sambil melayani request, sampai ujung disk, lalu berbalik (seperti lift).'
  };
  var MAX_CYL = 199;
  var START_HEAD = 53;
  var MAX_QUEUE = 30;
  // Data klasik (Silberschatz) untuk Compare All
  var CLASSIC_QUEUE = [98, 183, 37, 122, 14, 124, 65, 67];

  var container = null; // elemen jendela saat terbuka, null saat tertutup

  // State disimpan di closure modul (bukan di DOM).
  var state = {
    algorithm: 'FCFS',
    head: START_HEAD,
    direction: 'up',
    totalSeek: 0,
    queue: [],            // [{ pid, page, cylinder }]
    path: [START_HEAD],   // titik yang pernah dikunjungi head
    status: { kind: 'info', text: '' }, // pesan hasil aksi terakhir
    inputText: '',        // isi kolom input manual
    compare: false,       // tampilkan panel Compare All
    compareSample: false, // pakai data contoh klasik bila antrean kosong
    helpOpen: false       // tampilkan panel bantuan (?)
  };

  function log(msg) {
    try { window.kirimLog('Disk', msg); } catch (e) { /* log tidak boleh merusak modul */ }
  }

  function setStatus(kind, text) {
    state.status = { kind: kind, text: text };
  }

  // Bungkus event handler agar error tidak merusak desktop.
  function safe(fn) {
    return function (ev) {
      try { fn(ev); } catch (e) { log('error: ' + e.message); }
    };
  }

  function resetState() {
    state.head = START_HEAD;
    state.direction = 'up';
    state.totalSeek = 0;
    state.queue = [];
    state.path = [START_HEAD];
    state.status = { kind: 'info', text: 'Simulasi dikembalikan ke awal.' };
    state.inputText = '';
    state.compare = false;
    state.compareSample = false;
    state.helpOpen = false;
  }

  // Slider "head awal" hanya boleh diubah sebelum head pernah bergerak.
  function isIdle() {
    return state.path.length === 1;
  }

  // ---------- helper DOM (textContent, jadi aman dari injeksi) ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function button(cls, label, tip, handler) {
    var b = el('button', cls, label);
    b.type = 'button';
    if (tip) b.title = tip;
    b.addEventListener('click', safe(handler));
    return b;
  }

  function pct(cyl) {
    return (cyl / MAX_CYL) * 100;
  }

  function pathText(path) {
    if (path.length > 8) return '… → ' + path.slice(-8).join(' → ');
    return path.join(' → ');
  }

  function dirName(d) {
    return d === 'up' ? 'naik (ke angka besar)' : 'turun (ke angka kecil)';
  }

  // Petunjuk langkah berikutnya, supaya pengguna tahu harus menekan apa.
  function hintText() {
    var hasQ = state.queue.length > 0;
    if (!hasQ && isIdle()) return 'Langkah 1: isi antrean. Ketik angka silinder lalu tekan Tambah, atau jalankan Dispatch di CPU hingga terjadi page fault.';
    if (hasQ && isIdle()) return 'Langkah 2: tekan Service Next untuk melayani satu request. Anda juga bisa menggeser slider Head awal dulu.';
    if (hasQ) return 'Tekan Service Next lagi sampai antrean habis.';
    return 'Selesai. Total seek: ' + state.totalSeek + '. Tekan Reset untuk mengulang, atau Compare All untuk membandingkan algoritma.';
  }

  // ---------- render ----------
  function render() {
    if (!container) return;
    container.textContent = '';
    var root = el('div', 'disk-root');
    container.appendChild(root);

    if (state.helpOpen) {
      root.appendChild(buildHelp());
    } else {
      buildMain(root);
    }
  }

  function buildMain(root) {
    // Petunjuk langkah + tombol bantuan
    var topbar = el('div', 'app-topbar');
    topbar.appendChild(el('div', 'app-hint', hintText()));
    var help = button('app-help-btn' + (state.helpOpen ? ' active' : ''), '?',
      state.helpOpen ? 'Tutup bantuan' : 'Bantuan: cara memakai modul ini', function () {
        state.helpOpen = !state.helpOpen;
        render();
      });
    help.setAttribute('aria-label', 'Bantuan');
    topbar.appendChild(help);
    root.appendChild(topbar);

    // Pilihan algoritma + penjelasan singkat
    var secAlgo = el('div', 'app-section');
    secAlgo.appendChild(el('div', 'app-label', 'Algoritma:'));
    var rowAlgo = el('div', 'app-row');
    ALGOS.forEach(function (a) {
      rowAlgo.appendChild(button('btn-algo' + (state.algorithm === a ? ' active' : ''), a,
        ALGO_DESC[a], function () { setAlgorithm(a); }));
    });
    secAlgo.appendChild(rowAlgo);
    secAlgo.appendChild(el('div', 'app-desc', ALGO_DESC[state.algorithm]));

    // Arah: hanya berlaku untuk SCAN
    if (state.algorithm === 'SCAN') {
      var rowDir = el('div', 'app-row disk-dir-row');
      rowDir.appendChild(el('span', 'app-label', 'Arah awal sapuan:'));
      [['up', 'Naik ↑'], ['down', 'Turun ↓']].forEach(function (d) {
        rowDir.appendChild(button('btn-algo' + (state.direction === d[0] ? ' active' : ''), d[1],
          'Head mulai bergerak ' + dirName(d[0]), function () { setDirection(d[0]); }));
      });
      secAlgo.appendChild(rowDir);
    } else {
      secAlgo.appendChild(el('div', 'disk-note', 'Pengaturan arah hanya dipakai oleh SCAN.'));
    }
    root.appendChild(secAlgo);

    // Lintasan head + slider head awal
    var secTrack = el('div', 'app-section');
    secTrack.appendChild(el('div', 'app-label', 'Lintasan disk (silinder 0 - ' + MAX_CYL + '):'));
    var track = el('div', 'disk-track');
    track.setAttribute('aria-label', 'Lintasan posisi head dan request disk');
    state.queue.forEach(function (r) {
      var dot = el('div', 'disk-dot');
      dot.style.left = pct(r.cylinder) + '%';
      track.appendChild(dot);
    });
    var headEl = el('div', 'disk-head');
    headEl.style.left = pct(state.head) + '%';
    track.appendChild(headEl);
    secTrack.appendChild(track);

    var scale = el('div', 'disk-scale');
    scale.appendChild(el('span', '', '0'));
    var headLabel = el('span', 'disk-headlabel', 'Head: ' + state.head);
    scale.appendChild(headLabel);
    scale.appendChild(el('span', '', String(MAX_CYL)));
    secTrack.appendChild(scale);

    var legend = el('div', 'disk-legend');
    var l1 = el('span', 'disk-legend-item');
    l1.appendChild(el('i', 'disk-swatch disk-swatch-head'));
    l1.appendChild(document.createTextNode(' Head (kepala baca)'));
    var l2 = el('span', 'disk-legend-item');
    l2.appendChild(el('i', 'disk-swatch disk-swatch-dot'));
    l2.appendChild(document.createTextNode(' Request menunggu'));
    legend.appendChild(l1);
    legend.appendChild(l2);
    secTrack.appendChild(legend);

    // Slider head awal (slider sungguhan, bisa ditarik saat belum ada pergerakan)
    var rowSl = el('div', 'app-row disk-slider-row');
    rowSl.appendChild(el('span', 'app-label', 'Head awal:'));
    var slider = el('input', 'disk-slider');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(MAX_CYL);
    slider.step = '1';
    slider.value = String(state.head);
    slider.disabled = !isIdle();
    slider.title = isIdle() ? 'Tarik untuk mengatur posisi awal head' : 'Terkunci karena simulasi sudah berjalan. Tekan Reset untuk membuka kunci.';
    var sliderVal = el('strong', 'disk-slider-val', String(state.head));
    var pathEl = null; // diisi di bawah; dipakai saat slider digeser
    slider.addEventListener('input', safe(function () {
      var v = Number(slider.value);
      state.head = v;
      state.path = [v];
      headEl.style.left = pct(v) + '%';
      headLabel.textContent = 'Head: ' + v;
      sliderVal.textContent = String(v);
      if (pathEl) pathEl.textContent = pathText(state.path);
    }));
    slider.addEventListener('change', safe(function () {
      setStatus('ok', 'Head awal diatur ke silinder ' + state.head + '.');
      log('head awal diatur ke ' + state.head);
      render();
    }));
    rowSl.appendChild(slider);
    rowSl.appendChild(sliderVal);
    secTrack.appendChild(rowSl);
    if (!isIdle()) secTrack.appendChild(el('div', 'disk-note', 'Slider terkunci karena simulasi sudah berjalan. Tekan Reset untuk mengubahnya lagi.'));
    root.appendChild(secTrack);

    // Total seek + jalur
    var secStat = el('div', 'app-section disk-stat');
    var seekLabel = el('div', 'app-label', 'Total Seek (jumlah geseran head): ');
    seekLabel.appendChild(el('strong', 'disk-seek', String(state.totalSeek)));
    secStat.appendChild(seekLabel);
    var pathLabel = el('div', 'app-label', 'Jalur: ');
    pathEl = el('span', 'disk-path', pathText(state.path));
    pathLabel.appendChild(pathEl);
    secStat.appendChild(pathLabel);
    root.appendChild(secStat);

    // Tabel antrean (tiap baris punya tombol hapus)
    var secQ = el('div', 'app-section');
    secQ.appendChild(el('div', 'app-label', 'Antrean Request (' + state.queue.length + '/' + MAX_QUEUE + '):'));
    var table = el('table', 'app-table');
    var thead = el('thead');
    var hr = el('tr');
    ['#', 'Page', 'PID', 'Cylinder', ''].forEach(function (h) { hr.appendChild(el('th', '', h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    if (state.queue.length === 0) {
      var er = el('tr');
      var ec = el('td', 'empty', '(antrean kosong)');
      ec.colSpan = 5;
      er.appendChild(ec);
      tbody.appendChild(er);
    } else {
      state.queue.forEach(function (r, i) {
        var tr = el('tr');
        [i + 1, r.page, r.pid, r.cylinder].forEach(function (v) { tr.appendChild(el('td', '', String(v))); });
        var tdDel = el('td');
        tdDel.appendChild(button('disk-del-btn', '✕', 'Hapus request ini dari antrean', function () { removeRequest(i); }));
        tr.appendChild(tdDel);
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    secQ.appendChild(table);
    root.appendChild(secQ);

    // Input manual
    var secIn = el('div', 'app-section');
    secIn.appendChild(el('div', 'app-label', 'Tambah request dengan mengetik (angka silinder 0-' + MAX_CYL + ', pisahkan dengan koma):'));
    var rowIn = el('div', 'app-row');
    var input = el('input', 'disk-input');
    input.type = 'text';
    input.placeholder = 'contoh: 98, 183, 37';
    input.value = state.inputText;
    input.addEventListener('input', function () { state.inputText = input.value; });
    input.addEventListener('keydown', safe(function (ev) { if (ev.key === 'Enter') addManual(); }));
    rowIn.appendChild(input);
    rowIn.appendChild(button('btn-secondary', 'Tambah', 'Masukkan angka di kolom ke antrean (atau tekan Enter)', addManual));
    secIn.appendChild(rowIn);
    root.appendChild(secIn);

    // Pesan hasil aksi terakhir (selalu terlihat agar pengguna tahu apa yang terjadi)
    if (state.status.text) root.appendChild(el('div', 'app-status app-status-' + state.status.kind, state.status.text));

    // Tombol utama
    root.appendChild(button('btn-primary disk-service', 'Service Next',
      'Layani satu request sesuai algoritma yang dipilih', serviceNext));

    var rowBtn = el('div', 'app-section app-row');
    rowBtn.appendChild(button('btn-secondary', 'Reset', 'Kembalikan semuanya ke awal (antrean kosong, head 53)', doReset));
    rowBtn.appendChild(button('btn-secondary' + (state.compare ? ' disk-active' : ''), 'Compare All',
      'Bandingkan FCFS, SSTF, dan SCAN memakai antrean dan head Anda saat ini', toggleCompare));
    root.appendChild(rowBtn);

    if (state.compare) root.appendChild(buildCompare());
  }

  // Panel bantuan (tombol ?)
  function buildHelp() {
    var panel = el('div', 'app-help');
    var sections = [
      ['Modul ini untuk apa?', [
        'Disk punya "head" yang harus bergeser ke nomor silinder (0-199) untuk mengambil data. Geserannya disebut seek.',
        'Modul ini menunjukkan bagaimana urutan melayani request mengubah total seek.'
      ]],
      ['Cara pakai', [
        '1. Pilih algoritma: FCFS, SSTF, atau SCAN.',
        '2. Tambahkan request lewat Scheduler (CPU) dan Memory: dispatch CPU diproses Memory, lalu page fault masuk ke antrean Disk. Request juga bisa ditambahkan dengan mengetik angka silinder di kolom input.',
        '3. Tekan Service Next. Satu tekan melayani satu request.',
        '4. Lihat Total Seek. Nilai lebih kecil berarti perpindahan head lebih sedikit.',
        'Mau tahu metode terbaik? Tekan Compare All sebelum Service Next.'
      ]],
      ['Arti tampilan', [
        'Lintasan hanya menampilkan posisi head (biru) dan request menunggu (oranye); lintasan tidak bisa diklik.',
        'Slider Head awal = posisi awal head. Terkunci setelah Service Next, buka lagi dengan Reset.',
        'Kolom Cylinder = tujuan head (dipakai untuk menghitung).',
        'Kolom Page dan PID = diisi otomatis oleh modul Memory saat page fault. Request buatan sendiri diberi tanda "-".',
        'Tombol ✕ = hapus satu request.',
        'Compare All = bandingkan total seek FCFS, SSTF, dan SCAN. Hanya menghitung, simulasi tidak berubah.'
      ]],
      ['Tiga algoritma', [
        'FCFS: sesuai urutan datang. Adil, tapi bisa bolak-balik jauh.',
        'SSTF: pilih request terdekat. Hemat, tapi request jauh bisa lama menunggu.',
        'SCAN: menyapu satu arah sampai ujung disk, lalu berbalik (seperti lift). Arah hanya berlaku untuk SCAN.'
      ]],
      ['Kalau tombol terasa diam', [
        'Antrean kosong: isi request dulu.',
        'Slider abu-abu: simulasi sudah jalan, tekan Reset.',
        'SCAN kadang hanya menggeser head ke ujung dulu. Tekan lagi.',
        'Tanda "-" di Page dan PID bukan error, artinya request manual.'
      ]]
    ];
    sections.forEach(function (s) {
      panel.appendChild(el('div', 'app-help-h', s[0]));
      s[1].forEach(function (line) { panel.appendChild(el('p', 'app-help-p', line)); });
    });
    panel.appendChild(button('btn-primary', 'Kembali ke simulasi', 'Tutup bantuan', function () {
      state.helpOpen = false;
      render();
    }));
    return panel;
  }

  // Panel Compare All: membandingkan metode memakai antrean dan head milik pengguna.
  // Bila antrean kosong, pengguna boleh melihat data contoh klasik. Tidak mengubah simulasi aktif.
  function buildCompare() {
    var sec = el('div', 'app-section disk-compare');
    var head, queue, label;

    if (state.queue.length > 0) {
      head = state.head;
      queue = state.queue.map(function (r) { return r.cylinder; });
      label = 'Dihitung dari data Anda: head ' + head + ', antrean ' + queue.join(', ') + '.';
    } else if (state.compareSample) {
      head = START_HEAD;
      queue = CLASSIC_QUEUE;
      label = 'Contoh klasik (antrean Anda masih kosong): head ' + head + ', antrean ' + queue.join(', ') + '. Isi antrean sendiri untuk membandingkan data Anda.';
    } else {
      sec.appendChild(el('div', 'app-status app-status-info',
        'Antrean masih kosong, jadi belum ada yang bisa dibandingkan. Isi antrean dulu (ketik angka atau lewat Memory), atau lihat contoh klasik.'));
      sec.appendChild(button('btn-secondary', 'Lihat contoh klasik', 'Bandingkan memakai data contoh buku teks', function () {
        state.compareSample = true;
        render();
      }));
      return sec;
    }

    sec.appendChild(el('div', 'app-label', label));
    if (state.queue.length > 0 && !isIdle()) {
      sec.appendChild(el('div', 'disk-note', 'Simulasi sudah berjalan, jadi yang dibandingkan hanya sisa antrean dari posisi head sekarang. Untuk membandingkan seluruh antrean, tekan Compare All sebelum Service Next.'));
    }

    // SCAN ditampilkan dua arah karena hasilnya bisa berbeda.
    var variants = [
      { name: 'FCFS', algo: 'FCFS', dir: 'up' },
      { name: 'SSTF', algo: 'SSTF', dir: 'up' },
      { name: 'SCAN (naik)', algo: 'SCAN', dir: 'up' },
      { name: 'SCAN (turun)', algo: 'SCAN', dir: 'down' }
    ];
    var results = [];
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      var r = window.DiskLogic.run({
        algorithm: v.algo, head: head, maxCylinder: MAX_CYL, direction: v.dir, queue: queue
      });
      if (!r.ok) {
        sec.appendChild(el('div', 'app-status app-status-warn', r.error.message));
        return sec;
      }
      results.push({
        name: v.name, total: r.result.totalSeek
      });
    }

    var totals = results.map(function (x) { return x.total; });
    var best = Math.min.apply(null, totals);
    var worst = Math.max.apply(null, totals);

    var table = el('table', 'app-table');
    var thead = el('thead');
    var hr = el('tr');
    ['Metode', 'Total Seek', 'Perbandingan', ''].forEach(function (h) { hr.appendChild(el('th', '', h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    results.forEach(function (x) {
      var isBest = x.total === best;
      var tr = el('tr', isBest ? 'disk-best' : '');
      tr.appendChild(el('td', '', x.name));
      tr.appendChild(el('td', '', String(x.total)));
      var tdBar = el('td');
      var wrap = el('div', 'disk-bar-wrap');
      var bar = el('div', 'disk-bar');
      bar.style.width = (worst > 0 ? (x.total / worst) * 100 : 0) + '%';
      wrap.appendChild(bar);
      tdBar.appendChild(wrap);
      tr.appendChild(tdBar);
      tr.appendChild(el('td', '', isBest ? '✓ terkecil' : ''));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    sec.appendChild(table);

    // Ringkasan dalam kalimat biasa
    var bestNames = results.filter(function (x) { return x.total === best; }).map(function (x) { return x.name; });
    var summary;
    if (worst === best) {
      summary = 'Semua metode menghasilkan total seek yang sama (' + best + ') untuk data ini.';
    } else {
      var worstNames = results.filter(function (x) { return x.total === worst; }).map(function (x) { return x.name; });
      summary = 'Paling hemat: ' + bestNames.join(' dan ') + ' (' + best + ' langkah). Paling boros: ' +
        worstNames.join(' dan ') + ' (' + worst + ' langkah), selisih ' + (worst - best) + ' langkah.';
    }
    sec.appendChild(el('div', 'disk-compare-sum', summary));

    return sec;
  }

  // ---------- aksi ----------
  function setAlgorithm(a) {
    state.algorithm = a;
    setStatus('info', 'Algoritma diganti ke ' + a + '. ' + ALGO_DESC[a]);
    log('algoritma → ' + a);
    render();
  }

  function setDirection(d) {
    state.direction = d;
    setStatus('info', 'Arah sapuan SCAN: ' + dirName(d) + '.');
    log('arah SCAN → ' + d);
    render();
  }

  function toggleCompare() {
    state.compare = !state.compare;
    state.compareSample = false;
    if (state.compare) log('Compare All ditampilkan (' + (state.queue.length > 0 ? 'data pengguna' : 'antrean kosong') + ')');
    render();
  }

  function doReset() {
    // Reset resmi lewat shell; shell mengirim os:reset yang ditangani listener di bawah.
    if (window.OS && typeof window.OS.reset === 'function') {
      window.OS.reset();
    } else {
      resetState();
      render();
    }
  }

  // Ubah teks "98, 183" menjadi daftar silinder yang valid.
  function parseCylinders(text) {
    var parts = String(text).split(',');
    var list = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p === '') continue;
      if (!/^\d+$/.test(p)) return { error: '"' + p + '" bukan angka silinder yang valid. Gunakan bilangan bulat 0-' + MAX_CYL + '.' };
      var n = Number(p);
      if (n > MAX_CYL) return { error: 'Silinder ' + n + ' melebihi batas ' + MAX_CYL + '.' };
      list.push(n);
    }
    if (list.length === 0) return { error: 'Kolom masih kosong. Ketik minimal satu angka silinder, misalnya 98.' };
    return { list: list };
  }

  // Tambah request manual/klik ke antrean. Mengembalikan true bila berhasil.
  function addRequests(list, source) {
    if (state.queue.length + list.length > MAX_QUEUE) {
      setStatus('warn', 'Antrean penuh: maksimal ' + MAX_QUEUE + ' request.');
      return false;
    }
    list.forEach(function (c) {
      state.queue.push({ pid: '-', page: '-', cylinder: c });
    });
    setStatus('ok', 'Request silinder ' + list.join(', ') + ' masuk antrean. Tekan Service Next untuk melayani.');
    log('request (' + source + ') masuk antrean: ' + list.join(', ') + ' (total ' + state.queue.length + ')');
    return true;
  }

  function addManual() {
    var parsed = parseCylinders(state.inputText);
    if (parsed.error) {
      setStatus('warn', parsed.error);
      render();
      return;
    }
    if (addRequests(parsed.list, 'manual')) state.inputText = '';
    render();
  }

  function removeRequest(i) {
    var r = state.queue.splice(i, 1)[0];
    if (!r) return;
    setStatus('info', 'Request silinder ' + r.cylinder + ' dihapus dari antrean.');
    log('request silinder ' + r.cylinder + ' dihapus dari antrean');
    render();
  }

  function serviceNext() {
    var res = window.DiskLogic.next({
      algorithm: state.algorithm,
      head: state.head,
      maxCylinder: MAX_CYL,
      direction: state.direction,
      queue: state.queue.map(function (r) { return r.cylinder; })
    });

    if (!res.ok) {
      setStatus('warn', res.error.message);
      log('error: ' + res.error.message);
      render();
      return;
    }

    var r = res.result;
    if (r.done) {
      setStatus('warn', 'Antrean kosong, belum ada yang dilayani. Tambahkan request dulu (ketik angka silinder lalu tekan Tambah, atau tunggu page fault dari Memory).');
      log('antrean kosong, tidak ada request untuk dilayani');
      render();
      return;
    }

    var from = state.head;
    state.head = r.newHead;
    state.direction = r.newDirection;
    state.totalSeek += r.seek;
    state.path.push(r.target);

    if (r.isRequest) {
      var idx = -1;
      for (var i = 0; i < state.queue.length; i++) {
        if (state.queue[i].cylinder === r.target) { idx = i; break; }
      }
      var req = idx >= 0 ? state.queue.splice(idx, 1)[0] : { pid: '-', page: '-' };
      // Urutan wajib: kirim event dulu, baru kirimLog.
      window.dispatchEvent(new CustomEvent('os:disk-served', {
        detail: { pid: req.pid, page: req.page, target: r.target, seek: r.seek }
      }));
      log(state.algorithm + ' → layani page ' + req.page + ' (' + req.pid + '), head=' + r.target + ', seek=' + r.seek);
      setStatus('ok', 'Dilayani: silinder ' + r.target + '. Head bergeser ' + r.seek + ' langkah (dari ' + from + ' ke ' + r.target + '). Total seek sekarang ' + state.totalSeek + '.');
    } else {
      // Gerak ke ujung SCAN: bukan request, tidak mengirim os:disk-served.
      log('SCAN → head ke ujung ' + r.target + ', seek=' + r.seek + ', arah berbalik ' + r.newDirection);
      setStatus('info', 'Tidak ada request lagi di arah ini, jadi head menyapu ke ujung disk (' + r.target + ') lalu berbalik arah ke ' + dirName(r.newDirection) + '. Belum ada request yang dilayani; tekan Service Next lagi.');
    }
    render();
  }

  // ---------- event terintegrasi (didaftarkan SEKALI saat file dimuat) ----------
  window.addEventListener('os:page-fault', function (e) {
    try {
      var d = (e && e.detail) || {};
      if (!Number.isInteger(d.page) || d.page < 0) {
        log('page-fault diabaikan: page tidak valid');
        return;
      }
      var cyl = Math.min(d.page * 10, MAX_CYL);
      if (state.queue.length >= MAX_QUEUE) {
        log('antrean penuh (' + MAX_QUEUE + '), request page ' + d.page + ' ditolak');
        return;
      }
      var pid = d.pid === undefined || d.pid === null ? '-' : d.pid;
      state.queue.push({ pid: pid, page: d.page, cylinder: cyl });
      setStatus('info', 'Dari Memory: page fault ' + pid + ' page ' + d.page + ' masuk antrean (silinder ' + cyl + ').');
      log('page fault ' + pid + ' page ' + d.page + ' → request silinder ' + cyl + ' masuk antrean');
      render();
    } catch (err) {
      log('error saat menerima page-fault: ' + err.message);
    }
  });

  window.addEventListener('os:reset', function () {
    try {
      resetState(); // algoritma pilihan pengguna tetap dipertahankan
      render();
    } catch (err) {
      log('error saat reset: ' + err.message);
    }
  });

  window.registerApp({
    id: 'disk',
    title: 'Disk Scheduling',
    width: 640,
    height: 560,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><circle cx="7" cy="15" r="1"></circle><path d="M11 15h6"></path></svg>',
    mount: function (el) {
      container = el;
      render();
    },
    unmount: function () { container = null; },
    getState: function () {
      return {
        algorithm: state.algorithm,
        head: state.head,
        direction: state.direction,
        totalSeek: state.totalSeek,
        queue: state.queue.map(function (r) { return r.cylinder; })
      };
    }
  });
})();