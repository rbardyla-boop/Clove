// ─── OPERATOR'S DECK — VOICE ENGINE ────────────────────────────────────────
// Offline speech-to-text. Device-gated. Opt-in only.
// Coordinates: device check → worker init → record → transcribe → insert.
// Zero tracking. Zero cloud. Audio processed locally in WASM.
// ────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  var worker = null;
  var isReady = false;
  var isLoading = false;
  var isRecording = false;
  var isProcessing = false;
  var currentCb = null;
  var mediaStream = null;
  var recorder = null;
  var recordTimer = null;
  var recordStart = 0;
  var recordDuration = 0;

  // ── GATE 1: Device capability check ──
  // Returns false on low-memory, no-mic, or no-module-worker devices.
  // Those users never see the mic button. Zero breakage.
  window.voiceCapable = function() {
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    if (typeof MediaRecorder === 'undefined') return false;
    if (typeof Worker === 'undefined') return false;
    return true;
  };

  // ── Voice enabled state (reads od3 blob) ──
  window.voiceIsOn = function() {
    try { return !!(JSON.parse(localStorage.getItem('od3'))||{}).ve; }
    catch(e) { return false; }
  };

  // ── Model state helpers ──
  window.voiceIsReady = function() { return isReady; };
  window.voiceIsLoading = function() { return isLoading; };
  window.voiceIsRecording = function() { return isRecording; };
  window.voiceIsProcessing = function() { return isProcessing; };

  // ── Init: spin up worker and load model ──
  // progressFn(pct, file) — called during model download
  // readyFn() — called when model is ready
  // errorFn(msg) — called on failure
  window.voiceInit = function(progressFn, readyFn, errorFn) {
    if (isReady) { if (readyFn) readyFn(); return; }
    if (isLoading) return;
    isLoading = true;

    // Fetch worker as blob so it inherits the page's CSP (wasm-unsafe-eval)
    // rather than running under its own cached response headers.
    fetch('stt-worker.js?v=7')
      .then(function(r) { return r.blob(); })
      .then(function(blob) {
        var url = URL.createObjectURL(blob);
        try {
          worker = new Worker(url, { type: 'module' });
        } catch(e) {
          URL.revokeObjectURL(url);
          isLoading = false;
          if (errorFn) errorFn('Cannot start voice engine: ' + e.message);
          return;
        }
        URL.revokeObjectURL(url);

        worker.onmessage = function(e) {
          var m = e.data;
          if (m.type === 'progress' && progressFn) progressFn(m.data.pct, m.data.file);
          if (m.type === 'ready') { console.log('[VOICE] Engine ready'); isReady = true; isLoading = false; if (readyFn) readyFn(); }
          if (m.type === 'status') { console.log('[VOICE] Worker status:', m.data); }
          if (m.type === 'error') { console.error('[VOICE] Worker error:', m.data); isLoading = false; isProcessing = false; if (errorFn) errorFn(m.data); if (currentCb) { currentCb(m.data, null); currentCb = null; } }
          if (m.type === 'result') { console.log('[VOICE] Whisper result:', JSON.stringify(m.data)); isProcessing = false; if (currentCb) { currentCb(null, m.data); currentCb = null; } }
        };

        worker.onerror = function(e) {
          isLoading = false;
          if (errorFn) errorFn('Worker crashed: ' + (e.message||'unknown'));
        };

        worker.postMessage({ type: 'init' });
      })
      .catch(function(e) {
        isLoading = false;
        if (errorFn) errorFn('Cannot start voice engine: ' + e.message);
      });
  };

  // ── Record audio and transcribe ──
  // seconds: 3-30 (default 10)
  // callback: function(err, text)
  // tickFn: function(remaining) — called every second during recording
  window.voiceRecord = function(seconds, callback, tickFn) {
    if (!isReady) { callback('Voice engine not loaded. Tap mic again.'); return; }
    if (isRecording || isProcessing) { callback('Already in progress.'); return; }

    seconds = Math.min(Math.max(seconds||10, 3), 30);
    recordDuration = seconds;
    currentCb = callback;
    isRecording = true;
    recordStart = Date.now();

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        mediaStream = stream;
        var chunks = [];
        var mime = getMime();
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

        recorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = function() {
          isRecording = false;
          isProcessing = true;
          clearInterval(recordTimer);
          if (mediaStream) { mediaStream.getTracks().forEach(function(t){t.stop()}); mediaStream = null; }

          var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          console.log('[VOICE] Recording blob:', blob.size, 'bytes,', blob.type);

          if (blob.size < 1000) {
            isProcessing = false;
            if (currentCb) { currentCb('Recording too short or empty (' + blob.size + ' bytes)', null); currentCb = null; }
            return;
          }

          var reader = new FileReader();
          reader.onloadend = function() {
            console.log('[VOICE] ArrayBuffer size:', reader.result.byteLength);
            var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtx.decodeAudioData(reader.result, function(audioBuffer) {
              console.log('[VOICE] Decoded: duration=' + audioBuffer.duration.toFixed(2) + 's, sampleRate=' + audioBuffer.sampleRate + ', channels=' + audioBuffer.numberOfChannels);

              var raw = audioBuffer.getChannelData(0);
              var maxVal = 0;
              for (var i = 0; i < raw.length; i++) { var abs = Math.abs(raw[i]); if (abs > maxVal) maxVal = abs; }
              console.log('[VOICE] Raw audio peak amplitude:', maxVal.toFixed(6), maxVal < 0.001 ? '⚠ SILENT — Brave Shields may be blocking mic audio' : '✓ Audio detected');

              if (maxVal < 0.001) {
                isProcessing = false;
                audioCtx.close();
                if (currentCb) { currentCb('Mic recorded silence. If using Brave, disable Shields for this site (click lion icon → Shields Down).', null); currentCb = null; }
                return;
              }

              var TARGET_SR = 16000;
              var numSamples = Math.round(audioBuffer.duration * TARGET_SR);
              if (numSamples < 100) {
                isProcessing = false;
                audioCtx.close();
                if (currentCb) { currentCb(null, ''); currentCb = null; }
                return;
              }
              var offCtx = new OfflineAudioContext(1, numSamples, TARGET_SR);
              var source = offCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(offCtx.destination);
              source.start(0);
              offCtx.startRendering().then(function(resampled) {
                var float32 = resampled.getChannelData(0);
                console.log('[VOICE] Resampled: ' + float32.length + ' samples at 16kHz (' + (float32.length/16000).toFixed(2) + 's)');
                var rMax = 0;
                for (var j = 0; j < float32.length; j++) { var a = Math.abs(float32[j]); if (a > rMax) rMax = a; }
                console.log('[VOICE] Resampled peak amplitude:', rMax.toFixed(6), rMax < 0.001 ? '⚠ SILENT AFTER RESAMPLE' : '✓ Audio intact');

                var copy = new Float32Array(float32.length);
                copy.set(float32);
                worker.postMessage({ type: 'transcribe', data: { audio: copy } }, [copy.buffer]);
                audioCtx.close();
              }).catch(function(err) {
                isProcessing = false;
                audioCtx.close();
                if (currentCb) { currentCb('Resample failed: ' + (err.message||'unknown'), null); currentCb = null; }
              });
            }, function(err) {
              isProcessing = false;
              audioCtx.close();
              if (currentCb) { currentCb('Audio decode failed: ' + (err||'unknown'), null); currentCb = null; }
            });
          };
          reader.readAsArrayBuffer(blob);
        };

        recorder.start();

        // Countdown tick
        if (tickFn) {
          recordTimer = setInterval(function() {
            var elapsed = Math.floor((Date.now() - recordStart) / 1000);
            var remaining = seconds - elapsed;
            if (remaining >= 0) tickFn(remaining);
          }, 500);
        }

        // Auto-stop after duration
        setTimeout(function() {
          if (recorder && recorder.state === 'recording') recorder.stop();
        }, seconds * 1000);
      })
      .catch(function(err) {
        isRecording = false;
        callback('Mic blocked: ' + err.message);
      });
  };

  // ── Stop recording early (user taps again) ──
  window.voiceStop = function() {
    if (recorder && recorder.state === 'recording') recorder.stop();
  };

  // ── Dispose worker (cleanup) ──
  window.voiceDispose = function() {
    if (worker) {
      try { worker.postMessage({ type: 'dispose' }); } catch(e) {}
      setTimeout(function() { try { worker.terminate(); } catch(e) {} worker = null; }, 500);
    }
    isReady = false;
    isLoading = false;
    isRecording = false;
    isProcessing = false;
  };

  // ── Mic button tap handler (called from index.html) ──
  // targetId: id of the textarea to insert text into
  window.voiceMicTap = function(targetId) {
    var btn = document.getElementById('voiceBtn_' + targetId);
    var ta = document.getElementById(targetId);
    if (!ta) return;

    // State: not loaded yet → consent check then init
    if (!isReady && !isLoading) {
      if (!localStorage.getItem('od_voice_consent')) {
        var ok = window.confirm(
          'VOICE TRANSCRIPTION — ONE-TIME NOTICE\n\n' +
          'First use downloads the Whisper speech model (~75 MB) from HuggingFace.\n' +
          'The model is cached locally after that. No audio ever leaves your device.\n\n' +
          'Proceed with download?'
        );
        if (!ok) return;
        localStorage.setItem('od_voice_consent', '1');
      }
      if (btn) { btn.textContent = 'LOADING ENGINE...'; btn.style.color = 'var(--gld)'; }
      voiceInit(
        function(pct) { if (btn) btn.textContent = 'DOWNLOADING ' + pct + '%'; },
        function() {
          if (btn) { btn.textContent = '\u25C9 VOICE LOG'; btn.style.color = ''; }
          showVoiceToast('VOICE ENGINE READY \u2014 TAP MIC AGAIN');
        },
        function(err) {
          if (btn) { btn.textContent = '\u25C9 VOICE LOG'; btn.style.color = ''; }
          showVoiceToast('VOICE FAILED: ' + (err||'unknown').substring(0, 60));
        }
      );
      return;
    }

    if (isLoading) { showVoiceToast('STILL LOADING \u2014 PLEASE WAIT'); return; }
    if (isProcessing) { showVoiceToast('PROCESSING \u2014 PLEASE WAIT'); return; }

    // State: recording → stop early
    if (isRecording) {
      voiceStop();
      return;
    }

    // State: ready → start recording
    if (btn) { btn.textContent = 'RECORDING... TAP TO STOP'; btn.style.color = 'var(--red)'; btn.style.animation = 'pulse 1s infinite'; }
    voiceRecord(10, function(err, text) {
      if (btn) { btn.textContent = '\u25C9 VOICE LOG'; btn.style.color = ''; btn.style.animation = ''; }
      if (err) { showVoiceToast('ERROR: ' + (err||'').substring(0, 60)); return; }
      if (text) {
        var current = ta.value;
        ta.value = current ? (current + '\n' + text) : text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        showVoiceToast('TRANSCRIBED \u2014 ' + text.split(' ').length + ' WORDS');
      } else {
        showVoiceToast('NO SPEECH DETECTED \u2014 TRY AGAIN');
      }
    }, function(remaining) {
      if (btn) btn.textContent = 'RECORDING ' + remaining + 's \u2014 TAP TO STOP';
    });
  };

  // ── Toast (reuses existing showToast if available, otherwise standalone) ──
  function showVoiceToast(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:10px 24px;border-radius:10px;font-size:11px;font-weight:700;font-family:monospace;letter-spacing:1.5px;z-index:100;opacity:1;transition:opacity .3s';
    document.body.appendChild(t);
    setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 400); }, 2000);
  }

  // ── MIME type detection ──
  function getMime() {
    var types = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return '';
  }

})();
