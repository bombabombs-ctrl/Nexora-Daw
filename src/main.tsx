import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, FolderOpen, Music2, Pause, Play, RotateCcw, Sparkles, Volume2, Waves } from 'lucide-react';
import './styles.css';

type Track = { name: string; emoji: string; color: string; kind: 'kick' | 'snare' | 'hat' | 'tone'; volume: number; muted: boolean };
type Project = { name: string; tempo: number; pattern: boolean[][]; tracks: Track[] };
const STEPS = 16;
const STORAGE_KEY = 'nexora-project-v1';
const starterTracks: Track[] = [
  { name: 'Cassa', emoji: '🥁', color: '#ff806b', kind: 'kick', volume: 75, muted: false },
  { name: 'Rullante', emoji: '👏', color: '#a68bfa', kind: 'snare', volume: 65, muted: false },
  { name: 'Charleston', emoji: '✨', color: '#42cdbb', kind: 'hat', volume: 45, muted: false },
  { name: 'Nota magica', emoji: '🎹', color: '#f5bc55', kind: 'tone', volume: 50, muted: false },
];
const starterPattern = () => starterTracks.map((_, row) => Array.from({ length: STEPS }, (_, i) => row === 0 ? i % 4 === 0 : row === 1 ? i === 4 || i === 12 : row === 2 ? i % 2 === 0 : i === 2 || i === 6 || i === 10 || i === 14));
function loadProject(): Project {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Project;
  } catch { /* Start with the demo if browser storage is unavailable. */ }
  return { name: 'La mia prima canzone', tempo: 110, pattern: starterPattern(), tracks: starterTracks };
}

