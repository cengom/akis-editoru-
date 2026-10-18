# Akış Editörü — Claude için proje notları

## Amaç
Tarayıcıda çalışan, genel amaçlı bir süreç ve akış diyagramı editörü. Kullanıcı farklı iş
süreçlerini serbestçe çizer. VSM (değer akışı haritası) ileride desteklenecek şablonlardan
yalnızca biri olacak; uygulama bir VSM hesaplayıcısına dönüştürülmemeli.

- Arayüz dili: **Türkçe**. Kullanıcıya yapılan açıklamalar sade Türkçe olmalı (kullanıcı başlangıç seviyesinde).
- Ücretli bileşen, ücretli API veya AI API **yok**. Kendi sunucu kodumuz yok; bulut kaydı ve giriş
  **Supabase** (ücretsiz katman) ile yapılır. Supabase ayarlanmamışsa uygulama yalnızca yerel taslakla çalışır.
- Yayında: https://akis-editoru.vercel.app (Vercel projesi `cengoo/akis-editoru`, `cengom/akis-editoru-`
  deposunun `main` dalına bağlı). **`main`'e her push otomatik olarak canlıya çıkar**; bu yüzden push
  yalnızca kullanıcının açık onayıyla ve derleme (`npm run build`) geçtikten sonra yapılır.

## Mimari
- **React 19 + TypeScript 7 + Vite 8**, diyagram için **React Flow (`@xyflow/react` 12)**.
- `src/model/types.ts` — tüm veri tipleri ve kayıt formatı (`DiagramDocument`, `SCHEMA_VERSION`).
- `src/model/document.ts` — tuval ↔ kayıt formatı dönüşümü ve içe aktarma doğrulaması (`parseDocument`).
  Doğrulama hiçbir şeyi değiştirmez; hatalı dosya mevcut çizime dokunmaz.
- `src/model/storage.ts` — `localStorage` otomatik kaydı. Okunamayan kayıt silinmez, yedek anahtara taşınır.
- `src/model/vsm.ts` — VSM alan kataloğu (`VSM_FIELDS`: etiket, izinli birimler, kurallar), boş veri,
  sayı biçimlendirme/ayrıştırma ve VSM doğrulaması (`parseVsm`). Yeni VSM alanı: `types.ts` içindeki
  `VSM_FIELD_KEYS`'e ve bu kataloğa ekle; panel ve veri kutusu kataloğu okuyarak kendiliğinden gösterir.
- `src/model/vsmCalc.ts` — VSM özet hesapları, **klasik yöntem** (Rother & Shook): işlem süresi =
  proseslerin C/T toplamı; bekleme = stok üçgenleri (adet ÷ günlük talep ya da doğrudan gün);
  lead time = bekleme + işlem süresi (net çalışma süresiyle güne çevrilir); değer katma oranı;
  takt üstü prosesler. Saf fonksiyonlar; `null` toplama katılmaz, 0 katılır. Proseslere ayrı
  "değer katan/katmayan süre" ya da WIP alanı ekleme (sürüm 4'te bilinçli olarak kaldırıldı).
- `src/model/edges.ts` — bağlantı türlerinin adları ve ok uçları. Çizim: `src/edges/FlowEdgeView.tsx` + CSS.
- `src/components/MapPanel.tsx` (harita verileri + özet), `Timeline.tsx` (alt zaman çizgisi),
  `QuantityFields.tsx` (sayı + birim satırları; proses ve harita alanları ortak kullanır),
  `VsmCanvasContext.ts` (takt ve talebi şekillere iletir; sürüklemede değişmez).
- `src/nodes/VsmSymbols.tsx` — simge olarak çizilen VSM şekilleri (süpermarket, FIFO, kanbanlar, heijunka,
  git gör, operatör, kamyon, güvenlik stoğu); palet de aynı çizimleri kullanır.
- `src/editor/` — `useHistory` (geri al/ileri al; `historyKey` değişince sıfırlanır), `useClipboard`,
  `exportImage` (PNG ve yazdırma sayfası; `html-to-image`).
- `src/model/csv.ts` — proses verileri CSV (Excel, `;` ayraç, virgüllü ondalık) dışa/içe aktarma.
- `src/components/TaktChart.tsx`, `StateCompare.tsx`, `KaizenList.tsx` — özet panel parçaları.
- `src/model/shapes.ts` — şekil kataloğu (ad, boyut, renk) ve renk yardımcıları.
- `src/model/example.ts` — uydurma örnek üretim süreci (gerçek veri yok).
- `src/nodes/ShapeNodeView.tsx` — tüm şekiller için tek düğüm bileşeni; şeklin türü `node.type` alanında.
- `src/components/` — `Toolbar`, `Palette`, `PropertiesPanel`, `ConfirmDialog`.
- `src/App.tsx` — editör durumu (nodes/edges), sürükle-bırak, bağlantı, otomatik kayıt, içe/dışa aktarma.
- `src/cloud/` — bulut katmanı:
  - `types.ts` — `CloudBackend` arayüzü (oturum + proje CRUD). Supabase ve sahte arka uç bunu uygular.
  - `supabaseClient.ts` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), `supabaseBackend.ts`,
    `mockBackend.ts` (yalnızca `npm run dev:sahte-bulut`; üretim derlemesine girmez), `index.ts` (seçim).
  - `useCloudSession.ts` — oturum durumu. `useCloudProject.ts` — mod yönetimi: açık proje, kirli
    bayrağı, kaydet/kopya/aç/yeniden adlandır/sil, çakışma, çıkış, yedekten devam.
