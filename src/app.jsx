/* 期末速通 v1 · App Root */

/* ===== Error Boundary ===== */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return <div style={{ padding: 24, color: '#b00020', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        {'渲染错误：\n' + (this.state.err?.stack || String(this.state.err))}
      </div>;
    }
    return this.props.children;
  }
}

/* ===== JSON 导入按钮 ===== */
const JsonImportButton = ({ saveData }) => {
  const ref = useRef(null);
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.sections || !Array.isArray(data.sections)) { alert('JSON 格式错误：缺少 sections'); return; }
        const imported = {
          name: data.name || data.meta?.courseName || file.name.replace(/\.json$/, ''),
          teacher: data.teacher || '', school: data.school || '', examDate: data.examDate || '',
          sections: [], questions: data.questions || [], srs: data.srs || {},
          mastered: data.mastered || [], wrongIds: data.wrongIds || [], allAnswers: data.allAnswers || {},
        };
        data.sections.forEach((sec, i) => {
          const sid = sec.id || ('s' + (i + 1));
          imported.sections.push({
            id: sid, no: sec.no || String(i + 1), title: sec.title, summary: sec.summary || '',
            cards: (sec.cards || []).map((c, j) => ({ id: c.id || (sid + '_c' + (j + 1)), title: c.title, subtitle: c.subtitle || '', tag: c.tag || '知识点', bullets: c.bullets || [], detail: c.detail || '', cloze: c.cloze || '' })),
          });
        });
        imported.questions = imported.questions.map((q, i) => ({ ...q, id: q.id || ('q' + (i + 1)), sectionId: q.sectionId || ('s' + ((q.sectionIndex || 0) + 1)) }));
        const cards = imported.sections.reduce((a, s) => a + s.cards.length, 0);
        if (!confirm('导入「' + imported.name + '」？\n' + imported.sections.length + ' 章节 · ' + cards + ' 卡片 · ' + imported.questions.length + ' 题目\n\n已有数据将被覆盖。')) return;
        saveData(imported);
        location.reload();
      } catch (err) { alert('JSON 解析失败：' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  return (
    <button className="nav-item" onClick={() => ref.current.click()}>
      <I.cards className="ico" /> 导入 JSON
      <input ref={ref} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
    </button>
  );
};

/* ===== Sidebar（独立组件，不会随 view 变化重建） ===== */
const Sidebar = React.memo(({ view, go, course, stats, theme, setTheme, saveData, sections }) => {
  const navRef = useRef(null);
  const scrollRef = useRef(0);

  React.useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = scrollRef.current;
  });

  const handleNavScroll = useCallback(() => {
    if (navRef.current) scrollRef.current = navRef.current.scrollTop;
  }, []);

  return (
    <aside className="sidebar">
      <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{course.name || '未命名课程'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
          {course.teacher && course.teacher + ' · '}{course.school}
          {course.examDate && ' · 距考试 ' + daysUntil(course.examDate) + ' 天'}
        </div>
      </div>
      <nav ref={navRef} onScroll={handleNavScroll} style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px' }}>学习</div>
        <button className={`nav-item ${view.id === 'home' ? 'active' : ''}`} onClick={() => go('home')}><I.home className="ico" /> 首页</button>
        <button className={`nav-item ${view.id === 'upload' ? 'active' : ''}`} onClick={() => go('upload')}><I.upload className="ico" /> 上传课件</button>
        <JsonImportButton saveData={saveData} />

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '16px 12px 8px' }}>章节</div>
        {sections.map((s, i) => (
          <button key={s.id} className={`nav-item ${view.id === 'section' && view.sectionId === s.id ? 'active' : ''}`} onClick={() => go('section', { sectionId: s.id })}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-3)', width: 16 }}>{s.no || i + 1}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
          </button>
        ))}

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '16px 12px 8px' }}>复习</div>
        <button className={`nav-item ${view.id === 'review' ? 'active' : ''}`} onClick={() => go('review')}>
          <I.refresh className="ico" /> 间隔复习
          {stats.dueCount > 0 && <span className="nav-badge accent">{stats.dueCount}</span>}
        </button>
        <button className={`nav-item ${view.id === 'quiz' || view.id === 'session' ? 'active' : ''}`} onClick={() => go('quiz')}>
          <I.target className="ico" /> 全部题目 <span className="nav-badge">{stats.totalQ}</span>
        </button>
        <button className={`nav-item ${view.id === 'wrong' ? 'active' : ''}`} onClick={() => go('wrong')}>
          <I.error className="ico" /> 错题本 {stats.wrongCount > 0 && <span className="nav-badge danger">{stats.wrongCount}</span>}
        </button>
        <button className={`nav-item ${view.id === 'progress' ? 'active' : ''}`} onClick={() => go('progress')}>
          <I.cards className="ico" /> 进度
        </button>
      </nav>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>掌握 {stats.masteredCount}/{stats.totalCards}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="theme-toggle" onClick={() => {
            if (confirm('清除所有学习数据？此操作不可撤销。')) {
              localStorage.removeItem('exam-cram-v1');
              localStorage.removeItem('final-cram-v0');
              localStorage.removeItem('final-cram-v0-courses');
              location.reload();
            }
          }} title="清除数据">🗑</button>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <I.sun width={14} height={14} /> : <I.moon width={14} height={14} />}
          </button>
        </div>
      </div>
    </aside>
  );
});

