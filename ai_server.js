// 期末速通 AI 后端（简化版）
// POST /api/parse-material { fileBase64, fileType, fileName } → { ok, text, stats, engine, fileType }
// POST /api/generate      { text, courseName } → { ok, ai, sections, questions }
// GET  /health
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { parseMaterial } = require('./parse-material');

// region env - 启动时从 .env 自动读 env
(function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      v = v.replace(/^['"]|['"]$/g, '').trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch (e) { console.warn('[env] load .env failed:', e.message); }
})();

const BASE_URL = (process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1').replace(/\/+$/, '');
const API_KEY = (process.env.MIMO_API_KEY || '').trim();
const MODEL = (process.env.MIMO_MODEL || 'mimo-v2.5-pro').trim();
const PORT = parseInt(process.env.PORT || '8766', 10);

// -------- utils --------
const log = (...a) => console.log('[' + new Date().toISOString().slice(11, 19) + ']', ...a);

function readBody(req, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.setEncoding('utf8');
    req.on('data', c => { buf += c; if (buf.length > 50 * 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); } });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
    setTimeout(() => reject(new Error('request timeout')), timeoutMs);
  });
}

function json(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

async function callMimo(messages, { max_tokens = 6000, temperature = 0.3, timeoutMs = 60000 } = {}) {
  if (!API_KEY) throw new Error('MIMO_API_KEY not configured');
  const url = BASE_URL + '/chat/completions';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens,
      temperature,
      top_p: 0.95,
      stream: false,
    }),
    signal: ctrl.signal,
  });
  clearTimeout(t);
  const text = await r.text();
  if (r.status !== 200) {
    throw new Error('mimo HTTP ' + r.status + ': ' + text.slice(0, 300));
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('mimo returned non-JSON: ' + text.slice(0, 200)); }
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('mimo returned empty content: ' + text.slice(0, 200));
  return String(content);
}

