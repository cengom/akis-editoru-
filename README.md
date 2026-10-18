# Akış Editörü

Tarayıcıda çalışan bir **süreç / akış ve VSM diyagramı editörü**. Kutuları sürükleyip bırakarak iş
süreçlerinizi çizebilir, oklarla bağlayabilir, çizimi JSON dosyası olarak saklayabilir ve isterseniz
**buluta** kaydedebilirsiniz.

İki kayıt modu vardır:

| Mod | Ne zaman | Nerede saklanır |
| --- | --- | --- |
| **💾 Yerel taslak** | Giriş yapmadan ya da bulut projesi açık değilken | Yalnızca bu tarayıcıda (otomatik) |
| **☁ Buluta kayıtlı proje** | Giriş yapıp bir bulut projesi açtığınızda | Supabase veritabanında ("Kaydet" ile) |

Bulut ayarlanmamışsa (Supabase bilgileri girilmemişse) uygulama yalnızca yerel taslakla çalışır.

## Kurulum

Gerekenler: **Node.js 20.19+ veya 22.12+** (geliştirildiği sürüm: Node 24.21.0, npm 11.19.0).

```bash
git clone https://github.com/cengom/akis-editoru-.git
cd akis-editoru-
npm install
```

## Çalıştırma

```bash
npm run dev
```

Sonra tarayıcıda **http://localhost:5173** adresini açın.

Diğer komutlar:

| Komut | Ne yapar |
| --- | --- |
| `npm run dev:sahte-bulut` | Supabase olmadan bulut ekranlarını denemek için **sahte bulutlu** geliştirme sunucusu (http://localhost:5174). Veriler gerçek sunucuya gitmez; yalnızca o tarayıcıda durur. |
| `npm run typecheck` | TypeScript tür kontrolü |
| `npm run kilavuz` | VSM rehberinin ekran görüntülerini ve PDF'ini yeniden üretir (önce `npm run dev` açık olmalı; bilgisayardaki Google Chrome'u ayrı, geçici bir profille kullanır) |
| `npm test` | Otomatik hesap testleri (Vitest): takt, OEE, stok günü, lead time, ürün aileleri, eski dosya geçişleri |
| `npm run build` | Tür kontrolü + üretim derlemesi (`dist/` klasörü) |
| `npm run preview` | Derlenmiş sürümü yerelde açar |

### Otomatik testler (GitHub Actions)

