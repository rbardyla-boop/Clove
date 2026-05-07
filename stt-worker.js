import { pipeline, env } from '/semantic/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.onmessage = async function(e) {
  const { type, data } = e.data;

  if (type === 'init') {
    if (transcriber) { self.postMessage({ type: 'ready' }); return; }
    try {
      self.postMessage({ type: 'status', data: 'loading' });
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        quantized: true,
        progress_callback: function(p) {
          if (p.status === 'progress' && p.progress !== undefined) {
            self.postMessage({ type: 'progress', data: { pct: Math.round(p.progress), file: p.file || '' } });
          }
        }
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', data: err.message || 'Failed to load voice engine' });
    }
  }

  if (type === 'transcribe') {
    if (!transcriber) { self.postMessage({ type: 'error', data: 'Engine not loaded' }); return; }
    try {
      self.postMessage({ type: 'status', data: 'transcribing' });
      var audio = data.audio;
      if (audio instanceof ArrayBuffer) { audio = new Float32Array(audio); }
      self.postMessage({ type: 'status', data: 'running whisper on ' + audio.length + ' samples' });
      var result = await transcriber(audio);
      var text = result && result.text ? result.text.trim() : '';
      self.postMessage({ type: 'result', data: text });
    } catch (err) {
      self.postMessage({ type: 'error', data: err.message || 'Transcription failed' });
    }
  }

  if (type === 'dispose') {
    if (transcriber) {
      try { await transcriber.dispose(); } catch(e) {}
      transcriber = null;
    }
    self.postMessage({ type: 'disposed' });
  }
};
