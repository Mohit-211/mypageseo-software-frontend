# Google Business Profile post guidelines (as enforced)

Source: Mohit's compiled summary of Google's post content and behaviour rules (2026-10-13). Breaking them can get a post rejected or the whole profile flagged or suspended.

The AI follows every rule below through its instructions (`src/services/posts/aiPrompts.ts`). The backend also checks what the AI wrote, where a rule can be checked mechanically (`src/posts/guidelines.ts`, `src/posts/warnings.ts`). Editor warnings use the same checks for posts people write themselves.

## Rules and how each is applied

| Rule | AI instruction | Checked by the backend |
|---|---|---|
| No phone numbers in the text (use the Call button) | yes | warning `phone_in_text`; AI drafts retried, auto-posts refused |
| No links or web addresses in the text (use a button) | yes | warning `link_in_text`; same |
| No gimmicky formatting: capitals, "!!!", decorative symbols, emoji | yes (no emoji in AI text) | warnings `all_caps` (incl. 3+ shouting words; acronyms allowed), `repeated_punctuation`, `special_characters`; AI drafts also refused with any emoji |
| No duplicate content across locations or weeks | yes (recent posts and other locations' posts are passed as "do not copy") | AI drafts compared with the location's last 20 posts and the organization's other locations' recent posts (3-word phrase overlap ≥ 35 %) → `duplicate_risk`; retried; auto-posts refused |
| No misleading claims (guarantees, "instant", "#1", "100%", ranking / lead promises) | yes; extra rule for marketing agencies | warning `bold_claim`; AI drafts retried, auto-posts refused; such post ideas dropped |
| No invented prices, offers or facts | yes | – |
| Hotels / lodging: no Offer posts, no prices or deals | yes | Offer posts can't be scheduled or published (`offer_not_allowed_for_lodging`); post ideas never `offer`; AI drafts with prices / % / deal words refused |
| Regulated products (alcohol, tobacco, gambling, financial services, pharmaceuticals, medical devices): don't showcase or promote them | yes (sectors detected from the business categories) | images told not to show them |
| Family-friendly content | yes | images told to be family-friendly |
| Images: authentic, no stock look, no text overlays, logos or watermarks, sharp | yes | the automatic image rotation uses realistic photo styles only; every image prompt forbids text, logos, watermarks, generic charts / arrows and staged office scenes |
| A clear action button | yes | AI drafts always suggest one (Learn more, or Call without a website), except offers |
| 100–300 words, value first, locally relevant | yes (100–220 words to stay under Google's 1,500 characters; first sentence under 150 characters; tied to the city) | – |

## How AI drafts are checked

1. The AI writes the draft(s) under the rules above.
2. Each draft is checked. If any has a hard problem (phone, link, capitals, repeated punctuation, symbols, a claim, emoji, a copy of an earlier post, a lodging price or deal), the AI gets **one free retry** that names the problems.
3. **Editor ("Write with AI"):** clean drafts are returned. If none is clean, the drafts come back with `compliant: false` and their `warnings`, and the user edits or redoes.
4. **Auto-posts:** a draft that still fails is not posted. The tokens are refunded and the slot is retried on the next hourly run (`ai_not_compliant`).

**Real photos:** AI images are generated, not photos of the business. Google prefers real photos, so encourage users to upload their own where they can.
