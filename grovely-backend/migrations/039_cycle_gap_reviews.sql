CREATE TABLE cycle_gap_reviews (
  earlier_cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  later_cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  gap_days INTEGER NOT NULL CHECK(gap_days > 0),
  review_state TEXT NOT NULL CHECK(review_state IN ('confirmed', 'excluded')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (earlier_cycle_id, later_cycle_id)
);
