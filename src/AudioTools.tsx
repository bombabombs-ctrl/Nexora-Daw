import React, { useEffect, useRef, useState } from 'react';
import { Download, Music2, Upload, WandSparkles } from 'lucide-react';

type Props = { mode: 'mastering' | 'bpm' };
type MasterSettings = { bass: number; treble: number; compression: number; output: number };
const DEFAULT_MASTER: MasterSettings = { bass: 0, treble: 0, compression: 35, output: 90 };

function wavBlob(buffer: AudioBuffer): Blob {
  const channels = Math.min(buffer.numberOfChannels, 2), frames = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(arrayBuffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, arrayBuffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, frames * channels * 2, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) { const sample = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i])); view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2; }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// WSOLA: overlap-add with waveform similarity search changes duration while retaining local waveform cycles/pitch.
function stretchWsola(input: AudioBuffer, factor: number): AudioBuffer {
  const win = 1024, hop = 256, overlap = win - hop, search = 96;
  const outputLength = Math.max(win, Math.round(input.length * factor));
  const output = new AudioBuffer({ numberOfChannels: input.numberOfChannels, length: outputLength, sampleRate: input.sampleRate });
  for (let channel = 0; channel < input.numberOfChannels; channel++) {
    const source = input.getChannelData(channel), target = output.getChannelData(channel);
    const weights = new Float32Array(outputLength);
    let sourcePos = 0;
    for (let outPos = 0; outPos < outputLength; outPos += hop) {
      let best = Math.max(0, Math.min(source.length - win, Math.round(sourcePos)));
      if (outPos > 0) {
        let bestScore = -Infinity;
        const expected = Math.round(sourcePos);
        const from = Math.max(0, expected - search), to = Math.min(source.length - win, expected + search);
        for (let candidate = from; candidate <= to; candidate += 4) {
          let dot = 0, a2 = 0, b2 = 0;
          for (let j = 0; j < overlap; j += 8) { const a = target[outPos + j] || 0; const b = source[candidate + j]; dot += a * b; a2 += a * a; b2 += b * b; }
          const score = dot / Math.sqrt(a2 * b2 + 1e-12);
          if (score > bestScore) { bestScore = score; best = candidate; }
        }
      }
      for (let j = 0; j < win && outPos + j < outputLength && best + j < source.length; j++) {
        const weight = .5 - .5 * Math.cos(2 * Math.PI * j / (win - 1));
        target[outPos + j] += source[best + j] * weight; weights[outPos + j] += weight;
      }
      sourcePos = best + hop / factor;
    }
    for (let i = 0; i < outputLength; i++) target[i] = weights[i] > 1e-5 ? target[i] / weights[i] : 0;
  }
  return output;
}

