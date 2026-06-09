/* 期末速通 v1 · 知识卡片 */

/* ===== 挖空渲染 ===== */
const ClozeText = ({ text, revealed }) => {
  if (!text) return null;
  // 解析 [?|答案] 格式（用字符串逐字符匹配，避免正则转义问题）
  const parts = [];
  let i = 0;
  while (i < text.length) {
    // 查找 [?| 或 [?]
    const idx1 = text.indexOf('[?|', i);
    const idx2 = text.indexOf('[?]', i);
    let idx = -1;
    if (idx1 !== -1 && idx2 !== -1) idx = Math.min(idx1, idx2);
    else if (idx1 !== -1) idx = idx1;
    else if (idx2 !== -1) idx = idx2;

    if (idx === -1) { parts.push({ type: 'text', val: text.slice(i) }); break; }
    if (idx > i) parts.push({ type: 'text', val: text.slice(i, idx) });

    if (text.startsWith('[?|', idx)) {
      const end = text.indexOf(']', idx + 3);
      if (end !== -1) {
        parts.push({ type: 'blank', val: text.slice(idx + 3, end) });
        i = end + 1;
      } else {
        parts.push({ type: 'blank', val: '' });
        i = idx + 3;
      }
    } else {
      parts.push({ type: 'blank', val: '' });
      i = idx + 3;
    }
  }
  if (!parts.some(p => p.type === 'blank')) return <span>{text}</span>;
  return (
    <span>
      {parts.map((p, j) => p.type === 'text' ? (
        <span key={j}>{p.val}</span>
      ) : revealed ? (
        <span key={j} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 8px', borderRadius: 4, fontWeight: 600, margin: '0 2px' }}>{p.val || '…'}</span>
      ) : (
        <span key={j} style={{ background: 'var(--bg-subtle)', color: 'var(--text-3)', padding: '1px 14px', borderRadius: 4, margin: '0 2px', borderBottom: '2px solid var(--accent)', letterSpacing: '0.1em' }}>____</span>
      ))}
    </span>
  );
};

