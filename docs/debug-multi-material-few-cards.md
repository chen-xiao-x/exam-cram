# 多课件只生成少量卡片 v5

## Status: [FIXED]

## 现象
- 用户：4 个课件导入，只生成 11 张知识卡
- 截图：当前课程「管理信息」下 4 个章节，共 11 道复习题
- 期望：4 个课件每个至少 8-15 张卡 = 30-60 张

## 静态分析（不开 debug 服务器，直接读代码）
读了 ai_server.js 相关代码后，定位三个叠加根因：
- H1 ✅ 命中：handleStructureMaterial 默认 maxCardsPerSection=5（[ai_server.js:574](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L574)），/api/chat 编排时又压到 6（[ai_server.js:915](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L915)）
- H2 ✅ 命中：prompt 写「全文保证至少 3 个章节 6 张卡」（[ai_server.js:617](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L617)）— AI 把它当硬上限
- H3 ✅ 命中：4 个文件用 `【filename】\n` 拼接成 1 段 text（[app.jsx:3144](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/app.jsx#L3144)）→ AI 看到长文本保守只切几章
- H4 ❌：text 截断到 64000 字（[ai_server.js:570](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L570)），4 个课件不会超
- H5 ❌：不存在「AI 切分太粗」本身

## 修复（基于静态分析的最小修改）
1. **默认值上调**（[ai_server.js:573-574](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L573-L574)）：`maxSections` 12→16、`maxCardsPerSection` 5→8（上限 20→24 / 8→12）
2. **多文件感知**（[ai_server.js:914-926](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L914-L926)）：扫 `【filename】` 标记数，≥2 视为多文件
   - 多文件：maxSections 16→24、maxCardsPerSection 8→10
   - 多文件：userHint 加「按文件拆章节、每章 8-10 张、全文保证 30+ 张」
3. **prompt 卡数下限**（[ai_server.js:594-597, 622](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L594-L622)）：
   - 旧：「全文保证至少 3 个章节 6 张卡」→ 删
   - 新：「每个真实章节至少 6 张、全文保证至少 max(12, maxSections*3) 张。材料丰富可往上限靠」
   - 强调「每张卡是一个独立可考的概念/原理/方法/公式/案例/对比，颗粒度要细」

## 探针
- `[smat-1]` 入口：rawTextLen, afterTruncate, maxSections, maxCardsPerSection — 验证 text 长度 + 上限值
- AI server 已重启

## 验证
- @babel/parser：JSX OK
- node Function()：JS OK
- ai_server 进程：已重启 8766

## 清理
- 保留 `[smat-1]` 探针作为生产观察点（无副作用）
