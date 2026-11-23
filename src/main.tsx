import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, FolderOpen, Gauge, Headphones, Pause, Play, Plus, Save, Settings2, SlidersHorizontal, Square, Volume2, Waves } from 'lucide-react';
import './styles.css';

type Track = { name: string; color: string; volume: number; muted: boolean };
const STEPS = 16;
const initialTracks: Track[] = [
  { name: 'Drums', color: '#ff795f', volume: 82, muted: false },
  { name: 'Bass', color: '#a78bfa', volume: 72, muted: false },
  { name: 'Keys', color: '#42d4c8', volume: 68, muted: false },
];

function App() {
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(118);
  const [selected, setSelected] = useState(0);
  const [tracks, setTracks] = useState(initialTracks);
  const [pattern, setPattern] = useState<boolean[][]>(() => initialTracks.map((_, row) => Array.from({ length: STEPS }, (_, i) => row === 0 ? [0, 4, 8, 12].includes(i) : row === 1 ? [0, 3, 8, 11].includes(i) : [2, 6, 10, 14].includes(i))));
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => () => { audio.current?.close(); }, []);
  const toggleStep = (row: number, step: number) => setPattern(current => current.map((line, r) => r === row ? line.map((on, s) => s === step ? !on : on) : line));
  const flipMute = (index: number) => setTracks(current => current.map((track, i) => i === index ? { ...track, muted: !track.muted } : track));

  const preview = (frequency: number, duration = 0.12) => {
    const context = audio.current ?? new AudioContext();
    audio.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + duration + 0.02);
  };

  const addTrack = () => setTracks(current => [...current, { name: `Track ${current.length + 1}`, color: '#f4b942', volume: 70, muted: false }]);
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Waves size={19} /></div><strong>NEXORA</strong><span>DAW</span></div>
      <div className="project"><span>Untitled project</span><small>Local session</small></div>
      <div className="top-actions"><button className="icon-button" title="Open project"><FolderOpen size={18}/></button><button className="icon-button" title="Save project"><Save size={18}/></button><button className="icon-button" title="Settings"><Settings2 size={18}/></button></div>
    </header>
    <main>
      <section className="transport panel">
        <button className={`transport-button ${playing ? 'active' : ''}`} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
        <button className="stop-button" onClick={() => setPlaying(false)}><Square size={15}/></button>
        <div className="tempo"><Gauge size={17}/><label>BPM <input type="number" min="40" max="240" value={tempo} onChange={event => setTempo(Number(event.target.value))}/></label></div>
        <div className="transport-spacer"/><span className="timecode">00:00:00:00</span><span className="ready"><i/> Audio ready</span>
      </section>
      <div className="workspace">
        <aside className="sidebar panel"><div className="section-title">LIBRARY <Plus size={15}/></div><div className="library-item selected"><Waves size={16}/> Patterns <b>1</b></div><div className="library-item"><FolderOpen size={16}/> Samples <b>0</b></div><div className="library-item"><Headphones size={16}/> Instruments <b>3</b></div><div className="section-title lower">TOOLS</div><div className="library-item"><Activity size={16}/> Audio effects</div><div className="library-item"><SlidersHorizontal size={16}/> Mixer presets</div><div className="tip"><strong>Local-first</strong><p>Your project stays in this browser session until export is added.</p></div></aside>
        <section className="sequencer panel"><div className="panel-heading"><div><span className="eyebrow">PATTERN 01</span><h2>Neon pulse</h2></div><button className="small-button"><Plus size={14}/> Add pattern</button></div><div className="grid-header"><span>TRACK</span>{Array.from({ length: STEPS }, (_, i) => <span key={i}>{i + 1}</span>)}</div>{tracks.map((track, row) => <div className="step-row" key={track.name}><button className={`track-name ${selected === row ? 'chosen' : ''}`} onClick={() => setSelected(row)}><i style={{ background: track.color }}/>{track.name}</button>{Array.from({ length: STEPS }, (_, step) => <button key={step} aria-label={`${track.name} step ${step + 1}`} className={`step ${pattern[row]?.[step] ? 'on' : ''} ${step % 4 === 0 ? 'beat' : ''}`} style={pattern[row]?.[step] ? { '--track-color': track.color } as React.CSSProperties : undefined} onClick={() => { toggleStep(row, step); preview(150 + row * 80); }}/>)}</div>)}<button className="add-track" onClick={addTrack}><Plus size={15}/> Add track</button><div className="piano"><div className="piano-label">PIANO ROLL <span>{tracks[selected]?.name ?? 'Track'}</span></div><div className="piano-grid">{Array.from({ length: 32 }, (_, i) => <button key={i} onClick={() => preview(220 * Math.pow(2, (i % 12) / 12))} className={i % 7 === 0 ? 'note active-note' : i % 5 === 0 ? 'note soft-note' : 'note'} style={{ left: `${(i / 32) * 100}%` }}/>)}</div></div></section>
        <aside className="mixer panel"><div className="section-title">MIXER <SlidersHorizontal size={15}/></div>{tracks.map((track, index) => <div className="channel" key={track.name}><div className="channel-top"><i style={{ background: track.color }}/><strong>{track.name}</strong><button onClick={() => flipMute(index)} className={track.muted ? 'muted' : ''}>{track.muted ? 'M' : 'M'}</button></div><div className="meter"><span style={{ height: `${track.muted ? 8 : track.volume}%`, background: track.color }}/></div><input aria-label={`${track.name} volume`} type="range" min="0" max="100" value={track.volume} onChange={event => setTracks(current => current.map((item, i) => i === index ? { ...item, volume: Number(event.target.value) } : item))}/><div className="channel-bottom"><Volume2 size={13}/><span>{track.volume}%</span></div></div>)}</aside>
      </div>
    </main>
    <footer><span>Nexora DAW 0.1.0</span><span>Web Audio preview engine</span><span className="footer-right">No account required · <a href="https://github.com/bombabombs-ctrl/Nexora-Daw">Source</a></span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
