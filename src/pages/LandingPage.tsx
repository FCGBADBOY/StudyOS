import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookX,
  Bot,
  CalendarDays,
  FileText,
  GraduationCap,
  ScrollText,
  Sigma,
  Timer,
  TrendingUp,
} from 'lucide-react'
import {
  BackgroundArt,
  Badge,
  Card,
  IconTile,
  Illustration,
  LinkButton,
  ProgressBar,
  Skeleton,
  StatCard,
} from '@/components/ui'
import { Logo } from '@/components/LogoMark'
import { useCountUp, useReveal, useStagger } from '@/hooks'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

/* ------------------------------------------------------------------ data -- */

interface Feature {
  icon: typeof Bot
  title: string
  benefit: string
  to: string
  linkLabel: string
  /** One identity per feature, so the grid reads as four different tools. */
  theme: ThemeKey
}

const FEATURES: Feature[] = [
  {
    icon: ScrollText,
    title: 'PYQ Intelligence',
    benefit: 'Fifteen years of board papers ranked by how often each concept repeats.',
    to: '/pyq',
    linkLabel: 'Explore PYQs',
    theme: 'pyq',
  },
  {
    icon: Bot,
    title: 'AI Tutor',
    benefit: 'Ask a doubt in plain language, get a step-by-step answer at your level.',
    to: '/ai-tutor',
    linkLabel: 'Open AI Tutor',
    theme: 'ai',
  },
  {
    icon: BookX,
    title: 'MistakeBook',
    benefit: 'Every wrong answer returns as a drill until it stops recurring.',
    to: '/mistakebook',
    linkLabel: 'Review mistakes',
    theme: 'mistakes',
  },
  {
    icon: Sigma,
    title: 'Formula Flow',
    benefit: 'Recall drills that move formulas from your notes into memory.',
    to: '/formula-flow',
    linkLabel: 'Browse formulas',
    theme: 'formula',
  },
]

const HOW_STEPS = [
  {
    title: 'Set up your board',
    detail: 'Pick your board, class, stream and subjects — every screen narrows to your syllabus.',
    theme: 'library' as ThemeKey,
  },
  {
    title: 'Practise with PYQs',
    detail: 'Solve papers ordered by repeat probability instead of guessing what matters.',
    theme: 'pyq' as ThemeKey,
  },
  {
    title: 'Fix your mistakes',
    detail: 'MistakeBook reschedules every slip until the concept genuinely sticks.',
    theme: 'mistakes' as ThemeKey,
  },
]

/* ------------------------------------------------------------------ page -- */