- `src/components/ProjectsDialog.tsx`, `NewProjectDialog.tsx`, `Modal.tsx` — bulut pencereleri.
- `supabase/migrations/` — tablo, tetikleyici ve Row Level Security SQL'i.

Önemli kararlar:
- Bağlantılar `ConnectionMode.Loose` ile çalışır; her şeklin dört kenarında `top/right/bottom/left`
  kimlikli bağlantı noktası vardır. Kenar kimlikleri kayıtta saklanır.
- Katman sırası: departman alanı (zIndex 0) < oklar (1) < diğer şekiller (2). Seçili ok öne çıkar.
- JSON dosyası, yerel kayıt ve buluttaki `document_json` **aynı** formatı kullanır. Güncel sürüm 8;
  sürüm 1–7 de okunur (kaldırılan alanlar yok sayılır, kullanıcıya `warnings` ile bildirilir).
- Stok verisi `data.inventory`; stok tutan şekiller `STOCK_KINDS` (stok üçgeni, süpermarket, FIFO,
  güvenlik stoğu) ve hepsi zaman çizgisinde bekleme sayılır. Kaizen verisi `data.kaizen`.
- Mevcut / gelecek durum: üst düzey alanlar her zaman **mevcut durumdur**; gelecek durum `futureState`.
  Editörde yalnızca açık harita React Flow durumundadır, diğeri App'te `otherState` olarak tutulur
  (`splitStates`, `toDocument(..., active, other)`). Bulutun "kaydedilmemiş" imzası iki haritayı da kapsar.
- OEE: `oeeOf(vsm, netSec)` (vsmCalc). Kullanılabilirlik = elle uptime, yoksa duruş ve değişimlerden;
  etkin C/T de aynı kullanılabilirliği kullanır (`effectiveCycleSeconds(vsm, netSec)`). Net süre harita
  verisinden gelir ve tuvale `VsmCanvasContext.netSec` ile iletilir.
- Ürün aileleri (sürüm 8): `vsmMap.families` (talep ve paket adedi burada; harita alanında değil) ve
  `vsmMap.familyView` ('all' | aile kimliği). Yardımcılar `src/model/families.ts` (`viewFamily`,
  `viewDemand`, `passes`, `familyCycle`, `stockDemand`, `stockInView`). Tek ailede sonuçlar eski
  hesapla birebir aynı olmalı. Karma görünümde takt üstü = ham yük > 1. Görünüm değişikliği bulut
  "kaydedilmemiş" imzasına girmez (`contentSignature`). Tuvale durum `VsmCanvasContext.processStatus`,
  soluk şekiller `dimmed` ile gelir.
- Zaman çizgisi sırası akış oklarından gelir (`flowOrder`: bilgi okları hariç, geri dönüşler kırılır). Buluttan gelen belge de `parseDocument` ile doğrulanır.
- İki kayıt modu: **yerel taslak** (`STORAGE_KEY`, otomatik) ve **bulut proje** (manuel "Kaydet").
  Bulut projesi açıkken yerel taslağa yazılmaz; kaydedilmemiş değişiklikler `CLOUD_BACKUP_KEY` yedeğine
  yazılır ve sayfa yenilenince o projeyle devam edilir. Çıkışta yedek silinir.
- Kaydetmede çakışma kontrolü: güncelleme yalnızca sunucudaki `updated_at` açılıştaki değerle aynıysa
  yapılır; değilse kullanıcıya sorulur (sessizce üzerine yazılmaz). `updated_at` sunucuda tetikleyiciyle yenilenir.
- Giriş şimdilik Supabase **anonim (misafir)** girişiyle. İleride aynı hesaba e-posta bağlanacak
  (`auth.updateUser({ email })`), böylece veri kaybı olmadan çok cihazlı kullanıma geçilecek.
- Harita düzeyi VSM verisi `DiagramDocument.vsmMap`'tedir. Bağlantı türü tuvalde `edge.type`, kayıtta
  `edge.kind` alanıdır (`edgeKindProps` ikisini eşler).
- Hesaplanan değerler arayüzde `.calc-value` sınıfıyla (mavi italik, ∑) gösterilir; elle girilen
  değerlerle karışmamalı.
