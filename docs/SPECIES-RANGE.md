# Thiết kế và kế hoạch: Vùng phân bố của loài

| Mục | Nội dung |
|---|---|
| Ngày | 27/11/2026 |
| Trạng thái | Chờ duyệt |
| Liên quan | `docs/DESIGN.md`, mục 8 (giao diện) và mục 9 (dịch vụ bên ngoài) |

## 1. Mục tiêu

- Người dùng tìm được một loài động vật bằng tên tiếng Việt hoặc tên khoa học.
- Người dùng xem được thông tin chính của loài trong khung bên trái.
- Bản đồ hiện hai lớp cho loài đang xem. Lớp thứ nhất là vùng phân bố do chuyên gia vẽ. Lớp thứ hai là những nơi người ta đã thật sự gặp loài đó.
- Người dùng vẫn bấm được tỉnh, quốc gia và ghim như bình thường trong lúc hai lớp này đang hiện.

## 2. Phạm vi

Lần này làm:

- Tab mới "Loài" trong khung bên trái, có ô tìm loài và danh sách kết quả.
- Trang thông tin của một loài.
- Hai lớp bản đồ của loài đang xem, mỗi lớp bật tắt được.
- Nút ở góc phải cho biết loài nào đang hiện trên bản đồ, và tắt được.

Lần này **không làm**:

- Ghi lại loài đã gặp ở mỗi ghim.
- Danh sách loài quanh một ghim hay một tỉnh.
- Danh sách "nơi nên đi để gặp loài này".
- Bản đồ của Sách đỏ IUCN, vì API của IUCN cần khóa.
- Lưu bất cứ thông tin nào về loài vào dữ liệu người dùng. Tính năng này không đổi file `data/user-data.json` và không đổi schema.

## 3. Nguồn dữ liệu

Mình đã thử từng nguồn vào ngày 27/11/2026. Kết quả ghi trong bảng dưới.

| Nguồn | App dùng để làm gì | Cần khóa API | Trình duyệt gọi thẳng được | Giới hạn |
|---|---|---|---|---|
| Wikidata | Tìm loài bằng tên tiếng Việt. Lấy tên tiếng Việt, tình trạng Sách đỏ bằng tiếng Việt, ảnh bản đồ phân bố, mã loài trên iNaturalist và GBIF, tên bài Wikipedia tiếng Việt. | Không | Được | Wikidata trả lỗi 429 khi mình gửi ba yêu cầu trong nửa giây. |
| iNaturalist | Tìm loài bằng tên khoa học và tên tiếng Anh. Lấy ảnh, nhóm loài, số lần quan sát. Vẽ lớp vùng phân bố. | Không | Được | Tối đa 60 yêu cầu mỗi phút và 10.000 yêu cầu mỗi ngày. |
| GBIF | Vẽ lớp nơi đã gặp loài, dạng lưới lục giác. Lấy tổng số điểm quan sát và khung bao của các điểm. | Không | Được | GBIF không công bố giới hạn cho lớp bản đồ. |
| Wikipedia tiếng Việt | Lấy đoạn giới thiệu của loài. App đã có sẵn hàm `fetchSummary`. | Không | Được | Như hiện nay. |

Những điều mình đã kiểm tra:

- Tìm "voọc" trên Wikidata, chỉ lấy các mục có mã iNaturalist, cho ra Voọc đen má trắng, Voọc xám, Voọc bạc và Voọc quần đùi trắng.
- Tìm "voọc" trên iNaturalist chỉ cho ra Voọc Cát Bà. Tìm "vượn" trên iNaturalist cho ra hai loài không liên quan. Vì vậy app phải tìm tên tiếng Việt qua Wikidata.
- iNaturalist tìm tốt bằng tên khoa học. Ví dụ, "Pygathrix" cho ra Chà vá chân đỏ.
- Lớp vùng phân bố của iNaturalist có ô bản đồ cỡ 256 px. Ô rỗng có cỡ cố định 1.096 byte. Ví dụ là ô của Voọc Cát Bà, vì iNaturalist chưa có vùng phân bố cho loài này.
- Lớp của GBIF có ô cỡ 512 px. Kiểu lưới lục giác chạy được với `style=classic.poly&bin=hex&hexPerTile=30`.
- GBIF cho biết Chà vá chân đỏ có 699 điểm quan sát. Khung bao của các điểm trải từ vĩ độ 11 đến 24, và từ kinh độ 104 đến 112. Khung này rộng hơn vùng sống thật, vì có vài điểm lạc ở xa.
- Một loài có thể có hai mã trên iNaturalist sau khi các nhà khoa học đổi cách phân loại. Ví dụ, Vượn đen má hung có mã 74779 và mã 885131.
- Một số loài trên Wikidata chỉ có tên khoa học. Ví dụ, nhãn tiếng Việt của chích chòe lửa là "Copsychus malabaricus".

