# Modul Disk Scheduling (MiniOS Desktop)

Pemilik: Hardiana · Branch: `feat/disk` · Folder: `modules/disk/`

## 1. Ceritanya dulu: apa itu disk scheduling?

Bayangkan hard disk seperti **lemari arsip panjang** dengan 200 laci bernomor 0 sampai 199. Ada satu petugas (disebut **head**) yang berjalan di depan lemari untuk mengambil berkas. Setiap kali pindah dari satu laci ke laci lain, petugas butuh waktu. Jarak yang ia tempuh itulah yang disebut **seek**.

Sekarang bayangkan banyak orang meminta berkas dari laci berbeda sekaligus: laci 98, 183, 37, dan seterusnya. Petugas bebas memilih **urutan** melayani mereka. Urutan yang pintar membuatnya berjalan lebih sedikit, dan urutan yang asal membuatnya lari bolak-balik.

Memilih urutan itu adalah tugas **algoritma penjadwalan disk**. Modul ini memperlihatkan tiga cara dan menghitung berapa total langkah yang ditempuh petugas.

## 2. Tiga cara memilih urutan

| Algoritma | Cara berpikirnya | Kelebihan | Kekurangan |
|---|---|---|---|
| **FCFS** | Layani sesuai urutan datang, seperti antre di loket | Adil | Bisa bolak-balik jauh |
| **SSTF** | Selalu ke request yang paling dekat dari posisi sekarang | Hemat langkah | Request yang jauh bisa menunggu lama. Jika jaraknya sama, dipilih laci bernomor lebih kecil |
| **SCAN** | Seperti lift: jalan ke satu arah sambil melayani semua yang searah, sampai ujung, lalu balik | Merata dan teratur | Harus ke ujung walau tidak ada request di sana |

**Contoh hitungan** (head di 53, antrean 98, 183, 37, 122, 14, 124, 65, 67):

| Algoritma | Total seek |
|---|---|
| FCFS | 640 |
| SSTF | 236 |
| SCAN naik | 331 |
| SCAN turun | 236 |

Angka inilah yang dipakai tes otomatis. SCAN di modul ini adalah versi buku teks, jadi **selalu sampai ujung disk** (199 atau 0). Itu sebabnya hasilnya 331, bukan 299 seperti versi LOOK.

## 3. Panduan memakai jendela Disk

1. **Pilih algoritma** (FCFS, SSTF, atau SCAN). Penjelasan singkatnya muncul tepat di bawah tombol.
2. **Isi antrean.** Ada dua cara:
   - Ketik angka silinder dipisah koma (misalnya `98, 183, 37`), lalu tekan **Tambah** atau Enter.
   - Dalam mode terintegrasi, jalankan proses di **Scheduler (CPU)**. Memory memproses dispatch tersebut dan request masuk ke Disk saat terjadi page fault.
3. **Atur Head awal** (opsional) dengan menarik slider. Slider hanya bisa ditarik sebelum simulasi mulai.
4. **Tekan Service Next.** Setiap tekan melayani satu request. Kotak berwarna di bawah antrean menjelaskan apa yang baru terjadi.
5. **Baca hasilnya:** Total Seek (jumlah langkah head) dan Jalur (titik yang dikunjungi).
6. **Reset** untuk mengulang dari awal, **Compare All** untuk membandingkan tiga algoritma dengan data contoh.

Tombol **?** di pojok kanan atas membuka panduan singkat di dalam jendela.

### Arti tampilan

| Tampilan | Artinya |
|---|---|
| Garis biru di lintasan | Posisi head sekarang; lintasan hanya untuk melihat posisi dan tidak bisa diklik |
| Titik oranye | Request yang masih menunggu |
| Kotak biru muda di atas | Petunjuk langkah berikutnya |
| Kotak hijau, biru, atau kuning | Hasil aksi terakhir (berhasil, info, atau peringatan) |
| Tombol ✕ di tabel | Menghapus satu request |
| Slider abu-abu | Terkunci karena simulasi sudah berjalan. Tekan Reset untuk membukanya |

### Kalau terasa tidak bereaksi

- **Service Next saat antrean kosong** memang tidak melayani apa-apa. Pesan kuning akan memberi tahu, lalu isi antrean dulu.
- **Pada SCAN**, satu tekanan kadang hanya menggeser head ke ujung disk tanpa melayani request. Itu normal, tekan lagi.
- **Pilihan arah** hanya muncul untuk SCAN, karena FCFS dan SSTF tidak memakainya.

