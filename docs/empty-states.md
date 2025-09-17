# 安心守護 - 空狀態文案設計

## 設計原則
- **親切友善**：使用溫暖、支持性的語言
- **指引明確**：清楚說明下一步該做什麼
- **視覺層級**：圖示 → 標題 → 說明 → 行動按鈕
- **適應情境**：根據用戶角色顯示不同文案

## 家屬分頁空狀態

### 未登入用戶
```yaml
icon: shield-lock
title: 請先登入
description: 登入後即可使用安心守護功能，守護您的家人
cta:
  text: 立即登入
  action: navigate_to_login
  style: primary
```

### 一般會員（未實名）
```yaml
icon: verified-user
title: 需要實名驗證
description: |
  為確保服務安全性，使用定位追蹤、電子圍籬
  等功能需要先完成實名驗證
cta:
  text: 前往實名驗證
  action: navigate_to_verification
  style: primary
secondary_cta:
  text: 了解更多
  action: show_info_modal
  style: text
```

### 實名會員（未綁定受照護者）
```yaml
icon: family-add
title: 尚未綁定受照護者
description: |
  開始使用安心守護服務
  為您的家人提供24小時的守護
steps:
  - 點擊下方按鈕開始綁定
  - 輸入受照護者資訊
  - 完成同意書簽署
cta:
  text: 綁定受照護者
  action: start_binding_flow
  style: primary
  icon: plus
helper_text: 最多可綁定3位受照護者
```

### 實名會員（已綁定但無即時資料）
```yaml
icon: location-searching
title: 正在取得位置資訊
description: 首次定位可能需要1-2分鐘，請稍候
loading: true
helper_text: |
  提示：請確認受照護者的裝置
  - 已開啟定位功能
  - 已連接網路
  - 電量充足
```

## 志工分頁空狀態

### 一般會員（未實名）
```yaml
icon: volunteer-badge
title: 加入志工行列
description: |
  成為安心守護志工，一起守護社區長者
  完成實名驗證即可開始接受任務
benefits:
  - 獲得志工時數認證
  - 參與社區服務
  - 累積愛心積分
cta:
  text: 完成實名驗證
  action: navigate_to_verification
  style: primary
```

### 實名會員（無任務）
```yaml
icon: task-completed
title: 目前沒有新任務
description: |
  感謝您的熱心參與！
  有新任務時我們會立即通知您
settings_hint: 可在設定中調整接收任務的時段與區域
cta:
  text: 查看歷史任務
  action: show_history
  style: secondary
notification_status:
  enabled: true
  text: 任務通知已開啟
```

### 實名會員（首次加入）
```yaml
icon: welcome-volunteer
title: 歡迎加入志工團隊！
description: |
  您已成功註冊為安心守護志工
  讓我們一起為社區盡一份心力
onboarding_steps:
  - title: 設定服務區域
    description: 選擇您方便服務的區域
    completed: false
  - title: 設定服務時段
    description: 告訴我們您可服務的時間
    completed: false
  - title: 完成教育訓練
    description: 觀看5分鐘教學影片
    completed: false
cta:
  text: 開始設定
  action: start_onboarding
  style: primary
```

## 申辦分頁空狀態

### 未登入用戶
```yaml
icon: document-info
title: 了解安心守護服務
description: |
  為失智症患者及家屬提供的守護服務
  包含定位追蹤、電子圍籬、緊急通報等功能
features:
  - icon: location
    text: 即時定位追蹤
  - icon: fence
    text: 智慧電子圍籬
  - icon: alert
    text: 24小時緊急通報
cta:
  text: 登入以申辦
  action: navigate_to_login
  style: primary
secondary_cta:
  text: 下載服務說明
  action: download_brochure
  style: text
```

### 一般會員（可查看但不能申辦）
```yaml
icon: form-locked
title: 線上申辦服務
description: |
  申辦安心守護服務需要完成實名驗證
  以確保申請資料的真實性與安全性
info_cards:
  - title: 申辦資格
    items:
      - 設籍新竹市民
      - 65歲以上失智症患者家屬
      - 或經醫師診斷需要之個案
  - title: 準備文件
    items:
      - 身分證明文件
      - 醫師診斷證明
      - 家屬同意書
cta:
  text: 前往實名驗證
  action: navigate_to_verification
  style: primary
download_section:
  title: 相關文件下載
  files:
    - name: 申請書範本
      format: PDF
      size: 245KB
    - name: 同意書範本
      format: PDF
      size: 180KB
```

