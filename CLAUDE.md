# 期末速通

AI 驱动的期末复习工具：上传课件 → AI 拆分知识点 → 生成题目 → 卡片复习/刷题/SRS。

## 项目结构

```
期末速通-v0/
├── index.html          # 入口
├── data.js             # 默认课程数据（旧版兼容）
├── ai_server.js        # AI 后端（端口 8766）
├── serve.js            # 静态服务器（端口 8765）
├── parse-material.js   # 文件解析模块
├── .env                # MIMO_API_KEY 配置
├── src/                # 前端 React 组件
├── css/style.css       # 样式
├── tools/              # 工具脚本
│   ├── test-ai.js      # 单文件 AI 测试
│   ├── batch-process.js # 批量处理
│   ├── import-to-app.js # 格式转换
│   └── prompt-v1.txt   # AI Prompt 模板
└── start-all.bat       # 一键启动
```

## 常用命令

```bash
# 启动服务
start-all.bat

# 处理单个文件
node tools/test-ai.js <文件路径>

# 批量处理目录
node tools/batch-process.js <目录路径>

# 转换为网站格式
node tools/import-to-app.js <JSON文件>
```

## AI 配置

- 模型：mimo-v2.5-pro（小米 MIMO）
- API：https://token-plan-cn.xiaomimimo.com/v1
- Key：在 .env 中配置 MIMO_API_KEY

## Skill

- `/process-course <目录>` — 批量处理课件并导入网站
