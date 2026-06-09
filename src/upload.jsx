/* 期末速通 v1 · 上传+AI分析 */

const AI_ENDPOINT = (typeof window !== 'undefined' && window.AI_ENDPOINT) || 'http://127.0.0.1:8766';

/* ===== 上传页面 ===== */
const UploadView = ({ onImport, go }) => {
  const [files, setFiles] = useState([]);       // [{ name, size, text, fileType, loading, err }]
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { sections, questions }
  const [err, setErr] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileInputRef = useRef(null);

  /* 解析文件 */
  const extractFile = async (file) => {
    const name = file.name || '未命名';
    const lc = name.toLowerCase();
    let fileType = '';
    if (lc.endsWith('.pdf')) fileType = 'pdf';
    else if (lc.endsWith('.pptx') || lc.endsWith('.ppt')) fileType = 'pptx';
    else if (lc.endsWith('.docx') || lc.endsWith('.doc')) fileType = 'docx';
    else if (lc.endsWith('.xlsx') || lc.endsWith('.xls')) fileType = 'xlsx';
    else if (lc.endsWith('.txt')) fileType = 'txt';
    else if (lc.endsWith('.md') || lc.endsWith('.markdown')) fileType = 'md';
    if (!fileType) throw new Error('不支持的文件类型：' + name);
    if (file.size > 80 * 1024 * 1024) throw new Error('文件超过 80MB');

    const fileBase64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const r = fr.result || '';
        const m = String(r).match(/^data:[^;]+;base64,(.*)$/);
        resolve(m ? m[1] : String(r));
      };
      fr.onerror = () => reject(new Error('读取文件失败'));
      fr.readAsDataURL(file);
    });

    const r = await fetch(AI_ENDPOINT + '/api/parse-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, fileType, fileName: name }),
    });
    if (!r.ok) throw new Error('解析失败：' + (await r.text()).slice(0, 100));
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || '解析失败');
    return { text: data.text, fileType };
  };

  /* 处理文件选择 */
  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList || []);
    const newFiles = arr.map(f => ({ name: f.name, size: f.size, loading: true, text: '', fileType: '', err: null, _file: f }));
    setFiles(prev => [...prev, ...newFiles]);

    for (const nf of newFiles) {
      try {
        const { text, fileType } = await extractFile(nf._file);
        setFiles(prev => prev.map(f => f === nf ? { ...f, loading: false, text, fileType } : f));
      } catch (e) {
        setFiles(prev => prev.map(f => f === nf ? { ...f, loading: false, err: e.message } : f));
      }
    }
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const handleDrop = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files); };

  /* AI 生成 */
  const generate = async () => {
    const readyFiles = files.filter(f => !f.loading && !f.err && f.text);
    if (readyFiles.length === 0) { setErr('请先上传至少一个文件'); return; }
    setBusy(true);
    setErr(null);
    setResult(null);

    try {
      const allText = readyFiles.map(f => '【' + f.name + '】\n' + f.text).join('\n\n');
      const r = await fetch(AI_ENDPOINT + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: allText, courseName: '期末复习' }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || 'AI 生成失败');
      setResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  /* 确认导入 */
  const confirmImport = () => {
    if (!result) return;
    onImport(result.sections, result.questions);
    go('home');
  };

  const readyCount = files.filter(f => !f.loading && !f.err && f.text).length;

  return (
    <div>
      <div className="hero">
        <h1>📤 上传课件</h1>
        <p className="lede" style={{ marginTop: 8 }}>上传课件文件，AI 自动拆分知识点并生成题目</p>
      </div>

      {/* 拖拽上传区 */}
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <I.upload width={32} height={32} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>拖拽文件到这里，或点击选择</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>支持 PDF / PPTX / DOCX / XLSX / TXT / MD</div>
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.pptx,.docx,.xlsx,.xls,.txt,.md" style={{ display: 'none' }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono' }}>{(f.size / 1024).toFixed(0)}KB</span>
              {f.loading && <span style={{ fontSize: 11, color: 'var(--accent)' }}>解析中…</span>}
              {f.err && <span style={{ fontSize: 11, color: 'var(--danger)' }} title={f.err}>❌</span>}
              {!f.loading && !f.err && f.text && <span style={{ fontSize: 11, color: 'var(--success)' }}>✅ {f.text.length} 字</span>}
              <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <Button variant="primary" size="lg" onClick={generate} disabled={busy || readyCount === 0}>
          {busy ? '🤖 AI 分析中…' : '🤖 开始 AI 分析'}
        </Button>
        {readyCount > 0 && <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-3)' }}>{readyCount} 个文件就绪</span>}
      </div>

      {err && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>⚠️ {err}</div>}

      {/* 分析结果预览 */}
      {result && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>📋 分析结果预览</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 14, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>{result.sections?.length || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>章节</div>
            </div>
            <div style={{ padding: 14, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>{result.sections?.reduce((s, sec) => s + (sec.cards?.length || 0), 0) || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>知识卡片</div>
            </div>
            <div style={{ padding: 14, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>{result.questions?.length || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>题目</div>
            </div>
          </div>

          {/* 章节列表预览 */}
          {result.sections?.map((sec, i) => (
            <div key={i} style={{ marginBottom: 8, padding: '10px 14px', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>第 {i + 1} 章 · {sec.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sec.cards?.length || 0} 张知识卡</div>
            </div>
          ))}

          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <Button variant="primary" size="lg" icon={I.check} onClick={confirmImport}>确认导入</Button>
            <Button variant="ghost" onClick={() => setResult(null)}>重新分析</Button>
          </div>
        </div>
      )}
    </div>
  );
};