GitHub'a her push'ta (ve pull request'te) `.github/workflows/test.yml` çalışır: bağımlılıkları kurar,
tür kontrolü, hesap testleri (`npm test`) ve üretim derlemesi yapar. Sonucu GitHub'da deponun
**Actions** sekmesinde ya da commit'in yanındaki ✓ / ✗ işaretinde görürsünüz. Ücretsizdir ve gizli
anahtar kullanmaz. Vercel de yayından önce testleri çalıştırır (`vercel.json`: `npm test && npm run build`): bir test
başarısız olursa Vercel derlemesi durur ve **önceki sürüm yayında kalır**.

## Bulut kaydını kurma (Supabase, ücretsiz katman)

Bu adımları **siz** yapmalısınız; hesap ve proje sizin adınıza açılır.

1. **Hesap ve proje:** https://supabase.com adresinde ücretsiz hesap açın → **New project**. Bölge olarak
   size yakın birini (ör. Frankfurt) seçin. Veritabanı şifresini güvenli bir yere kaydedin (uygulamada
   kullanılmaz).
2. **Tabloyu ve güvenlik kurallarını oluşturun:** Sol menüden **SQL Editor** → **New query** →
   [`supabase/migrations/20261018000000_diagrams.sql`](supabase/migrations/20261018000000_diagrams.sql)
   dosyasının tamamını yapıştırıp **Run**. Bu dosya `diagrams` tablosunu, `updated_at` tetikleyicisini ve
   Row Level Security kurallarını kurar (her kullanıcı yalnızca kendi diyagramlarını görür ve değiştirir).
3. **Misafir girişini açın:** **Authentication → Sign In / Providers** (ya da *Auth Providers*) →
   **Allow anonymous sign-ins** seçeneğini açıp kaydedin. Uygulama şu an e-posta/şifre istemeden bu
   yöntemle giriş yapar.
4. **Bağlantı bilgileri:** **Project Settings → API** (ya da *API Keys*) sayfasından **Project URL** ve
   **anon / publishable** anahtarını alın. Proje klasöründe `.env.example` dosyasını `.env.local` adıyla
   kopyalayıp doldurun:
   ```bash
   cp .env.example .env.local
   ```
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (ya da sb_publishable_...)
   ```
   `.env.local` git'e eklenmez. **`service_role` / secret anahtarını asla buraya yazmayın**; o anahtar
   tüm güvenlik kurallarını atlar.
5. `npm run dev` ile yeniden başlatın. Üst çubukta "Giriş yap" görünür.

**Veri modeli:** Her diyagram `diagrams` tablosunda bir satırdır: `id`, `user_id`, `name`,
`document_json` (uygulamanın tam JSON belgesi: `schemaVersion`, `viewport`, `vsmMap`, `nodes`, `edges`),
`created_at`, `updated_at`. Belge sütunlara bölünmez. Buluttan gelen belge de içe aktarılan dosya gibi
doğrulanır.

### Misafir hesabı hakkında (önemli)

Giriş için e-posta ya da şifre gerekmez: "Giriş yap" bu tarayıcıya bağlı bir **misafir hesabı** açar.
Bunun sonuçları:

- Projeler bulutta durur ama hesaba **yalnızca bu tarayıcıdan** ulaşılır. **Başka bilgisayardan aynı
  projeleri görmek şu an mümkün değildir** (bunun için hesaba e-posta bağlama özelliği gerekir; bkz.
  `TASKS.md`).
- Tarayıcı verileri silinirse ya da **"Çıkış yap"** derseniz misafir hesabına bir daha giriş yapılamaz
  ve o hesabın projelerine ulaşılamaz. Uygulama çıkışta bunu ayrıca uyarır.
- Önemli çizimler için "JSON dışa aktar" ile yedek alın.

### İnternette yayımlama (Vercel veya Cloudflare Pages)

Uygulama tek sayfalık statik bir sitedir; sunucu kodu yoktur.

- **Derleme komutu:** `npm run build` · **Çıktı klasörü:** `dist`
- Barındırma panelinde ortam değişkenleri olarak `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` girin
  (değişkenler derleme sırasında koda gömülür; değiştirince yeniden derleyin).
- Supabase panelinde **Authentication → URL Configuration → Site URL** alanına yayın adresini yazın.
- Ücretsiz katmanda misafir girişleri kötüye kullanıma açıktır; herkese açık yayından önce Supabase'in
  CAPTCHA korumasını açmanız önerilir.

## Nasıl kullanılır?

Adım adım **VSM rehberi** uygulamanın içindedir: üst çubukta **"? Kılavuz"** (ya da
`/kilavuz/index.html`). Rehber hazırlıktan gelecek durum ve kaizen planına kadar VSM'yi uygulamanın örnek
süreciyle anlatır; sayfadan **PDF olarak indirilebilir** (`public/kilavuz/akis-editoru-vsm-rehberi.pdf`).
Aşağıda kısa bir özet var.

- **Şekil eklemek:** Soldaki paletten bir şekli tuvale sürükleyip bırakın ya da şekle tıklayın.
  Şekiller: Başlangıç/Bitiş, Proses, Karar, Departman, Not.
- **Taşımak:** Şekli fareyle sürükleyin. Seçili şeklin köşelerinden boyutunu değiştirebilirsiniz.
- **Bağlamak:** Fareyi şeklin üzerine getirin, kenarlarda beliren noktadan başka bir şeklin noktasına sürükleyin.
- **Düzenlemek:** Bir şekle tıklayın; sağ panelden başlık, açıklama ve renk değiştirin.
- **VSM verileri (yalnızca Proses):** Bir proses seçince sağ panelde "VSM verileri" bölümü açılır:
  çevrim süresi (C/T), setup/değişim, uptime (%), operatör sayısı ve "Gelişmiş alanlar" altında mesafe
  (m), EPEI, hurda (%), parti büyüklüğü ve not. Süreler sn/dk/saat olarak seçilebilir. Uptime ya da hurda
  girilirse **etkin C/T** (= C/T ÷ uptime ÷ (1 − hurda)) hesaplanır; etkin C/T taktı aşarsa turuncu
  kapasite uyarısı çıkar.
- **OEE:** Gelişmiş alanlara **ideal C/T** girilirse prosesin OEE'si hesaplanır:
  OEE = Kullanılabilirlik × Performans (ideal C/T ÷ C/T) × Kalite (1 − hurda). Kullanılabilirlik elle
  girilen uptime'dır; uptime boşsa **plansız duruş** (dk/gün) ve **değişim sayısı** (× C/O) ile net
  çalışma süresinden hesaplanır. Panelde dört çubuk, %85 hedefi, eksik bileşen notu ve günlük kapasite
  ile talep yükü görünür; veri kutusunda OEE satırı, özette proses bazında OEE tablosu vardır.
- **Parti beklemesi:** Parti büyüklüğü girilen proseste bir parça, partinin geri kalanını bekler:
  parti beklemesi = (parti − 1) × C/T. Özette toplamı görünür. Klasik VSM'de lead time'a eklenmez;
  "Parti beklemesini lead time'a ekle" seçilirse eklenir ve zaman çizgisinde "+ parti" olarak görünür.
- **Hız belirleyici proses (pacemaker):** Proses panelinde "⏱ Hız belirleyici proses" işaretlenir (haritada
  bir tane olur; tuvalde rozet çıkar). Seçilmediyse özet akıştaki son prosesi önerir. Hız belirleyiciden
  sonra itme stoğu (üçgen), süpermarket ya da itme oku varsa ve hız belirleyici takt üstüyse uyarı verir
  (sonrası FIFO ya da sürekli akış olmalı). Son prosesten sonraki mamul stoğu uyarı almaz.
- **EPEI hesabı:** Gelişmiş alanlarda **ürün çeşidi sayısı** girilirse (ya da birden çok aile prosesten
  geçiyorsa) en kısa olası EPEI hesaplanır: EPEI = (çeşit × C/O) ÷ (kullanılabilir süre − üretim süresi).
  Kullanılabilir süre = net süre − plansız duruş; üretim süresi = Σ(talep × C/T) ÷ (1 − hurda). Elle girilen
  EPEI bundan kısaysa "değişime zaman yetmez" uyarısı çıkar. Bir döngüde üretilecek miktar (talep × EPEI)
  de gösterilir.
- **Zincir verimi (RTY):** Proseslere girilen hurda oranlarından ilk seferde sağlam çıkan parça oranı
  hesaplanır: RTY = Π(1 − hurda). Özette "talebi karşılamak için giriş" (talep ÷ RTY) da görünür; birden
  çok ailede aile tablosunda aile başına RTY vardır.
- **Stok değeri:** Ürün ailesine **birim maliyet** (TL, € ya da $ / adet) girilir; stoğa ayrıca **birim
  değer** girilebilir (ör. hammadde ucuz, mamul pahalı). Stok değeri = adet × birim değer (gün girildiyse
  adet = gün × günlük talep). Ortak stokta ailelerin talebe göre ağırlıklı maliyeti kullanılır. Özette
  toplam, karşılaştırma tablosunda mevcut ↔ gelecek farkı görünür. Farklı para birimleri toplanmaz.
- **Birden fazla ürün ailesi (karma model):** "VSM verileri / özet" panelinde "+ Ürün ailesi ekle" ile
  en fazla 8 aile tanımlanır (ad, talep, paket adedi; renk otomatik). Proses seçilince "Ürün aileleri"
  bölümünde o prosesten geçen aileler işaretlenir (en az biri) ve gerekirse aileye özel C/T girilir; boş
  bırakılırsa ortak C/T kullanılır. Stoklar bir aileye bağlanabilir ya da "Tüm aileler (ortak stok)"
  kalır. Üstteki **Aile** seçicisi iki görünüm sunar:
  - **Tüm aileler (karma):** karma takt = net süre ÷ toplam talep; proses C/T'si talebe göre ağırlıklı
    ortalamadır; **proses yükü** = Σ(aile talebi × aile C/T) ÷ net süre (duruş/hurda payı ayrı gösterilir).
    %100'ü aşan proses kapasite yetmiyor uyarısı alır. Pitch bu görünümde aile başına tabloda gösterilir.
  - **Tek aile:** o ailenin talebi, taktı ve C/T'leriyle klasik özet; o aileden geçmeyen prosesler ve başka
    aileye ait stoklar tuvalde soluk görünür. Ortak stoklar beklemeyi toplam talebe göre hesaplar.
  Ondalık için virgül ya da nokta yazabilirsiniz. Boş bırakılan alan "veri yok" demektir; 0 ise gerçek
  bir değerdir. Girilen değerler prosesin altındaki veri kutusunda görünür; kutu prosesle birlikte
  taşınır ve "Veri kutusunu tuvalde göster" ile gizlenebilir.
  Bir oka tıklayıp etiket yazın (ör. "Evet", "Hayır").
- **VSM genel verileri ve özet:** Boş bir yere tıklayın (ya da üstteki "VSM verileri / özet" düğmesine
  basın). Sağ panelde net çalışma süresi (dk/gün veya sn/gün; günlük toplam), vardiya sayısı ve sevkiyat
  sıklığı; **Ürün aileleri** bölümünde her ailenin müşteri talebi (adet/gün) ve isteğe bağlı paket adedi
  girilir (pitch = takt × paket adedi). Tek aile varsa harita eskisi gibi tek ürünlüdür. Altındaki **VSM özeti** otomatik
  hesaplanır (klasik VSM yöntemi): takt süresi (net süre ÷ talep), toplam işlem süresi (proseslerin
  çevrim sürelerinin toplamı), stokta bekleme (stok üçgenlerinin gün toplamı), üretim lead time
  (bekleme + işlem süresi), değer katma oranı (işlem süresi ÷ lead time), toplam mesafe, darboğaz
  (en büyük C/T), teorik gereken operatör (⌈∑C/T ÷ takt⌉) ve pitch. **Takt – çevrim süresi grafiği**
  her prosesi takt çizgisine göre gösterir. Çevrim süresi takt'tan büyük prosesler kırmızı "Takt üstü"
  ile işaretlenir; "Prosesleri takta göre renklendir" seçilirse prosesler yeşil/sarı/kırmızı boyanır.
  **Hesaplanan değerler mavi italik ve ∑ işaretlidir**; elle girilen değerler normal yazılır.
- **VSM sembolleri:** Paletteki "VSM" grubunda Müşteri, Tedarikçi (fabrika simgesi), Stok / envanter
  (üçgen), Kaizen patlaması, Üretim kontrolü, Operatör ve Kamyon sevkiyatı var. Müşteri simgesi harita
  talebini ve hesaplanan takt'ı gösterir. "Çekme ve planlama" grubunda Süpermarket, FIFO şeridi,
  Güvenlik stoğu, Üretim/Çekme/Sinyal kanbanı, Kanban kutusu, Yükleme dengeleme (heijunka) ve Git gör var.
- **Kaizen eylemleri:** Kaizen patlamasına sorumlu, hedef tarih ve durum (açık / devam ediyor /
  tamamlandı) girilir. Harita panelindeki "Kaizen eylemleri" listesi tümünü gösterir; tarihi geçmiş açık
  eylemler "⚠ gecikti" ile işaretlenir.
- **Stok (üçgen):** Stok üçgenini seçip sağ panelden stok miktarını **adet** ya da doğrudan **gün**
  olarak girin. Adet girilirse bekleme günü = adet ÷ günlük müşteri talebi olarak hesaplanır ve
  üçgenin altında görünür. Stok, prosesin içine değil prosesler arasına üçgen olarak çizilir.
  Süpermarket, FIFO şeridi ve güvenlik stoğu da aynı şekilde stok taşır. **Süpermarkette** yenileme
  süresi ve güvenlik payı girilirse gereken stok (= günlük talep × yenileme × (1 + güvenlik)) ve kanban
  kartı sayısı (= ⌈gereken ÷ paket adedi⌉) hesaplanır.
- **Ok türleri:** Paletteki "Yeni ok türü" ile sıradaki okların türünü seçin: Genel ok, Bilgi akışı (mavi
  kesikli), Elektronik bilgi akışı (zikzaklı), Malzeme akışı / itme (kalın çizgili), Çekme (kavisli),
  Sevkiyat (kalın boş). Var olan bir okun türü, ok
  seçilince sağ panelden değiştirilebilir.
- **Zaman çizgisi:** "Tuvalin altında zaman çizgisini göster" ile açılır. Stoklar ve prosesler **akış
  oklarına göre** sıralanır (bilgi okları ve geri dönüş döngüleri sırayı etkilemez; oku olmayan şekiller
  yatay konumlarına göre araya girer) ve merdiven olarak gösterilir: **üst basamak stokta bekleme (gün)**, **alt
  basamak prosesin çevrim süresi (C/T)**. Sağda toplam bekleme, toplam işlem süresi, lead time ve değer
  katma oranı hesaplanır. Ada tıklamak o şekli seçer.
- **Mevcut durum / gelecek durum:** Üstteki "Harita" sekmeleriyle aynı projede iki harita tutulur.
  "+ Gelecek durum" mevcut haritanın kopyasıyla (ya da boş) bir hedef harita açar. İki harita varsa
  harita panelinde **karşılaştırma tablosu** (lead time, bekleme, işlem süresi, değer katma oranı,
  darboğaz…) görünür. "Temizle" yalnızca açık haritayı siler; "Kaldır" gelecek durumu siler.
- **Geri al / ileri al:** ⌘/Ctrl+Z ve ⇧+⌘/Ctrl+Z (ya da Ctrl+Y) veya "Düzen" düğmeleri. **Kopyala /
  yapıştır / çoğalt:** ⌘/Ctrl+C, ⌘/Ctrl+V, ⌘/Ctrl+D (seçili şekiller ve aralarındaki oklar).
- **PNG indir / Yazdır / PDF:** Tüm çizimi PNG görsel olarak indirir ya da görsel, VSM özeti ve zaman
  çizgisiyle bir yazdırma sayfası açar (tarayıcının yazdırma penceresinden "PDF olarak kaydet").
- **Excel / CSV:** Harita panelinden prosesların VSM verilerini CSV olarak dışa aktarıp Excel'de
  düzenleyebilir ve geri içe aktarabilirsiniz (proses adlarıyla eşleşir; noktalı virgül ya da virgül
  ayraçlı; hatalı dosya hiçbir şeyi değiştirmez; işlem geri alınabilir).
- **Silmek:** Seçip `Delete`/`Backspace` tuşuna basın ya da "Seçileni sil" düğmesini kullanın.
- **Gezinmek:** Boş alanı sürükleyerek kaydırın, fare tekerleğiyle yakınlaştırın; "Sığdır" tüm çizimi ekrana sığdırır.
- **Kaydetmek (yerel taslak):** Çizim otomatik olarak **yalnızca bu tarayıcıya** kaydedilir.
- **Buluta kaydetmek:** "Giriş yap" → "Buluta kaydet" (ya da "Yeni bulut proje"). Bulut projesi
  açıkken değişiklikler **otomatik değil**, **"Kaydet"** düğmesi ya da **Ctrl/⌘+S** ile buluta yazılır.
  Durum üst çubukta görünür: "Kaydedilmemiş değişiklikler var", "Buluta kaydediliyor…",
  "Buluta kaydedildi", hata mesajı.
- **Projelerim:** Kendi bulut projelerinizi listeler; açma, yeniden adlandırma ve silme (onaylı) buradan
  yapılır. **"Kopya olarak kaydet"** ekrandaki çizimi yeni bir proje olarak kaydeder.
- **Yerel taslağa dön:** Bulut projesini kapatır ve yerel taslağı açar. Yerel taslak, bulut projesi
  açıkken hiç değişmez.
- **Başka yerde değişiklik:** Proje siz açtıktan sonra başka bir sekmede/cihazda kaydedildiyse, kaydederken
  uyarılırsınız: "Benimkiyle üzerine yaz", "Kopya olarak kaydet" ya da "Vazgeç".
- **Kaydedilmemiş bulut değişiklikleri** bu tarayıcıda geçici olarak yedeklenir; sayfa yenilense de
  kaybolmaz. Oturum kapanmışsa değişiklikler ayrıca saklanır ve yerel taslak olarak geri açılabilir.
- **Yedeklemek / paylaşmak:** "JSON dışa aktar" ile dosya indirin, "JSON içe aktar" ile geri açın
  (her iki modda da çalışır).

## Hata olursa

Uygulamada beklenmeyen bir hata olursa beyaz sayfa yerine **hata ekranı** çıkar. Çizim silinmez:
ekrandan sayfayı yenileyebilir, son kaydı (yerel taslak ya da bulut projesinin kaydedilmemiş hâli) JSON
dosyası olarak indirebilir ve "JSON içe aktar" ile yeniden açabilirsiniz. Hata tekrar ederse
**"Kaydı yedeğe al, yeniden başla"** kaydı tarayıcıda ayrı bir yedeğe taşır (`akis-editoru.hata-yedek.*`)
ve uygulama ilk açılıştaki gibi açılır; yedek, hata ekranından indirilmeye devam eder.
Geliştirmede ekranı denemek için: http://localhost:5173/?hata-testi (yayındaki sürümde çalışmaz).

## Kayıt formatı

JSON dosyası ve tarayıcı kaydı aynı biçimdedir (`src/model/types.ts`):

```json
{
  "app": "akis-editoru",
  "schemaVersion": 10,
  "name": "Diyagram adı",
  "savedAt": "2026-10-15T20:00:00.000Z",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "vsmMap": {
    "fields": {
      "netWorkingTime": { "value": 460, "unit": "dk/gün" },
      "shifts": { "value": 1, "unit": "vardiya" },
      "shipmentFrequency": { "value": 1, "unit": "kez/gün" }
    },
    "families": [
      { "id": "aile-1", "name": "Standart ürün", "color": "#2a78d6",
        "demand": { "value": 460, "unit": "adet/gün" }, "packQuantity": { "value": 20, "unit": "adet" },
        "unitCost": { "value": 25, "unit": "TL/adet" } }
    ],
    "familyView": "all",
    "pacemakerId": null,
    "includeBatchWait": false,
    "showTimeline": true,
    "colorByTakt": false
  },
  "nodes": [
    { "id": "n-1", "kind": "process", "x": 100, "y": 50, "width": 180, "height": 80,
      "data": { "title": "Kesim", "description": "", "color": "#dbeafe",
        "vsm": {
          "showDataBox": true,
          "fields": {
            "cycleTime": { "value": 45, "unit": "sn" },
            "changeoverTime": { "value": 30, "unit": "dk" },
            "uptime": { "value": 92, "unit": "%" },
            "operators": { "value": 1, "unit": "kişi" },
            "distance": { "value": 15, "unit": "m" }
          },
          "note": ""
        } } }
  ],
  "edges": [
    { "id": "e-1", "source": "n-1", "target": "n-2",
      "sourceHandle": "right", "targetHandle": "left", "label": "Evet", "kind": "material" }
  ]
}
```

`vsm` alanı yalnızca `process` şekillerinde bulunur; `value: null` boş alan demektir. Stok üçgenleri
(`inventory`) `"inventory": { "stock": { "value": 120, "unit": "adet" } }` taşır (birim `adet` ya da `gün`).
Şekil türleri (`kind`): `terminal`, `process`, `decision`, `department`, `note`, `customer`, `supplier`,
`inventory`, `kaizen`. Bağlantı türleri (`kind`): `flow`, `info`, `material`, `shipment`.

**Sürüm 10 değişikliği:** Ürün ailesinde `unitCost` (birim maliyet), stokta `unitValue` (birim değer);
birimler `TL/adet`, `€/adet`, `$/adet`. Eski dosyalarda boş gelir.

**Sürüm 9 değişikliği:** `vsmMap.pacemakerId` (hız belirleyici proses; yoksa `null`),
`vsmMap.includeBatchWait` (parti beklemesi lead time'a eklensin mi; varsayılan `false`) ve proseste
`partTypes` alanı (ürün çeşidi sayısı, birim `çeşit`). Eski dosyalarda boş / kapalı gelir; olmayan bir
şekli gösteren `pacemakerId` okunurken kaldırılır.

**Sürüm 8 değişikliği:** Ürün aileleri. Müşteri talebi ve paket adedi harita alanlarından
`vsmMap.families` listesine taşındı; `vsmMap.familyView` seçili görünümü tutar. Proses VSM verisinde
`familyIds` (boş = tüm aileler) ve `cycleByFamily` (aileye özel C/T), stokta `familyId` (boş = ortak) var.
Eski dosyalardaki `customerDemand` / `packQuantity` otomatik olarak tek aileye taşınır.

**Sürüm 7 değişikliği:** Proseste OEE alanları (`idealCycleTime`, `unplannedDowntime`,
`changeoversPerDay`). Eski dosyalarda boş gelir.

**Sürüm 5–6 değişiklikleri:** Proseste EPEI, hurda ve parti büyüklüğü; haritada elle girilen pitch
yerine paket adedi (pitch hesaplanır); yeni sembol türleri; stok şekillerinde süpermarket boyut alanları
(`replenishTime`, `safetyRate`); kaizen verisi (`data.kaizen`); gelecek durum haritası (`futureState`,
üst düzey alanlarla aynı yapıda) ve açık harita (`activeState`); harita verisinde `colorByTakt`.

**Sürüm 4 değişikliği:** Klasik VSM yöntemine geçildi. Proseslerdeki "WIP / stok", "değer katan süre"
ve "değer katmayan süre" alanları kaldırıldı. İşlem süresi artık çevrim süresidir; bekleme stok
üçgenlerinden gelir. Eski dosyalarda bu alanlara girilmiş değerler açılışta kullanılmaz; uygulama bunu
bir notla bildirir.

**Geriye uyumluluk:** Sürüm 1, 2 ve 3 dosyaları açılmaya devam eder: prosesler boş VSM verisiyle, harita
verisi boş olarak, oklar "genel ok" olarak gelir. Sürüm 3'te `vsmMap` alanlarının bir kısmı eksikse
eksikler boş kabul edilir. Sürüm 2 dosyalarında eksik VSM alanları boş kabul edilir, `"12,5"` gibi metin
olarak yazılmış sayılar sayıya çevrilir, proses olmayan şekillerdeki VSM verisi yok sayılır.
Geçersiz birim, negatif değer, 100'ü aşan uptime ya da tam sayı olmayan operatör sayısı hata verir.

İçe aktarılan dosya önce doğrulanır (uygulama adı, sürüm, kimlikler, konumlar, renkler, bağlantıların
var olan şekillere gitmesi, boyut sınırları). Hatalı dosya yüklenirse hata mesajı gösterilir ve
**mevcut çizim değişmez**. Geçerli dosya da ancak siz onayladıktan sonra açılır.

## Mevcut sınırlamalar

- **Giriş yalnızca misafir hesabıyla:** e-posta/şifre ile giriş ve hesaba e-posta bağlama henüz yok;
  bu yüzden başka cihazdan aynı projelere ulaşılamaz (yukarıya bakın).
- Bulut kaydı otomatik değil ("Kaydet" gerekir); gerçek zamanlı ortak düzenleme, paylaşım ve yorum yok.
- Yerel taslak yalnızca bu tarayıcının yerel deposundadır; tarayıcı verileri temizlenirse kaybolur.
- **Aynı anda birden fazla sekme** açarsanız sekmeler birbirinin kaydının üzerine yazar
  (uygulama bunu fark edince uyarı gösterir). Tek sekmede çalışın.
- Ok güzergâhları otomatiktir; elle büküm noktası eklenemez.
- Departman şekli yalnızca görsel bir alandır; içindeki kutular onunla birlikte taşınmaz (gruplama yok).
- PNG çıktısı tüm çizimi kapsar; zaman çizgisi şeridi görsele girmez (yazdırma sayfasında tablo olarak
  yer alır). Yazdırma penceresi tarayıcının kendi penceresidir.
- Ürün aileleri her haritada (mevcut / gelecek) ayrı tutulur; karşılaştırma tablosu iki haritayı kendi
  seçili görünümleriyle karşılaştırır. Zaman çizgisi tek akış sırası kullanır; aileye özel güzergâh yoktur.
- Lead time'a işlem süresinin eklenmesi için net çalışma süresi gerekir (saniyeleri güne çevirmek için).
  Stok günü adetten hesaplanacaksa müşteri talebi gerekir.
- Net çalışma süresi günlük toplam olarak girilir; vardiya sayısı yalnızca bilgi amaçlıdır, hesaba girmez.
- Zaman çizgisi tuvalin altına sabitlenmiş bir şerittir; çizimle birlikte yakınlaşmaz ve çizimin alt
  kısmını örtebilir (kapatılabilir). "Sığdır" onu hesaba katmaz.
- Veri kutusu prosesin altına taşar: alt kenardan çıkan oklar kutunun arkasından geçer (yan kenarları
  kullanın) ve "Sığdır" veri kutusunu hesaba katmaz.
- Masaüstü kullanımı için tasarlandı; dokunmatik/mobil kullanım denenmedi.
- Tarayıcıda en fazla 2000 şekil ve 5000 bağlantı; içe aktarılan dosya en fazla 5 MB.
