# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案簡介

**打卡平台管理端** — React 19 + TypeScript + antd(桌面版) + Vite 的獨立 SPA，供 Manager 角色使用(公司維護、員工維護、配假、排班、報表、角色權限等)。

跟打卡 RWD 員工端(`../ImcCardPlatformFrontend`)是**完全獨立的部署物**(獨立 build、獨立 war、獨立網址)，但共用同一個後端(`../ImcCardPlatformBackend`)，兩者用不同的 localStorage key 前綴避免同瀏覽器互相污染(這裡一律 `platform*`，員工端是 `token`/`chname` 等)。

正式部署會放在非根路徑 `/ImcCardPlatformAdmin/`(見 `vite.config.ts` 的 `base` 設定，只在 `build` 模式生效；本機 dev 維持根路徑不受影響)，打包進 `../ImcCardPlatformAdminShell` 這個純靜態檔 Spring Boot 殼子模組。

## 建置與啟動

```bash
npm run dev      # dev server，port 24001，/api proxy 到 http://localhost:8081
npm run build    # tsc -b && vite build
```

**Node 版本注意**：系統 PATH 預設的 `node`(`D:\Program Files\nodejs`)是 v14，太舊會讓 Vite 直接壞掉(`Unexpected token '??='`)。要把 `D:\App\tools\node-v24.14.1-win-x64` 排到 PATH 前面再跑建置指令。

## 目錄結構

| 目錄 | 說明 |
|---|---|
| `src/pages` | 每個功能一個檔案，`XxxList.tsx`(清單)+`XxxForm.tsx`(新增/編輯)是主要模式 |
| `src/api/client.ts` | axios instance + 大部分共用邏輯(權限判斷、localStorage 存取、「目前操作個案/公司」預設值 helper) |
| `src/components` | `PageHeader`(含「目前操作個案」顯示、登出) |
| `src/hooks` | `useIdleLogout`(閒置自動登出，逾時要跟後端 `app.jwt.expiration-ms` 一致)；`useCompanyCaseEmployee`(「客戶→個案→員工」三層篩選的共用狀態+下拉，員工每日請假/加班、簽核代理人維護用；員工每日打卡是更早寫的，還是自己內建同一套邏輯) |
| `src/types` | 跟後端 DTO 對應的 TypeScript 型別 |

## 核心慣例

- **路由基底**：`App.tsx` 的 `<BrowserRouter basename={import.meta.env.BASE_URL}>`，`RequireAuth` 檢查 `platformToken`。**注意**：這個 `basename` 只對 React Router 的 `<Navigate>`/`useNavigate` 生效，如果用 `window.location.href` 做整頁導頁(例如登出時清空 session 後導回登入頁)，要自己手動補 `` `${import.meta.env.BASE_URL}xxx` `` 前綴，否則正式部署在 `/ImcCardPlatformAdmin/` 時會導去網域根目錄(這裡曾經真的踩過這個坑)。
- **「選擇客戶／選擇個案」預設值**，`api/client.ts` 有兩種 helper，新頁面要先判斷屬於哪一種語義：
  - `resolveDefaultCompanyId`/`resolveDefaultDispatchCaseId`：預設帶「目前操作個案」，沒有就選清單第一筆(適合一定要選定範疇才能操作的頁面)。
  - `resolveOperatingDispatchCaseIdOnly`：只在「目前操作個案」存在時才預選，否則維持「全部/未選」(適合篩選類頁面，例如報表、通知)。
- **樣板客戶鎖定**：顧問角色(`isAdvisorRole()`，`role=004`)對樣板客戶(`Company.template`)的所有操作型按鈕都要 `disabled`(不只編輯/刪除)，按鈕文字維持原本功能名稱、不要換成解釋性文字；純導覽性質按鈕不受限制。
- **查詢 IMC 系統自動帶入資料**的既定 UI 模式(`ManagerForm.tsx`/`CompanyForm.tsx` 都有現成範例)：`!isEdit` 時顯示一個灰底提示框，內含輸入框(業務代號/客戶編號)+「查詢」按鈕，成功後用 `form.setFieldsValue()` 帶入其餘欄位；新增類似查詢功能直接比照這個結構，不用重新設計。
- **新增一個管理端頁面的檢查清單**(頁面權限是資料不是程式碼)：(1) `rights` 表新增一列 `維護作業|xxx`(`id` 沒有 sequence，用 `max(id)+1`；`sort` 用字串字典序，想插在某項後面可用 `507a` 這種後綴，不必動其他列)並在 `roleright` 授權給對應角色，SQL 存進 `ImcCardPlatform/dumpDB/`，範例見 `20260921_emp_day_leave_overtime_delegate_rights.sql`；(2) 後端 Controller 用 `RightsGuard.hasRight()` 檢查同一個字串；(3) `Home.tsx` 加卡片(`rightName` 要一致)；(4) `RoleRightsMatrix.tsx` 的 `TIER_ROWS` 加進 `rightNames`，角色功能畫面才會照分組顯示；(5) `App.tsx` 加路由。
- **antd 版本是 v6**(桌面版)，跟員工端用的 `antd-mobile` 是不同套件，元件 API 不能互相套用。

## 跟後端的關係

只透過 `/api/**`(proxy 到 8081)溝通，沒有自己的資料庫存取。改動涉及新欄位/新查詢條件時，要同步確認 `../ImcCardPlatformBackend` 對應的 DTO/Controller 有沒有跟著改。

## 驗證方式

沒有自動化測試。改完要 `npm run build` 過關(注意上面的 Node 版本陷阱)，涉及畫面行為的改動盡量起 dev server 實際操作過一次(`npm run dev` + 接本機後端 8081)。

更完整的協作慣例(需求怎麼寫、已知的坑)見 `../最終整理/打卡平台系列專案_Claude協作指南.md`。
