-- Track what the app predicted when a cycle actually started (for accuracy feedback loop)
ALTER TABLE cycles ADD COLUMN predicted_start_date DATE;

-- Track when ovulation actually occurred (for personalised luteal phase)
ALTER TABLE cycles ADD COLUMN ovulation_date DATE;
