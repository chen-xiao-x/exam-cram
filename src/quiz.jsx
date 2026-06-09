/* 期末速通 v1 · 刷题 */

/* ===== 题目列表 ===== */
const QuizList = ({ sectionId, course, go }) => {
  const list = sectionId ? course.questions.filter(q => q.sectionId === sectionId) : course.questions;
  const typeMap = { single: '单选', multi: '多选', judge: '判断', essay: '简答' };

  return (
    <>
      <div className="hero">
        <h1>{sectionId ? '本节题库' : '全部题目'}</h1>
        <p className="lede" style={{ marginTop: 8 }}>共 {list.length} 道题</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <Button variant="primary" icon={I.target} onClick={() => go('session', { sectionId, mode: 'sequential' })}>顺序刷题</Button>
          <Button variant="outline" icon={I.refresh} onClick={() => go('session', { sectionId, mode: 'shuffle' })}>乱序刷题</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((q, i) => (
          <div key={q.id} className="quiz-list-row" onClick={() => go('session', { sectionId, mode: 'sequential', startIndex: i })}>
            <div className="num">{i + 1}</div>
            <div className="info">
              <div className="t">{q.stem.length > 60 ? q.stem.slice(0, 60) + '…' : q.stem}</div>
              <div className="meta">
                <span className={`qtype-pill ${q.type}`}>{typeMap[q.type]}</span>
              </div>
            </div>
            <I.arrow width={14} height={14} style={{ color: 'var(--text-3)' }} />
          </div>
        ))}
      </div>
    </>
  );
};

