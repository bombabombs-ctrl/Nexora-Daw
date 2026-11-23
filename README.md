# Nexora DAW

Nexora DAW is an original, local-first digital audio workstation prototype. It is not affiliated with FL Studio and does not include proprietary code, assets, or plugins.

## Current prototype

- React + TypeScript + Vite desktop UI foundation
- Browser Web Audio preview engine
- 16-step pattern sequencer
- Play/stop controls, tempo, track selection, mute and volume
- Piano-roll-style note grid
- Mixer and project panels

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. This first milestone runs in a browser so the audio workflow can be tested without native dependencies. Tauri packaging and native VST3 hosting are planned follow-up milestones.

## Roadmap

1. Desktop shell with Tauri.
2. Persistent project files and undo/redo.
3. MIDI device input and MIDI export.
4. Native audio recording and WAV rendering.
5. Rust audio engine and optional VST3 hosting for plugins installed by the user, subject to each plugin's license.

Never commit third-party plugins, plugin binaries, credentials, or copyrighted samples without redistribution rights.
