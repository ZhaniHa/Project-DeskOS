# DeskOS

**DeskOS** adalah aplikasi web simulator sistem operasi berbasis desktop dengan **tiga modul inti** (CPU Scheduler, Memory Manager, Disk Scheduler) dan **dua modul pendukung** (System Monitor, Analytics) yang saling terhubung melalui event (`CustomEvent`). Dibangun dengan HTML, CSS, dan JavaScript murni tanpa library eksternal maupun backend. Mendukung 9 algoritma: CPU (**FCFS**, **SJF**, **Round Robin**), Memory (**FIFO**, **LRU**, **Optimal**), dan Disk (**FCFS**, **SSTF**, **SCAN**), dengan algoritma bawaan **RR** (CPU), **LRU** (Memory), dan **FCFS** (Disk). [Lihat Live Demo](https://zhaniha.github.io/Project-DeskOS/)

## Cara instalasi dan menjalankan

Proyek ini tidak membutuhkan proses build atau instalasi dependency tambahan.

1. Clone repositori ini:

```bash
git clone https://github.com/ZhaniHa/Project-DeskOS.git
cd Project-DeskOS
```

2. Jalankan lewat server lokal (jangan klik dua kali `index.html`, karena `fetch` dan pemuatan script bisa diblokir browser):

```bash
npx serve .
```

Atau gunakan ekstensi **Live Server** di VS Code, lalu buka alamat yang ditampilkan di browser. Untuk GitHub Pages, cukup aktifkan Pages dari branch `main`.

## Cara penggunaan

### 1. Navigasi desktop
- Klik ikon aplikasi di desktop atau buka melalui menu Start (`⊞`) di taskbar kiri bawah.
- Jendela dapat digeser (*drag*), diubah ukurannya (*resize* dari sudut kanan bawah), diperkecil (`─`), dan ditutup (`✕`).
- Bilah status (*tray*) di kanan bawah menampilkan ringkasan real-time (`t`, `dispatch`, `pf`, `disk`) dan jam, sedangkan **Terminal** mencatat seluruh log simulasi.
- Setiap modul memiliki tombol bantuan (`?`) di kanan atas jendela untuk membuka panduan ringkas di dalam aplikasi.

### 2. Alur simulasi terintegrasi (CPU → Memory → Disk)
1. Buka **Scheduler (CPU)** (bawaan **RR**, quantum `2`, proses `P1:6, P2:3, P3:8, P4:2`), pilih algoritma atau ubah daftar proses (`Nama:Burst` atau `Nama:Burst:Arrival`), lalu klik **Dispatch**.
2. Setiap klik **Dispatch** mengirim event `os:dispatch` yang otomatis memajukan satu referensi di **Memory (Page Replacement)** (bawaan **LRU**, 4 frame, `7,0,1,2,0,3,0,4,2,3,0,3,2`). Bila terjadi *page fault*, Memory mengirim `os:page-fault` ke **Disk Scheduling** dengan silinder tujuan `min(page × 10, 199)`.
3. Buka **Disk Scheduling** (bawaan **FCFS**, head awal `53`), lalu klik **Service Next** untuk melayani satu request dari antrean dan mengirim `os:disk-served`.
4. Buka **System Monitor** untuk melihat ringkasan metrik, statistik per PID, 15 event terakhir, status aplikasi, serta mengunduh **Export CSV** (`deskos-log.csv`) dan **Export Log** (`deskos-log.txt`).
5. Buka **Analytics** untuk melihat 4 grafik SVG (perbandingan CPU, Memory, Disk, dan Timeline Event kumulatif) beserta tombol **Refresh** dan **Unduh SVG** pada tiap grafik.

### 3. Mode mandiri, perbandingan, dan reset
- Setiap modul inti juga dapat dijalankan secara mandiri menggunakan tombol **Dispatch** (CPU), **Next Reference** (Memory), atau **Tambah** dan **Service Next** (Disk).
- Gunakan **Compare All** di modul CPU, Memory, atau Disk untuk membandingkan seluruh algoritma pada data yang sama tanpa mengubah simulasi aktif.
- Gunakan **Reset** untuk mengembalikan `tick`, metrik, dan seluruh modul ke kondisi awal.

## Pengujian

Buka halaman tes berikut melalui server lokal:
- `tests/test.html` — unit test logika murni (`logic.js`) seluruh modul.
- `tests/integration.html` — tes integrasi alur event `os:dispatch` → `os:page-fault` → `os:disk-served` serta ketahanan listener saat jendela ditutup.

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

## Anggota tim

| No | Nama | NPM | Peran | Modul / Fokus | Branch |
|---|---|---|---|---|---|
| 1 | Ridhiya Syarahani Nadzra | 257006111145 | Ketua Kelompok & Developer System Monitor | `modules/monitor/` | `feat/monitor` |
| 2 | Hazmi Adzani Awanisi | 257006111130 | System Architect & Developer Memory Manager | `shell/` & `modules/memory/` | `feat/memory` |
| 3 | Arsha Diaz Raditya | 257006111139 | Developer CPU Scheduler | `modules/cpu/` | `feat/cpu` |
| 4 | Hardiana | 257006111150 | Developer Disk Scheduler | `modules/disk/` | `feat/disk` |
| 5 | Archen Ribiam Putra Sapaat | 257006111133 | Developer Analytics | `modules/analytics/` | `feat/analytics` |
| 6 | Naysa Sri Izzati | 257006111142 | QA & Presentasi | `tests/` | `feat/tests` |

## Aturan tim

1. Dilarang push ke `main`. Buat branch (`feat/cpu`, `feat/memory`, `feat/disk`) lalu ajukan Pull Request.
2. Hanya mengubah folder modul sendiri. Jangan mengubah `index.html`, `shell/*`, atau `tests/*`.
3. Mulai dari Hello World (salin `modules/_template/app.js`), pastikan muncul di desktop, baru menulis logika.
4. Sebelum PR: buka `tests/test.html`, semua kasus modulmu harus PASS. Modul lain yang belum ada tampil SKIP (bukan error).
   `tests/integration.html` dijalankan System Architect setelah semua modul digabung.
