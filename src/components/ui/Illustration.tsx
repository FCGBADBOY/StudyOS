import type { SVGProps } from 'react'
import { themeColors, type ThemeKey } from '@/config/visual'
import { cn } from '@/utils/cn'

/**
 * ---------------------------------------------------------------------------
 * StudyOS illustration system
 * ---------------------------------------------------------------------------
 * A single, coherent family of editorial vector drawings. Flat, layered, softly
 * rounded, drawn on a 160×120 stage so every illustration shares a baseline and
 * can sit side by side in a grid.
 *
 * Colours come from design tokens via `currentColor` and `var(--…)`, so each
 * drawing re-tints with the theme and inverts correctly in dark mode without a
 * second asset set. No stock art, no icon-set doodles, no 3D renders.
 *
 * Usage:
 *   <Illustration name="book" />
 *   <Illustration name="molecule" theme="chemistry" className="h-32" />
 */

export type IllustrationName =
  | 'book'
  | 'notebook'
  | 'formula'
  | 'molecule'
  | 'graduation'
  | 'paper'
  | 'calendar'
  | 'assistant'
  | 'desk'
  | 'target'
  | 'journey'
  | 'brain'
  | 'empty'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IllustrationName
  /** Re-tints the accent strokes and shapes. */
  theme?: ThemeKey
  className?: string
  /** Hide from assistive tech when it is decoration beside a real heading. */
  decorative?: boolean
}

type StageProps = Pick<Props, 'className' | 'decorative'> & {
  children: React.ReactNode
  title?: string
}

/** Shared stage: stable aspect, token-coloured, inherits text colour. */
function Stage({ children, className, decorative, title, ...rest }: StageProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      className={cn('h-auto w-full text-foreground', className)}
      fill="none"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ------------------------------- illustrations ---------------------------- */

function Book({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="104" rx="54" ry="7" fill="var(--border)" />
      {/* left leaf */}
      <path
        d="M80 36c-12-9-33-12-50-10v62c17-2 38 1 50 10z"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* right leaf */}
      <path
        d="M80 36c12-9 33-12 50-10v62c-17-2-38 1-50 10z"
        fill="var(--surface-raised)"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* gutter */}
      <path d="M80 36v62" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" />
      {/* text block, left */}
      <g stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <path d="M38 44 64 47" />
        <path d="M38 54 64 57" />
        <path d="M38 64 58 66" />
        <path d="M38 74 64 77" />
      </g>
      {/* highlighted block, right */}
      <rect x="94" y="42" width="34" height="14" rx="4" fill={accent} opacity="0.22" />
      <g stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <path d="M94 66 126 66" />
        <path d="M94 76 118 76" />
      </g>
      {/* ribbon */}
      <path d="M118 26v26l6-7 6 7V26z" fill={accent} />
    </>
  )
}

function Notebook({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="104" rx="46" ry="7" fill="var(--border)" />
      <rect x="40" y="22" width="82" height="76" rx="10" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <path d="M40 32a10 10 0 0 1 10-10h8v76h-8a10 10 0 0 1-10-10z" fill={accent} opacity="0.9" />
      {/* elastic band */}
      <path d="M108 12v96" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      {/* ruled lines */}
      <g stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round" opacity="0.8">
        <path d="M60 46h36" />
        <path d="M60 58h36" />
        <path d="M60 70h24" />
      </g>
      {/* corner fold */}
      <path d="M110 22l12 12h-12z" fill="var(--surface-sunken)" />
    </>
  )
}