### 實名會員（可申辦）
```yaml
icon: form-ready
title: 開始申辦
description: |
  您已完成實名驗證
  現在可以開始線上申辦程序
process_steps:
  - number: 1
    title: 填寫申請表
    time: 約10分鐘
  - number: 2
    title: 上傳文件
    time: 約5分鐘
  - number: 3
    title: MyData授權
    time: 約2分鐘
  - number: 4
    title: 送出申請
    time: 立即
estimated_time: 預計辦理時間：7個工作天
cta:
  text: 立即申辦
  action: start_application
  style: primary
  icon: arrow-right
save_draft:
  text: 可隨時儲存，稍後繼續
```

### 實名會員（已申辦）
```yaml
icon: application-submitted
title: 申請已送出
description: |
  您的申請已成功送出
  申請編號：#2024031500123
status_timeline:
  - date: 2024/03/15
    time: 10:30
    status: 已送出
    current: true
  - date: 預計 2024/03/16
    status: 承辦審核中
    current: false
  - date: 預計 2024/03/22
    status: 核准/駁回
    current: false
cta:
  text: 查看申請詳情
  action: view_application_detail
  style: secondary
notification:
  text: 已開啟進度通知，狀態更新時會立即通知您
  icon: notification-on
```

## 錯誤狀態

### 網路連線錯誤
```yaml
icon: wifi-off
title: 無法連接網路
description: 請檢查您的網路連線後重試
cta:
  text: 重新載入
  action: reload_page
  style: primary
```

### 服務暫時無法使用
```yaml
icon: maintenance
title: 系統維護中
description: |
  預計維護時間：今日 02:00 - 04:00
  造成不便，敬請見諒
alternative:
  text: 如有緊急狀況請撥打
  phone: 1999
  action: dial_phone
```

### 權限不足
```yaml
icon: permission-denied
title: 權限不足
description: 您目前的帳號權限無法使用此功能
helper_text: |
  若您認為這是錯誤，請聯繫客服
  客服專線：03-1234567
  服務時間：週一至週五 08:00-18:00
```

## 載入狀態

### 資料載入中
```yaml
type: skeleton
show_items: 3
animation: pulse
text: 載入中，請稍候...
```

### 首次載入（較長等待）
```yaml
type: progress
stages:
  - text: 正在驗證身分...
    progress: 33
  - text: 載入個人資料...
    progress: 66
  - text: 準備完成...
    progress: 100
```

## 特殊情境

### 服務時間外（志工）
```yaml
icon: clock-night
title: 非服務時間
description: |
  志工服務時間：
  週一至週日 08:00 - 20:00

  目前時間：23:45
next_available: 明天早上 8:00 開始
cta:
  text: 設定提醒
  action: set_reminder
  style: secondary
```

### 達到綁定上限（家屬）
```yaml
icon: limit-reached
title: 已達綁定上限
description: |
  您已綁定3位受照護者（上限）
  如需變更，請先解除現有綁定
current_bindings:
  - name: 王○明
    id_suffix: 1234
  - name: 李○華
    id_suffix: 5678
  - name: 陳○美
    id_suffix: 9012
cta:
  text: 管理綁定
  action: manage_bindings
  style: secondary
```

### 積分不足（志工獎勵兌換）
```yaml
icon: points-insufficient
title: 積分不足
description: |
  此獎勵需要：500 積分
  您目前積分：320 積分
  還差：180 積分
suggestion: 完成更多志工任務來獲得積分
cta:
  text: 查看可接任務
  action: view_available_tasks
  style: primary
```

## 文案風格指南

### 用詞規範
- ✅ 使用：受照護者、家屬、志工、申辦
- ❌ 避免：病患、患者、老人、失智者

### 語氣原則
- **支持性**：「讓我們一起...」「感謝您的...」
- **清晰性**：避免專業術語，使用日常用語
- **積極性**：強調服務價值而非問題

### 顏色運用
- **主要操作**：品牌色（藍色 #0066CC）
- **次要操作**：灰色邊框（#E5E5E5）
- **警示狀態**：橘色（#FF6B35）
- **錯誤狀態**：紅色（#DC3545）
- **成功狀態**：綠色（#28A745）