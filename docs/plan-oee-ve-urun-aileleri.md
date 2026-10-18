# Plan: OEE bileşenleri ve birden fazla ürün ailesi

Durum: tasarım onaylandı (18.10.2026). **1. bölüm (OEE) uygulandı** (kayıt formatı sürüm 7).
2. bölüm (ürün aileleri) henüz uygulanmadı; kayıt formatı sürüm 8 olacak.
Kararlar: OEE'de **karma giriş**; ürün aileleri için **tek harita, karma model (B)**.

## 1. OEE bileşenleri

OEE = Kullanılabilirlik (A) × Performans (P) × Kalite (Q). Sınıfının en iyisi referansı: %85.

| Bileşen | Formül | Kaynak alan |
| --- | --- | --- |
| A | çalışma ÷ planlı süre | `uptime` elle girilirse o; boşsa duruşlardan hesaplanır |
| P | ideal C/T ÷ gerçek C/T | yeni `idealCycleTime` + mevcut `cycleTime` |
| Q | 1 − hurda | mevcut `scrapRate` |

### Yeni proses alanları (gelişmiş)
- `idealCycleTime` — İdeal (tasarım) C/T, sn/dk.
- `unplannedDowntime` — Plansız duruş, dk/gün.
- `changeoversPerDay` — Değişim sayısı, adet/gün (tam sayı).

### Hesaplar
- A (hesaplanan) = (net süre − duruş − değişim sayısı × C/O) ÷ net süre. Net süre harita düzeyinden gelir.
  Uptime elle girildiyse kullanılan A elle girilendir; hesaplanan A ayrıca gösterilir (fark varsa not).
- P = ideal C/T ÷ C/T (en fazla %100; ideal > gerçek ise uyarı: "ideal C/T gerçekten büyük").
- OEE = A × P × Q; bileşenlerden biri boşsa OEE hesaplanmaz ve eksik olan yazılır.
- Etkin C/T formülü değişmez (C/T ÷ A ÷ Q = ideal C/T ÷ OEE).
- Günlük kapasite = net süre × A × Q ÷ C/T (adet/gün); talep ile karşılaştırılır (yük %).

### Arayüz
- Proses paneli: A, P, Q, OEE için dört küçük çubuk (hesaplanan değerler `.calc-value`), eksik bileşen notu.
- Veri kutusu: "OEE" satırı.
- VSM özeti: proses bazında OEE tablosu, en düşük OEE, %85 altı prosesler.

## 2. Birden fazla ürün ailesi (karma model)

### Veri modeli
- Harita düzeyi `families: { id, name, color, demand (adet/gün), packQuantity }[]`.
  Eski `customerDemand` ve `packQuantity` geçişte "Varsayılan aile"ye taşınır.
- Proses: `familyIds` (bu prosesten geçen aileler; boş = hepsi) ve isteğe bağlı aile başına C/T
  (`cycleTimeByFamily`; boşsa ortak C/T).
- Stok şekli: isteğe bağlı `familyId` (boş = tüm aileler).
- Kayıt formatı sürüm 8; eski dosyalar tek aileli açılır, değer kaybı yok.

### Hesaplar
- Aile takt'ı = net süre ÷ aile talebi; karma takt = net süre ÷ toplam talep.
- Ağırlıklı C/T = Σ(talepₐ × C/Tₐ) ÷ Σ talepₐ (yalnızca prosesten geçen aileler).
- Proses yükü = Σ(talepₐ × C/Tₐ) ÷ (net süre × A × Q); %100 üstü kapasite yetersiz.
- Stok günü: stok bir aileye bağlıysa o ailenin talebiyle, değilse toplam talep ile.
- Zaman çizgisi ve takt grafiği seçili aileye göre; "Tümü"nde ağırlıklı C/T ve karma takt.

### Arayüz
- Üstte aile seçici: "Tümü / Aile A / Aile B …".
- Harita panelinde aile listesi (ekle / sil / ad / renk / talep / paket adedi).
- Proses panelinde ürün–proses matrisi (onay kutuları) ve aile başına C/T tablosu.
- "Tümü" görünümünde proses yük grafiği (yük % ve %100 çizgisi); veri kutusunda aile renk etiketleri.

## Uygulama sırası
1. OEE veri alanları ve hesaplar → panel, veri kutusu, özet.
2. Aile veri modeli + sürüm 8 geçişi (testlerle: eski dosyalar).
3. Aile hesapları ve özet.
4. Aile seçici, zaman çizgisi, takt ve yük grafikleri.
Her adım tarayıcıda denenir ve ayrı commit edilir.
