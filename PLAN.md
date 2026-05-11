# Greenscape Quotes Agent — Plan

## Goal
Employees record/upload a site-walk audio memo. App transcribes it, then an LLM agent drafts a full landscaping/hardscaping quote (sections, line items, labor, materials, scope, terms) by pulling pricing from a synced catalog (originally a 200+ row Google Sheet). Employees review/edit in a web view and export to PDF.

## Decisions locked in
- **Stack:** Next.js (App Router, TS) + Supabase (Auth, Postgres, Storage).
- **Client:** Mobile-friendly PWA. Audio recorded in-browser via `MediaRecorder`.
- **Pricing catalog:** Synced from Google Sheets → Postgres on a schedule. Agent queries DB, not raw sheet.
- **Quote output:** Full structured quote (sections + scope narrative + notes + terms) → editable web view → PDF export.
- **Tenancy:** Single company, multiple employees with roles (admin / estimator).
- **Transcription:** OpenRouter. Settings page lists only transcription-capable models, fetched from `https://openrouter.ai/api/v1/models?output_modalities=transcription`.
- **Agent provider:** OpenRouter. Settings page lists text-output chat models (with tool-calling support).

## Architecture (high level)

```
[PWA recorder]
     │  upload .webm/.m4a
     ▼
[Supabase Storage]──► row in `recordings` table (status: uploaded)
     │
     ▼
[Next.js API route /api/transcribe] ──► OpenRouter (or STT provider)
     │  transcript text
     ▼
[Quote-drafting agent] ──tools──► Postgres (catalog lookups)
     │  structured QuoteDraft JSON
     ▼
[Editable quote view]  ─► save edits  ─► PDF export
```

## Data model (initial)

- `users` (Supabase Auth) — id, email
- `profiles` — user_id, role (`admin` | `estimator`), full_name
- `catalog_items` — id, sku, name, category, kind (`material`|`labor`|`composite`), unit, unit_price, labor_rate, labor_unit, notes, sheet_row_id, updated_at
- `catalog_sync_runs` — id, started_at, finished_at, status, rows_upserted, error
- `recordings` — id, user_id, storage_path, duration_s, status (`uploaded` | `transcribing` | `transcribed` | `failed`), created_at
- `transcripts` — id, recording_id, model, text, raw_response_json, created_at
- `quotes` — id, recording_id, transcript_id, status (`draft` | `final`), client_name, site_address, subtotal, tax, total, scope_narrative, notes, terms, created_by, created_at, updated_at
- `quote_sections` — id, quote_id, title, sort_order
- `quote_line_items` — id, section_id, catalog_item_id (nullable for ad-hoc), description, quantity, unit, unit_price, line_total, is_labor
- `settings` (single row) — transcription_model, agent_model, default_tax_rate, default_terms_md
- `audit_log` — who edited what, when (for quote provenance)

## Catalog sync (Google Sheets → Postgres)

- Service account with read access to the sheet.
- Vercel Cron (or Supabase scheduled function) hits `/api/sync-catalog` every 15 min.
- Upsert by `sheet_row_id` or `sku`. Soft-delete rows that vanish.
- Admin "Resync now" button in the catalog page.
- Record each run in `catalog_sync_runs` so admins can see freshness.

## Agent design

Tool-calling agent. Tools:
- `search_catalog(query, category?)` → fuzzy/full-text match against `catalog_items`.
- `get_item(id)` → exact lookup with price/labor.
- `list_categories()` → for grouping.

Flow:
1. System prompt explains role (senior landscape estimator), output JSON schema, and rules (never invent prices, always cite catalog_item_id when used, mark `is_ad_hoc` if no match).
2. Pass transcript + recent quote examples (few-shot) + estimator's name.
3. Agent calls tools, returns structured `QuoteDraft` JSON conforming to a Zod schema.
4. Server validates JSON, persists draft, returns to client.

Output schema (rough):
```ts
{
  client_name, site_address, scope_narrative,
  sections: [{ title, items: [{ catalog_item_id?, description, qty, unit, unit_price, is_labor }] }],
  notes, terms_md, assumptions_for_estimator_to_confirm: string[]
}
```
The `assumptions_for_estimator_to_confirm` field is important — surfaces what the agent guessed so the estimator can fix it fast.

