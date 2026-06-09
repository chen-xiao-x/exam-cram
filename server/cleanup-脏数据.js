// 清理脚本：在浏览器 F12 Console 粘贴运行
// 功能：清掉脏数据（重复章节、无效章节、杜撰卡片），保留真实课程结构

(function() {
  const KEY = 'final-cram-v0-courses';
  const raw = localStorage.getItem(KEY);
  if (!raw) { console.log('❌ 没找到课程数据'); return; }
  const data = JSON.parse(raw);
  if (!data.courses) { console.log('❌ 数据结构异常'); return; }

  let totalSections = 0, dupSections = 0, badCards = 0, emptySections = 0;
  const report = [];

  for (const cid in data.courses) {
    const c = data.courses[cid];
    if (!Array.isArray(c.sections)) continue;
    const before = c.sections.length;
    totalSections += before;

    // 1. 去重：相同 title 重复的，只保留 cards 最多的那个
    const byTitle = new Map();
    const cleaned = [];
    for (const s of c.sections) {
      const t = (s.title || '').trim();
      if (!t) continue;
      const key = t.replace(/^🆕\s*/, '').replace(/^导入章节\s*/, '').trim();
      if (!key) continue;
      if (byTitle.has(key)) {
        const prev = byTitle.get(key);
        if ((s.cards || []).length > (prev.cards || []).length) byTitle.set(key, s);
        dupSections++;
      } else {
        byTitle.set(key, s);
      }
    }
    let newSections = Array.from(byTitle.values());

    // 2. 删掉"杜撰"标题的章节（时间线、年份、明显的非教学标题）
    const fakePattern = /^(导入章节|未识别章节|1906|1949|1979|1995|2006|19\d{2}|20\d{2})/;
    newSections = newSections.filter(s => {
      const t = (s.title || '').replace(/^🆕\s*/, '');
      if (fakePattern.test(t)) { emptySections++; return false; }
      return true;
    });

    // 3. 删掉"奶茶/App下单/支付"等明显杜撰的卡（用关键词白名单筛）
    const banned = [/奶茶/, /App.*下单/, /阶段\s*\d+/, /邮购/, /亚马逊.*贝佐斯/];
    for (const s of newSections) {
      const good = [];
      for (const card of (s.cards || [])) {
        const t = (card.title || '') + ' ' + (card.detail || '');
        if (banned.some(re => re.test(t))) { badCards++; continue; }
        good.push(card);
      }
      s.cards = good;
    }
    // 4. 删空章节
    newSections = newSections.filter(s => (s.cards || []).length > 0);

    c.sections = newSections;
    report.push({ course: c.name || cid, before, after: newSections.length, removed: before - newSections.length });
  }

  localStorage.setItem(KEY, JSON.stringify(data));
  console.log('=== 清理报告 ===');
  console.log('总章节（清理前）:', totalSections);
  console.log('去重章节:', dupSections);
  console.log('删掉假章节:', emptySections);
  console.log('删掉杜撰卡片:', badCards);
  console.log('--- 各课程 ---');
  report.forEach(r => console.log('  ' + r.course + ': ' + r.before + ' → ' + r.after + ' (-' + r.removed + ')'));
  console.log('✅ 已保存。刷新页面看效果。');
})();
