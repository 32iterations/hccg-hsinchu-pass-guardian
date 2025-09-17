# language: zh-TW
Feature: 安心守護入口點導航
  驗證從首頁進入安心守護的導航流程
  確保三個分頁正確顯示與切換

  Background:
    Given 應用程式已啟動
    And 支援裝置為 "iOS 15.6+" 或 "Android 9+"

  Scenario: 首頁顯示安心守護入口
    Given 我在首頁
    When 首頁載入完成
    Then 應該看到 "安心守護" 入口圖示
    And 入口圖示應包含
      | 元素         | 內容                |
      | 圖標         | shield-heart.svg    |
      | 主標題       | 安心守護            |
      | 副標題       | 守護家人，安心同行   |
      | 狀態標籤     | 依用戶角色顯示      |

  Scenario: 點擊安心守護進入三分頁
    Given 我在首頁
    When 我點擊 "安心守護" 入口
    Then 系統應導航至 "/guardian"
    And 我應該看到三個分頁
      | 分頁名稱 | 圖標          | 預設狀態 | 順序 |
      | 家屬     | family.svg    | 選中     | 1    |
      | 志工     | volunteer.svg | 未選中   | 2    |
      | 申辦     | apply.svg     | 未選中   | 3    |
    And 預設顯示 "家屬" 分頁內容

  Scenario: 切換分頁功能
    Given 我在安心守護頁面
    And 當前在 "家屬" 分頁
    When 我點擊 "志工" 分頁
    Then "志工" 分頁應變為選中狀態
    And "家屬" 分頁應變為未選中狀態
    And 顯示 "志工" 分頁內容
    And URL 應更新為 "/guardian/volunteer"

  Scenario: 分頁切換保留狀態
    Given 我在 "家屬" 分頁
    And 已設定篩選條件 "僅顯示線上"
    When 我切換到 "志工" 分頁
    And 再切換回 "家屬" 分頁
    Then 篩選條件 "僅顯示線上" 應保留

  Scenario: 直接URL訪問分頁
    Given 我是已登入用戶
    When 我直接訪問 "/guardian/apply"
    Then 系統應顯示安心守護頁面
    And "申辦" 分頁為選中狀態
    And 顯示申辦頁面內容

  Scenario: 返回首頁功能
    Given 我在安心守護任一分頁
    When 我點擊返回按鈕
    Then 系統應返回首頁
    And 保留用戶登入狀態

  Scenario: 分頁標記通知
    Given 我是實名會員
    And 有新的志工任務
    When 我查看安心守護頁面
    Then "志工" 分頁應顯示紅點通知
    And 紅點上顯示數字 "1"

  Scenario: 橫向滑動切換分頁 (Mobile)
    Given 我使用手機裝置
    And 我在 "家屬" 分頁
    When 我向左滑動
    Then 應切換到 "志工" 分頁
    And 分頁切換應有滑動動畫

  Scenario: 分頁載入狀態
    Given 網路連線緩慢
    When 我切換到 "志工" 分頁
    Then 應顯示載入中動畫
    And 分頁標籤保持可互動
    And 載入完成後顯示內容