/**
 * Tiny, dependency-free Markdown renderer for AI answers.
 *
 * Deliberately small: it renders exactly what the tutor prompts ask for
 * (headings, lists, bold/italic, inline code, fenced code, blockquotes,
 * tables and horizontal rules) and nothing else — no raw HTML, ever. Every
 * node is built as React elements, so a model cannot inject markup.
 *
 * Visually it is treated as a *document* rather than a wall of text: a
 * comfortable measure, headings with real hierarchy, tinted callout panels for
 * blockquotes, monospaced `formula` panels for equations and code, and a list
 * rhythm that stays legible at 360px.
 */
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/* ------------------------------ inline parse ------------------------------ */

/** Tokens for the inline grammar: `code`, **bold**, *italic*, [text](href). */
type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'em'; value: string }
  | { kind: 'link'; value: string; href: string }

const INLINE_PATTERN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g

function safeHref(href: string): string | null {
  return /^(https?:|\/|#|mailto:)/i.test(href.trim()) ? href.trim() : null
}

export function parseInline(input: string): Inline[] {
  const tokens: Inline[] = []
  let cursor = 0
  for (const match of input.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ kind: 'text', value: input.slice(cursor, index) })
    const raw = match[0]
    if (raw.startsWith('`')) tokens.push({ kind: 'code', value: raw.slice(1, -1) })
    else if (raw.startsWith('**')) tokens.push({ kind: 'strong', value: raw.slice(2, -2) })
    else if (raw.startsWith('[')) {
      const split = raw.indexOf('](')
      const href = safeHref(raw.slice(split + 2, -1))
      if (href) tokens.push({ kind: 'link', value: raw.slice(1, split), href })
      else tokens.push({ kind: 'text', value: raw })
    } else tokens.push({ kind: 'em', value: raw.slice(1, -1) })
    cursor = index + raw.length
  }
  if (cursor < input.length) tokens.push({ kind: 'text', value: input.slice(cursor) })
  return tokens
}

function renderInline(tokens: Inline[], keyBase: string): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyBase}-${index}`
    switch (token.kind) {
      case 'code':
        return (
          <code
            key={key}
            className="rounded-[6px] bg-surface-sunken px-1.5 py-0.5 font-mono text-[12px] break-words text-foreground"
          >
            {token.value}
          </code>
        )
      case 'strong':
        return (
          <strong key={key} className="font-bold text-foreground">
            {token.value}
          </strong>
        )
      case 'em':
        return <em key={key}>{token.value}</em>
      case 'link':
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
          >
            {token.value}
          </a>
        )
      default:
        return <span key={key}>{token.value}</span>
    }
  })
}

/* ------------------------------- block parse ------------------------------ */

type BlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'ordered'
  | 'code'
  | 'quote'
  | 'table'
  | 'rule'

interface Block {
  type: BlockType
  lines: string[]
  level?: number
}

/** Split a markdown document into blocks (fenced code keeps its newlines). */
export function parseBlocks(markdown: string): Block[] {
  const lines = (markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (/^```/.test(line.trim())) {
      const body: string[] = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        body.push(lines[index])
        index += 1
      }
      index += 1 // closing fence
      blocks.push({ type: 'code', lines: body })
      continue
    }

    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', lines: [heading[2]], level: heading[1].length })
      index += 1
      continue
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: 'rule', lines: [] })
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const body: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', lines: body })
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const body: string[] = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*[-*+]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'bullet', lines: body })
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const body: string[] = []
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ordered', lines: body })
      continue
    }

    if (line.includes('|') && lines[index + 1]?.match(/^\s*\|?[\s:|-]+\|[\s:|-]*$/)) {
      const body = [line, lines[index + 1]]
      index += 2
      while (index < lines.length && lines[index].includes('|')) {
        body.push(lines[index])
        index += 1
      }
      blocks.push({ type: 'table', lines: body })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/.test(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph })
    else index += 1
  }

  return blocks
}

/** Headings scale down the deeper they go, so structure survives on a phone. */
function headingClass(level: number): string {
  if (level <= 2) return 'mt-4 text-[15.5px] font-bold tracking-tight text-foreground first:mt-0'
  if (level === 3) return 'mt-3 text-[14px] font-bold tracking-tight text-foreground first:mt-0'
  if (level === 4) return 'mt-3 text-[13px] font-bold uppercase tracking-[0.08em] text-muted first:mt-0'
  return 'mt-3 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-faint first:mt-0'
}

function renderTable(lines: string[]): ReactNode {
  const cells = (row: string) =>
    row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  const [head, separator, ...body] = lines
  if (!head || !separator) return null

  return (
    /* Horizontal scroll lives inside the panel — the page never widens. */
    <div className="max-w-full overflow-x-auto rounded-tile bg-cream no-scrollbar">
      <table className="w-full min-w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr>
            {cells(head).map((cell, index) => (
              <th
                key={index}
                className="border-b border-border-strong px-3 py-2 font-bold whitespace-nowrap text-foreground"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {cells(row).map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-border px-3 py-2 align-top text-muted last:border-b-0"
                >
                  {renderInline(parseInline(cell), `t${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------- renderer -------------------------------- */

export interface MarkdownProps {
  text: string
  className?: string
}

/** Render tutor markdown as safe React nodes. */
export function Markdown({ text, className }: MarkdownProps) {
  const blocks = parseBlocks(text ?? '')

  return (
    <div className={cn('max-w-[64ch] space-y-2.5 text-[14px] leading-[1.65]', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case 'heading':
            return (
              <p key={key} className={headingClass(block.level ?? 1)}>
                {renderInline(parseInline(block.lines[0] ?? ''), key)}
              </p>
            )
          case 'code':
            return (
              <pre
                key={key}
                className="formula max-w-full overflow-x-auto rounded-tile bg-surface-sunken p-3 text-[12px] leading-relaxed text-foreground no-scrollbar"
              >
                <code>{block.lines.join('\n')}</code>
              </pre>
            )
          case 'bullet':
            return (
              <ul key={key} className="space-y-1.5">
                {block.lines.map((line, lineIndex) => (
                  <li key={lineIndex} className="flex gap-2.5 text-muted">
                    <span
                      aria-hidden
                      className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70"
                    />
                    <span className="min-w-0 break-words">
                      {renderInline(parseInline(line), `${key}-${lineIndex}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          case 'ordered':
            return (
              <ol key={key} className="space-y-1.5">
                {block.lines.map((line, lineIndex) => (
                  <li key={lineIndex} className="flex gap-2.5 text-muted">
                    <span
                      aria-hidden
                      className="tabular mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[7px] bg-brand-soft text-[11px] font-bold text-brand-soft-fg"
                    >
                      {lineIndex + 1}
                    </span>
                    <span className="min-w-0 break-words">
                      {renderInline(parseInline(line), `${key}-${lineIndex}`)}
                    </span>
                  </li>
                ))}
              </ol>
            )
          case 'quote':
            return (
              <blockquote
                key={key}
                className="rounded-tile border-l-[3px] border-brand bg-cream px-3 py-2.5 text-muted italic"
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex} className="min-w-0 break-words">
                    {renderInline(parseInline(line), `${key}-${lineIndex}`)}
                  </p>
                ))}
              </blockquote>
            )
          case 'table':
            return <div key={key} className="max-w-full">{renderTable(block.lines)}</div>
          case 'rule':
            return <hr key={key} className="my-1 h-px border-0 bg-border" />
          default:
            return (
              <p key={key} className="break-words text-foreground">
                {renderInline(parseInline(block.lines.join(' ')), key)}
              </p>
            )
        }
      })}
    </div>
  )
}
