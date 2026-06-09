#!/usr/bin/env node
// 期末速通 · AI 文本处理测试工具
// 用法：node tools/test-ai.js <文件路径> [--prompt <prompt文件>] [--out <输出文件>]
//
// 示例：
//   node tools/test-ai.js 课件.pdf
//   node tools/test-ai.js 课件.pdf --prompt tools/prompt-v2.txt
//   node tools/test-ai.js 课件.pdf --out result.json
//
// 流程：解析文件 → 调用 AI → 输出结果 JSON → 可人工审查

const fs = require('fs');
const path = require('path');
const { parseMaterial } = require('../parse-material');

// ---- 参数解析 ----
const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const promptFile = getArg('--prompt');
const outFile = getArg('--out') || 'tools/last-result.json';
const maxTokens = parseInt(getArg('--max-tokens') || '16000', 10);
const temperature = parseFloat(getArg('--temperature') || '0.2');

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

if (!filePath) {
  console.log(`
用法：node tools/test-ai.js <文件路径> [选项]

选项：
  --prompt <文件>     使用自定义 prompt 文件（默认用内置 prompt）
  --out <文件>        输出结果文件（默认 tools/last-result.json）
  --max-tokens <N>    最大 token 数（默认 16000）
  --temperature <N>   温度（默认 0.2）

示例：
  node tools/test-ai.js ../课件.pdf
  node tools/test-ai.js ../课件.pdf --prompt tools/prompt-v2.txt
`);
  process.exit(0);
}

