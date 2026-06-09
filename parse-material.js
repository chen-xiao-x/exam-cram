// 期末速通 · 统一课件解析模块（后端）
// 支持 PDF / PPTX / DOCX / XLSX / TXT / MD / MARKDOWN
// 输入：Buffer + fileType
// 输出：{ text, stats: { rawLen, cleanLen, savedPercent }, engine, fileType, warnings }

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const xml2js = require('xml2js');

// 防 pdf-parse 自检读文件（不 import 子路径就不会触发）
let _pdfParse = null;
function getPdfParse() {
  if (_pdfParse) return _pdfParse;
  // 用绝对路径 require，绕开 pdf-parse index.js 里的 self-test
  const realPath = require.resolve('pdf-parse/lib/pdf-parse.js');
  _pdfParse = require(realPath);
  return _pdfParse;
}

let _mammoth = null;
function getMammoth() {
  if (_mammoth) return _mammoth;
  _mammoth = require('mammoth');
  return _mammoth;
}

let _xlsx = null;
function getXlsx() {
  if (_xlsx) return _xlsx;
  _xlsx = require('xlsx');
  return _xlsx;
}

// ===== 1. 解析：按文件类型分发 =====
async function parseMaterial(buf, fileType, fileName = '') {
  const type = (fileType || guessFromName(fileName)).toLowerCase();
  const rawLen = buf.length;
  let result;
  try {
    if (type === 'pdf') {
      result = await parsePdf(buf);
    } else if (type === 'pptx') {
      result = await parsePptx(buf);
    } else if (type === 'docx') {
      result = await parseDocx(buf);
    } else if (type === 'xlsx' || type === 'xls' || type === 'excel') {
      result = await parseXlsx(buf);
    } else if (type === 'txt' || type === 'md' || type === 'markdown') {
      result = { text: buf.toString('utf8'), engine: 'raw-text' };
    } else {
      throw new Error('不支持的文件类型：' + type);
    }
  } catch (e) {
    return {
      ok: false,
      text: '',
      stats: { rawLen, cleanLen: 0, savedPercent: 0 },
      engine: 'none',
      fileType: type,
      error: e.message || String(e),
    };
  }

  // ===== 2. 本地预处理（清噪音）=====
  const cleaned = cleanText(result.text);
  const cleanLen = cleaned.length;
  const savedPercent = rawLen > 0 ? Math.round((1 - cleanLen / rawLen) * 100) : 0;

  return {
    ok: true,
    text: cleaned,
    stats: {
      rawLen,
      cleanLen,
      extractedLen: result.text.length,
      savedPercent,
    },
    engine: result.engine,
    fileType: type,
    warnings: result.warnings || [],
  };
}

function guessFromName(name = '') {
  const lc = name.toLowerCase();
  if (lc.endsWith('.pdf')) return 'pdf';
  if (lc.endsWith('.pptx') || lc.endsWith('.ppt')) return 'pptx';
  if (lc.endsWith('.docx') || lc.endsWith('.doc')) return 'docx';
  if (lc.endsWith('.xlsx') || lc.endsWith('.xls')) return 'xlsx';
  if (lc.endsWith('.md') || lc.endsWith('.markdown')) return 'md';
  if (lc.endsWith('.txt')) return 'txt';
  return '';
}

// ===== PDF =====
async function parsePdf(buf) {
  const pdf = getPdfParse();
  const data = await pdf(buf);
  // pdf-parse 输出的 text 经常一页一段，用 \n\n 分隔
  return { text: data.text || '', engine: 'pdf-parse' };
}

// ===== DOCX =====
async function parseDocx(buf) {
  const mammoth = getMammoth();
  const r = await mammoth.extractRawText({ buffer: buf });
  return { text: r.value || '', engine: 'mammoth', warnings: r.messages?.map(m => m.message) || [] };
}

// ===== XLSX =====
async function parseXlsx(buf) {
  const xlsx = getXlsx();
  const wb = xlsx.read(buf, { type: 'buffer' });
  const lines = [];
  for (const sn of wb.SheetNames) {
    const sheet = wb.Sheets[sn];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    lines.push(`## Sheet: ${sn}`);
    for (const r of rows) {
      if (Array.isArray(r) && r.some(c => String(c || '').trim())) {
        lines.push(r.map(c => String(c || '').trim()).filter(Boolean).join(' | '));
      }
    }
    lines.push('');
  }
  return { text: lines.join('\n'), engine: 'xlsx' };
}

// ===== PPTX =====
// PPTX = ZIP, 内含 ppt/slides/slide{N}.xml
// 解析每张 slide 的 <a:t> 文本节点，按出现顺序串起来
async function parsePptx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/i)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)/i)[1], 10);
      return na - nb;
    });

  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false, trim: true });
  const pages = [];
  for (const fn of slideFiles) {
    const xml = await zip.files[fn].async('string');
    const parsed = await parser.parseStringPromise(xml);
    const texts = [];
    collectTextRuns(parsed, texts);
    const pageText = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (pageText) pages.push(`[Slide ${pages.length + 1}] ${pageText}`);
  }
  return { text: pages.join('\n\n'), engine: 'jszip+xml2js', warnings: [] };
}

// 抽 PPTX 内的所有 <a:t> 文本节点，跳过 attrs ($) 防止收进 namespace URL
function collectTextRuns(node, out) {
  if (!node) return;
  if (typeof node === 'string') { out.push(node); return; }
  if (Array.isArray(node)) { for (const v of node) collectTextRuns(v, out); return; }
  // 对象：递归所有 key，但跳过 '$' (xml2js 把 attrs 放在 $)
  for (const k of Object.keys(node)) {
    if (k === '$') continue;
    collectTextRuns(node[k], out);
  }
}

// ===== 本地文本预处理：清噪音（PPT 残线、页眉页脚、孤立符号、表格残线）=====
function cleanText(text) {
  if (!text) return '';
  let s = text;
  // 1. 统一换行
  s = s.replace(/\r\n?/g, '\n');
  // 2. 去掉页码：纯数字（1-3 位）独占一行
  s = s.replace(/^\s*\d{1,3}\s*$/gm, '');
  // 3. 去掉 PPT 模板常见噪音："第 X 页 共 Y 页"、"Page X of Y"
  s = s.replace(/^\s*第\s*\d+\s*页(?:\s*共\s*\d+\s*页)?\s*$/gm, '');
  s = s.replace(/^\s*Page\s*\d+\s*(?:of\s*\d+)?\s*$/gmi, '');
  // 4. 去掉首尾空白 + 连续空行
  s = s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  // 5. 去掉孤立符号行（只有标点/特殊字符）
  s = s.split('\n').filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (/^[\W_]+$/.test(t)) return false;
    return true;
  }).join('\n');
  // 6. 去掉表格残线（│ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ─ │）
  s = s.split('\n').filter(l => !/^[─│┌┐└┘├┤┬┴┼|+\-=\s]+$/.test(l.trim())).join('\n');
  // 7. 去掉 Word 软连字符 / 不可见字符
  s = s.replace(/[\u00AD\u200B-\u200F\uFEFF]/g, '');
  // 8. 标点周围多余空白
  s = s.replace(/\s+([,。;:；：、！？\?\!])/g, '$1');
  return s.trim();
}

module.exports = { parseMaterial, cleanText, guessFromName };
