/* 期末速通 v1 · 数据层 */

const STORAGE_KEY = 'exam-cram-v1';
const VERSION = 2; // 每次数据结构变更时递增

/* ===== 清除旧版本数据 ===== */
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const d = JSON.parse(raw);
    if (d._v !== VERSION) { localStorage.removeItem(STORAGE_KEY); }
  }
} catch {}

/* ===== 读写 ===== */
const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    delete d._v;
    return d;
  } catch { return null; }
};

const saveData = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, _v: VERSION })); } catch {}
};

/* ===== 默认数据（空课程） ===== */
const emptyCourse = () => ({
  name: '',
  teacher: '',
  school: '',
  examDate: '',
  sections: [],
  questions: [],
  srs: {},
  mastered: [],
  wrongIds: [],
  allAnswers: {},
});

const initData = () => {
  const existing = loadData();
  if (existing) return existing;
  const course = emptyCourse();
  saveData(course);
  return course;
};

/* ===== SRS（简化 SM-2） ===== */
const srsRate = (srs, cardId, correct) => {
  const now = Date.now();
  const day = 86400000;
  const cur = srs[cardId] || { state: 'new', interval: 0, ease: 2.5, reviews: 0, lapses: 0, streak: 0, nextDue: now };
  cur.reviews += 1;
  if (!correct) {
    cur.lapses += 1;
    cur.streak = 0;
    cur.state = 'learning';
    cur.interval = 1;
    cur.ease = Math.max(1.3, cur.ease - 0.2);
  } else {
    cur.streak += 1;
    if (cur.state === 'new' || cur.state === 'learning') {
      cur.state = 'review';
      cur.interval = cur.interval >= 1 ? Math.round(cur.interval * cur.ease) : 1;
    } else {
      cur.interval = Math.max(1, Math.round(cur.interval * cur.ease));
      cur.ease = Math.min(3.0, cur.ease + 0.05);
    }
    if (cur.streak >= 4 && cur.interval >= 30 && cur.lapses === 0) cur.state = 'mastered';
  }
  cur.nextDue = now + cur.interval * day;
  srs[cardId] = cur;
  return srs;
};

const srsDueCards = (course) => {
  const now = Date.now();
  const allCards = (course.sections || []).flatMap(s => (s.cards || []).map(c => ({ ...c, sectionTitle: s.title })));
  return allCards.filter(c => {
    const st = course.srs[c.id];
    return !st || st.nextDue <= now || st.state === 'new' || st.state === 'learning';
  });
};

/* ===== 工具函数 ===== */
const daysUntil = (d) => {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
};

const isCorrect = (q, ua) => {
  if (q.type === 'multi') {
    if (!Array.isArray(ua)) return false;
    const a = [...q.answer].sort(), b = [...ua].sort();
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  if (q.type === 'judge') return ua === q.answer;
  if (q.type === 'essay') return ua && ua.trim().length > 0;
  return ua === q.answer;
};
