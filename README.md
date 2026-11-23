# Nexora DAW

Nexora DAW is an original, local-first music-making prototype. It is not affiliated with any commercial DAW and contains no third-party samples or proprietary plugins.

## Features

- Beginner-friendly Italian interface and a 16-step drum/synth sequencer.
- Browser-based synthesized sounds, adjustable tempo, mute and per-track volume.
- Automatic project saving in the browser; open/download `.nexora.json` project files.
- **Mastering page:** import an audio file, adjust bass/treble, compression and output level, preview it, then export a stereo/mono WAV.
- **Tempo page:** import a song, enter its original and target BPM, and export a WSOLA time-stretched WAV intended to preserve pitch.
- Audio files are processed locally in your browser and are not uploaded.

Supported audio formats depend on your browser. WAV is recommended for best compatibility. Long/high-resolution audio files can use considerable memory; close other tabs if processing fails. Tempo changes work best when the new BPM is within half to twice the original tempo; extreme changes may sound less natural. Mastering controls are simple educational tools, not a substitute for professional mastering.

## Run locally

Requires Node.js 20 or newer and npm.

```bash
npm install
npm run build
npm run dev
```

Open the local address printed by Vite (usually `http://localhost:5173`). You can also deploy the generated `dist/` folder to a static web host. For GitHub Pages, configure the site to deploy the `dist` artifact with GitHub Actions; the repository is private, so hosting visibility/access depends on your GitHub plan and settings.

## Limitations

This browser MVP is not a full native DAW: it does not yet support multitrack audio recording, MIDI devices, plugin hosting, or native desktop packaging. The tempo feature uses WSOLA waveform similarity and can introduce artifacts, especially for strong transients, complex polyphonic material, very short files, or extreme tempo changes. Always audition and compare the exported result.