export default function AudioTools({ mode }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<AudioBuffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Scegli un brano audio dal tuo dispositivo per iniziare.');
  const [sourceUrl, setSourceUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [master, setMaster] = useState(DEFAULT_MASTER);
  const [originalBpm, setOriginalBpm] = useState(120);
  const [targetBpm, setTargetBpm] = useState(100);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); if (resultUrl) URL.revokeObjectURL(resultUrl); }, [sourceUrl, resultUrl]);
  const loadFile = async (selected?: File) => {
    if (!selected) return;
    setBusy(true); setNotice('Sto aprendo il brano…'); setFile(selected); setResultUrl('');
    try {
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(await selected.arrayBuffer());
      await context.close(); setSource(decoded); setSourceUrl(URL.createObjectURL(selected));
      setNotice(`Brano pronto! ${decoded.numberOfChannels === 1 ? 'Mono' : 'Stereo'} · ${Math.round(decoded.duration)} secondi.`);
    } catch { setSource(null); setNotice('Non riesco a leggere questo audio. Prova con un file WAV, MP3, M4A, AAC o OGG.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const downloadResult = () => { if (!resultUrl || !file) return; const link = document.createElement('a'); link.href = resultUrl; link.download = `${file.name.replace(/\.[^.]+$/, '')}-${mode === 'bpm' ? `${targetBpm}bpm` : 'master'}.wav`; link.click(); };
  const processMaster = async () => {
    if (!source) return;
    setBusy(true); setNotice('Sto migliorando il suono…');
    try {
      const offline = new OfflineAudioContext(source.numberOfChannels, source.length, source.sampleRate);
      const player = offline.createBufferSource(); player.buffer = source;
      const bass = offline.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 120; bass.gain.value = master.bass;
      const treble = offline.createBiquadFilter(); treble.type = 'highshelf'; treble.frequency.value = 8000; treble.gain.value = master.treble;
      const compressor = offline.createDynamicsCompressor(); compressor.threshold.value = -36 + master.compression * .28; compressor.knee.value = 18; compressor.ratio.value = 1 + master.compression / 12; compressor.attack.value = .008; compressor.release.value = .18;
      const limiter = offline.createDynamicsCompressor(); limiter.threshold.value = -1.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = .003; limiter.release.value = .08;
      const volume = offline.createGain(); volume.gain.value = master.output / 100;
      player.connect(bass).connect(treble).connect(compressor).connect(limiter).connect(volume).connect(offline.destination); player.start();
      const rendered = await offline.startRendering(); const url = URL.createObjectURL(wavBlob(rendered)); setResultUrl(url); setNotice('Master pronto! Ascolta il risultato e scarica il WAV.');
    } catch { setNotice('C’è stato un problema durante il mastering. Riprova con un file più corto.'); }
    finally { setBusy(false); }
  };
  const processTempo = async () => {
    if (!source) return;
    const factor = originalBpm / targetBpm;
    if (factor < .5 || factor > 2) { setNotice('Per conservare un buon suono, scegli un BPM tra metà e il doppio del tempo originale.'); return; }
    setBusy(true); setNotice('Sto cambiando la velocità senza alzare o abbassare le note…');
    try { const stretched = stretchWsola(source, factor); const url = URL.createObjectURL(wavBlob(stretched)); setResultUrl(url); setNotice(`Fatto! ${originalBpm} → ${targetBpm} BPM. Le note mantengono la tonalità. Scarica il WAV per ascoltarlo.`); }
    catch { setNotice('Non è riuscito il cambio di tempo. Riprova con un brano più corto.'); }
    finally { setBusy(false); }
  };
  const isMaster = mode === 'mastering';
  return <main className="audio-page main-content">
    <section className="welcome"><div><span className="eyebrow">{isMaster ? 'DAI L’ULTIMA LUSTRATA ✨' : 'CAMBIA PASSO, NON LE NOTE 🎼'}</span><h1>{isMaster ? 'Mastering facile' : 'Cambia la velocità'}</h1><p>{isMaster ? 'Regola il suono del tuo brano e scaricalo.' : 'Il ritmo cambia, la tonalità resta uguale.'}</p></div><div className="music-doodle" aria-hidden="true">{isMaster ? '🎚️' : '⏱️'}</div></section>
    <section className="audio-card card"><div className="audio-card-heading"><div><h2><Music2 size={21}/>{file ? file.name : 'Scegli la tua musica'}</h2><p>Il brano viene elaborato qui: non viene caricato su internet.</p></div><input ref={inputRef} className="file-input" type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg" onChange={event => void loadFile(event.target.files?.[0])}/><button className="secondary-button upload-button" onClick={()=>inputRef.current?.click()} disabled={busy}><Upload size={19}/>{file?'Scegli un altro brano':'Scegli un brano'}</button></div>
      <div className="audio-notice" role="status">💡 {notice}</div>
      {sourceUrl&&<div className="audio-players"><label>BRANO ORIGINALE<audio controls src={sourceUrl}/></label>{resultUrl&&<label>IL TUO RISULTATO<audio controls src={resultUrl}/></label>}</div>}
    </section>
    {isMaster?<section className="tool-card card"><h2>🎛️ Regola il suono</h2><p>Muovi i cursori, poi premi “Crea il mio master”. Se non sai da dove iniziare, lascia i valori così.</p>
      <label className="tool-slider"><span><b>🎈 Bassi</b><small>Più corpo o meno rimbombo</small></span><input type="range" min="-9" max="9" value={master.bass} onChange={e=>setMaster({...master,bass:Number(e.target.value)})}/><output>{master.bass>0?'+':''}{master.bass} dB</output></label>
      <label className="tool-slider"><span><b>✨ Alti</b><small>Più brillante o più morbido</small></span><input type="range" min="-9" max="9" value={master.treble} onChange={e=>setMaster({...master,treble:Number(e.target.value)})}/><output>{master.treble>0?'+':''}{master.treble} dB</output></label>
      <label className="tool-slider"><span><b>🤝 Uniformità</b><small>Rende il volume più regolare</small></span><input type="range" min="0" max="100" value={master.compression} onChange={e=>setMaster({...master,compression:Number(e.target.value)})}/><output>{master.compression}%</output></label>
      <label className="tool-slider"><span><b>🔊 Volume finale</b><small>Limita i picchi per evitare distorsioni</small></span><input type="range" min="30" max="100" value={master.output} onChange={e=>setMaster({...master,output:Number(e.target.value)})}/><output>{master.output}%</output></label>
      <div className="tool-actions"><button className="play-button" disabled={!source||busy} onClick={()=>void processMaster()}><WandSparkles size={21}/><span>{busy?'LAVORO…':'CREA IL MIO MASTER'}</span></button>{resultUrl&&<button className="secondary-button" onClick={downloadResult}><Download size={19}/> Scarica WAV</button>}</div>
    </section>:<section className="tool-card card"><h2>⏱️ Scegli il nuovo tempo</h2><p>Indica quanti battiti al minuto ha ora il brano e quanti ne vuoi. L’algoritmo cerca di mantenere le note alla stessa altezza.</p>
      <div className="bpm-controls"><label><span>IL BRANO È A</span><div><input type="number" min="40" max="240" value={originalBpm} onChange={e=>setOriginalBpm(Math.max(40,Math.min(240,Number(e.target.value)||40)))}/><b>BPM</b></div></label><span className="bpm-arrow">➜</span><label><span>LO VOGLIO A</span><div><input type="number" min="40" max="240" value={targetBpm} onChange={e=>setTargetBpm(Math.max(40,Math.min(240,Number(e.target.value)||40)))}/><b>BPM</b></div></label></div>
      <div className="tempo-presets"><span>Prova:</span>{[80,100,120,140].map(value=><button key={value} onClick={()=>setTargetBpm(value)}>{value} BPM</button>)}</div>
      <div className="pitch-note">🎵 La funzione usa l’elaborazione audio WSOLA per cambiare la durata senza cambiare intenzionalmente l’intonazione. Risultati migliori con variazioni moderate e brani musicali non troppo lunghi.</div>
      <div className="tool-actions"><button className="play-button" disabled={!source||busy} onClick={()=>void processTempo()}><WandSparkles size={21}/><span>{busy?'LAVORO…':'CAMBIA BPM'}</span></button>{resultUrl&&<button className="secondary-button" onClick={downloadResult}><Download size={19}/> Scarica WAV</button>}</div>
    </section>}
    <div className="tip-card"><span>🔒</span><p><strong>La tua musica resta tua.</strong> I file non lasciano il browser. L’elaborazione avviene sul tuo dispositivo e puoi scaricare il risultato in formato WAV.</p></div>
  </main>;
}
