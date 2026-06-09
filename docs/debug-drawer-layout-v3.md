# 上传抽屉布局错误 v3

## Status: [FIXED]

## 现象
ChatTab 内容直接显示在主页底部，没有遮罩/抽屉效果。

## 根因
`UploadDrawer` 被简化时只 return `<ChatTab/>`，把外层 drawer 框架（drawer-mask、aside.drawer、drawer-header、drawer-body）以及 `if (!open) return null;` 一起删掉了。

## 修复
`app.jsx:2303-2330`：给 UploadDrawer 加回：
- `if (!open) return null;` 提前退出
- `<div className="drawer-mask" onClick={onClose} />` 遮罩
- `<aside className="drawer">` 右侧 420px 抽屉
- `<div className="drawer-header">` 标题 + 关闭按钮
- `<div className="drawer-body" style={{ display: 'flex', flexDirection: 'column' }}>` 包裹 ChatTab

## 验证
- @babel/parser 解析：`syntax OK · size: 180779 lines: 3377`
- 浏览器需刷新一次（强刷 Ctrl+Shift+R 避免缓存）

## 清理
- `_check.js` 临时脚本已删
