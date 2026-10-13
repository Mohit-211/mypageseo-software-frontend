# Note for the customer-app Claude: AI assist (Phase 22, 2026-10-13)

Paste this into the customer frontend session (app.mypageseo.com). Shapes: the backend repo's `docs/API.md` "AI assist (Phase 22)"; routes: `docs/ENDPOINTS.md` #226–#227.

---

Three AI improvements, decided by Mohit. Live after the next deploy. All AI routes keep the usual AI errors:
- **503** `ai_not_configured` → hide the AI buttons
- **503** `ai_budget_reached` → "AI is paused for today"
- **502** `ai_failed` → "Try again"; nothing was charged
- **402** `insufficient_tokens` → buy tokens; never for keyword suggestions, which are free

## 1. Keyword suggestions while setting up a location (new)

**Where:** the Keywords step of location setup, and the location's keyword settings.

**Call:** `POST /locations/:id/keywords/suggest` (body `{}`; `{ "more": true }` for **Suggest more**).
- Free: no tokens, no cost shown.
- 20 runs per location per day: **429** `suggestion_limit_reached` → hide "Suggest more" ("That's all for today").
- Also hide "Suggest more" when the answer's `can_suggest_more` is false.

**Answer:** `{ suggestions: [{ keyword, reason, source }], website_used, website_note, can_suggest_more, runs_left_today }`.
- **List:** show at least the 7+ suggestions as tickable chips or rows, each with its `reason` as small text.
- **Source label** from `source`: "From your website" / "From your Google profile" / "From your category".
- **"Add selected"** adds them to the keyword list; save with the existing `PUT /locations/:id/tracking { keywords }`.
- **Website note:**
  - `website_note: "no_website"`: "No website on your profile; suggestions are based on your Google profile."
  - `website_note: "unreachable"` or `"not_html"`: "We couldn't read your website; suggestions are based on your Google profile."
- **Run it once automatically** when the Keywords step opens with no keywords yet, and show a progress state (a few seconds).

**Duplicates, required (Mohit):** treat keywords as the same when they match **ignoring case and spacing**: *cleaner* = *Cleaner* = *CLEANER* = *cleaner&nbsp;&nbsp;*. Compare `keyword.trim().replace(/\s+/g, " ").toLowerCase()`.
- **When the user types** a keyword that's already in the list (by that rule), don't add it a second time; show "Already in your list".
- **When adding suggestions:** skip any that match a keyword already in the list.
- **Never** let the list hold two entries that only differ in case or spacing.
- The backend also drops such duplicates on save and never suggests a tracked keyword, but the UI must not show them in the first place.
- Keep the keyword limit as before (20 per location).

## 2. Review replies (no UI change needed)

AI reply drafts are now longer (2–4 sentences, 40–100 words), weave in the location's keywords where they fit, and are written in the reviewer's own language. Star-only reviews are answered in the location's language.

Drafts made earlier stay as they are until the user clicks **Regenerate**; mention that once in a small hint on the Reputation page if you have room. Remove any copy that says replies are short.

## 3. AI posts: ideas → draft → image → redo (new flow)

**Step 1 – ideas:** a **"Suggest post ideas"** button.
- **Call:** `POST /locations/:id/posts/ai-topics { count?: 5–8 (default 6), focus? }`, costing `post_topics` tokens.
- **Cost on the button:** read it from `GET /billing` → `tokens.ai_costs.post_topics`.
- **Focus:** an optional field ("e.g. holiday specials").
- **Answer:** `{ topics: [{ topic, angle, type, keywords, why }] }`. Show them as cards: the topic as the title, the angle below, a type badge (event / offer), keyword chips, and `why` in small text.

**Step 2 – draft:** picking a card opens the editor and calls `POST /posts/ai-draft` with:
- `topic`
- `type` (from the card)
- `keywords`: the card's keywords, as editable chips. Users may add or remove; at most 3, chosen from the tracked keywords; same case-insensitive duplicate rule.
- `tone`, `variants` as today

The text weaves in each chosen keyword once.

**Step 3 – image:** the existing **"Create image"** with `prompt_hint` = the chosen draft's `image_idea` (or the user's text), plus the style picker.

**Redo:**
- **Text:** call `ai-draft` again with the same fields plus `avoid: [the summaries currently shown]`, so the new variants are clearly different. It costs `post_draft` tokens, so show the cost.
- **Image:** call `ai-image` again, or use `ai-regenerate { image: true }` on a saved post.

**Writing style:** the AI learns the voice from this location's last 20 posts, and from the same organization's other locations when it has few. Nothing to do in the UI. If you want a hint: "Drafts match the style of your previous posts."

**Google's post rules (Mohit, 2026-10-13; backend `docs/GBP_POST_GUIDELINES.md`):** the AI follows them and the backend checks its output. In the UI:
- **Drafts:** each draft has `compliant`, `duplicate_risk` and `warnings`.
  - On a `compliant: false` draft, show a clear note: "This draft may break Google's post rules: <warning messages>. Edit it or Redo."
  - On `duplicate_risk: true`: "Too close to an earlier post; Google treats repeats as spam."
  - Don't block saving a draft; the warnings are the guidance.
- **Buttons:** drafts now always carry a `cta_type` (except offers). Pre-select it and ask for the URL when it isn't Call.
- **Editor warnings** (every post, live from `POST /posts/validate`): new codes `repeated_punctuation`, `special_characters`, `bold_claim`. Show them like the existing ones.
- **Hotels and lodging:** a new blocking issue, `offer_not_allowed_for_lodging`. Hide or disable the "Offer" type for those locations (the issue comes back from validate if chosen), and suggest an update or event post.
- **Images:**
  - **Style picker:** show the photo styles first. Mark Flat illustration / 3D render / Watercolour as "may look like stock art; Google prefers real photos".
  - **Real photos:** near "Create image", add a gentle nudge: "Real photos of your business work best on Google; upload your own when you can."
- **Auto-posts:** a slot can now fail with `last_error.code: "ai_not_compliant"`. Show it as "The AI draft didn't meet Google's post rules; we'll try again next hour (no tokens were used)." 

## How to report back

One line per section (1–3): OK / changed (what) / question.
