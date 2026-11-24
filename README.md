# 行程筆記

傳統中文（zh-Hant）的旅行行程筆記本。在瀏覽器裡建立行程、排每天的住宿／起點與景點、看地圖與路線、核對營業時間、記票價與預訂狀態，並把還沒排進去的地方放在願望清單。資料存在這台瀏覽器的 `localStorage`，不需要登入或後端帳號。

## 執行

```bash
npm install
npm start
```

然後打開 [http://127.0.0.1:4317](http://127.0.0.1:4317)。

`npm start` 會啟動 Vite。貼上連結時的頁面預覽（Open Graph 圖片與標題）由這個開發伺服器讀取，所以請用上面的指令，不要直接打開建置後的靜態檔。

GitHub Pages（https://hongsanglee464-wq.github.io/itinerary-notebook/）是靜態網站，沒有 `/api/link-preview`。貼上連結的預覽圖需要本機 `npm start`；用地名帶出的照片在線上版仍可使用。

```bash
npm test
```

單元測試涵蓋連結解析、圖片篩選、營業時間判斷、預算、路線合計與分享連結。

## 可以做的事

- 建立、修改、刪除行程。每天有日期、住宿或當日起點，以及有順序的景點。
- 用地名搜尋，或貼上 Google 地圖、Apple 地圖、OpenStreetMap、`geo:` 或官網連結。
- 景點卡片與願望清單會顯示找得到的圖片；找不到或圖片載入失敗時顯示「尚無圖片」。
- 地圖標出住宿與當天景點順序，並計算住宿 → A → B 的距離與估計時間。可切換開車、步行、大眾運輸。
- 拖曳或上下按鈕調整景點順序後，路線會重算。
- 有營業時間時，依預計抵達時間提示是否可能打烊；沒有資料或無法判斷時會明確警告，不會補上猜測的時間。
- 每個景點可填票價／費用與預訂狀態（未預訂、已預訂、已付款），行程會加總已填金額。
- 願望清單的地點可以移入某一天。
- 用 Open-Meteo 顯示目的地或行程座標的天氣。
- 下載 JSON、下載可列印的 HTML、複製分享連結（網址 hash），或匯入 JSON。

預計抵達只用來對照營業時間，不是停留時程表。

## 資料來源與限制

沒有查到的距離、時間、營業時間或天氣會標成無法取得，不會填假數字。

| 項目 | 免費來源 | 限制 |
| --- | --- | --- |
| 地圖 | OpenStreetMap 圖磚 | 需保留 © OpenStreetMap 聲明 |
| 地名 | Nominatim | 公開服務約每秒 1 次請求，結果依 OpenStreetMap |
| 營業時間 | 該地點的 OSM `opening_hours` | 很多店家沒有這項標籤。含國定假日（`PH`）而函式庫沒有該國假日資料時，會標成無法判斷。可選填 Google 金鑰再查 |
| 開車、步行 | OSRM：`routing.openstreetmap.de` 的開車與步行路網 | 公開的 `router.project-osrm.org` 把步行也算成開車，所以這裡分開使用。估計時間不含即時路況 |
| 大眾運輸 | [Transitous](https://transitous.org/sources) | 無金鑰。覆蓋範圍依各地開放班表，沒有路線時會直接說明。景點之間不含停留，預設以當天 09:00 從起點試算 |
| 天氣 | Open-Meteo | 預報大約 16 天；更早的日期改查歷史觀測。超出範圍會說明 |
| 圖片 | 連結的 Open Graph 圖，或 Wikimedia／OSM | 不會使用帶有第三方 API 金鑰的 Google 靜態地圖。官網若擋預覽，可能只剩 Wikimedia 或空狀態 |

Google Maps JavaScript API 金鑰是選填，只存在這台瀏覽器，不會寫進 JSON、HTML 或分享連結。有金鑰時，大眾運輸在 Transitous 失敗後會再試 Google；營業時間缺少或無法判斷時，可按「用金鑰查營業時間」。金鑰需能在瀏覽器使用，並啟用 Maps JavaScript、Places 與 Directions。

Transitous 公開服務供開放原始碼、非商業使用，並請標明資料來源。