// ---- 加载 .env ----
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) {
      let v = m[2].replace(/^['"]|['"]$/g, '').trim();
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
})();

const BASE_URL = (process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1').replace(/\/+$/, '');
const API_KEY = (process.env.MIMO_API_KEY || '').trim();
const MODEL = (process.env.MIMO_MODEL || 'mimo-v2.5-pro').trim();

// ---- AI 调用 ----
async function callAI(messages, opts = {}) {
  if (!API_KEY) throw new Error('MIMO_API_KEY 未配置（检查 .env）');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 300000);
  const r = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({
      model: MODEL, messages, stream: false,
      max_tokens: opts.max_tokens || maxTokens,
      temperature: opts.temperature ?? temperature,
      top_p: 0.95,
    }),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  const text = await r.text();
  if (r.status !== 200) throw new Error('HTTP ' + r.status + ': ' + text.slice(0, 300));
  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 返回空');
  return content;
}

// ---- JSON 提取 ----
function extractJson(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // 尝试整体解析
  try { return JSON.parse(t); } catch {}
  // 找 { ... }
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, q = null;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (c === '\\') { esc = true; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) {
      const cand = t.slice(start, i + 1);
      try { return JSON.parse(cand); } catch { try { return JSON.parse(cand.replace(/'/g, '"')); } catch { return null; } }
    }}
  }
  return null;
}

// ---- 默认 Prompt ----
const DEFAULT_PROMPT = `你是一名中国大学期末复习助手。根据下面的课程材料，整理知识卡片并出题。

## 严格规则（违反即失败）
1. 章节数量：必须是 3~6 个章节，不能多也不能少
2. 每章卡片：必须是 3~8 张
3. 内容来源：只使用材料中出现的内容，不要编造
4. 章节命名：用材料中的原始标题（如"第一章 xxx"、"第N节 xxx"），不要自己发明
5. 卡片标题：简洁概括该知识点，≤20字
6. 要点 bullets：3~5 条，每条 10~30 字，来自原文

## 输出格式（纯 JSON，不要 markdown 围栏）
{
  "sections": [
    { "title": "章节标题", "summary": "一句话概述", "cards": [
      { "title": "卡片标题", "tag": "定义|原理|案例|辨析|制度|技术|特点", "bullets": ["要点1", "要点2", "要点3"], "detail": "完整说明" }
    ]}
  ],
  "questions": [
    { "sectionIndex": 0, "cardIndex": 0, "type": "single", "stem": "题干", "options": ["A.xx","B.xx","C.xx","D.xx"], "answer": "B", "explanation": "解析", "difficulty": "medium" },
    { "sectionIndex": 0, "cardIndex": 0, "type": "judge", "stem": "题干", "answer": true, "explanation": "解析", "difficulty": "easy" },
    { "sectionIndex": 0, "cardIndex": 0, "type": "essay", "stem": "题干", "answer": "参考答案", "explanation": "解析", "difficulty": "hard" }
  ]
}

每张卡片出 2 题（1道选择或判断 + 1道简答）。answer 判断题必须是 true/false 布尔值。

## 课程材料`;

// ---- 主流程 ----
async function main() {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) { console.error('文件不存在：' + absPath); process.exit(1); }

  // 1. 解析文件
  console.log('📄 解析文件：' + path.basename(absPath));
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).slice(1).toLowerCase();
  const fileType = { pdf: 'pdf', pptx: 'pptx', ppt: 'pptx', docx: 'docx', doc: 'docx', xlsx: 'xlsx', xls: 'xlsx', txt: 'txt', md: 'md' }[ext] || ext;
  const parsed = await parseMaterial(buf, fileType, path.basename(absPath));
  console.log('   字符数：' + parsed.text.length + '，引擎：' + parsed.engine);
  console.log('   前200字预览：' + parsed.text.slice(0, 200).replace(/\n/g, ' ') + '…');

  // 2. 构造 prompt
  let prompt = DEFAULT_PROMPT;
  if (promptFile) {
    const pPath = path.resolve(promptFile);
    if (fs.existsSync(pPath)) {
      prompt = fs.readFileSync(pPath, 'utf8');
      console.log('📝 使用自定义 prompt：' + pPath);
    } else {
      console.warn('⚠️ prompt 文件不存在：' + pPath + '，使用默认 prompt');
    }
  }

  const truncatedText = parsed.text.slice(0, 32000);

  // 3. 调用 AI
  console.log('\n🤖 调用 AI（' + MODEL + '）…');
  console.log('   参数：max_tokens=' + maxTokens + ', temperature=' + temperature);
  const t0 = Date.now();

  let content;
  try {
    content = await callAI([
      { role: 'system', content: '你是中国大学期末复习出题老师。严格按要求输出 JSON，不要任何额外文字。章节必须 3~6 个，不要超过 6 个。' },
      { role: 'user', content: prompt + '\n' + truncatedText },
    ]);
  } catch (e) {
    console.error('❌ AI 调用失败：' + e.message);
    process.exit(1);
  }

  const cost = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('✅ AI 返回，耗时 ' + cost + 's，长度 ' + content.length + ' 字');

  // 4. 解析 JSON
  const obj = extractJson(content);
  if (!obj) {
    console.error('❌ AI 返回的不是有效 JSON');
    console.log('--- 原始返回 ---');
    console.log(content.slice(0, 2000));
    // 保存原始返回
    fs.writeFileSync(outFile + '.raw.txt', content, 'utf8');
    console.log('原始返回已保存到：' + outFile + '.raw.txt');
    process.exit(1);
  }

  // 5. 统计结果
  const sections = Array.isArray(obj.sections) ? obj.sections : [];
  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  const totalCards = sections.reduce((a, s) => a + (s.cards?.length || 0), 0);

  console.log('\n📊 结果统计：');
  console.log('   章节数：' + sections.length);
  console.log('   卡片数：' + totalCards);
  console.log('   题目数：' + questions.length);
  console.log('\n📋 章节列表：');
  sections.forEach((s, i) => {
    console.log('   ' + (i + 1) + '. ' + s.title + '（' + (s.cards?.length || 0) + ' 张卡）');
  });

  // 6. 保存结果
  const result = {
    meta: {
      file: path.basename(absPath),
      fileSize: buf.length,
      textLength: parsed.text.length,
      engine: parsed.engine,
      model: MODEL,
      temperature,
      maxTokens,
      cost: cost + 's',
      timestamp: new Date().toISOString(),
    },
    sections,
    questions,
  };

  const outPath = path.resolve(outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('\n💾 结果已保存到：' + outPath);

  // 7. 质量检查
  console.log('\n🔍 质量检查：');
  const issues = [];
  if (sections.length < 3) issues.push('⚠️ 章节太少（' + sections.length + '），期望 3~6');
  if (sections.length > 8) issues.push('❌ 章节过多（' + sections.length + '），期望 3~6');
  if (totalCards < 10) issues.push('⚠️ 卡片太少（' + totalCards + '）');
  for (const s of sections) {
    if (!s.cards || s.cards.length < 2) issues.push('⚠️ 章节「' + s.title + '」卡片不足（' + (s.cards?.length || 0) + '）');
  }
  if (issues.length === 0) {
    console.log('   ✅ 全部通过');
  } else {
    issues.forEach(i => console.log('   ' + i));
  }
}

main().catch(e => { console.error('❌ 错误：' + e.message); process.exit(1); });