function Formula({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="104" rx="50" ry="7" fill="var(--border)" />
      <rect x="26" y="24" width="108" height="70" rx="14" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <rect x="26" y="24" width="108" height="22" rx="14" fill={accent} opacity="0.16" />
      <path d="M26 46h108" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="38" cy="35" r="3.5" fill={accent} />
      <circle cx="50" cy="35" r="3.5" fill="var(--border-strong)" />
      {/* the equation */}
      <text
        x="80"
        y="76"
        textAnchor="middle"
        fill="var(--foreground)"
        fontSize="26"
        fontWeight="700"
        fontFamily="var(--font-mono)"
        letterSpacing="-0.5"
      >
        E = mc²
      </text>
      {/* underline accent */}
      <path d="M56 86h48" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
      {/* sparkles */}
      <path d="M138 16l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill={accent} />
      <circle cx="22" cy="60" r="4" fill={accent} opacity="0.5" />
    </>
  )
}

function Molecule({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="104" rx="46" ry="7" fill="var(--border)" />
      {/* bonds */}
      <g stroke="var(--border-strong)" strokeWidth="3.5" strokeLinecap="round">
        <path d="M80 34 46 54" />
        <path d="M80 34 114 54" />
        <path d="M46 54 46 84" />
        <path d="M114 54 114 84" />
        <path d="M46 84 80 96" />
        <path d="M114 84 80 96" />
        <path d="M80 34 80 60" />
        <path d="M46 54 80 60" />
        <path d="M114 54 80 60" />
      </g>
      {/* ring highlight */}
      <path
        d="M80 34 114 54 114 84 80 96 46 84 46 54z"
        fill={accent}
        opacity="0.12"
      />
      {/* atoms */}
      <circle cx="80" cy="34" r="10" fill={accent} />
      <circle cx="46" cy="54" r="8" fill="var(--surface)" stroke={accent} strokeWidth="3" />
      <circle cx="114" cy="54" r="8" fill="var(--surface)" stroke={accent} strokeWidth="3" />
      <circle cx="46" cy="84" r="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="3" />
      <circle cx="114" cy="84" r="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="3" />
      <circle cx="80" cy="96" r="8" fill={accent} opacity="0.55" />
      <circle cx="80" cy="60" r="7" fill="var(--surface)" stroke={accent} strokeWidth="3" />
    </>
  )
}

function Graduation({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="104" rx="48" ry="7" fill="var(--border)" />
      {/* head */}
      <path d="M56 72a24 22 0 0 1 48 0v6H56z" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      {/* cap board */}
      <path d="M80 30 26 54l54 24 54-24z" fill={accent} />
      <path d="M80 30 26 54l54 24 54-24z" fill="url(#capGloss)" opacity="0.25" />
      <defs>
        <linearGradient id="capGloss" x1="26" y1="30" x2="134" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* tassel */}
      <path d="M126 60v18" stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="126" cy="82" r="6" fill={accent} />
      <path d="M126 88v10" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      {/* book beneath */}
      <path d="M44 88h72v10a4 4 0 0 1-4 4H48a4 4 0 0 1-4-4z" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
    </>
  )
}

function Paper({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="106" rx="46" ry="6" fill="var(--border)" />
      {/* stacked sheets */}
      <rect x="34" y="20" width="80" height="80" rx="8" fill="var(--surface-sunken)" transform="rotate(-6 74 60)" />
      <rect x="44" y="18" width="80" height="80" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" transform="rotate(3 84 58)" />
      <g transform="rotate(3 84 58)">
        {/* header */}
        <rect x="56" y="30" width="46" height="9" rx="4.5" fill={accent} />
        {/* question lines with marks */}
        <g stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round">
          <path d="M56 50h52" />
          <path d="M56 62h44" />
          <path d="M56 74h52" />
          <path d="M56 86h34" />
        </g>
        {/* ticks */}
        <path d="M112 47l4 5 7-9" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M106 71l4 5 7-9" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* pencil */}
      <path d="M124 44 144 78l-11 5-14-30z" fill={accent} opacity="0.85" />
      <path d="M144 78l-11 5 2-8z" fill="var(--foreground)" />
    </>
  )
}