## 4. Các quyết định

| Chủ đề | Quyết định |
|---|---|
| Loại kết quả | Chỉ hiện loài (bậc `species`) thuộc giới Động vật. App bỏ chi, họ và thực vật. |
| Cách tìm | App tìm cùng lúc trên Wikidata và iNaturalist, rồi gộp kết quả theo mã iNaturalist. |
| Lúc gửi yêu cầu tìm | Chỉ khi người dùng bấm Enter hoặc nút tìm. App không tìm theo từng phím gõ. |
| Tên hiển thị | Tên tiếng Việt trên Wikidata, rồi tên tiếng Việt trên iNaturalist, rồi tên tiếng Anh, cuối cùng là tên khoa học. Nhãn tiếng Việt trùng tên khoa học được coi là chưa có tên tiếng Việt. |
| Lớp vùng phân bố | Ô bản đồ của iNaturalist. App chỉ tải ô đến mức zoom 4. Ở mức zoom lớn hơn, MapLibre phóng to ô của mức 4. |
| Lớp nơi đã gặp | Ô bản đồ của GBIF, dạng lưới lục giác. App chỉ lấy quan sát của người và của máy (ví dụ bẫy ảnh). App bỏ mẫu vật trong bảo tàng. |
| Thứ tự lớp | Hai lớp loài nằm trên lớp màu của vùng, và nằm dưới lớp chữ của bản đồ nền. Ghim vẫn nằm trên cùng. |
| Thời gian hiện lớp | Hai lớp hiện từ lúc mở trang loài. Hai lớp vẫn hiện khi người dùng rời trang loài, cho đến khi người dùng bấm nút tắt ở góc phải. |
| Server | Không cần thêm API route. Mọi nguồn đều cho trình duyệt gọi thẳng. |
| Gói cài đặt | Không thêm gói nào. |

## 5. Giao diện

### 5.1. Tab "Loài"

Khung bên trái có thêm tab thứ ba.

```
┌───────────────────────────────────────┐
│ 🔍 Tìm địa điểm, ví dụ Hội An      ◧ │
├───────────────────────────────────────┤
│ Địa điểm 17   Vùng 25   Loài          │
├───────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌─────┐ │
│ │ Tên loài, ví dụ voọc       │ │ Tìm │ │
│ └───────────────────────────┘ └─────┘ │
│                                       │
│ [ảnh] Voọc đen má trắng          CR › │
│       Trachypithecus francoisi        │
│       Thú                             │
│ [ảnh] Voọc xám                   EN › │
│       Trachypithecus crepusculus      │
│       Thú                             │
│ ...                                   │
│                                       │
│ Tên loài bạn gõ được gửi tới Wikidata │
│ và iNaturalist để tìm kiếm.           │
└───────────────────────────────────────┘
```

- Ô tìm loài nằm trong tab. Ô tìm địa điểm ở hàng đầu giữ nguyên.
- Mỗi kết quả có ảnh nhỏ, tên hiển thị, tên khoa học in nghiêng, nhóm loài (Thú, Chim, Bò sát, Lưỡng cư, Cá, Côn trùng, ...) và nhãn tình trạng Sách đỏ.
- Khi ô tìm còn trống, tab hiện 6 loài gợi ý của Việt Nam: Sao la, Voọc Cát Bà, Chà vá chân đỏ, Vượn đen má hung, Rùa Hoàn Kiếm và Công. Mã iNaturalist của 6 loài này được kiểm tra ở bước S1.
- Kết quả tìm được giữ lại khi người dùng mở một loài rồi bấm quay lại.

### 5.2. Trang loài