// Extract outermost JSON array from model reply (tolerates ```json fences, single quotes)
function extractJsonArray(text) {
  if (!text) return null;
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = t.indexOf('[');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, q = null;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') { esc = true; continue; }
      if (c === q) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) {
      const cand = t.slice(start, i + 1);
      try { return JSON.parse(cand); } catch { try { return JSON.parse(cand.replace(/'/g, '"')); } catch { return null; } }
    } }
  }
  return null;
}

function extractJsonObject(text) {
  if (!text) return null;
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, q = null;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') { esc = true; continue; }
      if (c === q) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) {
      const cand = t.slice(start, i + 1);
      try { return JSON.parse(cand); } catch { try { return JSON.parse(cand.replace(/'/g, '"')); } catch { return null; } }
    } }
  }
  return null;
}

function truncate(s, n) { s = (s == null ? '' : String(s)).trim(); return s.length <= n ? s : s.slice(0, n) + '\n...(truncated)'; }

// Fallback: generate minimal sections/questions when AI fails
function fallbackGenerate(text, courseName) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const titleRe = /^(第\s*[0-9一二三四五六七八九十]+\s*章|[0-9]+(\.[0-9]+){0,2}\s|\d+[\.、])/;
  const sections = [];
  let cur = { title: courseName + ' - 导入', summary: 'AI 解析失败，以下为文本粗略切分', cards: [] };
  for (const ln of lines) {
    if (titleRe.test(ln) && ln.length < 50) {
      if (cur.cards.length > 0) sections.push(cur);
      cur = { title: ln.replace(/^第\s*[0-9一二三四五六七八九十]+\s*章\s*/, '').slice(0, 30), summary: '', cards: [] };
    } else if (cur.cards.length < 6 && ln.length > 10) {
      cur.cards.push({
        title: ln.slice(0, 22), subtitle: '', tag: '定义',
        bullets: [ln.slice(0, 30)], detail: ln,
      });
    }
  }
  if (cur.cards.length > 0) sections.push(cur);
  if (sections.length === 0) {
    sections.push({
      title: courseName + ' - 全部内容',
      summary: '未能自动识别章节',
      cards: [{ title: '文本片段', subtitle: '', tag: '定义', bullets: [text.slice(0, 30)], detail: text.slice(0, 500) }],
    });
  }
  // Generate simple judge + essay questions for each card
  const questions = [];
  for (let si = 0; si < sections.length; si++) {
    for (let ci = 0; ci < sections[si].cards.length; ci++) {
      const c = sections[si].cards[ci];
      const detail = c.detail || c.title;
      questions.push({
        sectionIndex: si, cardIndex: ci, type: 'judge',
        stem: detail.slice(0, 60) + (detail.length > 60 ? '...' : '') + ' 是否正确？',
        answer: true, explanation: '基于原文：' + c.title, difficulty: 'medium',
      });
      questions.push({
        sectionIndex: si, cardIndex: ci, type: 'essay',
        stem: '请简述「' + c.title + '」的核心内容',
        answer: detail.slice(0, 200), explanation: '结合要点回答即可', difficulty: 'medium',
      });
    }
  }
  return { sections, questions };
}

// -------- handler: POST /api/parse-material --------
async function handleParseMaterial(req, body) {
  try {
    const { fileBase64, fileType, fileName } = body || {};
    if (!fileBase64) return { status: 400, body: { ok: false, error: 'missing fileBase64' } };
    const cleanB64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(cleanB64, 'base64');
    if (buf.length === 0) return { status: 400, body: { ok: false, error: 'file is empty' } };
    if (buf.length > 80 * 1024 * 1024) return { status: 413, body: { ok: false, error: 'file too large (>80MB)' } };
    const r = await parseMaterial(buf, fileType, fileName);
    return { status: r.ok ? 200 : 400, body: r };
  } catch (e) {
    return { status: 500, body: { ok: false, error: e.message || String(e) } };
  }
}

// -------- handler: POST /api/generate --------
// Combined: structure material into chapters/cards AND generate quiz questions — single AI call
// Response: { ok, ai, sections: [{ title, summary, cards }], questions: [{ sectionIndex, cardIndex, type, stem, ... }] }
async function handleGenerate(req, body) {
  const text = truncate(body.text || '', 32000);
  const courseName = String(body.courseName || '').trim().slice(0, 60) || 'this course';
  if (!text || text.length < 30) return { status: 400, body: { ok: false, ai: false, sections: [], questions: [], error: 'text too short (min 30 chars)' } };
  const t0 = Date.now();
  const VALID_TAGS = ['定义', '原理', '公式', '案例', '辨析', '制度', '技术', '特点', '概念', '流程', '方法'];
  const VALID_TYPES = ['single', 'judge', 'essay'];
  const VALID_DIFF = ['easy', 'medium', 'hard'];

  try {
    const prompt =
      '你是一名中国大学期末复习助手。根据课程材料，整理知识卡片并出题。\n\n' +
      '## 工作流程\n\n' +
      '### 第1步：识别章节结构\n' +
      '- 扫描材料，识别 3~6 个主要章节\n' +
      '- 章节标题用材料中的原始名称\n' +
      '- 如果材料没有明确章节，按主题逻辑自行划分\n\n' +
      '### 第2步：提取核心知识点\n' +
      '- 每章提取 3~8 个核心知识点\n' +
      '- 每个知识点必须来自材料原文，不要编造\n\n' +
      '### 第3步：生成知识卡片\n' +
      '每个知识点生成一张卡片，包含：\n' +
      '- title：知识点名称（≤15字）\n' +
      '- tag：类型标签（定义/原理/公式/案例/辨析/制度/技术/特点/流程/方法）\n' +
      '- summary：一句话概括（20~50字）\n' +
      '- bullets：3~5 条要点（每条 10~30 字）\n' +
      '- detail：详细说明（50~200字），案例类必须写清楚来龙去脉\n' +
      '- cloze：挖空版本，格式 [?|答案]\n\n' +
      '## 不同类型卡片的写法\n\n' +
      '### 定义/概念类（重要！）\n' +
      'bullets 写 1~3 条关键限定词或要素，detail 写一句完整的定义陈述（不要把定义拆碎成碎片）\n\n' +
      '### 原理/流程/方法类\n' +
      'bullets 按步骤或要素分点，detail 写完整的原理或流程说明\n\n' +
      '### 案例类（最重要！）\n' +
      'bullets 写 3~5 个关键事实，detail 必须写清楚来龙去脉（谁、做了什么、结果如何、说明什么道理）\n\n' +
      '### 优势/特点/制度类\n' +
      'bullets 每个优势/特点单独一条，detail 写总结性说明\n\n' +
      '### 辨析类\n' +
      'bullets 列出对比维度，detail 写清楚两者的区别和联系\n\n' +
      '### 第4步：生成练习题\n' +
      '每张卡片出 2 道题：1道选择或判断 + 1道简答\n\n' +
      '## 输出格式（纯 JSON，不要 markdown 围栏）\n' +
      '{\n' +
      '  "sections": [\n' +
      '    {\n' +
      '      "title": "章节标题",\n' +
      '      "summary": "章节概述（20~60字）",\n' +
      '      "cards": [\n' +
      '        {\n' +
      '          "title": "知识点名称",\n' +
      '          "tag": "定义|原理|公式|案例|辨析|制度|技术|特点|流程|方法",\n' +
      '          "summary": "一句话概括",\n' +
      '          "bullets": ["要点1", "要点2", "要点3"],\n' +
      '          "detail": "详细说明（案例类必须写清楚来龙去脉，50~200字）",\n' +
      '          "cloze": "挖空版本，用 [?|答案] 格式，如：BPR之父是[?|迈克尔·哈默]"\n' +
      '        }\n' +
      '      ]\n' +
      '    }\n' +
      '  ],\n' +
      '  "questions": [\n' +
      '    { "sectionIndex": 0, "cardIndex": 0, "type": "single", "stem": "题干", "options": ["A.xx","B.xx","C.xx","D.xx"], "answer": "B", "explanation": "解析（20~80字）", "difficulty": "medium" },\n' +
      '    { "sectionIndex": 0, "cardIndex": 0, "type": "judge", "stem": "题干", "answer": true, "explanation": "解析", "difficulty": "easy" },\n' +
      '    { "sectionIndex": 0, "cardIndex": 0, "type": "essay", "stem": "题干", "answer": "参考答案（80~150字）", "explanation": "要点提示", "difficulty": "hard" }\n' +
      '  ]\n' +
      '}\n\n' +
      '## 质量要求\n' +
      '1. 所有内容必须来自材料，不要编造\n' +
      '2. 覆盖材料中的所有重要知识点\n' +
      '3. 选择题干扰项要有迷惑性\n' +
      '4. 挖空的必须是关键术语/数字/核心概念\n' +
      '5. 判断题 answer 必须是 true/false 布尔值\n' +
      '6. 案例卡片的 detail 必须让没读过材料的人也能理解\n' +
      '7. 定义类卡片的 detail 必须是一句完整的陈述，不要拆成碎片\n\n' +
      '## 课程材料\n' + text;

    const content = await callMimo([
      { role: 'system', content: '你是中国大学期末复习出题老师。严格按要求输出 JSON，不要任何额外文字。章节必须 3~6 个，不要超过 6 个。' },
      { role: 'user', content: prompt },
    ], { max_tokens: 16000, temperature: 0.2, timeoutMs: 300000 });

    const obj = extractJsonObject(content);
    if (!obj) throw new Error('AI did not return valid JSON');

    // Validate and sanitize sections — HARD CAP at 10
    const MAX_SECTIONS = 10;
    const MAX_CARDS_PER_SECTION = 12;
    const sections = [];
    if (Array.isArray(obj.sections)) {
      for (const sec of obj.sections.slice(0, MAX_SECTIONS)) {
        if (!sec || typeof sec !== 'object') continue;
        const secTitle = String(sec.title || '').trim().slice(0, 40);
        if (!secTitle) continue;
        const secSummary = String(sec.summary || '').trim().slice(0, 200);
        const cards = [];
        for (const c of (sec.cards || []).slice(0, MAX_CARDS_PER_SECTION)) {
          if (!c || typeof c !== 'object') continue;
          const cTitle = String(c.title || '').trim().slice(0, 30);
          if (!cTitle) continue;
          const tag = String(c.tag || '').trim();
          const finalTag = VALID_TAGS.includes(tag) ? tag : '定义';
          const bullets = Array.isArray(c.bullets) ? c.bullets.map(x => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 5) : [];
          const detail = String(c.detail || '').trim().slice(0, 800);
          const cloze = String(c.cloze || '').trim().slice(0, 300);
          const summary = String(c.summary || '').trim().slice(0, 100);
          cards.push({
            title: cTitle,
            subtitle: summary || String(c.subtitle || '').trim().slice(0, 30),
            tag: finalTag,
            bullets: bullets.length >= 2 ? bullets : [detail.slice(0, 40) || cTitle],
            detail: detail || cTitle,
            cloze: cloze || '',
          });
        }
        if (cards.length > 0) sections.push({ title: secTitle, summary: secSummary, cards });
      }
    }

    // Validate and sanitize questions
    const questions = [];
    if (Array.isArray(obj.questions)) {
      for (const q of obj.questions) {
        if (!q || typeof q !== 'object') continue;
        const si = parseInt(q.sectionIndex, 10);
        const ci = parseInt(q.cardIndex, 10);
        if (!Number.isFinite(si) || si < 0 || si >= sections.length) continue;
        if (!Number.isFinite(ci) || ci < 0 || ci >= (sections[si]?.cards?.length || 0)) continue;
        let t = String(q.type || '').toLowerCase().replace('-choice', '');
        if (!VALID_TYPES.includes(t)) t = 'judge';
        const diffRaw = String(q.difficulty || '').toLowerCase();
        const entry = {
          sectionIndex: si,
          cardIndex: ci,
          type: t,
          stem: String(q.stem || '').trim().slice(0, 200) || '(missing stem)',
          answer: q.answer !== undefined ? q.answer : (t === 'judge' ? true : ''),
          explanation: String(q.explanation || '').trim().slice(0, 400),
          difficulty: VALID_DIFF.includes(diffRaw) ? diffRaw : 'medium',
        };
        if (t === 'single' && Array.isArray(q.options) && q.options.length >= 2) {
          entry.options = q.options.map(x => String(x).slice(0, 120)).slice(0, 6);
        }
        questions.push(entry);
      }
    }

    if (sections.length === 0) throw new Error('AI returned empty sections');
    log('generate: ai=True, sections=' + sections.length + ', cards=' + sections.reduce((a, s) => a + s.cards.length, 0) + ', questions=' + questions.length + ', cost=' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    return { status: 200, body: { ok: true, ai: true, sections, questions } };
  } catch (e) {
    log('generate fallback:', e.message);
    const fallback = fallbackGenerate(text, courseName);
    return {
      status: 200,
      body: {
        ok: true,
        ai: false,
        sections: fallback.sections,
        questions: fallback.questions,
        error: String(e.message || e).slice(0, 200),
      },
    };
  }
}

// -------- server --------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && u.pathname === '/health') {
    return json(res, 200, { ok: true, base_url: BASE_URL, model: MODEL, has_key: !!API_KEY });
  }

  if (req.method === 'POST' && u.pathname === '/api/parse-material') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const r = await handleParseMaterial(req, body);
      return json(res, r.status, r.body);
    } catch (e) { return json(res, 500, { ok: false, text: '', error: e.message || String(e) }); }
  }

  if (req.method === 'POST' && u.pathname === '/api/generate') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const r = await handleGenerate(req, body);
      return json(res, r.status, r.body);
    } catch (e) { return json(res, 500, { ok: false, ai: false, sections: [], questions: [], error: e.message || String(e) }); }
  }

  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  log('AI backend started http://127.0.0.1:' + PORT);
  log('  model=' + MODEL + '  base=' + BASE_URL + '  has_key=' + !!API_KEY + ' (key_len=' + API_KEY.length + ')');
  const envFile = path.join(__dirname, '.env');
  log('  .env = ' + (fs.existsSync(envFile) ? 'loaded' : 'not found (using process env only)'));
  if (!API_KEY) log('  WARNING: MIMO_API_KEY not configured, all requests will fail');
});