/* ===== 卡片翻转弹窗 ===== */
const CardModal = ({ card, onClose, onMaster }) => {
  const [flipped, setFlipped] = useState(false);
  const [clozeRevealed, setClozeRevealed] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { setFlipped(false); setClozeRevealed(false); }, [card?.id]);

  const hasCloze = card.cloze && (card.cloze.includes('[?|') || card.cloze.includes('[?]'));

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, background: 'transparent', boxShadow: 'none', overflow: 'visible' }}>
        <div className={`flashcard ${flipped ? 'flipped' : ''}`}>
          <div className="flashcard-inner">
            <div className="flashcard-face flashcard-front">
              <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 14, right: 14 }} onClick={onClose}><I.x width={14} height={14} /></button>
              <span className="tag-inline accent" style={{ marginBottom: 10, alignSelf: 'flex-start' }}>{card.tag}</span>
              <h2 style={{ marginTop: 6, fontSize: 22, lineHeight: 1.4 }}>{card.title}</h2>
              {card.subtitle && <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 12 }}>{card.subtitle}</p>}
              {hasCloze && (
                <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 15, lineHeight: 1.8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>填空测试</div>
                  <ClozeText text={card.cloze} revealed={clozeRevealed} />
                  {!clozeRevealed && (
                    <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); setClozeRevealed(true); }}>
                      显示答案
                    </button>
                  )}
                </div>
              )}
              <div style={{ flex: 1 }} />
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setFlipped(true)}>看完整要点 →</button>
              </div>
            </div>
            <div className="flashcard-face flashcard-back">
              <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 14, right: 14 }} onClick={() => setFlipped(false)}>↩</button>
              <h2 style={{ marginTop: 6, fontSize: 18, lineHeight: 1.4 }}>{card.title}</h2>
              <div style={{ flex: 1, overflowY: 'auto', marginTop: 12 }}>
                {card.bullets?.length > 0 && (
                  <ul className="bullets">{card.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                )}
                {card.detail && <p style={{ marginTop: 12, color: 'var(--text-2)', fontSize: 13 }}>{card.detail}</p>}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
                <Button variant="primary" size="sm" icon={I.check} onClick={() => { onMaster(card.id); onClose(); }}>标记掌握</Button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
          <kbd style={{ padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg-elev)', fontFamily: 'JetBrains Mono' }}>Space</kbd> 翻转 ·
          <kbd style={{ padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg-elev)', fontFamily: 'JetBrains Mono' }}>Esc</kbd> 关闭
        </div>
      </div>
    </div>
  );
};

/* ===== 章节详情页 ===== */
const SectionView = ({ sectionId, course, go, mastered, setMastered, setOpenedCard }) => {
  const section = course.sections.find(s => s.id === sectionId);
  if (!section) return <div className="empty"><h3>章节未找到</h3></div>;

  const sectionQs = course.questions.filter(q => q.sectionId === sectionId);

  return (
    <>
      <div className="hero">
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
          <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => go('home')}>首页</span>
          <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>/</span>
          <span>{section.title}</span>
        </div>
        <h1>{section.title}</h1>
        {section.summary && <p className="lede" style={{ marginTop: 8 }}>{section.summary}</p>}
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <Button variant="primary" icon={I.cards} onClick={() => go('cards', { sectionId })}>浏览卡片 ({section.cards?.length || 0})</Button>
          <Button variant="outline" icon={I.target} onClick={() => go('quiz', { sectionId })}>本节刷题 ({sectionQs.length})</Button>
        </div>
      </div>

      <h2 style={{ marginBottom: 12 }}>知识卡片 <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-3)' }}>· 共 {section.cards?.length || 0} 张</span></h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {(section.cards || []).map(c => {
          const isMastered = mastered.has(c.id);
          return (
            <div key={c.id} className="knowledge-card" onClick={() => setOpenedCard(c)}>
              <span className="tag">{c.tag}</span>
              <h3>{c.title}</h3>
              {c.subtitle && <p className="sub">{c.subtitle}</p>}
              {c.cloze && (c.cloze.includes('[?|') || c.cloze.includes('[?]')) ? (
                <p className="preview" style={{ color: 'var(--accent)' }}>📝 含挖空测试</p>
              ) : c.bullets?.[0] ? (
                <p className="preview">{c.bullets[0]}</p>
              ) : null}
              <div className="footer">
                <span>{(c.bullets || []).length} 个要点</span>
                {isMastered && <span className="mastered-pill"><I.check width={11} height={11} /> 已掌握</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

/* ===== 速通模式（卡片翻转） ===== */
const SpeedRun = ({ sectionId, course, mastered, setMastered }) => {
  const cards = useMemo(() => {
    if (sectionId) {
      const sec = course.sections.find(s => s.id === sectionId);
      return sec?.cards || [];
    }
    return course.sections.flatMap(s => s.cards || []);
  }, [sectionId, course]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const c = cards[idx];
  if (!c) return <div className="empty"><h3>暂无卡片</h3></div>;

  const isMastered = mastered.has(c.id);
  const sec = course.sections.find(s => s.cards?.some(x => x.id === c.id));

  return (
    <>
      <div className="hero">
        <h1>⚡ 速通模式</h1>
        <p className="lede" style={{ marginTop: 8 }}>点击卡片翻转 · 空格翻转 · 左右键切换</p>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ fontFamily: 'JetBrains Mono' }}>{idx + 1} / {cards.length}</span>
          <span style={{ marginLeft: 16 }}>已掌握 {cards.filter(x => mastered.has(x.id)).length}</span>
        </div>
      </div>

      <div className={`flash-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
        <div className="flash-inner">
          <div className="flash-face">
            <div className="stem">{c.tag} · {sec?.title || ''}</div>
            <div className="q">{c.title}</div>
            {c.cloze && (c.cloze.includes('[?|') || c.cloze.includes('[?]')) && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, lineHeight: 1.8, textAlign: 'left' }}>
                <ClozeText text={c.cloze} revealed={false} />
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>点击查看 {(c.bullets || []).length} 个要点</div>
          </div>
          <div className="flash-face back">
            <div className="stem">要点速览</div>
            {c.cloze && (c.cloze.includes('[?|') || c.cloze.includes('[?]')) && (
              <div style={{ padding: '10px 12px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 13, lineHeight: 1.7, textAlign: 'left', marginBottom: 12 }}>
                <ClozeText text={c.cloze} revealed={true} />
              </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, textAlign: 'left', maxWidth: 380 }}>
              {(c.bullets || []).map((b, i) => (
                <li key={i} style={{ position: 'relative', paddingLeft: 16, marginBottom: 6, fontSize: 14 }}>
                  <span style={{ position: 'absolute', left: 0, top: 8, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flash-controls">
        <Button variant="outline" icon={I.arrowL} onClick={() => { setFlipped(false); setIdx((idx - 1 + cards.length) % cards.length); }}>上一张</Button>
        <Button variant={isMastered ? 'success' : 'primary'} icon={I.check} onClick={(e) => { e.stopPropagation(); setMastered(c.id, !isMastered); }}>
          {isMastered ? '已掌握' : '标记掌握'}
        </Button>
        <Button variant="outline" icon={I.arrow} onClick={() => { setFlipped(false); setIdx((idx + 1) % cards.length); }}>下一张</Button>
      </div>
    </>
  );
};