export default function LandingPage() {
  const navigate = useNavigate()

  const heroRef = useStagger<HTMLDivElement>({ step: 55, distance: 18 })
  const previewRef = useStagger<HTMLDivElement>({ step: 55, distance: 24, delay: 220 })

  const questions = useCountUp<HTMLSpanElement>(18642, { delay: 120 })
  const papers = useCountUp<HTMLSpanElement>(412, { delay: 200 })
  const years = useCountUp<HTMLSpanElement>(15, { delay: 280 })
  const accuracy = useCountUp<HTMLSpanElement>(78, { suffix: '%', delay: 360 })

  const featuresRef = useReveal<HTMLElement>({ selector: '[data-reveal="true"]', step: 70, distance: 18 })
  const howRef = useReveal<HTMLElement>({ selector: '[data-reveal="true"]', step: 80, distance: 18 })

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ---------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="StudyOS home"
            className="shrink-0 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <Logo size={32} />
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <a
              href="#features"
              className="hidden min-h-11 items-center rounded-control px-3 text-sm font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring sm:inline-flex"
            >
              Features
            </a>
            <a
              href="#how"
              className="hidden min-h-11 items-center rounded-control px-3 text-sm font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring sm:inline-flex"
            >
              How it works
            </a>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="hidden min-h-11 items-center rounded-control px-3 text-sm font-semibold text-muted outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring sm:inline-flex"
            >
              Open dashboard
            </button>
            <LinkButton to="/onboarding" size="md" className="px-4">
              Get started
            </LinkButton>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section aria-labelledby="hero-title" className="relative">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
            <div ref={heroRef}>
              <Badge variant="brand" size="md" icon={<GraduationCap />}>
                Built for CBSE · ICSE · State boards
              </Badge>

              <h1
                id="hero-title"
                className="text-display mt-5 text-[36px] leading-[1.02] text-foreground sm:text-[54px] lg:text-[60px]"
              >
                Study smarter.
                <br />
                <span className="text-brand">Score higher.</span>
              </h1>

              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
                StudyOS turns fifteen years of board papers, your syllabus and your own mistakes into
                one focused daily plan — so every hour of study lands on what the exam actually asks.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <LinkButton to="/onboarding" size="lg" icon={<ArrowRight />} className="sm:px-6">
                  Start setup
                </LinkButton>
                <LinkButton to="/dashboard" size="lg" variant="outline" className="sm:px-6">
                  Open dashboard
                </LinkButton>
              </div>

              <p className="mt-4 text-[13px] font-medium text-muted">
                Free preview · No sign-up · Runs entirely in your browser
              </p>
            </div>

            {/* Product preview, staged as a warm hero panel */}
            <div ref={previewRef}>
              <div className="relative isolate overflow-hidden rounded-hero bg-cream p-5 shadow-hero sm:p-6">
                <BackgroundArt theme="brand" geometry intensity="subtle" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow">Your study command centre</span>
                    <Badge theme="streak" icon={<Timer />}>
                      Day 12
                    </Badge>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-card bg-surface p-4 shadow-card">
                    <Illustration name="desk" theme="brand" decorative className="w-full" />

                    <div className="mt-4 flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-fg"
                      >
                        S
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          Good evening, Sumit
                        </p>
                        <p className="truncate text-xs text-muted">3 sessions planned · 1h 45m</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-tile bg-surface-muted p-3">
                      <ProgressBar value={68} size="sm" label="Weekly goal" valueText="68%" />
                      <p className="mt-2 text-[12px] leading-snug text-muted">
                        Physics · Current electricity is 2 topics away from done
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-3 rounded-tile bg-surface-muted p-3">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-tile" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-2.5 w-3/4" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-3 rounded-tile bg-surface-muted p-3">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-tile" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-2/5" />
                        <Skeleton className="h-2.5 w-3/5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- stats */}
        <section aria-label="StudyOS by the numbers" className="bg-cream">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 px-4 py-8 sm:grid-cols-4 sm:gap-4 sm:px-6 sm:py-10">
            <StatCard
              label="questions analysed"
              value={<span ref={questions}>0</span>}
              icon={<Sigma />}
              accent="pyq"
            />
            <StatCard
              label="question papers mapped"
              value={<span ref={papers}>0</span>}
              icon={<FileText />}
              accent="paper"
            />
            <StatCard
              label="years of board exams"
              value={<span ref={years}>0</span>}
              icon={<CalendarDays />}
              accent="brand"
            />
            <StatCard
              label="avg accuracy after 3 weeks"
              value={<span ref={accuracy}>0</span>}
              icon={<TrendingUp />}
              accent="success"
              trendTone="positive"
            />
          </div>
        </section>

        {/* ------------------------------------------------------ features */}
        <section
          id="features"
          aria-labelledby="features-title"
          ref={featuresRef}
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="max-w-2xl">
            <p className="eyebrow">The toolkit</p>
            <h2
              id="features-title"
              className="text-display mt-2 text-[26px] text-foreground sm:text-[34px]"
            >
              Four tools that compound
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              Each one solves a single, expensive student problem — together they replace the pile of
              PDFs, notes and good intentions that never quite add up to a plan.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              const tone = themeColors(feature.theme)
              return (
                <div key={feature.to} data-reveal="true" className="h-full">
                  <Card as="article" interactive className="flex h-full flex-col">
                    <IconTile icon={<Icon />} theme={feature.theme} variant="gradient" size="lg" />
                    <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted clamp-2">
                      {feature.benefit}
                    </p>
                    <Link
                      to={feature.to}
                      className={cn(
                        'mt-4 inline-flex min-h-11 items-center gap-1.5 self-start rounded-control text-[13px] font-semibold outline-none transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-brand-ring',
                        tone.onSoft,
                        'hover:text-foreground',
                      )}
                    >
                      {feature.linkLabel}
                      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                  </Card>
                </div>
              )
            })}
          </div>
        </section>

        {/* --------------------------------------------------- how it works */}
        <section
          id="how"
          aria-labelledby="how-title"
          ref={howRef}
          className="scroll-mt-24 bg-surface"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2
                id="how-title"
                className="text-display mt-2 text-[26px] text-foreground sm:text-[34px]"
              >
                Three steps, then it runs itself
              </h2>
            </div>

            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {HOW_STEPS.map((item, index) => (
                <li key={item.title} data-reveal="true" className="h-full">
                  <Card tone="cream" className="flex h-full flex-col p-5">
                    <IconTile
                      icon={<span className="tabular text-[13px] font-extrabold">
                        {String(index + 1).padStart(2, '0')}
                      </span>}
                      theme={item.theme}
                      variant="gradient"
                      size="md"
                    />
                    <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted clamp-3">{item.detail}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------- closing CTA */}
        <section aria-labelledby="cta-title" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="relative isolate overflow-hidden rounded-hero bg-cream px-6 py-12 text-center shadow-hero sm:px-10 sm:py-16">
            <BackgroundArt theme="brand" geometry intensity="subtle" />
            <span
              aria-hidden
              className="pattern-dots pointer-events-none absolute inset-y-0 right-0 w-1/4 opacity-[0.35]"
            />
            <Illustration
              name="graduation"
              theme="brand"
              decorative
              className="pointer-events-none absolute -bottom-4 -right-6 hidden w-56 opacity-70 lg:block"
            />

            <div className="relative mx-auto max-w-2xl">
              <p className="eyebrow">Ready when you are</p>
              <h2
                id="cta-title"
                className="text-display mt-2 text-[28px] text-foreground sm:text-[40px]"
              >
                Your board exam is already counting down
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Six quick questions — board, class, stream, subjects, exam date and daily goal — and
                StudyOS builds the rest of your year around them.
              </p>
              <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <LinkButton to="/onboarding" size="lg" icon={<ArrowRight />} className="sm:px-6">
                  Start setup
                </LinkButton>
                <LinkButton to="/dashboard" size="lg" variant="outline" className="sm:px-6">
                  Open dashboard
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------- footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Logo size={26} compact />
            <span className="text-xs text-muted">© 2026 StudyOS · Frontend preview</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
            <Link
              to="/dashboard"
              className="rounded-control outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              Dashboard
            </Link>
            <Link
              to="/pyq"
              className="rounded-control outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              PYQs
            </Link>
            <Link
              to="/ai-tutor"
              className="rounded-control outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              AI Tutor
            </Link>
            <Link
              to="/mistakebook"
              className="rounded-control outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              MistakeBook
            </Link>
            <Link
              to="/formula-flow"
              className="rounded-control outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              Formula Flow
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
