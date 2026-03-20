import { useState, useEffect, useCallback } from 'react';
import ChapterList, { useChapterList } from '../components/ChapterList.jsx';
import ExportButton from '../components/ExportButton.jsx';

const GENRES      = ['thriller', 'horror', 'fantasy', 'romance', 'mystery', 'literary'];
const STYLES      = ['', 'king_like', 'hemingway_like', 'dickens_like', 'carver_like', 'le_guin_like'];
const STYLE_LABEL = { '': 'None', king_like: 'King-like', hemingway_like: 'Hemingway-like', dickens_like: 'Dickens-like', carver_like: 'Carver-like', le_guin_like: 'Le Guin-like' };

export default function Story() {
  const [form, setForm] = useState({
    input: '', genre: 'thriller', authorStyle: '', chapters: 5, protagonist: 'protagonist',
  });
  const [continuity, setContinuity]   = useState([]);
  const [running, setRunning]         = useState(false);
  const [error, setError]             = useState('');
  
  const { 
    chapters, 
    progress, 
    sessionId, 
    startStreaming, 
    resumeStreaming,
    setChapters,
    setProgress,
    setError,
  } = useChapterList('story');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // Load session if URL has ?session=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) loadSession(sid);
  }, []);

  async function loadSession(id) {
    try {
      const res = await fetch(`/api/stream/session/${id}`);
      const data = await res.json();
      if (data.session) {
        setForm(f => ({
          ...f,
          input: data.session.title || '',
          genre: data.session.genre || 'thriller',
          authorStyle: data.session.author_style || '',
          chapters: data.scenes.length,
          protagonist: data.session.protagonist || 'protagonist',
        }));
        setChapters(data.scenes.map(s => ({ 
          index: s.index,
          content: s.text, 
          wordCount: s.text?.split(/\s+/).length || 0,
          emotion: s.emotion,
          validation: s.validation,
          status: s.status,
        })));
        setContinuity(data.scenes.map(s => ({ scene: s.index, issues: s.validation || 'No issues found.' })));
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setContinuity([]); setError('');
    setRunning(true);

    try {
      await startStreaming({
        ...form,
        chapters: Number(form.chapters),
        sessionId,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const handleEdit = useCallback(async (index, newText) => {
    if (!sessionId) return;
    
    try {
      const res = await fetch(`/api/stream/session/${sessionId}/scene/${index + 1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newText }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.code === 'STREAMING_LOCK') {
          alert('Cannot edit while streaming is active. Please wait for generation to complete.');
          return;
        }
        if (data.violations) {
          const message = data.violations.map(v => v.message).join('\n');
          alert('Edit violates constraints:\n' + message);
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }
      
      // Update local state
      setChapters(prev => prev.map((c, i) => 
        i === index ? { ...c, content: newText, status: 'edited' } : c
      ));
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  }, [sessionId, setChapters]);

  const handleRecompute = useCallback((index) => {
    // TODO: Implement downstream recompute
    alert('Recompute from chapter ' + (index + 1) + ' - Coming in Phase 3');
  }, []);

  // Update URL when session changes
  useEffect(() => {
    if (sessionId) {
      const url = new URL(window.location);
      url.searchParams.set('session', sessionId);
      window.history.replaceState({}, '', url);
    }
  }, [sessionId]);

  return (
    <div>
      <form className="form" onSubmit={handleGenerate}>
        <div className="field">
          <label>Premise</label>
          <textarea
            value={form.input}
            onChange={e => set('input', e.target.value)}
            placeholder="A detective discovers reality resets every time he lies…"
            required
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Genre</label>
            <select value={form.genre} onChange={e => set('genre', e.target.value)}>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Author style</label>
            <select value={form.authorStyle} onChange={e => set('authorStyle', e.target.value)}>
              {STYLES.map(s => <option key={s} value={s}>{STYLE_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Chapters</label>
            <input type="number" min={1} max={20} value={form.chapters} onChange={e => set('chapters', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <button className="btn btn-primary" type="submit" disabled={running}>
            {running ? 'Generating…' : 'Generate'}
          </button>
          <ExportButton scenes={chapters.map(c => c.content)} title={form.input.slice(0, 40)} disabled={running} />
        </div>
      </form>

      {sessionId && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
          Session: {sessionId.slice(0,8)}… <a href={`?session=${sessionId}`} style={{color:'#4a4aff'}}>permalink</a>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <div className="output">
        <div className="output-header">
          <h2>{chapters.length ? `${chapters.length} chapter(s)` : 'Generating…'}</h2>
        </div>
        {progress && <p className="progress">{progress}</p>}
        
        <ChapterList
          chapters={chapters}
          onEdit={handleEdit}
          onRecompute={handleRecompute}
          autoScroll={!running}
        />
        
        {continuity.length > 0 && (
          <div className="continuity-report">
            <h3>Continuity check</h3>
            {continuity.map((r, i) => (
              <div key={i} className={`continuity-item ${/no issues/i.test(r.issues) ? 'clean' : ''}`}>
                Chapter {r.scene}: {r.issues}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}