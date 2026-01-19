# 🚀 Panduan Menjalankan Chat App Online (Untuk Pemula)

Halo! Panduan ini dibuat khusus untuk Anda yang ingin membuat aplikasi chatting Anda bisa digunakan oleh orang lain di internet, tanpa harus paham istilah komputer yang rumit. 

Kita akan melakukan 3 langkah besar:
1. **Menaruh "Otak" (Backend)** di sebuah layanan bernama Railway.
2. **Menyambungkan "Tampilan" (Frontend)** ke otak tersebut.
3. **Mengunggah ke itch.io** agar bisa dimainkan di browser.

---

## 1. Menaruh "Otak" (Backend) di Internet

Backend adalah tempat pesan-pesan diproses. Kita akan menggunakan **GitHub** (gudang file online) dan **Railway** (untuk menjalankan filenya).

### A. Upload ke GitHub
1. Buat akun di [GitHub.com](https://github.com/).
2. Buat "Repository" baru (klik tombol **New** yang berwarna hijau). 
   - Beri nama: `my-chat-backend`.
   - Pilih **Public**.
3. Di komputer Anda, buka folder `Backend`.
4. Upload semua isi folder `Backend` ke GitHub (bisa langsung geser/drag-and-drop file ke halaman GitHub).
5. Klik **Commit changes**.

### B. Hubungkan ke Railway
1. Buat akun di [Railway.app](https://railway.app/) (login pakai akun GitHub tadi lebih mudah).
2. Klik **+ New Project** -> **Deploy from GitHub repository**.
3. Pilih repository `my-chat-backend` yang baru Anda buat.
4. Klik **Deploy Now**.
5. Tunggu prosesnya (ada lampu hijau kalau sudah selesai).
6. Pergi ke tab **Settings**, cari bagian **Public Networking**, lalu klik **Generate Domain**.
7. Anda akan dapat alamat seperti: `https://my-chat-backend-production.up.railway.app`. **Simpan alamat ini!**

> [!IMPORTANT]
> **PENTING:** Saat menyalin alamat di bawah, pastikan Anda menyertakan **`https://`** di depannya. Tanpa itu, aplikasi di itch.io tidak akan bisa tersambung.

---

## 2. Menyambungkan Tampilan (Frontend)

Sekarang kita harus memberi tahu tampilan aplikasi di mana "otak"-nya berada.

1. Buka folder `ItchDeployment` di komputer Anda.
2. Cari file bernama `app.js`, klik kanan, lalu pilih **Open with Notepad** (atau editor lain).
3. Cari bagian kode ini:
   ```javascript
   const connection = new signalR.HubConnectionBuilder()
       .withUrl("https://my-chatapp-backend.up.railway.app/chatHub") 
   ```
4. Ganti tulisan `https://my-chatapp-backend.up.railway.app` dengan **Alamat dari Railway** yang Anda simpan tadi.
   - *Penting:* Pastikan `/chatHub` di bagian belakang tidak terhapus.
   - Contoh: `.withUrl("https://alamat-anda-tadi.up.railway.app/chatHub")`
5. **Save** (Simpan) file tersebut.

---

## 3. Mengunggah ke itch.io

Langkah terakhir agar teman Anda bisa membukanya!

1. Buka folder `ItchDeployment`.
2. Pastikan ada 3 file penting: `index.html`, `styles.css`, dan `app.js` (yang baru Anda edit).
3. Blokir/Pilih ketiga file tersebut, klik kanan -> **Compress to ZIP file** (atau "Send to Compressed folder").
4. Beri nama file baru itu `chat-app-final.zip`.
5. Login ke [itch.io](https://itch.io/), klik **Dashboard** -> **Create new project**.
6. **Judul:** Isi bebas.
7. **Kind of project:** Pilih **HTML**.
8. **Upload:** Masukkan file `chat-app-final.zip` tadi.
9. Centang kotak **This file will be played in the browser**.
10. Klik **Save & View Page**.

**Selesai!** Aplikasi chat Anda sekarang sudah online dan bisa dibagikan link itch.io nya ke teman-teman.

