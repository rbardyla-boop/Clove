CREATE TABLE aggregate_daily (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  surface TEXT NOT NULL,
  device TEXT NOT NULL,
  return_bucket TEXT NOT NULL,
  referrer_group TEXT NOT NULL,
  build TEXT NOT NULL,
  variant TEXT NOT NULL,
  detail TEXT NOT NULL,
  diagnostic TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (
    day, event, surface, device, return_bucket,
    referrer_group, build, variant, detail, diagnostic
  )
);

CREATE TABLE feedback_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  category TEXT NOT NULL,
  surface TEXT NOT NULL,
  device TEXT NOT NULL,
  note TEXT NOT NULL,
  diagnostic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'resolved'))
);

CREATE INDEX feedback_notes_day_idx ON feedback_notes(day);
CREATE INDEX feedback_notes_status_idx ON feedback_notes(status, day);
