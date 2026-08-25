Look at this image, generated for a Jewish organization. Check it against 
each item below and respond with ONLY valid JSON, no other text:

{
  "crosses_or_church_imagery": boolean,
  "women_not_tznius": boolean,
  "men_missing_yarmulke": boolean,
  "boys_missing_kippah_or_peyos": boolean,
  "inappropriate_physical_contact": boolean,
  "shofar_wrong_shape": boolean,
  "menorah_wrong_branch_count": boolean,
  "wrong_menorah_for_occasion": boolean,
  "etrog_looks_like_lemon": boolean,
  "chametz_visible_on_pesach": boolean,
  "shabbat_violation_depicted": boolean,
  "wrong_greeting_for_occasion_type": boolean,
  "mixed_gender_seating_or_dancing": boolean,
  "cross_gender_physical_contact": boolean,
  "hebrew_text_garbled_backwards_or_repeated": boolean,
  "invented_or_gibberish_hebrew": boolean,
  "mismatched_tone_for_occasion": boolean,
  "other_issue": string or null,
  "passes": boolean
}

Definitions for judgment calls:
- women_not_tznius: sleeves don't reach the elbow, hemline is above the 
  knee, neckline shows the collarbone, or clothing is tight/form-fitting.
- boys_missing_kippah_or_peyos: applies only to boys who appear age 3 or 
  older.
- shabbat_violation_depicted: a phone, car, stove/match-lighting, or 
  writing shown in a scene clearly meant to depict Shabbat.
- wrong_menorah_for_occasion: a 7-branch menorah shown for Chanukah 
  (should be 9-branch), or vice versa for a non-Chanukah context.
- hebrew_text_garbled_backwards_or_repeated: letters malformed or 
  reversed, OR any word/phrase appearing more than once when it should 
  appear only once.
- mismatched_tone_for_occasion: e.g. bright/festive imagery for Yom 
  Kippur or a memorial event, or somber/muted imagery for a joyful 
  holiday like Purim or Chanukah.
- Only evaluate a field if it's relevant to what's shown — false means 
  "not a problem," not "not applicable." Don't flag chametz_visible_on_pesach 
  as true just because no Pesach items are present at all.
- cross_gender_physical_contact: any physical contact (touching, 
  hand-holding, embracing, dancing together) shown between an adult man 
  and an adult woman, regardless of apparent relationship or marital 
  status — flag it every time it appears.

Set "passes" to false if ANY boolean issue field above is true, or if 
"other_issue" is not null. Be specific in "other_issue" if you notice a 
problem not covered by the listed fields (use null when there is none) — 
this is a genuine content review for a real client, so flag anything 
that looks wrong even if it doesn't fit a category above.