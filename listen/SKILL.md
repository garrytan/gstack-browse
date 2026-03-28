# /listen — System Audio Capture

Capture system audio from Linux environments using PipeWire or PulseAudio. Auto-detects the active audio backend and records to WAV.

gstack has eyes (`/browse`). This gives it ears.

## Usage

```
/listen [duration_seconds] [output_file]
```

**Examples:**
```
/listen              # 5 seconds -> captured.wav
/listen 10           # 10 seconds -> captured.wav
/listen 5 meeting.wav
```

## How it works

1. Detects audio backend: PipeWire (`pw-record`) or PulseAudio (`parec`)
2. For PulseAudio: auto-discovers the monitor source
3. Captures system audio for the specified duration
4. Saves as WAV file

## Requirements

- Linux with PipeWire or PulseAudio
- `pw-record` (PipeWire) or `parec` (PulseAudio)
- Python 3.6+

## Use cases

- ** app QA**: Capture app audio output for automated verification
- **Meeting capture**: Record system audio during calls
- **CI audio testing**: Validate audio output in automated pipelines

## Tested on

- Ubuntu 24.04 LTS — PipeWire 1.0.5 (real hardware)
- WSL2 Ubuntu 24.04 — PulseAudio (WSLg)