```
┌───────────────────────────────────────┐
│ ←  🔍 Tìm địa điểm ...             ◧ │
├───────────────────────────────────────┤
│ [ảnh lớn của loài]                    │
│ © the_taxanaut (CC BY-NC), iNaturalist│
│                                       │
│ Chà vá chân đỏ                        │
│ Pygathrix nemaeus · Thú               │
│ [Cực kỳ nguy cấp]                     │
│                                       │
│ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│ │ 855     │ │ 699     │ │ CR       │  │
│ │ quan sát│ │ điểm    │ │ Sách đỏ  │  │
│ │ iNat    │ │ GBIF    │ │ IUCN     │  │
│ └─────────┘ └─────────┘ └──────────┘  │
│                                       │
│ Trên bản đồ                           │
│ [■ Vùng phân bố        👁]            │
│ [⬡ Nơi đã gặp          👁]            │
│ [Bay tới vùng có loài này]            │
│ Một số điểm quan sát bị làm lệch vị   │
│ trí để bảo vệ loài quý hiếm.          │
│                                       │
│ Đoạn giới thiệu từ Wikipedia ...      │
│ Xem thêm · Đọc trên Wikipedia         │
│                                       │
│ Bản đồ phân bố (Wikimedia Commons)    │
│ [ảnh bản đồ phân bố]                  │
│                                       │
│ Nguồn: iNaturalist, GBIF, Wikidata,   │
│ Wikipedia.                            │
└───────────────────────────────────────┘
```

- Trang dùng lại các khối đang có trong `WikiBlocks`: `HeroImage`, `Stats`, `Intro`, `Details` và `SourceNote`.
- Ảnh lấy từ iNaturalist. Dòng ghi công tác giả và giấy phép luôn hiện ngay dưới ảnh, vì nhiều ảnh dùng giấy phép CC BY-NC.
- Nhãn Sách đỏ dùng tên tiếng Việt từ Wikidata, ví dụ "Cực kỳ nguy cấp". Màu nhãn theo mức độ: xanh cho Ít quan tâm, vàng cho Sắp bị đe dọa, cam cho Sắp nguy cấp, đỏ cho Nguy cấp và Cực kỳ nguy cấp, xám cho Thiếu dữ liệu.
- Hai nút bật tắt lớp dùng cùng kiểu với ba nút ở góc phải: có biểu tượng con mắt.
- Nút "Bay tới vùng có loài này" dùng khung bao của các điểm GBIF.
- Ảnh bản đồ phân bố chỉ hiện khi Wikidata có ảnh đó.

### 5.3. Hai lớp trên bản đồ

| Lớp | Nguồn | Cỡ ô | Mức zoom tải ô | Độ trong suốt | Ghi công |
|---|---|---|---|---|---|
| `tm-species-range` | `https://api.inaturalist.org/v1/taxon_ranges/{id}/{z}/{x}/{y}.png` | 256 px | 0 đến 4 | 0,6 | "Vùng phân bố © iNaturalist" |
| `tm-species-obs` | `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey={key}&basisOfRecord=HUMAN_OBSERVATION&basisOfRecord=MACHINE_OBSERVATION&style=classic.poly&bin=hex&hexPerTile=30` | 512 px | 0 đến 12 | 0,85 | "Điểm quan sát © GBIF.org" |

- Hai lớp được chèn ngay dưới lớp chữ đầu tiên của bản đồ nền, tức là trên các lớp màu vùng của app.
- Khi người dùng đổi sang loài khác, app gỡ hai lớp cũ rồi thêm hai lớp mới.
- Khi lớp tắt, app đặt `visibility` thành `none`. App không gỡ lớp, để bật lại không phải tải lại ô.

### 5.4. Nút loài đang hiện ở góc phải

```
● Đã đến 25 vùng 👁   ● Muốn đến 11 vùng 👁   📍 Ghim 17 👁   🐾 Chà vá chân đỏ ×
```

- Nút này nằm cùng hàng với ba nút lọc, theo cùng cách với nút lọc theo loại ghim đang có.
- Bấm vào tên loài thì mở lại trang loài.
- Bấm dấu × thì gỡ cả hai lớp của loài khỏi bản đồ.

### 5.5. Luồng tương tác