/* ===== App ===== */
const App = () => {
  const [course, setCourse] = useState(() => initData());
  const [view, setView] = useState({ id: 'home' });
  const [openedCard, setOpenedCard] = useState(null);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('exam-cram-theme') || 'light'; } catch { return 'light'; } });
  const [result, setResult] = useState(null);

  // 保存到 localStorage
  useEffect(() => { saveData(course); }, [course]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('exam-cram-theme', theme); } catch {}
  }, [theme]);

  const mastered = useMemo(() => new Set(course.mastered || []), [course]);

  const setMastered = (cardId, val) => {
    const newMastered = new Set(course.mastered || []);
    if (val) { newMastered.add(cardId); } else { newMastered.delete(cardId); }
    const newSrs = val ? srsRate({ ...course.srs }, cardId, true) : course.srs;
    setCourse({ ...course, mastered: [...newMastered], srs: newSrs });
  };

  const handleImport = (sections, questions) => {
    // 给 sections 和 questions 生成 ID
    const newSections = sections.map((s, i) => ({
      id: 's' + (i + 1),
      no: String(i + 1),
      title: s.title,
      summary: s.summary || '',
      cards: (s.cards || []).map((c, j) => ({
        id: 's' + (i + 1) + '_c' + (j + 1),
        title: c.title,
        subtitle: c.subtitle || '',
        tag: c.tag || '知识点',
        bullets: c.bullets || [],
        detail: c.detail || '',
        cloze: c.cloze || '',
      })),
    }));

    const newQuestions = (questions || []).map((q, i) => ({
      id: 'q' + (i + 1),
      sectionId: 's' + (q.sectionIndex != null ? q.sectionIndex + 1 : 1),
      type: q.type || 'single',
      difficulty: q.difficulty || 'medium',
      stem: q.stem,
      options: q.options || [],
      answer: q.answer,
      explanation: q.explanation || '',
    }));

    // 合并到现有数据
    const baseLen = course.sections.length;
    const mergedSections = [...course.sections, ...newSections.map((s, i) => ({ ...s, id: 's' + (baseLen + i + 1), no: String(baseLen + i + 1) }))];
    const mergedQuestions = [...course.questions, ...newQuestions.map(q => {
      const secIdx = parseInt(q.sectionId.replace('s', '')) - 1;
      return { ...q, sectionId: 's' + (baseLen + secIdx + 1) };
    })];

    setCourse({ ...course, sections: mergedSections, questions: mergedQuestions });
  };

  const onSessionComplete = (list, answers) => {
    const newWrong = new Set(course.wrongIds || []);
    const updatedAnswers = { ...(course.allAnswers || {}) };
    list.forEach(q => {
      updatedAnswers[q.id] = answers[q.id];
      const ok = isCorrect(q, answers[q.id]);
      if (!ok) newWrong.add(q.id); else newWrong.delete(q.id);
    });
    setCourse({ ...course, wrongIds: [...newWrong], allAnswers: updatedAnswers });

    const stats = {
      correct: list.filter(q => isCorrect(q, answers[q.id])).length,
      wrong: list.filter(q => q.type !== 'essay' && !isCorrect(q, answers[q.id])).length,
      essay: list.filter(q => q.type === 'essay').length,
    };
    setResult({ list, answers, stats });
    setView({ id: 'result' });
  };

  const go = useCallback((id, params = {}) => setView({ id, ...params }), []);

  /* ===== 统计 ===== */
  const stats = useMemo(() => {
    const totalCards = course.sections.reduce((s, sec) => s + (sec.cards?.length || 0), 0);
    const dueCards = srsDueCards(course);
    return {
      totalCards,
      totalQ: course.questions.length,
      wrongCount: (course.wrongIds || []).length,
      dueCount: dueCards.length,
      masteredCount: (course.mastered || []).length,
    };
  }, [course]);

  /* ===== 首页 ===== */
  const HomeView = () => {
    const days = daysUntil(course.examDate);
    return (
      <>
        {/* 渐变 Hero */}
        <div className="hero-gradient" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 32, marginBottom: 8 }}>📚 {course.name}</h1>
              <p className="lede" style={{ marginTop: 0 }}>
                {course.teacher && course.teacher + ' · '}{course.school}
              </p>
            </div>
            {days !== null && (
              <div className={`countdown-badge ${days <= 7 ? 'urgent' : ''}`}>
                <div className="countdown-num">{days}</div>
                <div className="countdown-label">天</div>
              </div>
            )}
          </div>

          {/* 统计概览 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
            <div className="stat-mini">
              <div className="stat-mini-v">{stats.totalCards}</div>
              <div className="stat-mini-l">知识点</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-v">{stats.totalQ}</div>
              <div className="stat-mini-l">练习题</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-v">{stats.masteredCount}</div>
              <div className="stat-mini-l">已掌握</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-v">{stats.dueCount}</div>
              <div className="stat-mini-l">待复习</div>
            </div>
          </div>
        </div>

        {/* 快捷入口 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          <div className="action-card" onClick={() => go('upload')}>
            <div className="action-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <I.upload width={24} height={24} />
            </div>
            <div className="action-content">
              <div style={{ fontWeight: 600, fontSize: 15 }}>上传课件</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>AI 自动拆分知识点</div>
            </div>
            <I.arrow width={16} height={16} style={{ color: 'var(--text-3)' }} />
          </div>
          <div className="action-card" onClick={() => go('review')}>
            <div className="action-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <I.refresh width={24} height={24} />
            </div>
            <div className="action-content">
              <div style={{ fontWeight: 600, fontSize: 15 }}>间隔复习</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{stats.dueCount} 张卡片待复习</div>
            </div>
            <I.arrow width={16} height={16} style={{ color: 'var(--text-3)' }} />
          </div>
          <div className="action-card" onClick={() => go('quiz')}>
            <div className="action-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
              <I.target width={24} height={24} />
            </div>
            <div className="action-content">
              <div style={{ fontWeight: 600, fontSize: 15 }}>刷题</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>共 {stats.totalQ} 道题</div>
            </div>
            <I.arrow width={16} height={16} style={{ color: 'var(--text-3)' }} />
          </div>
        </div>

        {/* 章节列表 */}
        {course.sections.length > 0 && (
          <>
            <h2 style={{ marginBottom: 12 }}>章节</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {course.sections.map((s, i) => {
                const secMastered = (s.cards || []).filter(c => mastered.has(c.id)).length;
                const secTotal = (s.cards || []).length;
                const pct = secTotal > 0 ? Math.round((secMastered / secTotal) * 100) : 0;
                return (
                  <div key={s.id} className="card hover" style={{ cursor: 'pointer' }} onClick={() => go('section', { sectionId: s.id })}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>第 {s.no || i + 1} 章</div>
                    <h3 style={{ fontSize: 16, marginBottom: 8 }}>{s.title}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{secTotal} 张卡片 · {course.questions.filter(q => q.sectionId === s.id).length} 道题</div>
                    <div style={{ marginTop: 10, height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--accent)', width: `${pct}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {course.sections.length === 0 && (
          <div className="empty">
            <I.upload style={{ width: 36, height: 36, opacity: 0.4 }} />
            <h3>还没有学习内容</h3>
            <p>上传课件文件，AI 自动帮你拆分知识点和生成题目</p>
            <Button variant="primary" icon={I.upload} onClick={() => go('upload')}>上传课件</Button>
          </div>
        )}
      </>
    );
  };

  /* ===== 路由渲染 ===== */
  let body;
  if (view.id === 'home') body = <HomeView />;
  else if (view.id === 'upload') body = <UploadView onImport={handleImport} go={go} />;
  else if (view.id === 'section') body = <SectionView sectionId={view.sectionId} course={course} go={go} mastered={mastered} setMastered={setMastered} setOpenedCard={setOpenedCard} />;
  else if (view.id === 'cards') body = <SpeedRun sectionId={view.sectionId} course={course} mastered={mastered} setMastered={setMastered} />;
  else if (view.id === 'quiz') body = <QuizList sectionId={view.sectionId} course={course} go={go} />;
  else if (view.id === 'session') {
    if (view.wrongOnly) {
      const wrongQs = course.questions.filter(q => (course.wrongIds || []).includes(q.id));
      body = <QuizSession list={wrongQs} mode="sequential" course={course} go={go} onComplete={onSessionComplete} />;
    } else {
      body = <QuizSession sectionId={view.sectionId} mode={view.mode} startIndex={view.startIndex || 0} course={course} go={go} onComplete={onSessionComplete} />;
    }
  }
  else if (view.id === 'result') body = <QuizResult result={result} go={go} onRetry={() => setView({ id: 'session', mode: 'sequential' })} />;
  else if (view.id === 'wrong') body = <WrongBook course={course} go={go} />;
  else if (view.id === 'review') body = <ReviewView course={course} setCourse={setCourse} go={go} setOpenedCard={setOpenedCard} />;
  else if (view.id === 'progress') body = <ProgressView course={course} />;

  return (
    <div className="app">
      <Sidebar view={view} go={go} course={course} stats={stats} theme={theme} setTheme={setTheme} saveData={saveData} sections={course.sections} />
      <div className="main">
        <div className="content"><div className="container">{body}</div></div>
      </div>
      {openedCard && <CardModal card={openedCard} onClose={() => setOpenedCard(null)} onMaster={(id) => setMastered(id, true)} />}
      <ToastContainer />
    </div>
  );
};

/* ===== Mount ===== */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><App /></ErrorBoundary>);
