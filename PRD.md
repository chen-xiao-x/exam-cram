# 期末速通 v1.0 · 产品需求文档（PRD）

> 定位：**精简版 PDF-Guru** —— 跨格式课件 → AI 自动制卡 → 内置复习。一条龙，自闭环。
> 不要 Anki 同步、不要 PDF 工具箱、不要视频笔记。

---

## 1. 产品定位

| 维度 | 说明 |
|------|------|
| **目标用户** | 中国大学期末复习场景下的学生 |
| **核心痛点** | 课件（PPT/PDF）很多，手动制卡耗时且容易遗漏 |
| **解决方案** | 上传课件 → AI 自动切章节 + 抽概念 + 出知识卡 → 内置闪卡/选择/速通复习 |
| **差异化** | 相比 PDF-Guru，**不依赖 Anki**，复习闭环全在站内；UI 极简，无冗余功能 |
| **技术栈** | React SPA（无构建工具） + Node ai_server.js（零依赖） + MIMO LLM + markitdown（Python） |

---

## 2. 现状盘点（v0 已有）

### ✅ 已实现
- [x] 跨格式输入：PDF / PPT / Word / Excel / TXT / Markdown
- [x] 多课程管理（多门课隔离）
- [x] 章节管理（手动 + AI 半自动）
- [x] 知识卡管理（标题/详情/要点/标签）
- [x] 题目管理（选择/判断/简答/速通）
- [x] ChatTab 统一上传入口（上一轮）
- [x] 4 类复习模式：闪卡 / 选择题 / 速通本节 / 错题本
- [x] 进度跟踪
- [x] 错题本 + 重做
- [x] AI 能力：summarize / gen-questions / structure-material / parse-keypoint-excel / match-keypoints / search-keypoint / web-search / chat
- [x] 考点提纲 Excel 导入
- [x] AI 自动匹配已有知识卡（语义匹配）
- [x] 联网补卡（缺概念时搜索）
- [x] 多文件感知（≥2 份放宽上限）

### ❌ 已知短板
- [ ] **PPT 解析质量差**（噪音、表格、版面）→ 需 markitdown 升级
- [ ] **AI 卡数偏少**（4 份课件只出 11 张）→ 需多轮抽卡 + few-shot
- [ ] **章节识别弱**（只认「第N章」）→ 需扩展启发式
- [ ] **无概念清单预览**（用户看不到 AI 准备出什么）
- [ ] **ChatTab 进度反馈弱**

---

## 3. 目标功能清单（v1.0）

### 🎯 P0（必须有）
| 功能 | 说明 | 验收 |
|------|------|------|
| 跨格式课件解析 | markitdown 统一转换 | 上传 PPT/PDF → 干净 Markdown |
| AI 多轮抽卡 | Round 1 列概念 → Round 2 扩卡 | 4 份课件 ≥ 50 张 |
| 章节智能切分 | 启发式 + 语义 fallback | 90% 课件能识别出章节 |
| 内置复习（已 OK） | 闪卡/选择/速通 | 流畅 |
| ChatTab 上传（已 OK） | 拖传 + 对话 | 1 步进入 |

### 🎯 P1（应该有）
| 功能 | 说明 |
|------|------|
| 概念清单预览 | AI 出卡前先展示概念列表，让用户删/补 |
| AI 详细度滑块 | 5/8/12 张/章 |
| 错题自动归集 | 错过的题自动进入错题本 |
| 复习进度可视化 | 章节完成度 / 卡片掌握度 |

### 🎯 P2（可选）
| 功能 | 说明 |
|------|------|
| 截图出卡 | PPT 里的图 → LLM 描述 → 图卡 |
| 多用户 / 云同步 | 脱离单机 |
| Anki .apkg 导出 | 以后再说 |

---

## 4. 技术架构