| Người dùng làm gì | App làm gì |
|---|---|
| Mở tab "Loài" | Hiện ô tìm loài và 6 loài gợi ý. |
| Gõ "voọc" rồi bấm Enter | Hiện "Đang tìm…". Sau đó hiện tối đa 10 loài. |
| Bấm một loài trong danh sách | Mở trang loài. Bật hai lớp trên bản đồ. Nếu GBIF có điểm quan sát, bản đồ bay tới khung bao của các điểm. |
| Tắt "Vùng phân bố" | Ẩn lớp vùng phân bố. Con mắt đổi thành con mắt gạch chéo. |
| Bấm một tỉnh trên bản đồ | Mở trang tỉnh như bình thường. Hai lớp của loài vẫn hiện. |
| Bấm tên loài ở góc phải | Mở lại trang loài. |
| Bấm × ở góc phải | Gỡ hai lớp của loài. Nút loài biến mất. |
| Bấm quay lại trên trang loài | Về tab "Loài" với danh sách kết quả cũ. |

### 5.6. Trạng thái rỗng và lỗi

| Tình huống | App hiện gì |
|---|---|
| Gõ ít hơn 2 ký tự rồi bấm tìm | "Gõ ít nhất 2 chữ cái." |
| Không có kết quả | "Không tìm thấy loài động vật nào. Thử tên khác hoặc tên khoa học." |
| iNaturalist chưa có vùng phân bố của loài | Nút "Vùng phân bố" bị mờ, kèm dòng "iNaturalist chưa có vùng phân bố của loài này." |
| GBIF không có điểm quan sát | Nút "Nơi đã gặp" bị mờ, kèm dòng "GBIF chưa có điểm quan sát của loài này." Nút "Bay tới" bị ẩn. |
| Dịch vụ trả lỗi 429 | "Dịch vụ đang bận. Thử lại sau ít phút." App không tự thử lại. |
| Mất mạng hoặc lỗi khác | "Không kết nối được dịch vụ tìm loài. Thử lại sau." |
| Loài không có tên tiếng Việt | Tên hiển thị là tên tiếng Anh hoặc tên khoa học. Trang loài không ghi gì thêm. |

### 5.7. Khả năng truy cập

- Ba tab dùng `role="tab"` như hai tab hiện có.
- Hai nút bật tắt lớp có `aria-pressed`.
- Ảnh loài có `alt` là tên hiển thị của loài.
- Nhãn Sách đỏ có chữ, không chỉ dựa vào màu.

## 6. Dữ liệu và cách gọi dịch vụ

### 6.1. Kiểu dữ liệu

```ts
/** Mức trong Sách đỏ IUCN. */
type IucnStatus = 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX' | 'DD';

/** Một loài trong danh sách kết quả tìm. */
interface SpeciesHit {
  inatId: number;
  /** Tên hiển thị, chọn theo thứ tự ở mục 4. */
  name: string;
  scientificName: string;
  /** Nhóm loài của iNaturalist, ví dụ "Mammalia" hay "Aves". */
  group: string;
  thumbnail?: string;
  iucn?: IucnStatus;
}

/** Thông tin đầy đủ của một loài, hiện trên trang loài. */
interface SpeciesInfo extends SpeciesHit {
  photo?: { url: string; attribution: string; license: string };
  observationsCount: number;
  /** Tên tình trạng Sách đỏ bằng tiếng Việt, lấy từ Wikidata. */
  iucnLabel?: string;
  wikidataId?: string;
  wikipediaTitle?: string;
  gbifKey?: number;
  /** Tên file ảnh bản đồ phân bố trên Wikimedia Commons. */
  rangeMapFile?: string;
}

/** Loài đang hiện trên bản đồ. App giữ trạng thái này riêng, không nằm trong `Selection`. */
interface ActiveSpecies {
  inatId: number;
  gbifKey?: number;
  name: string;
  group: string;
  showRange: boolean;
  showObservations: boolean;
}
```

`Selection` trong `src/map/useMap.ts` có thêm `{ kind: 'species'; inatId: number }`.

### 6.2. Tìm loài

1. App bỏ khoảng trắng hai đầu. Nếu còn ít hơn 2 ký tự, app dừng và báo lỗi.
2. App gửi cùng lúc hai yêu cầu.
   - Wikidata: `action=query&list=search&srsearch=<chữ gõ> haswbstatement:P3151&srlimit=10`. Điều kiện `haswbstatement:P3151` giữ lại các mục có mã iNaturalist, tức là các loài sinh vật.
   - iNaturalist: `/v1/taxa/autocomplete?q=<chữ gõ>&taxon_id=1&locale=vi&per_page=10`. Mã `taxon_id=1` là giới Động vật.
