# MiniOS Desktop

Aplikasi web simulator sistem operasi dengan **tiga modul inti** (CPU Scheduler, Memory Manager, Disk Scheduler) dan **dua modul pendukung** (System Monitor, Analytics) yang saling terhubung melalui event. Mendukung 9 algoritma: CPU (**FCFS**, **SJF**, **Round Robin**), Memory (**FIFO**, **LRU**, **Optimal**), dan Disk (**FCFS**, **SSTF**, **SCAN**), dengan algoritma bawaan **RR** (CPU) dan **LRU** (Memory). [Lihat Live Demo](https://zhaniha.github.io/Project-MiniOS-Desktop/)

## Menjalankan di komputer

Buka folder ini lewat server lokal (jangan klik dua kali `index.html`, karena `fetch` dan pemuatan script bisa diblokir browser):

```bash
npx serve .
```

Atau gunakan ekstensi Live Server di VS Code, lalu buka alamat yang ditampilkan. Untuk GitHub Pages, cukup aktifkan Pages dari branch `main`.

## Alur antar modul

```text
[CPU: Dispatch] ──os:dispatch──▶ [Memory: proses 1 referensi]
                                        │ (bila page fault)
                                        ▼
[Disk: Service Next] ◀──os:page-fault──┘
        │
        ▼ os:disk-served
[System Monitor & Analytics] (merekam seluruh event secara real-time)
```

## Struktur

```
index.html            halaman desktop
styles/desktop.css    gaya shell dan class bersama
shell/os.js           API: registerApp, kirimLog, OS
shell/windows.js      jendela, taskbar, start menu, tray
shell/terminal.js     aplikasi Terminal
shell/loader.js       memuat semua folder modul otomatis (file yang belum ada dilewati)
modules/_template/    template Hello World (salin, jangan diubah)
modules/cpu/          logic.js, app.js, style.css (opsional)
modules/memory/       logic.js, app.js, style.css (opsional)
modules/disk/         logic.js, app.js, style.css (opsional)
modules/monitor/      System Monitor
modules/analytics/    Analytics
tests/test.html       gerbang uji logika (semua modul)
tests/integration.html  uji alur CPU → Memory → Disk lewat event
```

## Aturan tim

1. Dilarang push ke `main`. Buat branch (`feat/cpu`, `feat/memory`, `feat/disk`) lalu ajukan Pull Request.
2. Hanya mengubah folder modul sendiri. Jangan mengubah `index.html`, `shell/*`, atau `tests/*`.
3. Mulai dari Hello World (salin `modules/_template/app.js`), pastikan muncul di desktop, baru menulis logika.
4. Sebelum PR: buka `tests/test.html`, semua kasus modulmu harus PASS. Modul lain yang belum ada tampil SKIP (bukan error).
   `tests/integration.html` dijalankan System Architect setelah semua modul digabung.
