# Pack Forge

Animasyonlu Pokemon TCG paket açma simülatörü. TCGdex API'den canlı set ve kart verisi çeker, seçilen set için booster havuzu hazırlar, kartları tek tek reveal eder ve koleksiyonu tarayıcıda saklar.

## Özellikler

- TCGdex REST API ile set listesi, set detayı ve kart detayı çekme
- Dil seçimi: EN, FR, DE, ES, IT, PT-BR
- 6, 10 veya 12 kartlık paket açma
- Paket yırtılma, kart çekme, flip ve foil parıltı animasyonları
- Rarity tabanlı pack generation: common, uncommon, rare ve hit slotları
- LocalStorage koleksiyon sistemi
- Son paket geçmişi ve set tamamlama sayacı
- GitHub Pages uyumlu statik Vite build
- Opsiyonel login/register altyapısı: Pages'te kapalı, self-host kullanımda env ile açılır

## Kurulum

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Opsiyonel Auth Altyapısı

GitHub Pages statik çalıştığı için login/register varsayılan olarak kapalıdır. Source'u indirip kendi sunucusunda kullanacak kişi auth API'yi aktif edebilir.

1. `.env.example` dosyasını `.env.local` olarak kopyala.
2. Frontend için `VITE_AUTH_ENABLED=true` yap.
3. `JWT_SECRET` değerini en az 32 karakterlik rastgele bir değerle değiştir.
4. İki terminalde çalıştır:

```bash
npm run dev
npm run dev:auth
```

Auth API endpointleri:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Kullanıcılar varsayılan olarak `.data/users.json` içinde bcrypt hash ile saklanır. `.data` git'e eklenmez.

## GitHub Pages

Bu proje `.github/workflows/pages.yml` ile GitHub Actions üzerinden Pages deploy etmeye hazırdır.

1. Repoyu GitHub'a pushla.
2. Repository `Settings -> Pages` bölümünde source olarak `GitHub Actions` seç.
3. `main` branch'e her push sonrası build otomatik yayınlanır.

## API

Kullanılan TCGdex uçları:

- `https://api.tcgdex.net/v2/en/sets`
- `https://api.tcgdex.net/v2/en/sets/{setId}`
- `https://api.tcgdex.net/v2/en/cards/{cardId}`

Kart görselleri TCGdex asset formatıyla kullanılır:

- `{image}/low.webp`
- `{image}/high.webp`

Dokümantasyon: https://tcgdex.dev/