3. Với kết quả của Wikidata, app gọi `action=wbgetentities&props=labels|claims&languages=vi|en` để lấy tên và mã iNaturalist (P3151), mã GBIF (P846).
4. App gộp hai danh sách theo mã iNaturalist. Với các mã chỉ có trong kết quả của Wikidata, app gọi một lần `/v1/taxa/{id1,id2,...}?locale=vi` để lấy bậc phân loại, nhóm, ảnh và tình trạng Sách đỏ.
5. App bỏ các mục không phải bậc `species`, và các mục không có mã 1 trong `ancestor_ids`.
6. Thứ tự kết quả:
   1. Loài có tên tiếng Việt trùng hẳn với chữ gõ (không phân biệt hoa thường).
   2. Các loài còn lại của Wikidata, theo thứ tự Wikidata trả về.
   3. Các loài còn lại của iNaturalist, theo thứ tự iNaturalist trả về.
7. App hiện tối đa 10 loài.

Mỗi lần tìm tốn 4 yêu cầu: 2 tới Wikidata và 2 tới iNaturalist.

### 6.3. Thông tin loài

Khi mở trang loài, app gọi các yêu cầu sau.

| Yêu cầu | Lấy gì |
|---|---|
| iNaturalist `/v1/taxa/{id}?locale=vi` | Tên, nhóm, ảnh, số quan sát, tình trạng Sách đỏ, đường dẫn Wikipedia. Nếu `is_active` là `false`, app chuyển sang mã đầu tiên trong `current_synonymous_taxon_ids`. |
| Wikidata SPARQL theo `wdt:P3151 "<id>"` | Nhãn tiếng Việt, tên bài Wikipedia tiếng Việt, mã GBIF (P846), ảnh bản đồ phân bố (P181), tên tiếng Việt của tình trạng Sách đỏ (P141). |
| Wikipedia `fetchSummary(tên bài)` | Đoạn giới thiệu. |
| GBIF `density/capabilities.json?taxonKey=...` kèm bộ lọc ở mục 5.3 | Tổng số điểm quan sát và khung bao. |
| GBIF `/v1/species/match?name=<tên khoa học>&strict=true` | Chỉ gọi khi Wikidata không có mã GBIF. |
| Ô bản đồ vùng phân bố ở mức zoom 0 | Biết loài có vùng phân bố hay không (mục 6.4). |

### 6.4. Biết loài có vùng phân bố hay không

- App tải ô `taxon_ranges/{id}/0/0/0.png` bằng `Image` với `crossOrigin = 'anonymous'`. iNaturalist cho phép việc này, vì ô có header `Access-Control-Allow-Origin: *`.
- App vẽ ô lên một canvas 256 x 256, rồi kiểm tra kênh alpha. Nếu mọi điểm ảnh đều trong suốt, loài không có vùng phân bố.
- App không so cỡ file 1.096 byte, vì cỡ này có thể đổi khi iNaturalist đổi cách nén ảnh.

### 6.5. Giới hạn tốc độ gọi

- Mỗi dịch vụ có một hàng đợi riêng. Hai yêu cầu liên tiếp tới cùng dịch vụ cách nhau ít nhất 1 giây. Hàng đợi này dùng cùng cách với hàng đợi Nominatim trong `src/services/nominatim.ts`.
- Kết quả tìm và thông tin loài được giữ trong bộ nhớ. Mở lại cùng một loài thì không gọi lại.
- Ô bản đồ không đi qua hàng đợi, vì MapLibre tự tải. Lớp vùng phân bố chỉ tải ô đến mức zoom 4, nên cả thế giới chỉ có tối đa 341 ô. Khi xem Việt Nam, bản đồ chỉ cần vài ô. Trình duyệt giữ ô trong bộ nhớ đệm 1 giờ, theo header `Cache-Control` của iNaturalist.

## 7. Thay đổi trong code

### 7.1. File thêm mới