function Calendar({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="106" rx="46" ry="6" fill="var(--border)" />
      <rect x="32" y="24" width="96" height="76" rx="12" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <path d="M32 46a12 12 0 0 1 12-12h72a12 12 0 0 1 12 12v4H32z" fill={accent} />
      {/* rings */}
      <path d="M56 16v16M104 16v16" stroke="var(--border-strong)" strokeWidth="5" strokeLinecap="round" />
      {/* day grid */}
      <g fill="var(--border-strong)" opacity="0.5">
        <rect x="44" y="56" width="14" height="12" rx="4" />
        <rect x="66" y="56" width="14" height="12" rx="4" />
        <rect x="88" y="56" width="14" height="12" rx="4" />
        <rect x="44" y="76" width="14" height="12" rx="4" />
        <rect x="88" y="76" width="14" height="12" rx="4" />
      </g>
      {/* today */}
      <rect x="66" y="76" width="14" height="12" rx="4" fill={accent} />
      {/* check */}
      <path d="M70 82l3 3 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="110" y="56" width="14" height="12" rx="4" fill={accent} opacity="0.35" />
    </>
  )
}

function Assistant({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="106" rx="44" ry="6" fill="var(--border)" />
      {/* bubble */}
      <path
        d="M34 30h92a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12H74l-20 16v-16H34a12 12 0 0 1-12-12V42a12 12 0 0 1 12-12z"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
      />
      {/* sparkle identity */}
      <path d="M62 44l4.5 11 11 4.5-11 4.5L62 75l-4.5-11-11-4.5 11-4.5z" fill={accent} />
      <g stroke="var(--border-strong)" strokeWidth="4" strokeLinecap="round" opacity="0.75">
        <path d="M88 52h26" />
        <path d="M88 66h18" />
      </g>
      {/* orbit sparks */}
      <circle cx="138" cy="24" r="5" fill={accent} opacity="0.45" />
      <circle cx="20" cy="70" r="4" fill={accent} opacity="0.35" />
      <path d="M132 84l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={accent} opacity="0.6" />
    </>
  )
}

function Desk({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="108" rx="58" ry="6" fill="var(--border)" />
      {/* lamp */}
      <path d="M40 30 54 52" stroke="var(--border-strong)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M40 30 28 26l-4 14 14 2z" fill={accent} />
      <path d="M54 52v40" stroke="var(--border-strong)" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="54" cy="94" rx="14" ry="5" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      {/* light pool */}
      <path d="M40 40 78 96H26z" fill={accent} opacity="0.14" />
      {/* desk */}
      <rect x="22" y="94" width="116" height="8" rx="4" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      {/* books */}
      <rect x="84" y="76" width="44" height="8" rx="3" fill={accent} />
      <rect x="88" y="66" width="40" height="10" rx="3" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <rect x="92" y="56" width="34" height="10" rx="3" fill={accent} opacity="0.55" />
      {/* mug */}
      <path d="M66 80h14v10a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <path d="M80 84h5a4 4 0 0 1 0 8h-5" stroke="var(--border-strong)" strokeWidth="2.5" />
      {/* steam */}
      <path d="M72 72c0-4 4-4 4-8M78 74c0-4 4-4 4-8" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </>
  )
}

function Target({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="106" rx="44" ry="6" fill="var(--border)" />
      <circle cx="80" cy="60" r="44" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2.5" />
      <circle cx="80" cy="60" r="32" fill={accent} opacity="0.14" />
      <circle cx="80" cy="60" r="32" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.6" />
      <circle cx="80" cy="60" r="19" fill="none" stroke={accent} strokeWidth="3" />
      <circle cx="80" cy="60" r="7" fill={accent} />
      {/* arrow */}
      <path d="M80 60 134 26" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
      <path d="M118 24h20v20" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M134 26l-12 3 4 5z" fill="var(--foreground)" />
    </>
  )
}

