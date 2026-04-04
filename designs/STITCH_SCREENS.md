# CareerFlow UI Screens - Stitch MCP

> **Project ID**: `17366397665912095806`
> **Project URL**: https://stitch.withgoogle.com/projects/17366397665912095806
> **Design System**: CareerFlow Ultra
> **Last Updated**: 2026-03-31

## Design System Tokens

| Token | Value |
|-------|-------|
| Primary Color | `#4F46E5` (Indigo) |
| Headline Font | Manrope |
| Body Font | Inter |
| Color Mode | Light |
| Roundness | ROUND_EIGHT |

---

## Unified Header Component

**所有页面必须使用统一导航栏**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo] CareerFlow  [Workspace] [Library] [Pricing] [Settings]               │
│                                                        [🌐 EN|中]  👤       │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Logo**: Left-aligned, 点击返回首页
- **Navigation**: Center-aligned, Manrope font
  - **Workspace** (工作台)
  - **Library** (成就库)
  - **Pricing** (定价) - **CN 市场用户隐藏此项**
  - **Settings** (设置)
- **Language Toggle**: Pill-shaped [EN | 中] with globe icon
- **Active State**: Indigo #4F46E5 underline/highlight
- **User Avatar**: Right-aligned

### 导航栏显示规则

| 用户状态 | payment_market | 显示导航项 |
|---------|----------------|-----------|
| 未登录 | - | Workspace, Pricing |
| CN 用户 | cn_free | Workspace, Library, Settings |
| EN 用户 | en_paid | Workspace, Library, Pricing, Settings |

---

## 路由守卫规则

### Pricing 页面访问控制

```typescript
// CN 市场用户访问 /pricing 时自动重定向
if (profile.payment_market === 'cn_free' && pathname === '/pricing') {
  redirect('/workspace')
}
```

**规则**：
- CN 用户 (`cn_free`) 访问 Pricing 页面 → 重定向到 Workspace
- EN 用户 (`en_paid`) 可正常访问
- 未登录用户可查看 Pricing 页面

---

## 版本历史侧边栏

### 触发位置
- Workspace 页面工具栏 [📜 历史] 按钮

### 设计规范
- 宽度: 400px
- 从右侧滑入动画 (300ms)
- 显示最近 20 个版本
- 按日期分组：今天、昨天、本周、更早

### 版本卡片内容
```
┌─────────────────────┐
│ v1.3 - 当前版本     │
│ 2026-03-31 10:30    │
│ • JD: 产品经理      │
│ [查看] [恢复]       │
└─────────────────────┘
```

---

## Screen List

### 1. Landing Page (首页)
- **Screen ID**: `69b74182b3224e838990d7370333b347` (Updated)
- **Device**: Desktop (2560 x 6734)
- **Features**:
  - ✅ Unified navigation: Workspace, Library, Pricing, Settings
  - ✅ Language toggle [EN | 中]
  - Hero section with value proposition
  - Feature highlights
  - CTA buttons

### 2. Resume Upload (简历上传页)
- **Screen ID**: `6256f72b23e3416db8e342d7d4ad1417` (Updated)
- **Device**: Desktop (2560 x 3272)
- **Features**:
  - ✅ Unified navigation: Workspace, Library, Pricing, Settings
  - ✅ Language toggle [EN | 中]
  - Drag & drop upload zone
  - File type support info
  - No login required (F1 flow)

### 3. Achievement Library (成就库)
- **Screen ID**: `d5918038b9ec40ae9924afd5a379fa6d` (Updated)
- **Device**: Desktop (2560 x 2466)
- **Features**:
  - ✅ Unified navigation: Workspace, Library, Pricing, Settings
  - ✅ Language toggle [EN | 中]
  - Achievement cards grouped by Tier (1/2/3)
  - Search and filter functionality

### 4. CareerFlow Workspace (同屏工作台)
- **Screen ID**: `c8b5e0e8b8f84e1e8c5e3f3e3e3e3e3e` (Updated)
- **Device**: Desktop (2560 x 2048)
- **Features**:
  - ✅ Unified navigation: Workspace, Library, Pricing, Settings
  - ✅ Language toggle [EN | 中]
  - Left panel: JD input + Achievement library
  - Right panel: Resume preview (TipTap editor)
  - Preview toolbar:
    - Language selector (中文 / English / 中英双语)
    - Photo toggle (CN: default on, EN: default off)
    - [📜 历史] Version history sidebar
    - Export button

