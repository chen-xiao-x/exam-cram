# 课件识别 0 章节 调试

## Status: [FIXED]

## 现象
用户上传 `eTOM介绍简单版2026.pdf`（10263 字符），AI 返回 "没识别出章节，请确认上传的是讲义"。
ai_server.log 多次显示：`structure-material: ai=True, sections=0, cards=0, cost=80~100s`

## 假设
- H1：`/api/chat` 把 text 传成空 → text 太短走 line 575 兜底返回空 ❌（text 1568 字符，不空）
- H2：LLM 返回了非 JSON（被 `extractJsonArray` 解析失败）→ 走 catch + fallbackStructureFromText ❌（fallback 永远返回 ≥1）
- H3：清洗循环把 cards 都丢掉了 → 验证：用 `_dbg/last-llm-material.ndjson` 记录清洗后数量 ❌（清洗后 sectionsLen=5，正常）
- H4 ✅ **命中**：当所有 section 的 `sourceChapter` 都是 null（LLM 没法定位到原课件「第N章」），line 681-687 把 `recognized` 设为空数组，然后 line 694 return `recognized` → 返回空 sections
- H5：前端解析出错（'undefined 章节 undefined 卡'）❌（前端只是显示问题，root 在后端）

## 证据
- `_repro.js` 模拟 eTOM 课件文本（1568 字符）打 `/api/chat`
- `.dbg/last-llm-material.ndjson` 抓取 3 个时间点：
  - `at+0`：LLM 原始 contentLen=4538
  - `at+1`：arrLen=5, firstSecCardsLen=3（解析成功）
  - `at+2`：**sectionsLen=5, perSec 5 个全部 droppedCards=[], cleanedCardsLen 正常** ← 清洗完全正常
- 同样 5 个章节的 title 在 .dbg 中显示为 UTF-8 中文被 GBK 解码的乱码（仅 PowerShell 显示问题，content 本身正常）
- 之后 ai_server.log 显示 `sections=0` —— 5 个被丢了

## 根因
`ai_server.js:680-694` 「全未识别」分支的逻辑 bug：
```js
if (recognized.length === 0) {
  sections.forEach(s => s.title = '未识别章节（待手动划分）');
  unrecognized = sections;
  recognized = [];      // ← 把 recognized 清空
}
...
return { status: 200, body: { ai: true, sections: recognized, ... } };  // ← return 空数组
```
`sections` 数组本身有 5 个 chapter（已 rename），但 return 的却是空 `recognized`，导致前端收到 0 章节、显示"没识别出章节"。

## 修复
[ai_server.js:680-697](file:///d:/xiazai/work.2026/%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86/%E6%9C%9F%E6%9C%AB%E9%80%9F%E9%80%9A-v0/ai_server.js#L680-L697)：
- 新增 `const finalSections = recognized.length > 0 ? recognized : sections;`
- return `finalSections`（recognized 非空时取它，否则取全部 sections）
- 修复后的逻辑：部分章节有 sourceChapter → 取 recognized（带"未识别章节"末尾组）；全部都没 sourceChapter → 取 sections（全部已 rename 为"未识别章节（待手动划分）"）

## 验证（post-fix）
同样 `_repro.js` 跑出来：
```
[repro] ok: true
[repro] sections: 6
[repro] sec[0].title: 未识别章节（待手动划分）  (UTF-8 中文)
[repro] card[0].title: eTOM定义与提出者 (UTF-8 中文)
[repro] summary: { sections: 6, cards: 18, ai: true }
[repro] text reply: 已整理出 6 个章节 18 张知识卡（AI 智能整理）
```
- 5 个真实章节 + 1 个"未识别章节（待手动划分）"汇总组 = 6
- 18 张知识卡，全部入库
- 提示「未识别章节（待手动划分）」可让用户手动拖到指定章节（后续可在课程页支持手动指定章节归属）

## 清理
- `_repro.js` 临时复现脚本已删
- `_repro.out` 临时输出已删
- `.dbg/last-llm-material.ndjson` 已删
- 3 个 `region debug-point str-mat-*` 插桩代码已删
