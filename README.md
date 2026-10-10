# StudyOS

A premium, Android-first education app for CBSE Class 12 students — notes, previous-year questions, an AI tutor, a mistake book, progress analytics and a study planner, in one focused interface.

The frontend is fully wired to a **Supabase backend**: authentication (Google + email), profiles, a normalised academic hierarchy, resources, PYQ intelligence, progress, mistakes, bookmarks, planner sessions and exams — with row-level security, migrations and seed data. The existing UI and its Anime.js animation system are untouched.

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in your Supabase values
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (LAN-enabled, so you can open it on a phone at `http://<your-ip>:5173`) |
| `npm run build` | Typecheck (`tsc --noEmit`) then production bundle |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript only, no emit |

> **npm postinstall:** if npm blocks esbuild's install script, approve it once with `npm install-scripts approve esbuild`.

### Two modes

| Mode | When | Behaviour |
| --- | --- | --- |
| **Demo mode** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are empty in `.env` | Bundled sample data from `src/data/` plus localStorage overlays for mistakes, sessions, profile edits and favourites. Fully browsable, no network. |
| **Live mode** | Env vars present | Real Supabase auth + database. Pages show skeletons while loading, `ErrorState` with retry on failure, and empty states when a table has no rows. Cached responses (localStorage, 7-day TTL) are shown when the network is unavailable. |

You can run the app with no Supabase project at all — it simply starts in demo mode.

---

## Supabase setup

### 1. Create a project

