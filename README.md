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
