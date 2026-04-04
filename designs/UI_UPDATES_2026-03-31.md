# UI/UX 更新说明 - 2026-03-31

## 三项关键改动

### ✅ 1. 增加版本历史侧边栏

**位置**: Workspace 页面右侧
**触发**: 点击工具栏 [📜 历史] 按钮
**规格**:
- 宽度: 400px
- 动画: 从右侧滑入 (300ms)
- 内容: 最近 20 个版本，按日期分组
- 操作: [查看] [恢复]

**数据来源**: `resume_versions` 表

---

### ✅ 2. CN 市场用户不显示 Pricing 页面

**路由守卫**:
```typescript
if (profile.payment_market === 'cn_free' && pathname === '/pricing') {
  redirect('/workspace')
}
```

**导航栏规则**:
- CN 用户 (`cn_free`): 隐藏 Pricing 导航项
- EN 用户 (`en_paid`): 显示 Pricing 导航项
- 未登录用户: 显示 Pricing 导航项

---

### ✅ 3. 统一所有页面导航栏

**标准导航栏**:
```
[Logo] CareerFlow  [Workspace] [Library] [Pricing*] [Settings]  [🌐 EN|中] 👤
```

**显示规则**:

| 用户状态 | payment_market | 显示导航项 |
|---------|----------------|-----------|
| 未登录 | - | Workspace, Pricing |
| CN 用户 | cn_free | Workspace, Library, Settings |
| EN 用户 | en_paid | Workspace, Library, Pricing, Settings |

**需要更新的页面**:
- Landing Page
- Resume Upload
- Workspace
- Achievement Library
- Pricing

---

## 实施清单

- [ ] 在 Stitch 中更新所有页面的导航栏
- [ ] 设计版本历史侧边栏组件
- [ ] 实现路由守卫逻辑
- [ ] 更新导航栏显示逻辑
- [ ] 添加 Analytics 埋点
