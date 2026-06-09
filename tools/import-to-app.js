#!/usr/bin/env node
// 期末速通 · 将批量处理结果导入网站
// 用法：node tools/import-to-app.js <course-data.json>
//
// 将 batch-process.js 生成的 JSON 转为网站可直接加载的格式

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const inFile = args[0] || 'tools/course-data.json';

if (!fs.existsSync(inFile)) {
  console.log('文件不存在：' + inFile);
  console.log('用法：node tools/import-to-app.js <course-data.json>');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));

// 转换为网站格式
const course = {
  name: data.meta?.courseName || '导入课程',
  teacher: '',
  school: '',
  examDate: '',
  sections: [],
  questions: [],
  srs: {},
  mastered: [],
  wrongIds: [],
  allAnswers: {},
};

// 章节
data.sections.forEach((sec, i) => {
  const sectionId = 's' + (i + 1);
  course.sections.push({
    id: sectionId,
    no: String(i + 1),
    title: sec.title,
    summary: sec.summary || '',
    cards: (sec.cards || []).map((c, j) => ({
      id: sectionId + '_c' + (j + 1),
      title: c.title,
      subtitle: c.subtitle || '',
      tag: c.tag || '知识点',
      bullets: c.bullets || [],
      detail: c.detail || '',
    })),
  });
});

// 题目
(data.questions || []).forEach((q, i) => {
  const si = q.sectionIndex || 0;
  const sectionId = 's' + (si + 1);
  let type = (q.type || 'judge').toLowerCase().replace('-choice', '');
  if (!['single', 'multi', 'judge', 'essay'].includes(type)) type = 'judge';

  course.questions.push({
    id: 'q' + (i + 1),
    sectionId,
    type,
    difficulty: q.difficulty || 'medium',
    stem: q.stem || '',
    options: q.options || [],
    answer: q.answer,
    explanation: q.explanation || '',
  });
});

// 输出
const outPath = path.resolve(inFile).replace(/\.json$/, '-ready.json');
fs.writeFileSync(outPath, JSON.stringify(course, null, 2), 'utf8');

console.log('✅ 转换完成');
console.log('   章节：' + course.sections.length);
console.log('   卡片：' + course.sections.reduce((a, s) => a + s.cards.length, 0));
console.log('   题目：' + course.questions.length);
console.log('\n💾 输出：' + outPath);
console.log('\n📋 导入方法：');
console.log('   1. 打开浏览器 http://127.0.0.1:8765');
console.log('   2. 按 F12 打开控制台');
console.log('   3. 粘贴以下代码并回车：');
console.log('\n   // 先读取 JSON 文件内容，然后：');
console.log('   localStorage.setItem("exam-cram-v1", JSON.stringify({...data, _v: 2}));');
console.log('   location.reload();');
console.log('\n   或者用下面的一键导入脚本 👇');