### 4. Export Modal (导出弹窗 - 极简设计)
- **Screen ID**: `b52130ab82ce49fe97c3064ba7ccd011`
- **Device**: Desktop (2560 x 2048)
- **Features**:
  - **State 1 (cn_free 免费市场)**:
    - PDF icon with checkmark
    - Title: 导出简历
    - Label: ✓ 免费导出 (绿色)
    - Button: [立即下载]
  - **State 2 (en_paid 付费市场)**:
    - PDF icon
    - Title: Ready to Export
    - Subtitle: Upgrade to download PDF
    - Button: [Upgrade to Pro] → 跳转到定价页
  - ❌ 已移除格式选择（默认 PDF）
  - ❌ 已移除弹窗内定价卡片

### 5. Upgrade to Pro / Pricing (升级页/定价页)
- **Pricing Page Screen ID**: `9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d` (Updated)
- **Device**: Desktop (2560 x 2480)
- **Features**:
  - ✅ Unified navigation: Workspace, Library, Pricing, Settings
  - ✅ Language toggle [EN | 中]
  - **路由守卫**: CN 用户 (`cn_free`) 访问此页面自动重定向到 Workspace
  - Headline: "Choose Your Plan" / "Upgrade to Pro"
  - Subtitle: "Unlock unlimited exports"
  - **Three Pricing Cards (横向排列)**:
    1. **Per Export**: $2.99 - Single download, Pay as you go
    2. **Monthly**: $9.99/month - Unlimited exports, Cancel anytime
    3. **Yearly**: $79/year - **BEST VALUE** badge, Save 34%
  - Primary CTA: [Continue to Payment]

---

## Resume Preview Toolbar

Located in the Workspace page, above the resume preview:

```
┌────────────────────────────────────────────────────────────────────┐
│ [🌐 中文 ▼]  [📷 Photo: ON]  [📜 History]  [📤 Export]            │
└────────────────────────────────────────────────────────────────────┘
```

- **Language Selector**: 中文 / English / 中英双语
- **Photo Toggle**: ON/OFF (default varies by market)
- **History**: Version history dropdown
- **Export**: Triggers export modal (with paywall for en_paid)

---

## Export Flow (简化导出流程)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 用户点击 [导出] 按钮                                                      │
│     ↓                                                                    │
│ ┌─────────────────────┐    ┌─────────────────────────────────────────┐ │
│ │ cn_free 市场        │    │ en_paid 市场 (未订阅)                    │ │
│ │                     │    │                                         │ │
│ │ Export Modal:       │    │ Export Modal:                           │ │
│ │ - PDF icon ✓        │    │ - PDF icon                              │ │
│ │ - 免费导出          │    │ - Ready to Export                       │ │
│ │ - [立即下载]        │    │ - [Upgrade to Pro]                      │ │
│ │     ↓               │    │     ↓                                   │ │
│ │ 直接下载 PDF        │    │ 跳转到 Pricing 页面                     │ │
│ └─────────────────────┘    │     ↓                                   │ │
│                            │ 选择套餐 → 支付 → 下载                   │ │
│                            └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Payment Market Logic

| Market | profiles.payment_market | Export Behavior |
|--------|------------------------|-----------------|
| China | `cn_free` | Free export, no paywall |
| International | `en_paid` | Paywall with 3 pricing tiers |

### Pricing Structure (en_paid)

| Plan | Price | Billing | Features |
|------|-------|---------|----------|
| Per Export | $2.99 | One-time | Single export |
| Monthly | $9.99 | Monthly | Unlimited exports, Priority AI |
| Yearly | $79 | Yearly | Unlimited exports, Priority AI, **Save 34%** |

**Important**: Never use `geo.country` for payment decisions. Always use `profiles.payment_market`.

---

## Next Steps

1. [ ] Export HTML from Stitch for each screen
2. [ ] Implement React components based on designs
3. [ ] Add analytics tracking (trackEvent)
4. [ ] Integrate Stripe/Creem payment flow
5. [ ] Implement language toggle functionality (next-intl)