### 4.1 系统图
```
┌─────────────────────────────────────────────────┐
│  浏览器                                          │
│  ┌────────────────────────────────────────┐     │
│  │ React SPA (app.jsx)                     │     │
│  │  ├─ Landing 上传页                       │     │
│  │  ├─ ChatTab 对话 + 拖传                  │     │
│  │  ├─ 课程页 章节/卡片/题目                │     │
│  │  └─ 复习页 闪卡/选择/速通/错题           │     │
│  └────────────────────────────────────────┘     │
│         ↕ fetch (localhost:8765)                │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  Node 后端 (ai_server.js, 端口 8766)             │
│  ┌────────────────────────────────────────┐     │
│  │ 解析层                                  │     │
│  │  ├─ /api/parse-material → markitdown    │     │
│  │  └─ 本地正则兜底（PPT 噪音清）          │     │
│  ├────────────────────────────────────────┤     │
│  │ AI 提取层                               │     │
│  │  ├─ /api/extract-concepts (Round 1)     │     │
│  │  ├─ /api/structure-material (Round 2)   │     │
│  │  ├─ /api/match-keypoints                │     │
│  │  └─ /api/search-keypoint (联网补卡)     │     │
│  ├────────────────────────────────────────┤     │
│  │ 编排层                                  │     │
│  │  └─ /api/chat (统一入口，智能分发)      │     │
│  └────────────────────────────────────────┘     │
│         ↕ HTTPS                                  │
│  ┌────────────────────────────────────────┐     │
│  │ MIMO LLM (mimo-v2.5-pro)               │     │
│  └────────────────────────────────────────┘     │
│         ↕ child_process                          │
│  ┌────────────────────────────────────────┐     │
│  │ Python: markitdown（解析）              │     │
│  └────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 4.2 关键技术决策
| 决策 | 选择 | 理由 |
|------|------|------|
| 前端构建 | 无构建（CDN React + Babel） | 简单、可读、改动即时生效 |
| 后端依赖 | 零依赖 Node | start-all.bat 一键启 |
| LLM | MIMO mimo-v2.5-pro | 国产、便宜、中文强 |
| 文件解析 | markitdown | 微软开源、117k stars、统一 Markdown 输出 |
| 数据存储 | localStorage | 单机、零部署、隐私好 |
| 卡片存储 | JS Object | 不引入 IndexedDB，够用 |

---

## 5. API 契约

### 5.1 `/api/parse-material`（新增 · Phase 1）
```http
POST /api/parse-material
Content-Type: application/json