| File | Nội dung |
|---|---|
| `src/domain/species.ts` | Kiểu dữ liệu ở mục 6.1. Các hàm thuần: chọn tên hiển thị, gộp và xếp kết quả tìm, đổi mã Sách đỏ sang nhãn và màu. |
| `src/domain/species.test.ts` | Test cho các hàm thuần ở trên. |
| `src/services/species.ts` | Hàm `searchSpecies(query, signal)`, `fetchSpecies(inatId, signal)`, `fetchObservationExtent(gbifKey, signal)`, `hasRange(inatId)`. Hàng đợi ở mục 6.5. |
| `src/services/species.test.ts` | Test với `fetch` giả, theo cách của `nominatim.test.ts`. |
| `src/map/speciesLayers.ts` | Hàm thêm, gỡ và bật tắt hai lớp của loài. |
| `src/ui/SpeciesSearch.tsx` | Nội dung tab "Loài": ô tìm, loài gợi ý, danh sách kết quả. |
| `src/ui/SpeciesInfo.tsx` | Trang loài. |

### 7.2. File sửa

| File | Thay đổi |
|---|---|
| `src/map/useMap.ts` | Thêm `{ kind: 'species' }` vào `Selection`. Nhận `species: ActiveSpecies \| null` trong `Options` và gọi `speciesLayers.ts` khi giá trị này đổi. Thêm `fitBox(box)` vào `MapControls`. |
| `src/map/mapStyle.ts` | `prepareStyle` trả thêm id của lớp chữ đầu tiên, để chèn hai lớp loài đúng chỗ. |
| `src/map/MapView.tsx` | Truyền `species` xuống `useMap`. |
| `src/ui/SidePanel.tsx` | Thêm tab "Loài". Hiện `SpeciesInfo` khi `selection.kind` là `species`. |
| `src/App.tsx` | Thêm state `activeSpecies`. Thêm nút loài ở hàng nút góc phải. |
| `src/ui/WikiBlocks.tsx` | `HeroImage` nhận thêm dòng ghi công ảnh, nếu khối này chưa hỗ trợ. |
| `src/styles/tokens.css` | Kiểu cho tab mới, danh sách loài, nhãn Sách đỏ và nút bật tắt lớp. |

## 8. Các bước làm

### 8.1. Bước S1: Dịch vụ và logic

- Viết `src/domain/species.ts`, `src/services/species.ts` và test của hai file.
- Kiểm tra mã iNaturalist của 6 loài gợi ý.
- Kiểm tra bộ lọc `basisOfRecord` của GBIF có thật sự lọc hay không. Lần thử ngày 27/11 cho ra cùng tổng số với và không có bộ lọc. Mình sẽ thử thêm với một loài có nhiều mẫu vật bảo tàng.

| Kiểm tra | Điều kiện đạt |
|---|---|
| Unit test | Có test cho thứ tự kết quả, tên hiển thị khi thiếu tên tiếng Việt, nhãn tiếng Việt trùng tên khoa học, loài đổi mã trên iNaturalist, lỗi 429. Mọi test mới qua. |
| Script thử với dịch vụ thật | Tìm "voọc", "vượn", "sao la", "chà vá", "Pygathrix" và "rùa biển". Mỗi lần tìm ra ít nhất một loài đúng, hoặc báo không có kết quả một cách rõ ràng. Không có lỗi 429. |

### 8.2. Bước S2: Lớp bản đồ

- Viết `src/map/speciesLayers.ts` và sửa `useMap.ts`, `mapStyle.ts`, `MapView.tsx`.

| Kiểm tra | Điều kiện đạt |
|---|---|
| Bật Chà vá chân đỏ, zoom 5 ở Việt Nam | Thấy vùng phân bố ở miền Trung Việt Nam và Lào. Thấy lưới lục giác ở các nơi đã gặp. Chữ trên bản đồ vẫn đọc được. Ghim nằm trên hai lớp. |
| Tắt từng lớp | Lớp đó ẩn đi, lớp còn lại giữ nguyên. |
| Bấm × | Hai lớp và hai nguồn bị gỡ khỏi style. |
| Kéo bản đồ quanh Việt Nam từ zoom 5 đến 12 | Số ô tải từ iNaturalist không quá 30. |

### 8.3. Bước S3: Giao diện

- Viết `SpeciesSearch.tsx`, `SpeciesInfo.tsx`. Sửa `SidePanel.tsx`, `App.tsx`, `WikiBlocks.tsx` và `tokens.css`.

