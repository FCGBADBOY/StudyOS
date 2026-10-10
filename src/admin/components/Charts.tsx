/**
 * Chart primitives for the Admin Portal.
 *
 * Hand-rolled SVG rather than a charting dependency: the Admin Analytics
 * screens need three shapes (bars, a line/area series, and a donut), all of
 * which can be drawn directly and animated with the same Anime.js tokens the
 * rest of StudyOS uses.
 *
 * Every chart is responsive (viewBox + preserveAspectRatio), animates only
 * opacity and transform/geometry, and collapses to a static render when the
 * admin has reduced motion enabled. Each also renders a visually hidden data
 * table so the numbers are reachable by screen readers - a chart alone is not
 * an accessible way to read data.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate } from 'animejs'
import { MOTION, canAnimate, dur, staggerDelay, stop } from '@/animations/motion'

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

/** Screen-reader companion table - the same numbers, as text. */
function HiddenTable({ caption, rows }: { caption: string; rows: { label: string; value: string }[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* -------------------------------------------------------------------------- */
/* Bar chart                                                                  */
/* -------------------------------------------------------------------------- */

export interface BarDatum {
  label: string
  value: number
  /** Optional second series rendered beside it (grouped bars). */
  secondary?: number
  secondaryLabel?: string
}

export interface BarChartProps {
  data: BarDatum[]
  /** Accessible summary; also used as the hidden table caption. */
  title: string
  height?: number
  primaryLabel?: string
  formatValue?: (value: number) => string
}

/**
 * Vertical bar chart. Bars grow from the baseline once on mount, staggered
 * left-to-right - nothing re-animates on resize, so the chart never distracts
 * while an admin is reading it.
 */
export function BarChart({
  data,
  title,
  height = 200,
  primaryLabel = 'Value',
  formatValue = (value) => value.toLocaleString('en-IN'),
}: BarChartProps) {
  const groupRef = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const bars = groupRef.current?.querySelectorAll<SVGRectElement>('rect[data-bar]')
    if (!bars?.length) return
    if (!canAnimate()) return

    const instance = animate(bars, {
      opacity: [0, 1],
      scaleY: [0, 1],
      transformOrigin: 'bottom',
      duration: dur(MOTION.duration.slow),
      delay: staggerDelay(MOTION.stagger.tight) as number,
      ease: MOTION.ease.soft,
    })
    return stop(instance)
  }, [data])

  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted">No data for this period yet.</p>
  }

  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.secondary ?? 0]))
  const grouped = data.some((d) => d.secondary !== undefined)
  /* 92% headroom so the tallest bar never touches the chart ceiling. */
  const scale = 92 / max
  const viewWidth = Math.max(data.length * (grouped ? 44 : 30), 120)

  return (
    <div>
      <div className="overflow-x-auto no-scrollbar">
        <svg
          viewBox={`0 0 ${viewWidth} ${height}`}
          className="h-auto w-full min-w-[320px]"
          role="img"
          aria-label={title}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Horizontal gridlines - the only non-animated element. */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = height - 12 - (tick / 100) * (height - 32)
            return <line key={tick} x1="0" x2={viewWidth} y1={y} y2={y} className="stroke-border" strokeWidth="1" />
          })}

          <g ref={groupRef}>
            {data.map((datum, index) => {
              const slot = viewWidth / data.length
              const barWidth = grouped ? slot * 0.34 : slot * 0.5
              const centre = slot * index + slot / 2
              const primaryHeight = Math.max(2, (datum.value / max) * (height - 32))
              const secondaryHeight =
                datum.secondary === undefined ? 0 : Math.max(2, (datum.secondary / max) * (height - 32))

              return (
                <g key={datum.label}>
                  <rect
                    data-bar
                    x={centre - (grouped ? barWidth : barWidth / 2)}
                    y={height - 12 - primaryHeight}
                    width={barWidth}
                    height={primaryHeight}
                    rx="3"
                    className="fill-brand"
                  />
                  {grouped && datum.secondary !== undefined && (
                    <rect
                      data-bar
                      x={centre}
                      y={height - 12 - secondaryHeight}
                      width={barWidth}
                      height={secondaryHeight}
                      rx="3"
                      className="fill-accent"
                    />
                  )}
                  <text x={centre} y={height - 2} textAnchor="middle" className="fill-muted" fontSize="9">
                    {datum.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {grouped && (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-control bg-brand" aria-hidden="true" />
            {primaryLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-control bg-accent" aria-hidden="true" />
            {data.find((d) => d.secondaryLabel)?.secondaryLabel ?? 'Secondary'}
          </span>
        </div>
      )}

      <HiddenTable
        caption={title}
        rows={data.map((datum) => ({
          label: datum.label,
          value:
            datum.secondary !== undefined
              ? `${formatValue(datum.value)} (${primaryLabel}), ${formatValue(datum.secondary)}`
              : formatValue(datum.value),
        }))}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Line / area chart                                                          */
/* -------------------------------------------------------------------------- */

export interface LineChartProps {
  data: { label: string; value: number }[]
  title: string
  height?: number
  formatValue?: (value: number) => string
}

/**
 * Smoothed area + line for growth series.
 *
 * The path is generated once per dataset; the entrance draws it with a stroke
 * dash offset (a reveal that does not trigger layout) and fades the fill in
 * behind it.
 */
export function LineChart({
  data,
  title,
  height = 200,
  formatValue = (v) => v.toLocaleString('en-IN'),
}: LineChartProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const areaRef = useRef<SVGPathElement>(null)

  useLayoutEffect(() => {
    const path = pathRef.current
    const area = areaRef.current
    if (!path || !canAnimate()) return

    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    if (area) area.style.opacity = '0'

    const draw = animate(path, {
      strokeDashoffset: [length, 0],
      duration: dur(MOTION.duration.epic),
      ease: MOTION.ease.soft,
    })

    const fade = area
      ? animate(area, {
          opacity: [0, 0.18],
          duration: dur(MOTION.duration.epic),
          delay: dur(MOTION.duration.base),
          ease: MOTION.ease.soft,
        })
      : null

    return () => {
      draw.pause()
      fade?.pause()
    }
  }, [data])

  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted">No data for this period yet.</p>
  }

  const width = 320
  const padding = 14
  const max = Math.max(1, ...data.map((d) => d.value))
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1)

  const points = data.map((datum, index) => ({
    x: padding + index * stepX,
    y: height - padding - (datum.value / max) * (height - padding * 2),
  }))

  /* Midpoint control points give a soft, professional curve. */
  const line = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      const previous = points[index - 1]
      const controlX = (previous.x + point.x) / 2
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
    })
    .join(' ')

  const baseline = height - padding
  const area = `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`

  return (
    <div>
      <div className="overflow-x-auto no-scrollbar">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[320px]"
          role="img"
          aria-label={title}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="admin-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" className="text-brand" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-brand" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padding + tick * (height - padding * 2)
            return <line key={tick} x1={padding} x2={width - padding} y1={y} y2={y} className="stroke-border" strokeWidth="1" />
          })}

          <path ref={areaRef} d={area} fill="url(#admin-line-fill)" opacity="0" />
          <path
            ref={pathRef}
            d={line}
            fill="none"
            className="stroke-brand"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {points.map((point, index) => (
            <circle key={data[index].label} cx={point.x} cy={point.y} r="2.5" className="fill-brand" />
          ))}
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>

      <HiddenTable
        caption={title}
        rows={data.map((datum) => ({ label: datum.label, value: formatValue(datum.value) }))}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Donut                                                                      */
/* -------------------------------------------------------------------------- */

export interface DonutSegment {
  label: string
  value: number
  /** Tailwind fill class, e.g. `fill-brand`. */
  className: string
}

export interface DonutChartProps {
  segments: DonutSegment[]
  title: string
  /** Big number in the middle (usually the total). */
  centerLabel?: string
  centerValue?: string
  size?: number
}

/** Proportion ring with a labelled legend - used for content status mix. */
export function DonutChart({
  segments,
  title,
  centerLabel,
  centerValue,
  size = 160,
}: DonutChartProps) {
  const ringRef = useRef<SVGGElement>(null)
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  useLayoutEffect(() => {
    const arcs = ringRef.current?.querySelectorAll<SVGPathElement>('path[data-arc]')
    if (!arcs?.length || !canAnimate()) return

    const instance = animate(arcs, {
      opacity: [0, 1],
      scale: [0.92, 1],
      transformOrigin: 'center',
      duration: dur(MOTION.duration.slow),
      delay: staggerDelay(MOTION.stagger.tight) as number,
      ease: MOTION.ease.soft,
    })
    return stop(instance)
  }, [segments])

  if (!total) {
    return <p className="py-10 text-center text-sm text-muted">Nothing to summarise yet.</p>
  }

  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={title}>
          <circle cx="50" cy="50" r={radius} className="fill-none stroke-surface-sunken" strokeWidth="10" />
          <g ref={ringRef}>
            {segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const dash = (segment.value / total) * circumference
                const element = (
                  <path
                    data-arc
                    key={segment.label}
                    d={describeArc(50, 50, radius, circumference, offset, offset + dash)}
                    className={`fill-none ${segment.className}`}
                    strokeWidth="10"
                    strokeLinecap="butt"
                  />
                )
                offset += dash
                return element
              })}
          </g>
        </svg>

        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && <span className="text-xl font-semibold text-foreground tabular">{centerValue}</span>}
            {centerLabel && <span className="text-[11px] text-muted">{centerLabel}</span>}
          </div>
        )}
      </div>

      <ul className="w-full space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-control ${segment.className}`} aria-hidden="true" />
              <span className="truncate text-muted">{segment.label}</span>
            </span>
            <span className="shrink-0 tabular font-medium text-foreground">
              {segment.value.toLocaleString('en-IN')}
              <span className="ml-1.5 text-xs text-faint">
                {Math.round((segment.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>

      <HiddenTable
        caption={title}
        rows={segments.map((segment) => ({
          label: segment.label,
          value: `${segment.value.toLocaleString('en-IN')} (${Math.round((segment.value / total) * 100)}%)`,
        }))}
      />
    </div>
  )
}

/**
 * SVG arc path between two offsets on a circle, measured as a fraction of the
 * circumference starting from the top (the ring is rotated -90deg in markup).
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  circumference: number,
  start: number,
  end: number,
): string {
  const sweep = end - start

  /* A near-full circle cannot be drawn with a single arc command - split it. */
  if (sweep >= circumference - 0.001) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
  }

  const toAngle = (offsetValue: number) => (offsetValue / circumference) * 2 * Math.PI - Math.PI / 2
  const startAngle = toAngle(start)
  const endAngle = toAngle(end)

  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)

  return `M ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`
}

/* -------------------------------------------------------------------------- */
/* Horizontal meter                                                           */
/* -------------------------------------------------------------------------- */

export interface MeterRowProps {
  label: string
  value: number
  max: number
  /** Right-aligned detail, e.g. "42 students". */
  detail?: ReactNode
  className?: string
}

/**
 * Horizontal proportion bar for ranked lists (popular subjects / chapters).
 * Animates its width once on mount.
 */
export function MeterRow({ label, value, max, detail, className }: MeterRowProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const percent = max > 0 ? Math.max(2, (value / max) * 100) : 0

  useLayoutEffect(() => {
    const node = barRef.current
    if (!node) return
    if (!canAnimate()) {
      node.style.width = `${percent}%`
      return
    }
    const instance = animate(node, {
      width: ['0%', `${percent}%`],
      duration: dur(MOTION.duration.slow),
      ease: MOTION.ease.soft,
    })
    return stop(instance)
  }, [percent])

  return (
    <li className={className}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-foreground">{label}</span>
        <span className="shrink-0 tabular text-muted">{detail ?? value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-control bg-surface-sunken">
        <div ref={barRef} className="h-full rounded-control bg-brand" style={{ width: 0 }} />
      </div>
    </li>
  )
}