- VSM verisi (`data.vsm`) yalnızca `process` şekillerinde tutulur (`makeNode`/`copyData` bunu zorlar).
  Boş değer `null`, 0 gerçek değerdir — ikisini asla eşitleme.
- VSM veri kutusu düğüm bileşeninin içinde, düğümün altına mutlak konumla çizilir; bu yüzden düğümle
  birlikte taşınır ama düğüm boyutuna (ve fitView'a) dahil değildir.

## Çalışma kuralları
- Kayıt formatını değiştirirsen `SCHEMA_VERSION`'ı artır, `parseDocument` içinde eski sürüm için
  geçiş (migration) yaz ve README'yi güncelle. Eski dosyalar açılmaya devam etmeli.
- İçe aktarılan veriye asla güvenme: önce doğrula, sonra onay al, ancak ondan sonra mevcut çizimi değiştir.
- Gerçek şirket verisi kullanma; örnekler uydurma olmalı.
- Arayüzde yerel kaydın bulut kaydı olmadığı açıkça yazılı kalmalı.
- Kullanıcı onayı olmadan: internete yayımlama, harici servis oluşturma, uzak depoya push yok.
  Supabase hesabını/projesini kullanıcı kendisi açar; hesap açma ya da gerçek Supabase'de giriş deneme yapma.
- `service_role` / secret anahtar asla istemci koduna ya da `.env` dosyalarına girmez. Erişim güvenliği
  RLS ile sağlanır; yeni tablo eklenirse RLS kuralları da eklenmeli.
- Bulut akışlarını `npm run dev:sahte-bulut` (port 5174) ile dene; gerçek Supabase testi kullanıcıyla yapılır.
- Çalışma klasörü: `~/Documents/GitHub/akis-editoru-` (GitHub: `cengom/akis-editoru-`, herkese açık).
  Bu klasörün dışına dokunma. Eski `~/Documents/akis-editoru` kopyası artık kullanılmıyor.
- Push yalnızca kullanıcının açık onayıyla. Depo herkese açık: `.env.local`, `referans-vsm.jpg`,
  `node_modules`, `dist` git'e girmemeli (`.gitignore`). Commit öncesi `git status` ile kontrol et.
- Yaptığın özelliği tarayıcıda gerçekten dene; denemediğini "çalışıyor" diye sunma.
- Biten/sıradaki işleri `TASKS.md`'de güncel tut.

## Komutlar
```bash
npm install          # bağımlılıkları kur
npm run dev          # geliştirme sunucusu: http://localhost:5173
npm run dev:sahte-bulut  # sahte bulutlu geliştirme sunucusu: http://localhost:5174
npm run typecheck    # TypeScript kontrolü (tsc --noEmit)
npm run build        # tsc + üretim derlemesi (dist/)
npm run preview      # derlenmiş sürümü yerelde aç
```

Tarayıcı testi notu: yerleşik tarayıcı paneli gizliyken sayfa kare çizmez (requestAnimationFrame ve
ResizeObserver çalışmaz); React Flow bu yüzden okları çizmez. Ekran görüntüsü almak çizimi tetikler.
Aynı adreste ikinci bir sekme açık kalmasın: iki sekme aynı yerel kaydın üzerine yazar.

Tarayıcı önizlemesi: `.claude/launch.json` içinde `akis-editoru` (sunucuyu başlatır) ve
`akis-editoru-acik-sunucu` (zaten çalışan 5173 sunucusuna bağlanır) tanımlı. Masaüstü uygulamasının
başlattığı süreç bu Belgeler klasöründe takılabiliyor; o durumda sunucuyu `npm run dev` ile başlatıp
ikinci yapılandırmayı kullan.

## Referans
`referans-vsm.jpg` (316×632 px) klasörde. Görsel **90° yan yatmış**; okumak için saat yönünde 90°
çevrilmeli (dosyanın kendisi değiştirilmedi). Yalnızca tasarım referansıdır; otomatik diyagrama
dönüştürülmeyecek. Kaynağı/telif durumu bilinmediği için git takibinden çıkarıldı (`.gitignore`);
ancak ilk GitHub yüklemesinde (commit `7eed75e`) yer aldığı için o commit'in geçmişinde hâlâ görünür.

Görselde görülen VSM düzeni (sonraki aşamalar için):
- Üstte bilgi akışı: müşteri talebi kutusu, üretim planlama, "Weekly" etiketli bilgi okları,
  üretim müdürü ve onaylı çizimler; merkezi bir ofisten her prosese çizim/CNC programı okları.
- Ortada soldan sağa ~12 proses kutusu; aralarında kesikli itme okları.
- Her prosesin altında veri tablosu (katma değerli süre, hazırlık süresi C/O, uptime, kullanılabilirlik,
  taşıma mesafesi gibi satırlar).
- En altta merdiven biçiminde zaman çizgisi (bekleme süreleri / işlem süreleri).
