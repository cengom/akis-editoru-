# Görevler

## Tamamlananlar (1. aşama)

- [x] Proje kurulumu: React 19.3, TypeScript 7.0, Vite 8.3, @xyflow/react 12.12 (sürümler sabitlendi)
- [x] Şekiller: Başlangıç/Bitiş, Proses, Karar (eşkenar dörtgen), Departman (alan), Not
- [x] Sol paletten tuvale sürükle-bırak ile ekleme (tıklayınca ortaya, boş bir yere ekler)
- [x] Serbest taşıma (10 px ızgaraya oturur), seçili şeklin boyutunu değiştirme
- [x] Dört kenardan oklu bağlantı; aynı şekle kendisinden bağlantı engellenir
- [x] Sağ panel: başlık, açıklama, renk (hazır renkler + özel renk); tuval anında güncellenir
- [x] Bağlantı etiketi düzenleme
- [x] Silme: Delete/Backspace ve "Seçileni sil" düğmesi (şekle bağlı oklar da silinir)
- [x] Yakınlaştır/uzaklaştır, kaydırma, "Sığdır", mini harita
- [x] Yerel otomatik kayıt (localStorage), sayfa yenilenince geri yükleme
- [x] Okunamayan yerel kaydı silmeden yedeğe alma ve kullanıcıyı uyarma
- [x] Başka sekmede değişiklik olursa uyarı
- [x] JSON dışa aktarma / içe aktarma; sürüm numaralı kayıt formatı (`schemaVersion: 1`)
- [x] İçe aktarma doğrulaması; hatalı dosya mevcut çizimi bozmaz; geçerli dosya onayla açılır
- [x] Uydurma örnek üretim süreci (gerçek veri yok)
- [x] Arayüzde "bulut kaydı değil" uyarısı
- [x] CLAUDE.md, README.md, TASKS.md

## Tamamlananlar (2. aşama: proses VSM verileri)

- [x] Proseslere VSM veri alanları: çevrim, setup/değişim, uptime, operatör, WIP/stok, değer katan/katmayan süre, mesafe, not
- [x] Sayı + birim (sn/dk/saat, %, kişi, adet/gün, m); boş değer `null`, 0'dan ayrı
- [x] Sağ panelde "VSM verileri" bölümü, gelişmiş alanlar katlanabilir; hatalı girişte alan altında uyarı
- [x] Prosesin altında gösterilip gizlenebilen VSM veri kutusu (prosesle birlikte taşınır)
- [x] Kayıt formatı sürüm 2; sürüm 1 dosyaları ve eksik alanlı dosyalar açılmaya devam eder
- [x] Örnek süreçte Kesim, Montaj ve Paketleme için uydurma VSM verileri

## Tamamlananlar (3. aşama: VSM haritası)

- [x] Harita düzeyi VSM verileri: müşteri talebi, net çalışma süresi, vardiya, sevkiyat sıklığı, pitch
- [x] VSM özeti: takt süresi, toplam değer katan / katmayan süre, lead time, toplam mesafe
- [x] Takt üstü proses uyarısı (tuvalde rozet, veri kutusunda kırmızı satır, panelde ve özette uyarı)
- [x] Hesaplanan değerlerin elle girilenlerden ayrı stili (mavi italik, ∑)
- [x] VSM sembolleri: müşteri, tedarikçi, stok üçgeni, kaizen patlaması (ayrı palet grubu)
- [x] Ok türleri: bilgi akışı, malzeme (itme) akışı, sevkiyat; panelden tür değiştirme
- [x] Alt zaman çizgisi: proses bazında VA / NVA, toplam VA, NVA ve lead time
- [x] Kayıt formatı sürüm 3; sürüm 1 ve 2 dosyaları açılıyor

## Tamamlananlar (4. aşama: bulut kaydı, tek kullanıcı)

- [x] Supabase istemcisi (ortam değişkenleri), `diagrams` tablosu, `updated_at` tetikleyicisi, RLS kuralları (SQL migration)
- [x] Misafir (anonim) giriş ve çıkış; çıkışta misafir hesabı uyarısı
- [x] İki kayıt modu: yerel taslak (otomatik) ve bulut proje (Kaydet / Ctrl+S); modun üst çubukta gösterimi
- [x] Projelerim: listeleme, açma, yeniden adlandırma, silme; yeni bulut proje (mevcut tuval / boş / örnek); kopya olarak kaydet
- [x] Kaydedilmemiş değişiklik takibi, sayfadan çıkış uyarısı, yenilemede yedekten devam
- [x] Çakışma kontrolü (başka sekme/cihazda değişmişse sor), silinmiş proje durumu
- [x] Oturum kaybolursa kaydedilmemiş değişiklikleri ayrıca saklama ve yerel taslak olarak geri açma
- [x] Geliştirme için sahte bulut arka ucu (`npm run dev:sahte-bulut`)

## Tamamlananlar (5. aşama: klasik VSM yöntemine düzeltme)

- [x] İşlem süresi = çevrim süresi (C/T); proseslerdeki "değer katan/katmayan süre" ve "WIP" alanları kaldırıldı
- [x] Stok üçgenine sayısal stok (adet ya da gün); adetten bekleme günü = adet ÷ günlük talep
- [x] Zaman çizgisi merdiveni: üstte stok bekleme günleri, altta C/T; toplam bekleme, işlem süresi, lead time, değer katma oranı
- [x] Kayıt formatı sürüm 4; eski dosyalar açılıyor, kaldırılan değerler için kullanıcıya not
- [x] Örnek haritada prosesler arası WIP üçgenleri