| Kiểm tra | Điều kiện đạt |
|---|---|
| Các luồng ở mục 5.5 | Mọi luồng chạy đúng. |
| Các tình huống ở mục 5.6 | Mọi dòng báo hiện đúng. Mình thử lỗi 429 và mất mạng bằng cách chặn yêu cầu ngay trong trình duyệt. |
| Dữ liệu thật | File `data/user-data.json` không đổi sau khi dùng tính năng. |
| Console | Không có lỗi. |
| Test và build | Mọi test qua, trừ test diện tích tỉnh cũ đã lỗi từ trước. `npm run build` qua. |

### 8.4. Bước S4: Cập nhật tài liệu

- `docs/DESIGN.md` mục 8 ghi tab "Loài" và trang loài. Mục 9 ghi ba nguồn mới.
- Tài liệu này đổi trạng thái thành "Đã làm".

### 8.5. Cách làm việc

- Mình làm lần lượt từng bước S1, S2, S3, S4.
- Sau mỗi bước, mình gửi bạn kết quả kiểm tra và ảnh chụp.

## 9. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| iNaturalist tính cả ô bản đồ vào giới hạn 60 yêu cầu mỗi phút. | Lớp vùng phân bố chỉ tải ô đến mức zoom 4. Bước S2 đếm số ô thật sự tải. |
| Wikidata trả lỗi 429 khi gọi dồn dập. | Hàng đợi 1 giây cho mỗi dịch vụ. App chỉ tìm khi bấm Enter. App báo lỗi rõ ràng và không tự thử lại. |
| Nhiều loài chưa có tên tiếng Việt. | Dùng tên tiếng Anh hoặc tên khoa học. |
| Cùng một loài có hai mã trên iNaturalist sau khi đổi cách phân loại. | Khi mã cũ không còn dùng, app chuyển sang mã mới (mục 6.3). Khi gộp kết quả, hai mã của cùng một mục Wikidata chỉ hiện một lần. |
| Điểm quan sát của loài quý hiếm bị làm lệch vị trí. | Trang loài ghi rõ điều này dưới hai nút bật tắt lớp. |
| GBIF có điểm lạc, ví dụ con vật trong vườn thú hoặc nhận nhầm loài. | Bộ lọc `basisOfRecord` bỏ mẫu vật bảo tàng. Lưới lục giác làm các điểm lạc ít nổi hơn chấm tròn. |
| Ảnh của iNaturalist có giấy phép CC BY-NC. App không bán và không dùng cho mục đích thương mại. | Luôn hiện tác giả và giấy phép dưới ảnh. |
| Vùng phân bố của iNaturalist có thể cũ hoặc thiếu so với Sách đỏ IUCN. | Trang loài ghi nguồn của từng lớp. Nếu bạn muốn dùng bản đồ IUCN sau này, bạn cần tự đăng ký khóa API của IUCN. |

## 10. Câu hỏi cần bạn chốt

| Câu hỏi | Đề xuất của mình |
|---|---|
| Chỉ hiện loài, hay cho cả chi và họ? | Chỉ hiện loài. Vùng phân bố của iNaturalist chỉ có ở cấp loài. |
| Có hiện 6 loài gợi ý khi tab "Loài" còn trống không? | Có. |
| Lớp "Nơi đã gặp" vẽ bằng lưới lục giác hay chấm tròn? | Lưới lục giác, vì dễ đọc hơn ở mức zoom xa. |
| Hai lớp của loài có giữ lại khi rời trang loài không? | Có, cho đến khi bấm ×. Như vậy bạn bấm được tỉnh để so với vùng phân bố. |

## 11. Nguồn tham khảo

- [iNaturalist API](https://api.inaturalist.org/v1/docs/)
- [Giới hạn tốc độ của iNaturalist, thảo luận trên diễn đàn](https://forum.inaturalist.org/t/429-error-from-observations-histogram-api-when-calling-at-60-calls-minute/64709)
- [GBIF Maps API](https://techdocs.gbif.org/en/openapi/v1/maps)
- [Wikidata API](https://www.wikidata.org/w/api.php)
- [Thuộc tính P3151 trên Wikidata: mã loài trên iNaturalist](https://www.wikidata.org/wiki/Property:P3151)
- [Thuộc tính P181 trên Wikidata: ảnh bản đồ phân bố](https://www.wikidata.org/wiki/Property:P181)