/* ===== 答题会话 ===== */
const QuizSession = ({ sectionId, mode, startIndex = 0, course, go, onComplete }) => {
  const list = useMemo(() => {
    const all = sectionId ? course.questions.filter(q => q.sectionId === sectionId) : [...course.questions];
    return mode === 'shuffle' ? [...all].sort(() => Math.random() - 0.5) : all;
  }, [sectionId, mode, course]);

  const [idx, setIdx] = useState(startIndex);
  const [answers, setAnswers] = useState({});
  const [showExplain, setShowExplain] = useState(false);
  const q = list[idx];
  if (!q) return <div className="empty"><h3>暂无题目</h3></div>;

  const userAnswer = answers[q.id];
  const submitted = showExplain && (q.type === 'essay' ? (userAnswer?.trim().length > 0) : userAnswer !== undefined);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];

  const toggleMulti = (i) => {
    if (submitted) return;
    const cur = Array.isArray(userAnswer) ? [...userAnswer] : [];
    const at = cur.indexOf(i);
    if (at === -1) cur.push(i); else cur.splice(at, 1);
    setAnswers({ ...answers, [q.id]: cur });
  };

  const handleSubmit = () => {
    if (q.type === 'essay' ? !userAnswer?.trim() : userAnswer === undefined) return;
    setShowExplain(true);
  };

  const handleNext = () => {
    if (idx < list.length - 1) {
      setIdx(idx + 1); setShowExplain(false);
    } else {
      onComplete(list, answers);
    }
  };

  const canSubmit = q.type === 'essay' ? (userAnswer?.trim().length > 0) : userAnswer !== undefined;
  const progress = ((idx + 1) / list.length) * 100;

  return (
    <>
      <div className="quiz-progress">
        <div className="pg-bar"><div className="pg-fill" style={{ width: `${progress}%` }} /></div>
        <div className="pg-text">{idx + 1} / {list.length}</div>
      </div>
      <div className="quiz-card">
        <span className={`qtype-pill ${q.type}`}>{q.type === 'single' ? '单选' : q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '简答'}</span>
        <div className="q-stem">{q.stem}</div>

        {/* 单选/多选 */}
        {(q.type === 'single' || q.type === 'multi') && (
          <div className="q-options">
            {q.options.map((opt, i) => {
              const isSel = q.type === 'multi' ? (Array.isArray(userAnswer) && userAnswer.includes(i)) : userAnswer === i;
              const isAns = q.type === 'multi' ? q.answer.includes(i) : q.answer === i;
              let cls = 'q-option';
              if (submitted) cls += ' disabled';
              if (isSel && !submitted) cls += ' selected';
              if (submitted && isAns) cls += ' correct';
              if (submitted && isSel && !isAns) cls += ' wrong';
              return (
                <div key={i} className={cls} onClick={() => {
                  if (submitted) return;
                  if (q.type === 'multi') toggleMulti(i);
                  else setAnswers({ ...answers, [q.id]: i });
                }}>
                  <div className="marker">{labels[i]}</div>
                  <div className="label">{opt}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 判断 */}
        {q.type === 'judge' && (
          <div className="q-options">
            {[true, false].map((v, i) => {
              const isSel = userAnswer === v;
              const isAns = q.answer === v;
              let cls = 'q-option';
              if (submitted) cls += ' disabled';
              if (isSel && !submitted) cls += ' selected';
              if (submitted && isAns) cls += ' correct';
              if (submitted && isSel && !isAns) cls += ' wrong';
              return (
                <div key={i} className={cls} onClick={() => { if (!submitted) setAnswers({ ...answers, [q.id]: v }); }}>
                  <div className="marker">{v ? 'T' : 'F'}</div>
                  <div className="label">{v ? '正确' : '错误'}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 简答 */}
        {q.type === 'essay' && (
          <>
            <textarea className="essay-area" placeholder="请在此输入你的答案…" value={userAnswer || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} disabled={submitted} />
            {submitted && <div className="essay-answer"><span className="label">参考答案</span>{q.answer}</div>}
          </>
        )}

        {/* 解析 */}
        {submitted && q.explanation && (
          <div className="q-explain"><span className="label">解析</span>{q.explanation}</div>
        )}

        {/* 操作 */}
        <div className="q-actions">
          <Button variant="ghost" icon={I.arrowL} onClick={() => go('quiz', { sectionId })}>返回列表</Button>
          {!submitted ? (
            <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>提交答案</Button>
          ) : (
            <Button variant="primary" icon={I.arrow} onClick={handleNext}>
              {idx < list.length - 1 ? '下一题' : '完成'}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

/* ===== 结果页 ===== */
const QuizResult = ({ result, go, onRetry }) => {
  const { list, answers, stats } = result;
  const pct = Math.round((stats.correct / list.length) * 100);
  const grade = pct >= 90 ? '优秀' : pct >= 75 ? '良好' : pct >= 60 ? '及格' : '加油';

  return (
    <>
      <div className="hero" style={{ textAlign: 'center', borderBottom: 'none' }}>
        <div className="result-hero">
          <div className="result-score">{stats.correct}<span className="total"> / {list.length}</span></div>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 500 }}>{grade} · {pct}%</div>
          <div className="result-summary">
            <div className="result-cell success"><div className="v">{stats.correct}</div><div className="l">答对</div></div>
            <div className="result-cell danger"><div className="v">{stats.wrong}</div><div className="l">答错</div></div>
            <div className="result-cell muted"><div className="v">{stats.essay}</div><div className="l">简答</div></div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
        <Button variant="outline" icon={I.refresh} onClick={onRetry}>再来一次</Button>
        <Button variant="primary" icon={I.error} onClick={() => go('wrong')}>查看错题</Button>
        <Button variant="ghost" onClick={() => go('home')}>返回首页</Button>
      </div>
    </>
  );
};

/* ===== 错题本 ===== */
const WrongBook = ({ course, go }) => {
  const wrongQs = course.questions.filter(q => course.wrongIds.includes(q.id));
  if (wrongQs.length === 0) {
    return (
      <div className="empty">
        <I.check style={{ width: 36, height: 36, opacity: 0.4 }} />
        <h3>暂无错题</h3>
        <p>答错的题目会自动收集在这里</p>
        <Button variant="primary" icon={I.target} onClick={() => go('quiz')}>去刷题</Button>
      </div>
    );
  }

  return (
    <>
      <div className="hero">
        <h1>错题本 <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text-3)' }}>· {wrongQs.length} 题</span></h1>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" icon={I.target} onClick={() => go('session', { mode: 'sequential', wrongOnly: true })}>刷错题</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {wrongQs.map((q, i) => (
          <div key={q.id} className="quiz-list-row" onClick={() => go('session', { sectionId: q.sectionId, mode: 'sequential' })}>
            <div className="num" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{i + 1}</div>
            <div className="info">
              <div className="t">{q.stem.length > 60 ? q.stem.slice(0, 60) + '…' : q.stem}</div>
              <div className="meta"><span className={`qtype-pill ${q.type}`}>{q.type === 'single' ? '单选' : q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '简答'}</span></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
