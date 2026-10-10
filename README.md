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

## Future AI integration

The AI Tutor screen is intentionally UI-only. When a model backend exists, the integration point is a single function:

```
src/data/tutor.ts → buildTutorReply(messages, mode)
```

Swap that for a streaming `fetch` to your endpoint (the `VITE_AI_TUTOR_ENDPOINT` placeholder in `.env.example` is reserved for it). Nothing else in the tutor screen needs to change. Recommendation/ML features would follow the same pattern: a service in `src/services/` that returns the UI's existing types.

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
- Not built (out of scope): AI model backend, recommendation ML, payments/premium, push server, admin portal.