## 4. Cara modul ini bekerja di dalam (bahasa sederhana)

Kode dibagi dua supaya rapi dan mudah dites.

- **`logic.js` adalah "otak hitung".** Ia hanya menerima data (algoritma, posisi head, antrean) dan mengembalikan jawaban (urutan kunjungan dan total seek). Ia tidak menyentuh layar, tidak menulis log, dan tidak mengubah data yang diberikan. Karena murni berhitung, mudah dicocokkan dengan angka buku teks.
- **`app.js` adalah "wajah dan penghubung".** Ia menggambar jendela, menerima klik, menyimpan keadaan (antrean, posisi head, total seek), lalu meminta `logic.js` menghitung langkah berikutnya.
- **`style.css` adalah dandanan.** Semua nama class berawalan `disk-` agar tidak bentrok dengan modul lain.

Satu fungsi di `logic.js` punya dua cara pakai:

- `run` menghitung **seluruh** perjalanan sekaligus (dipakai Compare All).
- `next` menghitung **satu langkah** (dipakai Service Next). `run` sama saja dengan `next` yang diulang sampai antrean habis, jadi hasil keduanya pasti konsisten.

### Berbicara dengan modul lain

Modul Disk **tidak pernah memanggil fungsi modul lain**. Mereka hanya saling mengirim pengumuman (event):

1. Scheduler (CPU) mengumumkan `os:dispatch`, lalu Memory memproses satu halaman.
2. Jika halaman tidak ada di memori, Memory mengumumkan `os:page-fault`.
3. **Disk mendengar pengumuman itu** dan menaruh request di antrean. Nomor silindernya adalah `page × 10` (maksimal 199).
4. Saat Service Next ditekan, Disk melayani satu request dan mengumumkan `os:disk-served`. Shell mencatatnya di penghitung.
5. Jika ada yang menekan Reset, semua modul mendengar `os:reset` dan kembali ke awal.

Dua aturan emas: **kirim event dulu, baru tulis log**, dan **pasang pendengar event sekali saja saat file dimuat** (bukan saat jendela dibuka), supaya Disk tetap menerima request walau jendelanya sedang ditutup.

## 5. Bahan untuk presentasi dan tanya jawab

**Penjelasan 1 menit:**
"Modul Disk mensimulasikan bagaimana sistem operasi memilih urutan melayani permintaan baca/tulis disk. Saya implementasikan tiga algoritma: FCFS, SSTF, dan SCAN. Perhitungannya saya pisah di `logic.js` supaya bisa dites otomatis dan cocok dengan angka buku teks (640, 236, 331). Di mode terintegrasi, request datang dari page fault modul Memory lewat event, bukan lewat pemanggilan fungsi langsung."

**Kemungkinan pertanyaan dosen:**

| Pertanyaan | Jawaban singkat |
|---|---|
| Kenapa SCAN 331, bukan 299? | SCAN buku teks harus sampai ujung disk (199). Yang berhenti di request terakhir adalah LOOK. |
| Kapan SSTF buruk? | Saat request dekat terus berdatangan, request yang jauh bisa tidak pernah dilayani (starvation). |
| Kenapa FCFS paling boros? | Tidak mempertimbangkan posisi head, jadi bisa bolak-balik (98 → 183 → 37 → ...). |
| Kenapa logika dipisah dari tampilan? | Supaya mudah dites dan dicocokkan dengan buku, serta tidak ketergantungan pada layar. |
| Dari mana request disk berasal? | Dari page fault Memory: halaman yang tidak ada di RAM harus diambil dari disk. |
| Kenapa antrean maksimal 30? | Batas dari kontrak modul, supaya simulasi tetap terbaca dan mudah dites. |

## 6. Cek cepat sebelum membuat PR

- [ ] Buka `index.html` lewat live server, lalu ikon Disk muncul dan jendelanya terbuka.
- [ ] Tombol **?**, **Service Next**, **Reset**, dan **Compare All** bisa ditekan dan memberi pesan yang jelas.
- [ ] Compare All menampilkan 640, 236, dan 331 dengan SSTF ditandai terkecil.
- [ ] `tests/test.html`: semua kasus Disk berstatus PASS.
- [ ] Hanya menyentuh `modules/disk/`. PR ditulis dengan hasil tes di deskripsinya.
