# 🤖 Anomali-Bot

Bot Discord yang mengintegrasikan Google Gemini API untuk menyediakan kemampuan AI generatif. Bot ini dirancang untuk memberikan solusi praktis untuk berbagai kebutuhan, mulai dari ekstraksi metadata gambar, OCR, generate caption sosial media, hingga chat AI.

## ✨ Fitur

### 🔍 Slash Commands (/)

- `/start` - Mulai sesi tanya jawab dengan AI
- `/end` - Akhiri sesi tanya jawab dengan AI
- `/help` - Tampilkan bantuan dan daftar semua fitur bot
- `/ping` - Cek respons dan latency bot
- `/generate <description>` - Membuat prompt AI Art dari deskripsi teks
- `/caption <description> [language]` - Buat caption sosial media dari deskripsi teks (pilih bahasa: Indonesia/Inggris)

### 🎨 Dot Commands (.)

- `.metadata` - Ekstrak metadata untuk stock photos (title, description, keywords, category, quality score, dll)
- `.ocr` - Ekstrak teks dari gambar menggunakan OCR
- `.generate` - Generate prompt AI Art dari gambar (untuk Midjourney, DALL-E, Stable Diffusion)
- `.caption [id/en]` - Buat caption dan hashtag untuk sosial media dari gambar
- `.dribbble` / `.dribble` - Buat title dan tags untuk portfolio Dribbble

### 💬 AI Chat

- Sesi tanya jawab interaktif dengan AI menggunakan Gemini 2.5-Flash
- History percakapan disimpan selama sesi aktif
- Maksimal 20 pesan dalam history untuk optimasi

## 🚀 Instalasi

### Prasyarat

- Node.js v16 atau lebih tinggi
- Discord Bot Token
- Google Gemini API Key

### Langkah-langkah

1. **Clone repository**

```bash
git clone <repository-url>
cd Anomali-Bot
```

2. **Install dependencies**

```bash
npm install
```

3. **Buat file `.env`**

```env
DISCORD_BOT_TOKEN=your_discord_bot_token_here
GEMINI_API_KEY=your_gemini_api_key_here
```

4. **Jalankan bot**

```bash
# Production
npm start

# Development (dengan auto-reload)
npm run dev
```

## 📋 Dependencies

- `discord.js` (^14.14.1) - Library untuk interaksi dengan Discord API
- `@google/generative-ai` (^0.2.1) - SDK untuk Google Gemini AI
- `dotenv` (^16.3.1) - Untuk mengelola environment variables

### Dev Dependencies

- `nodemon` (^3.0.2) - Auto-reload saat development

## 🎯 Penggunaan

### Ekstraksi Metadata Gambar

Upload gambar dengan command `.metadata` untuk mendapatkan metadata lengkap yang cocok untuk stock photo platforms seperti Shutterstock:

- Title yang SEO-friendly
- Deskripsi detail
- Keywords (10-50 keywords)
- Category dan subcategory
- Quality score (1-10)
- Saran untuk meningkatkan marketability

### OCR (Optical Character Recognition)

Upload gambar dengan command `.ocr` untuk mengekstrak semua teks yang ada dalam gambar.

### Generate AI Art Prompt

- Dari gambar: Upload gambar dengan command `.generate`
- Dari teks: Gunakan `/generate <description>`

Prompt yang dihasilkan cocok untuk AI art generators seperti Midjourney, DALL-E, atau Stable Diffusion.

### Generate Caption Sosial Media

- Dari gambar: Upload gambar dengan command `.caption` (tambahkan `id` atau `en` untuk bahasa)
- Dari teks: Gunakan `/caption <description> [language]`

Output mencakup:

- Caption yang menarik dan kreatif
- 20-30 hashtag relevan
- Saran untuk meningkatkan engagement

### Generate Dribbble Portfolio Content

Upload gambar desain dengan command `.dribbble` untuk mendapatkan:

- Title profesional dan kreatif
- 10-20 tags relevan untuk portfolio

### Chat AI

1. Mulai sesi dengan `/start`
2. Kirim pesan biasa untuk berinteraksi dengan AI
3. Akhiri sesi dengan `/end`

## 🔧 Konfigurasi

Bot menggunakan model **Gemini 2.5-Flash** untuk semua operasi AI. Model ini dapat diubah di file `index.js` jika diperlukan.

## 📝 Format Gambar yang Didukung

Bot mendukung berbagai format gambar:

- JPG/JPEG
- PNG
- GIF
- WebP
- Format gambar lainnya yang didukung oleh Discord

## ⚠️ Catatan Penting

- Bot memerlukan permission untuk membaca pesan dan mengirim pesan di channel
- Pastikan API key Gemini Anda memiliki quota yang cukup
- Response AI dibatasi maksimal 2000 karakter (batas Discord)
- History chat dibatasi maksimal 20 pesan per sesi

## 🐛 Troubleshooting

### Bot tidak merespons

- Pastikan bot sudah online dan terhubung ke server
- Cek apakah token Discord Bot valid
- Pastikan bot memiliki permission yang diperlukan

### Error saat memproses gambar

- Pastikan gambar yang diupload valid
- Cek koneksi internet
- Pastikan API key Gemini valid dan memiliki quota

### Error saat chat AI

- Pastikan sesi sudah dimulai dengan `/start`
- Cek apakah API key Gemini valid
- Pastikan tidak ada masalah dengan koneksi ke Gemini API

## 📄 License

MIT License

## 👤 Author

**Danenn.**

## 🙏 Acknowledgments

- Google Gemini AI untuk kemampuan AI generatif
- Discord.js untuk framework bot Discord
- Komunitas Discord untuk feedback dan dukungan

---

**Powered by Gemini AI 2.5-Flash** 🚀