function Journey({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="108" rx="56" ry="5" fill="var(--border)" />
      {/* axis */}
      <path d="M26 96h112" stroke="var(--border-strong)" strokeWidth="2.5" strokeLinecap="round" />
      {/* ascending path */}
      <path
        d="M30 90C48 84 56 74 68 70s18-22 32-26 22-14 34-20"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {/* area under curve */}
      <path
        d="M30 90C48 84 56 74 68 70s18-22 32-26 22-14 34-20v72H30z"
        fill={accent}
        opacity="0.12"
      />
      {/* milestones */}
      <circle cx="30" cy="90" r="6" fill="var(--surface)" stroke={accent} strokeWidth="3.5" />
      <circle cx="68" cy="70" r="6" fill="var(--surface)" stroke={accent} strokeWidth="3.5" />
      <circle cx="100" cy="44" r="6" fill="var(--surface)" stroke={accent} strokeWidth="3.5" />
      <circle cx="134" cy="24" r="8" fill={accent} />
      <path d="M130 24l3 3 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* grid dots */}
      <g fill="var(--border-strong)" opacity="0.45">
        <circle cx="46" cy="34" r="2" />
        <circle cx="62" cy="34" r="2" />
        <circle cx="78" cy="34" r="2" />
        <circle cx="46" cy="50" r="2" />
        <circle cx="62" cy="50" r="2" />
      </g>
    </>
  )
}

function Brain({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="106" rx="44" ry="6" fill="var(--border)" />
      {/* head silhouette */}
      <path
        d="M108 96H64a34 34 0 0 1-8-67 34 34 0 0 1 56-6c14 4 24 17 24 32 0 22-14 41-28 41z"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
      />
      {/* knowledge nodes */}
      <path d="M64 44c8 0 8 10 16 10s8-10 16-10 10 8 18 8" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M56 66c10-2 14 6 24 4s12-12 22-10 12 10 20 8" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M72 84c8-4 14 2 22-2" stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <g fill={accent}>
        <circle cx="64" cy="44" r="5" />
        <circle cx="96" cy="54" r="5" />
        <circle cx="56" cy="66" r="5" />
        <circle cx="102" cy="60" r="5" />
        <circle cx="72" cy="84" r="5" />
      </g>
      {/* sparks */}
      <path d="M132 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={accent} />
      <circle cx="26" cy="52" r="4" fill={accent} opacity="0.4" />
    </>
  )
}

function Empty({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="80" cy="102" rx="40" ry="7" fill="var(--border)" />
      {/* closed, waiting book */}
      <path
        d="M46 34h58a10 10 0 0 1 10 10v50a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10V44a10 10 0 0 1 10-10z"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
      />
      <path d="M46 34a10 10 0 0 0-10 10v50a10 10 0 0 0 10 10" fill={accent} opacity="0.75" />
      <g stroke="var(--border-strong)" strokeWidth="3.5" strokeLinecap="round" opacity="0.7">
        <path d="M56 56h46" />
        <path d="M56 68h34" />
      </g>
      {/* sleep / quiet marks */}
      <path d="M116 30h16l-16 16h16" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M134 54h10l-10 10h10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
      <circle cx="40" cy="24" r="4" fill={accent} opacity="0.4" />
    </>
  )
}

const DRAWINGS: Record<IllustrationName, (p: { accent: string }) => React.ReactNode> = {
  book: Book,
  notebook: Notebook,
  formula: Formula,
  molecule: Molecule,
  graduation: Graduation,
  paper: Paper,
  calendar: Calendar,
  assistant: Assistant,
  desk: Desk,
  target: Target,
  journey: Journey,
  brain: Brain,
  empty: Empty,
}

/**
 * Themed editorial illustration.
 *
 * ```tsx
 * <Illustration name="molecule" theme="chemistry" decorative />
 * ```
 */
export function Illustration({ name, theme = 'brand', decorative = true, className, ...rest }: Props) {
  const Drawing = DRAWINGS[name] ?? Book
  const { accentVar } = themeColors(theme)

  return (
    <Stage className={className} decorative={decorative} title={name} {...(rest as StageProps)}>
      <Drawing accent={accentVar} />
    </Stage>
  )
}
