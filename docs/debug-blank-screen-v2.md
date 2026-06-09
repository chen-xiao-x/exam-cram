# 空白屏 v2 调试会话

## Status: [FIXED]

## 现象
- 用户在浏览器打开 http://127.0.0.1:8765 后看到空白
- 出现时机：清理完 kp-import 探针代码之后

## 假设
- H1: 清理探针过程中意外把某段 JSX 结构改坏（括号不匹配 / 标签没闭合），导致 Babel 解析失败 ✅ **命中**
- H2: index.html 中 Babel 加载链路出问题 ❌
- H3: ChatTab 内部 steps.filter 在空 steps 上抛错 ❌
- H4: React 渲染时 ErrorBoundary 吞了错误 ❌
- H5: 服务没起来 ❌

## 证据
- 用 `@babel/parser` 解析 app.jsx：
  ```
  [check] file size: 214846 lines: 4148
  [check] SYNTAX ERROR:
  'return' outside of function. (2937:13)
  at line 2937 col 13
  ```
- 追到 2937 行：`<2937>  if (!open) return null;` 出现在文件顶层
- 进一步看，2303 行的 `UploadDrawer` 已简化为只 return `<ChatTab/>`（先前工作），但 2319-3101 的「原 UploadDrawer 共享状态+Tab 渲染+return null;」整段代码没清掉
- 删掉 2319-3101 后再解析：`[check] syntax OK`

## 根因
之前一次「简化 UploadDrawer → 只渲染 ChatTab」的改动只改了开头的 `const UploadDrawer = (...) => { return (<ChatTab .../>); }`，但忘了删掉原本 UploadDrawer 内部的共享状态、tab 切换 UI、return null 等大段代码，导致这些代码变成顶层悬空语句（用 useState、if return 等），Babel 解析失败 → React 永远不渲染 → 白屏。

## 修复
- 删掉 2319-3101 共 783 行悬空代码
- 保留 KeypointTab (3106-) 和 MaterialTab (3356-) 的独立组件定义（虽然不再使用，但保留不破坏现有引用即可；后续可清理）
- 验证：`node @babel/parser` 解析 → `syntax OK`

## 清理
- 临时诊断脚本 `_check_syntax.js`、`_trim_dead.js` 已删除