function App() {
  const [project, setProject] = useState<Project>(loadProject);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [message, setMessage] = useState('Premi ▶ e ascolta la tua musica!');
  const audio = useRef<AudioContext | null>(null);
  const nextStep = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch { /* Saving a file is still available. */ } }, [project]);
  useEffect(() => () => { if (audio.current && audio.current.state !== 'closed') void audio.current.close(); }, []);

  const playSound = (track: Track, when: number) => {
    const context = audio.current;
    if (!context || track.muted) return;
    const gain = context.createGain();
    gain.gain.value = Math.max(0.01, track.volume / 100) * 0.22;
    gain.connect(context.destination);
    if (track.kind === 'kick') {
      const osc = context.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(130, when); osc.frequency.exponentialRampToValueAtTime(42, when + 0.16);
      gain.gain.setValueAtTime(gain.gain.value, when); gain.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
      osc.connect(gain); osc.start(when); osc.stop(when + 0.21);
    } else if (track.kind === 'snare' || track.kind === 'hat') {
      const length = context.sampleRate * (track.kind === 'hat' ? 0.045 : 0.12);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource(); noise.buffer = buffer;
      const filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = track.kind === 'hat' ? 6500 : 1000;
      noise.connect(filter).connect(gain); gain.gain.setValueAtTime(gain.gain.value, when); gain.gain.exponentialRampToValueAtTime(0.001, when + (track.kind === 'hat' ? 0.045 : 0.13));
      noise.start(when);
    } else {
      const osc = context.createOscillator(); osc.type = 'triangle';
      const notes = [261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66];
      osc.frequency.value = notes[Math.floor(nextStep.current / 2) % notes.length];
      gain.gain.setValueAtTime(gain.gain.value, when); gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
      osc.connect(gain); osc.start(when); osc.stop(when + 0.23);
    }
  };

  useEffect(() => {
    if (!playing) { setStep(-1); return; }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const current = nextStep.current;
      setStep(current);
      const context = audio.current;
      if (context) project.pattern.forEach((line, row) => { if (line[current]) playSound(project.tracks[row], context.currentTime); });
      nextStep.current = (current + 1) % STEPS;
    };
    if (audio.current?.state === 'suspended') void audio.current.resume();
    tick();
    const timer = window.setInterval(tick, 60000 / Math.max(40, Math.min(240, project.tempo)) / 4);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [playing, project.tempo, project.pattern, project.tracks]);

  const updateProject = (patch: Partial<Project>) => setProject(current => ({ ...current, ...patch }));
  const toggleCell = (row: number, col: number) => updateProject({ pattern: project.pattern.map((line, r) => line.map((on, c) => r === row && c === col ? !on : on)) });
  const togglePlay = async () => {
    if (!playing) {
      const Audio = window.AudioContext;
      if (!Audio) { setMessage('Il tuo browser non supporta l’audio. Prova con Chrome o Edge.'); return; }
      audio.current ??= new Audio();
      if (audio.current.state === 'suspended') await audio.current.resume();
      setMessage('Che ritmo! Puoi cambiare i quadratini mentre suona.');
      setPlaying(true);
    } else { setPlaying(false); setMessage('Musica in pausa. Premi ▶ per ripartire!'); }
  };
  const changeTrack = (index: number, patch: Partial<Track>) => updateProject({ tracks: project.tracks.map((track, i) => i === index ? { ...track, ...patch } : track) });
  const clearPattern = () => { updateProject({ pattern: project.tracks.map(() => Array(STEPS).fill(false)) }); setMessage('Tutto pulito! Tocca i quadratini per creare un nuovo ritmo.'); };
  const makeSurprise = () => {
    updateProject({ pattern: project.tracks.map((_, row) => Array.from({ length: STEPS }, (_, i) => row === 0 ? i % 4 === 0 : row === 1 ? Math.random() > 0.72 : row === 2 ? Math.random() > 0.48 : Math.random() > 0.78)) });
    setMessage('Ecco un ritmo a sorpresa!');
  };
  const saveFile = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${project.name.trim().replace(/[^a-z0-9-_]+/gi, '-') || 'nexora-progetto'}.nexora.json`; link.click(); URL.revokeObjectURL(url);
    setMessage('Progetto scaricato! Lo ritrovi nella cartella Download.');
  };
  const openFile = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Project;
      if (!data.name || !Array.isArray(data.pattern) || !Array.isArray(data.tracks) || data.pattern.length !== data.tracks.length || data.pattern.some(row => !Array.isArray(row) || row.length !== STEPS)) throw new Error('file non valido');
      updateProject({ name: data.name, tempo: Math.max(40, Math.min(240, Number(data.tempo) || 110)), pattern: data.pattern.map(row => row.map(Boolean)), tracks: data.tracks });
      setPlaying(false); setMessage('Progetto aperto!');
    } catch { setMessage('Non riesco ad aprire questo file. Scegli un progetto Nexora valido.'); }
    if (fileInput.current) fileInput.current.value = '';
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Waves size={23} /></div><div><strong>NEXORA</strong><span>IL MIO STUDIO MUSICALE</span></div></div>
      <div className="project-name"><label htmlFor="song-name">La mia canzone</label><input id="song-name" value={project.name} maxLength={40} onChange={event => updateProject({ name: event.target.value })} aria-label="Nome della canzone" /></div>
      <div className="top-actions"><input ref={fileInput} className="file-input" type="file" accept=".json,.nexora.json,application/json" onChange={event => void openFile(event.target.files?.[0])} /><button className="secondary-button" onClick={() => fileInput.current?.click()}><FolderOpen size={19}/> <span>Apri</span></button><button className="secondary-button" onClick={saveFile}><Download size={19}/> <span>Salva</span></button></div>
    </header>
    <main className="main-content">
      <section className="welcome"><div><span className="eyebrow">CIAO, MUSICISTA! 👋</span><h1>Costruiamo un ritmo!</h1><p>Tocca i quadratini e inventa la tua musica.</p></div><div className="music-doodle" aria-hidden="true">🎵</div></section>
      <section className="controls card" aria-label="Controlli musica">
        <button className={`play-button ${playing ? 'is-playing' : ''}`} onClick={() => void togglePlay()} aria-label={playing ? 'Pausa' : 'Riproduci'}>{playing ? <Pause fill="currentColor" size={25}/> : <Play fill="currentColor" size={25}/>}<span>{playing ? 'PAUSA' : 'ASCOLTA'}</span></button>
        <div className="tempo-control"><label htmlFor="tempo">VELOCITÀ</label><div className="tempo-row"><input id="tempo" type="range" min="60" max="180" value={project.tempo} onChange={event => updateProject({ tempo: Number(event.target.value) })} /><strong>{project.tempo}<small> BPM</small></strong></div><div className="tempo-hints"><span>Piano 🐢</span><span>Veloce 🐇</span></div></div>
        <div className="control-actions"><button className="action-button surprise" onClick={makeSurprise}><Sparkles size={19}/> Sorprendimi!</button><button className="action-button clear" onClick={clearPattern}><RotateCcw size={18}/> Ricomincia</button></div>
      </section>
      <div className="hint" role="status"><span>💡</span>{message}</div>
      <section className="sequencer card">
        <div className="section-heading"><div><h2><Music2 size={22}/> Il tuo ritmo</h2><p>Ogni riga è uno strumento. Accendi o spegni i quadratini!</p></div><div className="step-legend"><i/> Sta suonando</div></div>
        <div className="beat-labels"><span className="instrument-label">STRUMENTI</span>{Array.from({ length: STEPS }, (_, i) => <span className={i % 4 === 0 ? 'beat-number strong' : 'beat-number'} key={i}>{i % 4 === 0 ? `${i / 4 + 1}` : '·'}</span>)}</div>
        <div className="tracks">{project.tracks.map((track, row) => <div className={`track-row ${track.muted ? 'muted' : ''}`} key={`${track.name}-${row}`}>
          <button className="track-name" onClick={() => changeTrack(row, { muted: !track.muted })} title={track.muted ? 'Attiva strumento' : 'Silenzia strumento'}><span className="track-emoji">{track.emoji}</span><span className="track-title">{track.name}</span><Volume2 size={16} className="volume-icon"/></button>
          <div className="steps-grid">{project.pattern[row]?.map((on, col) => <button key={col} aria-label={`${track.name}, battito ${col + 1}, ${on ? 'acceso' : 'spento'}`} aria-pressed={on} className={`step-cell ${on ? 'on' : ''} ${step === col ? 'current' : ''} ${col % 4 === 0 ? 'bar-start' : ''}`} style={{ '--track-color': track.color } as React.CSSProperties} onClick={() => toggleCell(row, col)} />)}</div>
        </div>)}</div>
        <div className="volume-panel"><span>🔊 VOLUME DEGLI STRUMENTI</span>{project.tracks.map((track, index) => <label className="volume-control" key={`vol-${track.name}-${index}`}><span>{track.emoji}</span><input aria-label={`Volume ${track.name}`} type="range" min="0" max="100" value={track.volume} onChange={event => changeTrack(index, { volume: Number(event.target.value) })} style={{ '--track-color': track.color } as React.CSSProperties} /></label>)}</div>
      </section>
      <div className="tip-card"><span>🌟</span><p><strong>Trucchetto:</strong> prova ad accendere i quadratini diversi, poi premi “Ascolta”. Ogni riga fa un suono diverso. La tua canzone si salva automaticamente su questo dispositivo!</p></div>
    </main>
    <footer><span>Nexora DAW · Fatto per divertirsi con la musica</span><span>Progetto privato, salvato sul tuo dispositivo</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