{
  "fileName": "eTOM框架.pdf",
  "fileType": "pdf",     // pdf | pptx | docx | xlsx | md | txt
  "fileBase64": "JVBERi0xLjQK...",  // 编码后内容
  "useMarkitdown": true  // 优先 markitdown，失败回退到本地
}
→
{
  "ok": true,
  "engine": "markitdown" | "local-fallback",
  "text": "## eTOM 框架概述\n\neTOM（增强的电信运营图）...",
  "stats": { "rawLen": 50000, "cleanLen": 32000, "savedPercent": 36 }
}
```

### 5.2 `/api/extract-concepts`（新增 · Phase 2）
```http
POST /api/extract-concepts
{
  "text": "eTOM 框架...",
  "courseName": "管理信息",
  "maxConcepts": 50
}
→
{
  "ok": true,
  "concepts": [
    { "title": "eTOM 框架定义", "chapter": "eTOM 概述", "difficulty": "easy" },
    { "title": "运营域分层", "chapter": "eTOM 概述", "difficulty": "medium" }
  ]
}
```

### 5.3 `/api/structure-material`（已存在 · Phase 2 升级）
```http
POST /api/structure-material
{
  "text": "eTOM 框架...",
  "courseName": "管理信息",
  "userHint": "本节重点是运营域分层",   // 可选
  "maxSections": 8,
  "maxCardsPerSection": 6,
  "conceptsHint": [                      // 【新增】来自 Round 1
    { "title": "eTOM 框架定义", "chapter": "eTOM 概述" }
  ]
}
→ { ai, sections, detectedChapters, allUnrecognized }
```

### 5.4 `/api/chat`（已存在 · 编排层）
统一入口，根据内容自动分发到 keypoint / material / other。

### 5.5 其他已存在端点（保持）
- `/api/summarize`
- `/api/gen-questions`
- `/api/parse-keypoint-excel`
- `/api/match-keypoints`
- `/api/search-keypoint`
- `/api/web-search`
- `GET /health`

---

## 6. 路由 / 页面规划

| 页面 | 路径 | 说明 |
|------|------|------|
| Landing | `/` | 大上传区（默认页） |
| 课程页 | `/course/:id` | 章节 / 卡片 / 题目 |
| 复习页 | `/course/:id/review` | 闪卡 / 选择 / 速通 |
| 错题本 | `/course/:id/mistakes` | 重做错题 |
| 进度 | `/course/:id/progress` | 学习进度 |

**Phase 3 UI 简化**：
- Landing 作为默认页（当前默认是课程页）
- 大上传区 + 「我已上传，继续上次」

---

## 7. 数据模型（localStorage）

### 7.1 courses data
```json
{
  "courses": {
    "管理信息": {
      "id": "xxx",
      "name": "管理信息",
      "subject": "管理学",
      "sections": [
        {
          "id": "s1",
          "title": "信息、数据、知识基本概念",
          "summary": "...",
          "sourceChapter": "第一章",
          "cards": [
            {
              "id": "c1",
              "title": "信息的定义",
              "detail": "...",
              "bullets": ["要点1", "要点2"],
              "tag": "定义"
            }
          ]
        }
      ],
      "questions": [
        {
          "id": "q1",
          "sectionId": "s1",
          "cardIndex": 0,
          "type": "choice",
          "stem": "下列关于信息的定义...",
          "options": ["A...", "B...", "C...", "D..."],
          "answer": "A",
          "explanation": "..."
        }
      ],
      "srs": { "q1": { "next": 1234567890, "interval": 1, "ease": 2.5 } }
    }
  },
  "activeCourseId": "xxx"
}
```

### 7.2 Chat session（新增 · Phase 3）
```json
{
  "chats": {
    "<courseId>": {
      "messages": [
        { "role": "user", "content": "把这份讲义整理成知识卡", "files": [...] },
        { "role": "ai", "content": "已整理 6 章节 18 张卡", "plan": {...} }
      ]
    }
  }
}
```

---

## 8. 开发路线图

### Phase 0 · 文档（先做）✅ 当前阶段
- [x] PRD.md（本文件）
- [ ] ARCHITECTURE.md（架构图、时序图）
- [ ] API.md（API 契约详解）

### Phase 1 · 解析层升级
- [ ] 集成 markitdown（pip install + child_process 包装）
- [ ] 新增 `/api/parse-material` 端点
- [ ] 本地正则兜底（PPT 噪音清）
- [ ] app.jsx 替换 PDF.js 直接抽 text → 走 markitdown
- [ ] **验收**：上传 PPT，对比前后抽出的 text 长度与质量

### Phase 2 · AI 提取层升级
- [ ] 新增 `/api/extract-concepts`（Round 1 概念清单）
- [ ] `/api/structure-material` 支持 `conceptsHint` 参数（Round 2 扩卡）
- [ ] prompt 模板：加 few-shot 示例
- [ ] 多粒度卡：定义/原理/公式/案例/对比
- [ ] **验收**：4 份课件 → 至少 50 张卡

### Phase 3 · UI 简化
- [ ] Landing 页（默认）— 大上传区
- [ ] ChatTab 优化：
  - 「已识别 X 概念 / 准备出 Y 张卡」实时显示
  - 一键导入按钮醒目
  - 已导入内容 ✓ 标记
- [ ] **验收**：第 1 次访问网站直接看到大上传区

### Phase 4 · 差异化（可选）
- [ ] 截图出卡（PPT 图片 → 图卡）
- [ ] 概念清单预览（出卡前可编辑）
- [ ] Anki .apkg 导出（**以后再说**）

### Phase 5 · 验收与文档
- [ ] 端到端测试：4 份课件 → ≥ 50 张卡
- [ ] 写 README.md
- [ ] 清理所有 debug 探针
- [ ] 性能：上传 → 出卡 < 30s

---

## 9. 验收清单

### 功能验收
- [ ] 上传 1 份 PDF → 5 分钟内出 ≥ 15 张卡
- [ ] 上传 4 份 PPT → 5 分钟内出 ≥ 50 张卡
- [ ] AI 识别的章节 ≥ 80% 准确
- [ ] 复习流程跑通：闪卡 / 选择 / 速通 / 错题
- [ ] ChatTab 上传一次成功，导入按钮工作正常

### 性能验收
- [ ] 上传 1 份 5MB PDF → 解析 < 10s
- [ ] AI 出卡 < 30s
- [ ] 页面响应 < 100ms（无卡顿）

### 体验验收
- [ ] 首次进入网站 = 上传页（无需登录）
- [ ] 上传 1 步到位（拖文件 → 看到进度）
- [ ] 导入成功有视觉反馈（success toast + 自动跳转）

---

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| markitdown 安装复杂 | 解析层升级受阻 | 提供 pip 安装文档 + 本地正则兜底 |
| MIMO API 不稳定 | AI 出卡失败 | 加重试 + 错误提示 + 模板兜底 |
| 4 份课件超 token | 截断丢内容 | 分块处理 + 摘要 + 全局视角 |
| 章节识别错 | 卡归错章节 | UI 给出"待手动划分"提示 |
| 用户重复点击 | 重复入库 | importingRef 防重入 + plan=null |
| 单 localStorage 容量 | 数据丢失 | 定期提示备份 JSON |

---

## 11. 文档清单

- [x] **PRD.md**（本文件）· 产品需求文档
- [ ] **ARCHITECTURE.md** · 架构图、时序图、数据流
- [ ] **API.md** · API 契约详解 + 错误码
- [ ] **README.md** · 启动/部署/常见问题
- [ ] **CHANGELOG.md** · 每次更新的变更说明

---

## 12. 进度跟踪（执行时更新）

| Phase | 状态 | 完成时间 | 备注 |
|-------|------|----------|------|
| Phase 0 文档 | ✅ | 2026-06-09 | PRD.md 已写 |
| Phase 1 解析层 | ✅ | 2026-06-09 | pdf-parse + mammoth + jszip + xml2js |
| Phase 2 AI 提取 | ✅ | 2026-06-09 | few-shot 精简版 + 5 类多粒度 + 强制 40 张下限，等浏览器实测 |
| Phase 3 UI 简化 | ⬜ | - | Landing + ChatTab 优化 |
| Phase 4 差异化 | ⬜ | - | - |
| Phase 5 验收 | ⬜ | - | - |

---

**文档版本**: v1.0
**最后更新**: 2026-06-09
**作者**: 期末速通项目组
