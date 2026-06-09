#!/usr/bin/env node
// 期末速通 · 批量课件处理
// 用法：node tools/batch-process.js <课件目录> [--out <输出文件>]
//
// 流程：扫描目录 → 逐个解析+AI生成 → 合并为完整课程数据

const fs = require('fs');
const path = require('path');
const { parseMaterial } = require('../parse-material');

// ---- 参数 ----
const args = process.argv.slice(2);
const dirPath = args.find(a => !a.startsWith('--'));
const outFile = getArg('--out') || 'tools/course-data.json';
const maxTokens = parseInt(getArg('--max-tokens') || '16000', 10);
const temperature = parseFloat(getArg('--temperature') || '0.2');

function getArg(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

if (!dirPath) {
  console.log('用法：node tools/batch-process.js <课件目录> [--out <输出文件>]');
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
    if (m) { let v = m[2].replace(/^['"]|['"]$/g, '').trim(); if (!process.env[m[1]]) process.env[m[1]] = v; }
  }
})();

const BASE_URL = (process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1').replace(/\/+$/, '');
const API_KEY = (process.env.MIMO_API_KEY || '').trim();
const MODEL = (process.env.MIMO_MODEL || 'mimo-v2.5-pro').trim();

// ---- AI 调用 ----
async function callAI(messages) {
  if (!API_KEY) throw new Error('MIMO_API_KEY 未配置');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 300000);
  const r = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
    body: JSON.stringify({ model: MODEL, messages, stream: false, max_tokens: maxTokens, temperature, top_p: 0.95 }),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  const text = await r.text();
  if (r.status !== 200) throw new Error('HTTP ' + r.status + ': ' + text.slice(0, 200));
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || '';
}

// ---- JSON 提取 ----
function extractJson(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch {}
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

// ---- Prompt ----
const PROMPT = `你是一名中国大学期末复习助手。根据下面的课程材料，整理知识卡片并出题。

## 严格规则
1. 章节数量：3~6 个章节
2. 每章卡片：3~8 张
3. 只用材料中的内容，不要编造
4. 章节命名用材料中的原始标题
5. 卡片标题 ≤20字
6. bullets 3~5 条，每条 10~30 字

## 输出格式（纯 JSON）
{
  "sections": [
    { "title": "章节标题", "summary": "概述", "cards": [
      { "title": "卡片标题", "tag": "定义|原理|案例|辨析|制度|技术|特点", "bullets": ["要点1", "要点2"], "detail": "说明" }
    ]}
  ],
  "questions": [
    { "sectionIndex": 0, "cardIndex": 0, "type": "single", "stem": "题干", "options": ["A.xx","B.xx","C.xx","D.xx"], "answer": "B", "explanation": "解析", "difficulty": "medium" },
    { "sectionIndex": 0, "cardIndex": 0, "type": "judge", "stem": "题干", "answer": true, "explanation": "解析", "difficulty": "easy" }
  ]
}
每张卡片出 2 题。判断题 answer 必须是 true/false。

## 课程材料
`;

// ---- 处理单个文件 ----
async function processFile(filePath, index, total) {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const fileType = { pdf: 'pdf', pptx: 'pptx', docx: 'docx', txt: 'txt', md: 'md' }[ext] || ext;

  console.log(`\n[${index + 1}/${total}] 📄 ${name}`);

  // 解析
  const buf = fs.readFileSync(filePath);
  let parsed;
  try {
    parsed = await parseMaterial(buf, fileType, name);
  } catch (e) {
    console.log(`   ❌ 解析失败：${e.message}`);
    return null;
  }

  if (!parsed.text || parsed.text.length < 50) {
    console.log(`   ⚠️ 文本太短（${parsed.text.length} 字），跳过`);
    return null;
  }

  console.log(`   字符数：${parsed.text.length}，引擎：${parsed.engine}`);

  // AI 生成
  console.log(`   🤖 调用 AI…`);
  const t0 = Date.now();
  let content;
  try {
    content = await callAI([
      { role: 'system', content: '你是中国大学期末复习出题老师。严格输出 JSON，不要额外文字。' },
      { role: 'user', content: PROMPT + parsed.text.slice(0, 32000) },
    ]);
  } catch (e) {
    console.log(`   ❌ AI 失败：${e.message}`);
    return null;
  }

  const cost = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`   ✅ 完成，${cost}s`);

  const obj = extractJson(content);
  if (!obj || !Array.isArray(obj.sections)) {
    console.log(`   ❌ JSON 解析失败`);
    return null;
  }

  const cards = obj.sections.reduce((a, s) => a + (s.cards?.length || 0), 0);
  console.log(`   📊 ${obj.sections.length} 章节，${cards} 卡片，${obj.questions?.length || 0} 题目`);

  return {
    fileName: name,
    sections: obj.sections || [],
    questions: obj.questions || [],
  };
}

// ---- 合并结果 ----
function mergeResults(results) {
  let sectionOffset = 0;
  const allSections = [];
  const allQuestions = [];

  for (const r of results) {
    if (!r) continue;
    // 章节：加文件来源标记
    for (const sec of r.sections) {
      allSections.push({
        ...sec,
        _source: r.fileName,
        cards: (sec.cards || []).map(c => ({ ...c, _source: r.fileName })),
      });
    }
    // 题目：修正 sectionIndex
    for (const q of r.questions) {
      allQuestions.push({
        ...q,
        sectionIndex: (q.sectionIndex || 0) + sectionOffset,
        _source: r.fileName,
      });
    }
    sectionOffset += r.sections.length;
  }

  return { sections: allSections, questions: allQuestions };
}

// ---- 主流程 ----
async function main() {
  const absDir = path.resolve(dirPath);
  if (!fs.existsSync(absDir)) { console.error('目录不存在：' + absDir); process.exit(1); }

  // 扫描支持的文件
  const SUPPORTED = ['.pdf', '.pptx', '.docx', '.txt', '.md'];
  const files = fs.readdirSync(absDir)
    .filter(f => SUPPORTED.includes(path.extname(f).toLowerCase()))
    .sort()
    .map(f => path.join(absDir, f));

  if (files.length === 0) {
    console.log('目录中没有支持的文件（支持：' + SUPPORTED.join(', ') + '）');
    // 列出所有文件供参考
    const all = fs.readdirSync(absDir);
    console.log('目录中的文件：');
    all.forEach(f => console.log('  ' + f));
    process.exit(0);
  }

  console.log('📁 课件目录：' + absDir);
  console.log('📋 找到 ' + files.length + ' 个文件：');
  files.forEach(f => console.log('  · ' + path.basename(f)));

  // 逐个处理
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const r = await processFile(files[i], i, files.length);
    results.push(r);
  }

  // 合并
  const merged = mergeResults(results);
  const totalCards = merged.sections.reduce((a, s) => a + (s.cards?.length || 0), 0);

  console.log('\n' + '='.repeat(50));
  console.log('📊 合并结果：');
  console.log('   文件数：' + results.filter(Boolean).length + '/' + files.length);
  console.log('   章节数：' + merged.sections.length);
  console.log('   卡片数：' + totalCards);
  console.log('   题目数：' + merged.questions.length);
  console.log('\n📋 章节列表：');
  merged.sections.forEach((s, i) => {
    console.log('   ' + (i + 1) + '. ' + s.title + '（' + (s.cards?.length || 0) + ' 张卡）[' + s._source + ']');
  });

  // 保存
  const outPath = path.resolve(outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const output = {
    meta: {
      courseName: path.basename(absDir),
      processedAt: new Date().toISOString(),
      model: MODEL,
      temperature,
      fileCount: results.filter(Boolean).length,
      totalSections: merged.sections.length,
      totalCards,
      totalQuestions: merged.questions.length,
    },
    sections: merged.sections,
    questions: merged.questions,
  };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log('\n💾 已保存到：' + outPath);
}

main().catch(e => { console.error('❌ 错误：' + e.message); process.exit(1); });
