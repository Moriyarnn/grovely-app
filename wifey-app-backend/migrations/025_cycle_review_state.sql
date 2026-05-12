ALTER TABLE cycles ADD COLUMN review_state TEXT DEFAULT NULL CHECK(review_state IN ('confirmed', 'excluded'));
