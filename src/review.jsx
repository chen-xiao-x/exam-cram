/* 期末速通 v1 · SRS 间隔复习 */

const ReviewView = ({ course, setCourse, go, setOpenedCard }) => {
  const dueList = useMemo(() => srsDueCards(course), [course]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tab, setTab] = useState('due'); // 'due' | 'wrong'

  const wrongQs = course.questions.filter(q => course.wrongIds.includes(q.id));
  const total = tab === 'due' ? dueList.length : wrongQs.length;

  useEffect(() => { setIdx(0); setRevealed(false); }, [tab]);

  const handleRate = (correct) => {
    const card = dueList[idx];
    if (!card) return;
    const newSrs = srsRate({ ...course.srs }, card.id, correct);
    const newMastered = new Set(course.mastered || []);
    if (correct) newMastered.add(card.id);
    else newMastered.delete(card.id);
    setCourse({ ...course, srs: newSrs, mastered: [...newMastered] });
    setRevealed(false);
    if (idx + 1 < total) setIdx(idx + 1);
    else setIdx(total);
  };

  // 空态
  if (tab === 'due' && dueList.length === 0) {
    return (
      <>
        <div className="hero">
          <h1>🔄 间隔复习</h1>
          <p className="lede" style={{ marginTop: 8 }}>基于艾宾浩斯遗忘曲线 · 自动安排复习节奏</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button className={`review-tab ${tab === 'due' ? 'active' : ''}`} onClick={() => setTab('due')}>待复习 <span className="tab-count">0</span></button>
          <button className={`review-tab ${tab === 'wrong' ? 'active' : ''}`} onClick={() => setTab('wrong')}>错题 <span className="tab-count" style={{ background: wrongQs.length > 0 ? 'var(--danger-soft)' : undefined, color: wrongQs.length > 0 ? 'var(--danger)' : undefined }}>{wrongQs.length}</span></button>
        </div>
        <div className="empty">
          <I.check style={{ width: 36, height: 36, opacity: 0.4 }} />
          <h3>今日已清</h3>
          <p>暂无待复习的卡片</p>
          <Button variant="primary" icon={I.target} onClick={() => go('quiz')}>去刷题</Button>
        </div>
      </>
    );
  }

  if (tab === 'wrong') {
    return (
      <>
        <div className="hero">
          <h1>🔄 间隔复习</h1>
          <p className="lede" style={{ marginTop: 8 }}>基于艾宾浩斯遗忘曲线 · 自动安排复习节奏</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button className={`review-tab ${tab === 'due' ? 'active' : ''}`} onClick={() => setTab('due')}>待复习 <span className="tab-count">{dueList.length}</span></button>
          <button className={`review-tab ${tab === 'wrong' ? 'active' : ''}`} onClick={() => setTab('wrong')}>错题 <span className="tab-count" style={{ background: wrongQs.length > 0 ? 'var(--danger-soft)' : undefined, color: wrongQs.length > 0 ? 'var(--danger)' : undefined }}>{wrongQs.length}</span></button>
        </div>
        {wrongQs.length === 0 ? (
          <div className="empty"><h3>无错题</h3></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wrongQs.map((q, i) => (
              <div key={q.id} className="quiz-list-row" onClick={() => go('session', { sectionId: q.sectionId, mode: 'sequential' })}>
                <div className="num" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{i + 1}</div>
                <div className="info"><div className="t">{q.stem.slice(0, 60)}</div></div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // 复习卡片
  const card = dueList[idx];
  if (!card) {
    return (
      <div className="empty">
        <I.check style={{ width: 36, height: 36, opacity: 0.4 }} />
        <h3>本轮复习完成</h3>
        <Button variant="primary" onClick={() => { setIdx(0); }}>再来一轮</Button>
      </div>
    );
  }

  const stat = course.srs[card.id] || { state: 'new', interval: 0 };
  const stateLabel = { new: '新卡', learning: '学习中', review: '复习中', mastered: '已掌握' };
  const stateColor = { new: '#7c8aff', learning: '#f59e0b', review: '#3b82f6', mastered: '#10b981' };

  return (
    <>
      <div className="hero">
        <h1>🔄 间隔复习</h1>
        <p className="lede" style={{ marginTop: 8 }}>基于艾宾浩斯遗忘曲线 · 自动安排复习节奏</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className={`review-tab ${tab === 'due' ? 'active' : ''}`} onClick={() => setTab('due')}>待复习 <span className="tab-count">{dueList.length}</span></button>
        <button className={`review-tab ${tab === 'wrong' ? 'active' : ''}`} onClick={() => setTab('wrong')}>错题 <span className="tab-count" style={{ background: wrongQs.length > 0 ? 'var(--danger-soft)' : undefined, color: wrongQs.length > 0 ? 'var(--danger)' : undefined }}>{wrongQs.length}</span></button>
      </div>

      {/* 进度条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, fontSize: 13, color: 'var(--text-3)' }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--accent)', width: `${((idx + (revealed ? 0.5 : 0)) / total * 100).toFixed(1)}%`, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontFamily: 'JetBrains Mono' }}>{Math.min(idx + 1, total)} / {total}</span>
      </div>

      {/* 复习卡片 */}
      <div className="review-card" style={{ padding: '28px 24px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 14, minHeight: 300, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12 }}>
          <span className="tag-inline accent">{card.tag}</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: stateColor[stat.state] }}>{stateLabel[stat.state]}</span>
          {card.sectionTitle && <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>📂 {card.sectionTitle}</span>}
        </div>

        <h2 style={{ fontSize: 20, lineHeight: 1.4, margin: '8px 0 16px' }}>{card.title}</h2>

        {revealed ? (
          <div style={{ flex: 1, animation: 'fadeIn 0.25s' }}>
            {card.cloze && (card.cloze.includes('[?|') || card.cloze.includes('[?]')) && (
              <div style={{ padding: '12px 14px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 14, lineHeight: 1.8, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6, fontWeight: 600 }}>填空答案</div>
                <ClozeText text={card.cloze} revealed={true} />
              </div>
            )}
            {card.bullets?.length > 0 && <ul className="bullets">{card.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
            {card.detail && <p style={{ marginTop: 12, color: 'var(--text-2)', fontSize: 13 }}>{card.detail}</p>}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14, textAlign: 'center', padding: 24, border: '1px dashed var(--border)', borderRadius: 10, gap: 16 }}>
            {card.cloze && (card.cloze.includes('[?|') || card.cloze.includes('[?]')) && (
              <div style={{ padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, lineHeight: 1.8, textAlign: 'left', width: '100%', maxWidth: 400 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>填空测试</div>
                <ClozeText text={card.cloze} revealed={false} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🤔</div>
              <div>先回忆一下，想不起来就点「看答案」</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {!revealed ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <Button variant="primary" size="lg" onClick={() => setRevealed(true)}>看答案</Button>
              <Button variant="ghost" onClick={() => setOpenedCard(card)}>看完整卡片</Button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginBottom: 10 }}>这次回忆得如何？</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <Button variant="outline" onClick={() => handleRate(false)} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>忘记了</Button>
                <Button variant="outline" onClick={() => handleRate(true)} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>想起来了</Button>
                <Button variant="ghost" onClick={() => { setRevealed(false); if (idx + 1 < total) setIdx(idx + 1); }}>跳过</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/* ===== 进度统计 ===== */
const ProgressView = ({ course }) => {
  const totalCards = course.sections.reduce((s, sec) => s + (sec.cards?.length || 0), 0);
  const masteredCount = (course.mastered || []).length;
  const overall = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;
  const answered = Object.keys(course.allAnswers || {}).length;
  const correct = Object.entries(course.allAnswers || {}).filter(([qid, ua]) => {
    const q = course.questions.find(x => x.id === qid);
    return q && isCorrect(q, ua);
  }).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const days = daysUntil(course.examDate);

  return (
    <>
      <div className="hero">
        <h1>📊 学习进度</h1>
        {days !== null && <p className="lede" style={{ marginTop: 8 }}>距考试还有 {days} 天</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: 16, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>掌握卡片</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, fontFamily: 'JetBrains Mono' }}>{masteredCount}<span style={{ fontSize: 14, color: 'var(--text-3)' }}>/{totalCards}</span></div>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>已答题数</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, fontFamily: 'JetBrains Mono' }}>{answered}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>正确率</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, fontFamily: 'JetBrains Mono' }}>{accuracy}%</div>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>错题数</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, fontFamily: 'JetBrains Mono', color: (course.wrongIds || []).length > 0 ? 'var(--danger)' : undefined }}>{(course.wrongIds || []).length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <RingChart value={overall} />
      </div>

      <h2 style={{ marginBottom: 12 }}>章节进度</h2>
      <div style={{ padding: '6px 16px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10 }}>
        {course.sections.map((s, i) => {
          const secMastered = (s.cards || []).filter(c => (course.mastered || []).includes(c.id)).length;
          const secTotal = (s.cards || []).length;
          const pct = secTotal > 0 ? Math.round((secMastered / secTotal) * 100) : 0;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < course.sections.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-3)', fontSize: 12, width: 20 }}>{s.no || i + 1}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{s.title}</span>
              <div style={{ width: 120, height: 4, background: 'var(--bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent)', width: `${pct}%`, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'JetBrains Mono', width: 36, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </>
  );
};