Create a project at [supabase.com](https://supabase.com), then copy **Project Settings → API** values into `.env`:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

The anon key is public and safe in the client bundle. **Never** ship a `service_role` key in the frontend.

### 2. Apply the database

The schema lives in `supabase/` and is reproducible from scratch:

```
supabase/
├── config.toml        # local-dev config (supabase start)
├── migrations/        # ordered SQL migrations — the source of truth
└── seed.sql           # representative CBSE Class 12 Science data
```

**Hosted project** — paste `migrations/*.sql` in order into the SQL editor (or push with the Supabase CLI), then run `seed.sql`.

**Local stack** — from `supabase/`:

```bash
supabase start          # local Postgres, auth, storage, studio
supabase db reset       # applies migrations + seed.sql
```

### What the schema contains

- **Academic hierarchy** — `boards → classes → streams → subjects → chapters`, normalised with UUID keys and slugs. Nothing hard-codes "CBSE"; the seed simply supplies CBSE Class 12 Science as sample content.
- **Profiles** — `profiles` row auto-created by an `auth.users` trigger (Google and email sign-ins both get one).
- **Resources + storage** — `resources` rows per chapter, files/avatars in storage buckets (`resources`, `avatars`) with upload policies.
- **PYQ intelligence** — `pyq_questions` (year, board, exam type, marks, difficulty, concepts) plus SQL views `pyq_chapter_stats`, `pyq_year_stats`, `pyq_marks_stats`, `pyq_difficulty_stats`, `pyq_concept_stats` that the frontend's intelligence panels read.
- **Per-user data** — progress, mistakes, bookmarks, study sessions, planner entries, exams (cloned from public `exam_templates` at onboarding).
- **Row-level security** — enabled on every table. Academic content is publicly readable; anything personal is restricted to `auth.uid()`.
- **Indexes** — on foreign keys, slugs, `user_id` + date columns and search columns.

### 3. Google sign-in

Authentication → Providers → **Google**: enable it and add the OAuth client IDs. The redirect URL is computed in the browser (see `authRedirectUrl()` in `src/lib/supabase.ts`) — add `<site-url>/login` (and `http://localhost:5173/login` for dev) to *Auth → URL Configuration → Redirect URLs*.

Email/password works out of the box (confirm disabled for local dev).

---

## Routes

| Route | Screen | Access |
| --- | --- | --- |
| `/` | Landing page | public |
| `/login` | Google + email sign-in | public |
| `/onboarding` | 6-step personalised setup | protected |
| `/dashboard` | Today's focus, quick actions, continue studying, snapshot, weak chapters, exams | protected |
| `/library` … `/library/:board/:class/:subject/:chapter` | Board → class → stream → subject → chapter | public browse |
| `/pyq`, `/pyq/:slug`, `/pyq/:subject/:paper` | PYQ intelligence + papers | public browse |
| `/ai-tutor` | Chat-style AI tutor (UI only — no model backend) | protected |
| `/mistakebook` | Logged mistakes + review flow | protected |
| `/progress` | Analytics report | protected |
| `/planner` | Weekly study planner | protected |
| `/formula-flow`, `/reaction-lab` | Bundled study material | public |
| `/profile`, `/settings` | Profile, appearance, study prefs | protected |

Protected screens live behind `RequireAuth`; unauthenticated visitors are redirected to `/login`, and the session persists across refreshes (Supabase restores it from localStorage). `/` → landing, `*` → `/dashboard`.

**Why `/pyq/:slug` exists:** a subject URL (`/pyq/physics`) and a paper URL (`/pyq/2025-cbse-physics-set-1`) have identical shapes, so `PyqRoutePage` resolves the segment against the paper index first, then falls back to the subject.

---

## Admin Portal (`/admin`)

A full content-management portal in the same app: the academic hierarchy, resources, PYQs, users, moderation, analytics, settings and an append-only audit log. The student app is untouched — the portal is a second surface over the same database.

### Routes

| Route | Screen |
| --- | --- |
| `/admin/login` | Staff sign-in (same Supabase auth as students) |
| `/admin` | → `/admin/dashboard` |
| `/admin/dashboard` | Platform stats, workflow queue, recent activity |
| `/admin/content` | Resource library — filters, bulk actions, publishing |
| `/admin/content/resources/new`, `/admin/content/resources/:id` | Resource editor: upload, preview, versions |
| `/admin/content/pyq` | PYQ archive browser |
| `/admin/content/pyq/new`, `/admin/content/pyq/:id` | PYQ editor (equation-ready, HTML-safe) |
| `/admin/content/pyq/import` | CSV / JSON bulk import with row-level validation |
| `/admin/academic` | Hierarchy overview with counts |
| `/admin/academic/(boards\|classes\|streams\|subjects\|chapters)` | One CRUD screen per level |
| `/admin/users`, `/admin/users/:id` | Directory, role changes, suspension, read-only learning data |
| `/admin/reports` | Moderation queue + content-quality dashboard |
| `/admin/analytics` | Growth, popularity, accuracy |
| `/admin/ai` | AI Studio (embedding queue, usage) |
| `/admin/audit` | Append-only audit log |
| `/admin/settings` | Upload, workflow, platform settings + permission matrix |

Everything under `/admin/*` is wrapped in `RequireAdmin`. Students see **"Access Denied — You don't have permission to access the Admin Portal."** with exits back to the app; signed-out visitors go to `/admin/login?next=…`.

### Roles and where permission is actually enforced

Five roles: `student`, `content_editor`, `moderator`, `admin`, `super_admin`.

**The frontend never decides who is allowed to do something.** `src/admin/lib/permissions.ts` is a *cosmetic mirror* of the database matrix — it only hides buttons that would always fail. The real gate is server-side:

- `role_permissions` (migration `…0001`) is the role → permission matrix.
- `has_permission(text)` / `has_role(…)` / `is_admin_user()` are `SECURITY DEFINER` helpers called inside Row Level Security policies (migration `…0003`) and by the `admin_*` RPCs.
- `guard_profile_role()` blocks privilege escalation: since `profiles` is owner-writable, a student editing their own row cannot set `role = 'admin'` — the trigger rejects it.
- Role changes and suspensions go through `admin_set_user_role()` / `admin_set_user_suspended()`, which re-check permission, forbid self-promotion and reserve `super_admin` grants for super admins.

A student who forges the UI, edits localStorage or calls PostgREST directly gets a `42501` from PostgreSQL. The `admin_user_directory` view is `security_invoker = false` and filters on `has_permission('users.view')`, so a student reads **zero rows** (not an error) and never sees an email they shouldn't.

### Content workflow

```
Draft → Pending Review → Approved → Published → Archived
                     ↘ Rejected
```

- `status` is the source of truth; `is_published` is a derived flag kept in sync by `sync_resource_status()` so the student app keeps working unchanged.
- `created_by` / `updated_by` / `reviewed_by` / `published_at` / `updated_at` record who did what. Editors may submit for review; only publisher-capable roles may publish, and `platform_settings.content.require_review` can force review for everyone.
- Every saved resource writes a `resource_versions` snapshot (`snapshot_resource_version()` AFTER trigger), so the editor can diff and roll back to any earlier version.
- Nothing referenced is ever hard-deleted: hierarchy levels and questions are **archived** (public read policies filter on `not is_archived`, staff policies don't), which hides them from students and keeps every link restorable.

### Uploads and bulk import

- Storage upload accepts **PDF / PNG / JPG / WEBP** up to a configurable size, validated in the browser *and* by storage policy. Order is deliberate: **storage path → DB metadata → resource row**, so an orphan file is never referenced by content.
- Resource preview (signed URL, rendered metadata, workflow status) is available before publishing.
- PYQ bulk import takes **CSV or JSON**, normalises column aliases, validates every row, and flags **possible duplicates** against the existing archive. Rows are imported independently and reported by line number — one bad row never fails the batch, and duplicates are skipped by choice, never merged or deleted.

### Reports, moderation and audit

- Students file one of six report types (`incorrect_question`, `wrong_answer`, `broken_resource`, `inappropriate_content`, `duplicate_content`, `other`); moderators move them `Open → Investigating → Resolved / Dismissed` with a resolution note, individually or in bulk (always behind a confirmation).
- The Content Quality panel surfaces content that *looks* wrong (missing thumbnails, no source, stuck drafts) before anyone reports it.
- `log_admin_action()` (SECURITY DEFINER) is the only writer of `audit_logs` — there is no client INSERT policy, so entries cannot be forged. It strips anything credential-shaped from `metadata`. The portal can read the log but never edit it.

### Admin demo mode

With no Supabase credentials the portal grants `super_admin` and persists mutations to localStorage (`admin:*` keys), so the whole workflow — publishing, archiving, role changes, imports — is demonstrable offline. With credentials present, every read and write is real and RLS-bound.

### Layout of the admin code

```
src/admin/
├── animations/    Admin motion set (pageEnter, statCounter, uploadProgress, …)
├── components/    DataTable, charts, feedback, hierarchy manager, filters
├── config/        Navigation (permission-gated links)
├── guards/        RequireAdmin + AccessDenied
├── hooks/         useAdminSession (role, staff check, demo flag)
├── layout/        AdminLayout — sidebar, mobile drawer, top bar, outlet
├── lib/           permissions.ts — cosmetic mirror of role_permissions
├── pages/         One file per route above
├── services/      The only code that talks to Supabase (admin_* RPCs, tables, storage)
└── types/admin.ts Shared admin model
```

---

## Architecture

```
src/
├── animations/       Anime.js system — the only place motion is defined
├── components/
│   ├── ui/              The design system (+ Skeleton/Empty/Error states)
│   ├── RequireAuth.tsx  Route guard
│   └── …domain cards (ResourceCard, ChapterCard, QuestionCard, ExamCard…)
├── config/navigation.ts Single source of truth for nav
├── context/
│   ├── AppProvider      Theme, preferences, favourites, toasts, search
│   └── AuthProvider     Supabase session, profile, onboarding choices
├── data/              Bundled sample content (demo mode) + static study material
├── hooks/
│   ├── useAuth.ts       Session helpers
│   ├── useData.ts       One hook per domain (useSubjects, useMistakes, …)
│   └── useQuery.ts      Generic loading/error/cache contract
├── lib/
│   ├── supabase.ts      Client, isSupabaseConfigured, readableError
│   └── query.ts         Tiny query cache (localStorage mirror, invalidation)
├── services/          The data layer — the ONLY code that talks to Supabase
├── layouts/           AppLayout (chrome) and PlainLayout (landing/auth)
├── pages/             One file per route
├── styles/index.css   Design tokens: light + dark, radii, elevation
├── types/             Domain model shared by services and UI
└── utils/             cn, format, storage, subject accents
```

### Data flow

```
page → hook (useData) → useQuery cache → service → Supabase
                                      ↘ localStorage cache (offline / 7-day TTL)
                                      ↘ demo data when env vars are missing
```

- **Pages never import Supabase or mock arrays for data-shaped content.** They call hooks, which call `src/services/*`, which map database rows onto the existing UI types in `src/types/`. The UI vocabulary (subjects, chapters, papers, mistakes…) didn't change.
- Every hook returns `{ data, loading, error, source, isFetching, refetch }`, so every database screen renders the same four states: **skeleton → success → empty → error-with-retry**. User-facing errors are readable messages (`readableError`), never raw Postgres strings.
- The cache is deliberately small: a shared entry per key, mirrored to localStorage with a 7-day TTL and a ~700 KB cap, plus `invalidateQueries` / `setQueryData` for mutations. No react-query, no state library.
- Writes are optimistic where it helps (favourites, mistakes, planner sessions) and re-fetch via `invalidateQueries`.

### Auth & onboarding

- `AuthProvider` restores the session on load, exposes `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `signOut`, `saveAcademicChoices`, `updateProfile`.
- A DB trigger creates the `profiles` row on first sign-in; `ensureProfile` covers demo mode and older users.
- Picking a board/class during onboarding persists to `profiles` and clones matching `exam_templates` into the user's `exams`.

---

## Animation architecture (Anime.js)

All motion lives in `src/animations/` and is re-exported from `@/animations`.

1. **One config file.** Timing, easing, distance and scale values come from `MOTION` in `animations/motion.ts`. Pages never hardcode a duration.
2. **Helpers return cleanups.** Every helper returns a function that pauses its animation instance, so effects stay leak-free *and* survive React StrictMode's double-invoke.
3. **Motion is opt-out everywhere.** `prefers-reduced-motion` and the in-app **Settings → Reduce motion** switch both flip a module-level flag; every helper checks `canAnimate()` and settles elements into their final state instead.
4. **Layouts own page transitions.** `AppLayout` wraps the `<Outlet/>` in a container keyed by `pathname` and runs `pageEnter` + `resetScroll`. Pages only stagger their own sections with `useStagger` / `useReveal`.
5. **No React re-renders mid-animation.** Progress bars, counters, rings and the nav indicator write straight to the DOM from `onUpdate` callbacks.

---

## Component system

`src/components/ui/index.ts` exports the full kit, typed end to end:

`Button` · `IconButton` · `LinkButton` · `Card` · `CardHeader` · `StatCard` · `ProgressBar` · `ProgressRing` · `SearchBar` · `Input` · `Textarea` · `BottomNavigation` · `Sidebar` · `Tabs` + `TabPanel` · `Modal` · `BottomSheet` · `Toast`/`ToastViewport` · `Avatar` · `Badge` · `Chip` · `Breadcrumb` · `Switch` · `Checkbox` · `SegmentedControl` · `Select` · `Slider` · `PageHeader` · `SectionHeader`

Plus the reusable states used by every database screen: `LoadingState`, `Skeleton`, `SkeletonCard`, `SkeletonList`, `EmptyState`, `ErrorState`, `OfflineState`.

**Design rules**

- Colour comes only from tokens (`bg-surface`, `text-muted`, `bg-brand-soft`, `text-danger`, …). No hardcoded hex in components.
- One primary accent (indigo) with subject accents (physics / chemistry / mathematics / english / computer) as a secondary scale.
- Medium radii, subtle elevation, deliberately designed dark mode.
- Focus-visible rings everywhere, `aria-*` on every icon-only control, semantic landmarks.

**Responsive model**

- **< 768px:** bottom navigation with an animated sliding indicator, sticky top bar, safe-area padding, 44px+ touch targets, verified at 360 / 390 / 412px.
- **≥ 768px:** fixed sidebar, wider content column, search field in the top bar.
- No horizontal overflow at any width; long academic titles use `clamp-1/2/3`.

---

## Content

- **Database (live mode):** boards, classes, streams, subjects, chapters, resources, PYQ papers/questions and exam templates all come from Supabase. `supabase/seed.sql` loads a representative CBSE Class 12 Science set — Physics, Chemistry, Mathematics, English, Computer Science — with a realistic number of chapters, resources and PYQ questions rather than hundreds of fake rows.
- **Bundled (always available):** formula sheets (`/formula-flow`), organic reactions (`/reaction-lab`), AI-tutor prompts/replies and static labels live in `src/data/` as product content, not backend data.
- **Demo mode:** the same `src/data/` files serve as sample content so the UI is fully explorable without a project.

---

## AI tutor, RAG & study intelligence (Phase 4)

The AI Tutor screen is no longer a mock. StudyOS runs a **server-side AI layer**
grounded in the student's own academic data: every answer is built from
StudyOS notes, chapters and the real PYQ archive, with citations back to the
source — never from a model improvising in the browser.

### Security model (read this first)

- **No AI call ever happens in the browser.** The frontend talks only to
  Supabase Edge Functions; the provider key lives as a server-side secret.
- **No secrets in `VITE_*`.** Only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  reach the bundle. `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`,
  `ANTHROPIC_API_KEY`, `AI_EMBEDDING_*` etc. are Edge Function secrets (see
  `.env.example`, "AI tutor (server-side)").
- **`service_role` never ships.** Privileged reads (embedding jobs, usage,
  analytics) go through `_shared/service.ts` inside the Edge Function only.
- **Tools cannot touch other students.** Every tool call is validated
  (`tools/validate.ts`): identity arguments are rejected outright, IDs must be
  UUIDs, queries are length-capped, and the model may only pick from a fixed
  8-tool catalog — there is no arbitrary SQL path.
- **RLS everywhere.** `ai_conversations` / `ai_messages` are owner-only;
  `document_chunks` is readable only through the `search_document_chunks`
  function (published resources the student may read); staff actions require
  `public.is_admin_user()`.

### Edge functions

| Function | Purpose |
|---|---|
| `ai-chat` | The tutor: streaming answers, 8 modes, tools, citations, history |
| `ai-search` | Hybrid (vector + keyword) search over StudyOS content |
| `ai-quiz` | Quiz generation (strict JSON → quiz card) |
| `ai-flashcards` | Flashcard deck generation |
| `ai-similar-question` | A new practice problem in the same shape as the student's |
| `ai-question-solver` | Image → transcription → full solution |
| `ai-embeddings` | Staff-only embedding worker (run/enqueue/status) |
| `ai-admin` | Staff-only analytics + embedding queue API |

Shared plumbing lives in `supabase/functions/_shared/`: `cors.ts`, `env.ts`,
`http.ts`, `logging.ts`, `sse.ts`, `service.ts`, and the AI core under
`_shared/ai/` (providers, prompts, retrieval, tools, services).

### Provider abstraction

`_shared/ai/providers/` defines one interface — `generateText`, `streamText`,
`generateEmbedding`, `analyzeImage` — with OpenAI (and OpenAI-compatible),
Google and Anthropic implementations plus a registry driven by `AI_PROVIDER`.
Anthropic has no embeddings API, so embedding work degrades to keyword search
instead of failing the request. Adding a provider is one file + one registry
entry; nothing else changes.

### How retrieval (RAG) works

1. **Chunking** (`retrieval/chunk.ts`, unit-tested): study material is split on
   *logical* boundaries — headings, paragraphs, definitions, formulas,
   examples, questions, solutions — not blind character counts. Chunks are
   merged back up to ~420 tokens without ever crossing a heading, a formula or
   a PDF page break, and each chunk keeps the metadata a citation is built
   from (board, class, subject, chapter, resource, section, page).
2. **Embeddings** (`ai-embeddings` worker): chunks of published resources
   (text files ≤ 512 KB; PDFs/binaries are indexed as metadata only) and
   chapters are embedded and stored in `document_chunks` (pgvector). The
   vector dimension comes from the DB (`studyos.embedding_dim`), and the worker
   refuses to write if it disagrees with `AI_EMBEDDING_DIM` — a dimension
   mismatch corrupts search silently, so it fails loudly instead.
3. **Search** (`search_document_chunks`, `search_pyqs`): hybrid vector +
   keyword, always filtered to content the student may read and (by default)
   to their own board/class/stream. Naming another class explicitly relaxes the
   curriculum filter — the explicit request wins.
4. **Answering**: retrieved chunks + real PYQ rows + tool results are assembled
   into the prompt with grounding rules that (a) forbid inventing citations,
   years or marking schemes, (b) require "AI-GENERATED PRACTICE" labelling for
   anything the model wrote, and (c) require admitting when StudyOS has no
   content. Citations in the UI point at real rows, not at the model's memory.

**Vector index decision:** HNSW where the table is large enough to benefit,
IVFFlat otherwise (see the embeddings migration). Either way the index is a
performance choice only — recall correctness never depends on it.

### Tutor features

- **8 modes, switchable in-thread:** Explain, Solve, Hint, 3-Mark, 5-Mark,
  Revise, Quiz Me, Simplify (`src/ai/prompts/modes.ts` mirrors the server
  intent table).
- **Progressive hints:** a 3-level ladder (concept → formula → substitution)
  that never reveals the final answer until the student explicitly asks.
- **PYQ honesty:** only archive rows are called previous-year questions; when
  the archive has nothing, the tutor says so and offers labelled practice.
- **Personalisation:** weak chapters, recent mistakes, upcoming exams and
  weekly activity shape the depth and the advice — "correct beats confident".
- **MistakeBook:** "explain my mistake" walks the student's own row
  (what you did → why it's wrong → the fix → one check for next time).
- **Images:** the solver transcribes first (vision prompt says *do not solve*),
  then solves the transcription. Unreadable photos fail loudly instead of
  being answered from a guess, and the image is never stored — only the
  extracted text is persisted.
- **Streaming:** answers stream over SSE (`_shared/sse.ts` →
  `src/ai/providers/sse.ts`) with a status line ("Searching StudyOS
  resources…"), rendered incrementally with Anime.js. Stop aborts cleanly.
- **History:** new/recent/rename/delete/search/continue, with summarisation
  for long threads.

### Rate limits & cost control

Usage is recorded per user, per model, per feature in `ai_usage` and enforced
server-side (`_shared/ai/services/usage.ts`); `ai_usage_today()` powers the
admin view. Costs are estimated from a server-side price table — never from
the browser. "Save to Notes" is deliberately **not** implemented: there is no
notes table in this phase's schema, so the tutor offers "Save to MistakeBook"
and copy-to-clipboard instead.

### Running the embedding worker

Staff only (`/admin/ai` → Embeddings panel, or the function directly):

```bash
# enqueue work for a resource / chapter / everything
curl -X POST "$FUNCTION_URL/ai-embeddings" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"action":"enqueue","scope":"chapter","chapterId":"<uuid>"}'

# run the queue (bounded batches, retry with backoff, clear-then-insert)
curl -X POST "$FUNCTION_URL/ai-embeddings" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"action":"run"}'