## Pages

- `/login` — Supabase auth (email magic link or password).
- `/` — list of my quotes + recent recordings.
- `/record` — record or upload audio → uploads → kicks off transcription → redirects to quote draft.
- `/quotes/[id]` — editable quote view: sections, line items, scope, notes, terms. Save / regenerate / export PDF.
- `/quotes/[id]/pdf` — server-rendered PDF (react-pdf or Puppeteer).
- `/admin/catalog` — table view of catalog, last-sync status, "Resync" button.
- `/admin/settings` — pick transcription model, agent model, tax rate, default terms.
- `/admin/users` — invite/manage employees, set roles.

## Tech choices (concrete)

- **PDF:** `@react-pdf/renderer` (clean, server-rendered, no headless browser).
- **Schema/validation:** Zod for agent outputs + form state.
- **Forms:** React Hook Form + Zod resolver.
- **DB access:** Supabase client on server (RLS-aware) + Drizzle or `supabase-js` directly (start with `supabase-js` for speed).
- **Background jobs:** Async from day one given ~10 min memos. Upload returns immediately; a server action uses `waitUntil` (or QStash) to run transcription → agent. Client polls recording status. Move to Inngest/QStash if reliability or retries become an issue.
- **PWA:** `next-pwa` + a manifest; add an "Install app" hint on mobile.

## Build order

1. **Repo scaffold** — Next.js + Supabase + Tailwind + shadcn/ui.
2. **Auth + roles** — Supabase Auth, profile bootstrap, role-gated routes.
3. **Catalog sync** — service account, sync route, admin page, cron.
4. **Recorder + upload** — `MediaRecorder` → Supabase Storage → DB row.
5. **Transcription** — OpenRouter client; settings page fetches `?output_modalities=transcription` and lets admin pick.
6. **Agent** — tools + prompt + Zod schema, persists `QuoteDraft`.
7. **Quote editor** — section/line-item CRUD, autosave.
8. **PDF export.**
9. **Polish:** PWA manifest, mobile recorder UX, error states, audit log.

## Resolved (2026-05-11)
- **Supabase project:** Starting fresh — create new project during scaffold.
- **Quote PDF layout:** Basic, minimal, black & white. No template to match.
- **Audio length:** ~10 min average. → Synchronous request would risk Vercel's 60s timeout. **Process transcription + agent async**: upload returns immediately, status polls until `transcribed` then `drafted`. Use Vercel `waitUntil` (or QStash/Inngest if memos run long) so we don't block the HTTP response.
- **Catalog:** Per-item rates. Each `catalog_items` row has both `unit_price` (materials/hardscape) and `labor_rate` + `labor_unit` (e.g. hr, sq ft) when applicable. Add `kind` enum (`material` | `labor` | `composite`) so the agent knows which fields are meaningful.
- **Branding:** "Greenscape Pro — Phoenix, AZ". All UI + PDFs black & white, minimalist. No logo asset yet — use bold wordmark text.

## Design implications of the above
- **Recordings table** gets a `processing_status` machine: `uploaded → transcribing → transcribed → drafting → drafted | failed`. Client polls `/api/recordings/[id]` until terminal.
- **Catalog schema update:**
  ```
  catalog_items(
    id, sku, name, category,
    kind: 'material' | 'labor' | 'composite',
    unit,                 -- ea, sq_ft, cu_yd, hr, ...
    unit_price numeric,   -- materials
    labor_rate numeric,   -- per labor_unit (often per hr or per sq_ft)
    labor_unit text,      -- 'hr' | 'sq_ft' | ...
    notes, sheet_row_id, updated_at
  )
  ```
  Agent picks the relevant fields based on `kind` when building a line item.
- **Theme:** Tailwind in monochrome — black text on white, grey borders, no accent color. shadcn/ui default with `--primary: 0 0% 0%`.
- **PDF header:** "GREENSCAPE PRO" wordmark, "Phoenix, AZ" subtitle, thin rule.