## Tamamlananlar (6. aşama: VSM analiz eksikleri, 1. grup)

- [x] Takt – C/T grafiği (etkin C/T uzantısı, takt çizgisi, darboğaz etiketi)
- [x] Darboğaz, teorik gereken operatör (⌈∑C/T ÷ takt⌉) ve mevcut operatör toplamı
- [x] Veri kutusuna EPEI, hurda (%), parti büyüklüğü
- [x] Etkin C/T = C/T ÷ uptime ÷ (1 − hurda); kapasite uyarısı (turuncu)
- [x] Pitch = takt × paket adedi (elle pitch alanı kaldırıldı, eski değer için not)
- [x] Zaman çizgisi akış oklarına göre sıralanıyor (geri dönüş okları yok sayılıyor)
- [x] Kayıt formatı sürüm 5

## Tamamlananlar (7. aşama: VSM 2. ve 3. grup)

- [x] Çekme ve planlama sembolleri: süpermarket, FIFO, güvenlik stoğu, üretim/çekme/sinyal kanbanı, kanban kutusu,
      heijunka, git gör; ayrıca üretim kontrolü, operatör, kamyon
- [x] Elektronik bilgi akışı (zikzak) ve çekme (kavisli) okları
- [x] Süpermarket boyutu (gereken stok, kanban kartı sayısı)
- [x] Kaizen eylem listesi (sorumlu, hedef tarih, durum, gecikme)
- [x] Mevcut / gelecek durum haritaları ve karşılaştırma tablosu (kayıt formatı sürüm 6)
- [x] Geri al / ileri al, kopyala / yapıştır / çoğalt
- [x] PNG indirme, yazdırma / PDF sayfası
- [x] Proses verileri için CSV (Excel) dışa/içe aktarma; takta göre renklendirme

## Bekleyen (kullanıcı tarafı)

- [x] Supabase projesi oluşturma, SQL'i çalıştırma, anonim girişi açma, `.env.local` doldurma (README)
- [x] Gerçek Supabase ile deneme (18.10.2026): misafir girişi, buluta kaydet, güncelle, sunucudan yeniden açma,
      sayfa yenileme, yeni proje, yeniden adlandırma (sonrasında yanlış çakışma yok), iki sekmede gerçek çakışma
      uyarısı, giriş yapmamış isteğin tabloya erişememesi (HTTP 401, RLS)
- [ ] Silme düğmesinin gerçek Supabase'de denenmesi (kullanıcı yapacak; test projeleri: "Supabase testi 1", "Supabase testi 2 (yeni ad) B")
- [ ] İki farklı misafir hesabın birbirinin projelerini görememesi (ikinci tarayıcı/gizli pencereyle)

## Sıradaki işler (henüz uygulanmadı)

- [ ] Misafir hesabına e-posta bağlama (aynı hesap, veri kaybı yok) ve e-posta ile giriş → başka cihazdan erişim
- [ ] Herkese açık yayından önce: CAPTCHA (Supabase Auth), kullanıcı başına proje sayısı/boyut sınırı
- [x] Vercel'e yayın: https://akis-editoru.vercel.app (Vercel projesi `cengoo/akis-editoru`, depo `cengom/akis-editoru-`, `main` dalına her push otomatik yayınlanır)
- [x] Supabase → Authentication → URL Configuration → Site URL = https://akis-editoru.vercel.app (kullanıcı yaptı, 18.10.2026)
- [ ] Artık kullanılmayan özel `cengom/akis-editoru` (tiresiz) deposu: kullanıcı şimdilik tutmaya karar verdi (18.10.2026). Vercel'e bağlı değil; push'lar tireli depoya yapılmalı.
- [ ] İsteğe bağlı: bulut projesinde otomatik kaydetme seçeneği

- [ ] OEE bileşenleri (A × P × Q, ideal C/T, duruşlardan kullanılabilirlik) — ayrıntılı plan: `docs/plan-oee-ve-urun-aileleri.md`
- [ ] Birden fazla ürün ailesi, karma model (aile talebi/takt, ürün–proses matrisi, proses yükü) — aynı plan belgesi
- [ ] Zaman çizgisini tuval koordinatlarında (çizimle birlikte yakınlaşan) seçenek olarak sunmak
- [ ] Vardiya başına net süre girişi (günlük toplamı otomatik hesaplama)
- [ ] Veri kutusunu düğüm boyutuna dahil etme ya da alt bağlantı noktasını kutunun altına taşıma seçeneği
- [ ] Gruplama ve kulvarlar (departman içindeki kutuların birlikte taşınması, yatay/dikey kulvarlar)
- [ ] Bağlantı güzergâhlarını elle düzenleme (büküm noktaları)
- [ ] Bulut kaydı ve çok kullanıcılı çalışma (hesap/backend gerektirir; ücretsiz kalma hedefiyle ayrıca planlanmalı)

## Notlar

- `referans-vsm.jpg` geldi; 90° yan yatmış (saat yönünde 90° çevrilince doğru okunur). Düşük çözünürlüklü,
  yalnızca tasarım referansı. Ayrıntılar CLAUDE.md'de. Git'e eklenmedi.
