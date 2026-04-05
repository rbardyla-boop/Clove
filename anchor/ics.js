/**
 * ODA-ICS.JS — RFC 5545 calendar file generation + download
 * ───────────────────────────────────────────────────────────
 * No external calls. All in-memory. Fail-open on export error.
 *
 * iOS path:  data: URI → native Calendar.app handles import
 * Desktop:   Blob URL  → browser download dialog
 * Android:   Blob URL  → Google Calendar picks it up
 *
 * Exposes:
 *   window.odaGenerateICS(anchor) → string
 *   window.odaDownloadICS(anchor) → boolean (true = downloaded ok)
 */
(function (g) {
  'use strict';

  // ── RFC 5545 DATE FORMAT ─────────────────────────────────────────────────
  function toICSDate(ms) {
    // Produces: 20260405T143000Z
    return new Date(ms)
      .toISOString()
      .replace(/[-:.]/g, '')
      .slice(0, 15) + 'Z';
  }

  // ── RFC 5545 VALUE ESCAPING ──────────────────────────────────────────────
  // Per §3.3.11: backslash, semicolon, comma must be escaped.
  // Actual newline chars in text → \n (two-char ICS sequence).
  function escVal(s) {
    return String(s || '')
      .replace(/\\/g,   '\\\\')  // backslash first (must be first)
      .replace(/;/g,    '\\;')
      .replace(/,/g,    '\\,')
      .replace(/\r?\n/g, '\\n'); // real newlines → ICS \n sequence
  }

  // ── ICS GENERATION ───────────────────────────────────────────────────────
  g.odaGenerateICS = function (anchor) {
    var endMs   = anchor.scheduledFor + 15 * 60 * 1000;
    var uid     = 'oda-' + anchor.anchoredAt + '@clovelearn.io';
    var stLbl   = (g.STATES && g.STATES[anchor.state])
      ? g.STATES[anchor.state].lbl
      : String(anchor.state || '').toUpperCase();

    // Build DESCRIPTION as an array of lines, join with ICS \n sequences.
    // escVal is applied per-line so backslashes in directiveText can't
    // corrupt the separator.
    var descLines = [
      anchor.directiveText,
      '',
      'ACTION: ' + (anchor.actionText || ''),
      '',
      'FIELD: ' + stLbl,
      "CloveLearn Operator's Deck"
    ];
    var description = descLines.map(escVal).join('\\n');
    // The join produces literal backslash-n sequences (2 chars each),
    // which ICS parsers interpret as visual line breaks. ✓

    var summary = 'EXECUTE: ' + escVal(anchor.directiveText.slice(0, 50));

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CloveLearn//OperatorsDeck//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:'         + uid,
      'DTSTAMP:'     + toICSDate(Date.now()),
      'DTSTART:'     + toICSDate(anchor.scheduledFor),
      'DTEND:'       + toICSDate(endMs),
      'SUMMARY:'     + summary,
      'DESCRIPTION:' + description,
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Operator: execute your field directive.',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n'); // RFC 5545 mandates CRLF line endings
  };

  // ── DOWNLOAD ─────────────────────────────────────────────────────────────
  g.odaDownloadICS = function (anchor) {
    try {
      var content  = g.odaGenerateICS(anchor);
      var filename = 'clovelearn_directive.ics';
      var isIOS    = /iP(ad|hone|od)/i.test(navigator.userAgent);

      if (isIOS) {
        // iOS Safari: data: URI with download attr prompts Calendar import
        // or saves to Files app — both outcomes are acceptable.
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(content);
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      }

      // Desktop + Android: Blob URL is CSP-safe (blob: is same-origin context)
      var blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a2   = document.createElement('a');
      a2.style.display = 'none';
      a2.href = url;
      a2.setAttribute('download', filename);
      document.body.appendChild(a2);
      a2.click();
      document.body.removeChild(a2);
      // Revoke after a tick so the browser can process the click
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      return true;

    } catch (e) {
      console.warn('[ODA] ICS download failed:', e);
      return false; // caller surfaces fallback message
    }
  };

})(window);
