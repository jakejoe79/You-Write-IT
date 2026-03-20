import { useState, useEffect } from 'react';
import OutputViewer from '../components/OutputViewer.jsx';
import ExportButton from '../components/ExportButton.jsx';

const GENRES      = ['thriller', 'horror', 'fantasy', 'romance', 'mystery', 'literary'];
const STYLES      = ['', 'king_like', 'hemingway_like', 'dickens_like', 'carver_like', 'le_guin_like'];
const STYLE_LABEL = { '': 'None', king_like: 'King-like', hemingway_like: 'Hemingway-like', dickens_like: 'Dickens-like', carver_like: 'Carver-like', le_guin_like: 'Le Guin-like' };

export default function Story() {
  const [form, setForm] = useState({
    input: '', genre: 'thriller', authorStyle: '', scenes: 5, protagonist: 'protagonist',
  });
  const [scenes, setScenes]           = useState([]);
  const [continuity, setContinuity]   = useState([]);
  const [progress, setProgress]       = useState('');
  const [running, setRunning]         = useState(false);
  const [error, setError]             = useState('');
  const [sessionId, setSessionId]     = useState(null);
  const [editingIdx, setEditingIdx]   = useState(null);
  const [editText, setEditText]       = useState('');

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
        setSessionId(id);
        setForm(f => ({
          ...f,
          input: data.session.title || '',
          genre: data.session.genre || 'thriller',
          authorStyle: data.session.author_style || '',
          scenes: data.scenes.length,
          protagonist: data.session.protagonist || 'protagonist',
        }));
        setScenes(data.scenes.map(s => ({ text: s.text, emotion: s.emotion })));
        setContinuity(data.scenes.map(s => ({ scene: s.index, issues: s.validation || 'No issues found.' })));
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setScenes([]); setContinuity([]); setError(''); setProgress('Connecting…');
    setRunning(true);

    try {
      const res = await fetch('/api/stream/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, scenes: Number(form.scenes), sessionId }),
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();

        for (const block of events) {
          const eventLine = events.find(l => l.startsWith('event:'));
          const dataLine  = events.find(l => l.startsWith('data:'));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace('event:', '').trim();
          const data  = JSON.parse(dataLine.replace('data:', '').trim());

          if (event === 'start')    { setSessionId(data.sessionId); setProgress(`Generating ${data.total} scenes…`); }
          if (event === 'progress') setProgress(data.status || `Scene ${data.scene} of ${data.total}…`);
          if (event === 'scene')    setScenes(s => [...s, { text: data.text, emotion: data.emotion }]);
          if (event === 'done') {
            setScenes(data.scenes.map(t => ({ text: t })));
            setContinuity(data.continuityReport || []);
            setProgress('');
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('session', data.sessionId);
            window.history.replaceState({}, '', url);
          }
          if (event === 'error')    setError(data.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
      setProgress('');
    }
  }

  async function saveEdit(idx) {
    try {
      await fetch(`/api/stream/session/${sessionId}/scene/${idx + 1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText }),
      });
      setScenes(s => s.map((sc, i) => i === idx ? { ...sc, text: editText } : sc));
      setEditingIdx(null);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  }

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
            <label>Scenes</label>
            <input type="number" min={1} max={20} value={form.scenes} onChange={e => set('scenes', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <button className="btn btn-primary" type="submit" disabled={running}>
            {running ? 'Generating…' : 'Generate'}
          </button>
          <ExportButton scenes={scenes.map(s => s.text)} title={form.input.slice(0, 40)} disabled={running} />
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
          <h2>{scenes.length ? `${scenes.length} scene(s)` : 'Generating…'}</h2>
        </div>
        {progress && <p className="progress">{progress}</p>}
        <div className="scene-list">
          {scenes.map((scene, i) => (
            <div key={i} className="scene">
              <div className="scene-label">
                Scene {i + 1}
                <button
                  style={{ marginLeft: '1rem', background: 'none', border: 'none', color: '#4a4aff', cursor: 'pointer', fontSize: '0.75rem' }}
                  onClick={() => { setEditingIdx(i); setEditText(scene.text); }}
                >
                  edit
                </button>
              </div>
              {editingIdx === i ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{ width: '100%', minHeight: 200, background: '#1a1a1a', color: '#e8e8e8', border: '1px solid #333', borderRadius: 6, padding: '0.5rem', fontFamily: 'inherit' }}
                  />
                  <div style={{ marginTop: 0.5, display: 'flex', gap: 0.5 }}>
                    <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => saveEdit(i)}>Save</button>
                    <button className="btn btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingIdx(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="scene-text">{scene.text}</div>
              )}
              {scene.emotion?.protagonist && (
                <div className="scene-emotion">
                  {Object.entries(scene.emotion.protagonist).sort(([,a],[,b]) => b-a).slice(0,2).map(([e,v]) => `${e} ${Math.round(v*100)}%`).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
        {continuity.length > 0 && (
          <div className="continuity-report">
            <h3>Continuity check</h3>
            {continuity.map((r, i) => (
              <div key={i} className={`continuity-item ${/no issues/i.test(r.issues) ? 'clean' : ''}`}>
                Scene {r.scene}: {r.issues}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