# status: pending / processing / completed / failed counts + last errors
curl -X POST "$FUNCTION_URL/ai-embeddings" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"action":"status"}'
```

Failed jobs record `last_error` and can be retried or rebuilt from the admin
dashboard; a rebuild replaces a chapter's chunks rather than appending duplicates.

### Testing the AI layer

```bash
npm test          # node --test: chunking, intent, prompts, tools, filters, images, SSE
```

The tests import only pure modules (no Deno, no DB, no network), so they run
with Node's built-in runner and zero extra dependencies. Live behaviour —
answer quality, grounding, streaming, rate limits, admin flows — is covered by
the checklist in [`tests/manual-prompts.md`](tests/manual-prompts.md).

---

## Accessibility & performance

- Semantic HTML, landmark regions, labelled controls, `aria-current` on active navigation, `role="tablist"/"tab"/"tabpanel"`, dialog semantics on modals and sheets.
- Full keyboard support: ⌘K/Ctrl+K search, Escape to close, arrow keys across tabs, visible focus rings.
- Animations only touch `transform` and `opacity`; every instance is paused and released on unmount; no infinite loops except the intentional skeleton/typing pulses.
- `prefers-reduced-motion` is honoured both by CSS and by the Anime.js guard flag.
- Query results are cached and de-duplicated, so navigating back to a screen is instant and offline visits fall back to the last snapshot.

---

## Tech stack

- **React 19** + **TypeScript** (strict, `verbatimModuleSyntax`)
- **Vite 7** with the `@` → `src` alias
- **Tailwind CSS v4** via `@tailwindcss/vite`, driven by a token system in `src/styles/index.css`
- **Supabase** (`@supabase/supabase-js`) — auth, Postgres, storage, RLS
- **Anime.js v4 — the only animation library.** No Framer Motion, GSAP, Lottie or CSS keyframes anywhere.
- **React Router 7** for routing · **Lucide** for icons

---

## Notes

- `.env` is git-ignored; `.env.example` is committed. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required.
- No service-role keys, passwords or secrets ever reach the browser bundle.
- Not built (out of scope): payments/premium, push notification server. The AI tutor backend exists (see "AI tutor, RAG & study intelligence") but needs a configured provider key to answer; "Save to Notes" is deferred until a notes table exists.
