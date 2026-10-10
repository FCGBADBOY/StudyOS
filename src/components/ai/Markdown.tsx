/**
 * Tiny, dependency-free Markdown renderer for AI answers.
 *
 * Deliberately small: it renders exactly what the tutor prompts ask for
 * (headings, lists, bold/italic, inline code, fenced code, blockquotes,
 * tables and horizontal rules) and nothing else — no raw HTML, ever. Every
 * node is built as React elements, so a model cannot inject markup.
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
          <code key={key} className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[12px] text-foreground">
            {token.value}
          </code>
        )
      case 'strong':
        return <strong key={key}>{token.value}</strong>
      case 'em':
        return <em key={key}>{token.value}</em>
      case 'link':
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-brand underline underline-offset-2"
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

function renderTable(lines: string[]): ReactNode {
  const cells = (row: string) =>
    row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  const [head, separator, ...body] = lines
  if (!head || !separator) return null

  return (
    <div className="overflow-x-auto no-scrollbar">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr>
            {cells(head).map((cell, index) => (
              <th key={index} className="border-b border-border-strong px-2 py-1.5 font-semibold text-foreground">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {cells(row).map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-border px-2 py-1.5 align-top text-muted">
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
    <div className={cn('space-y-2 text-sm leading-relaxed', className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case 'heading':
            return (
              <p key={key} className="pt-1 text-[15px] font-semibold text-foreground">
                {renderInline(parseInline(block.lines[0] ?? ''), key)}
              </p>
            )
          case 'code':
            return (
              <pre
                key={key}
                className="formula overflow-x-auto rounded-tile bg-surface-sunken p-3 text-[12px] leading-relaxed text-foreground no-scrollbar"
              >
                <code>{block.lines.join('\n')}</code>
              </pre>
            )
          case 'bullet':
            return (
              <ul key={key} className="space-y-1.5 pl-1">
                {block.lines.map((line, lineIndex) => (
                  <li key={lineIndex} className="flex gap-2 text-muted">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-soft" />
                    <span className="min-w-0 break-words">{renderInline(parseInline(line), `${key}-${lineIndex}`)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'ordered':
            return (
              <ol key={key} className="space-y-1.5">
                {block.lines.map((line, lineIndex) => (
                  <li key={lineIndex} className="flex gap-2 text-muted">
                    <span
                      aria-hidden
                      className="tabular mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-soft-fg"
                    >
                      {lineIndex + 1}
                    </span>
                    <span className="min-w-0 break-words">{renderInline(parseInline(line), `${key}-${lineIndex}`)}</span>
                  </li>
                ))}
              </ol>
            )
          case 'quote':
            return (
              <blockquote key={key} className="border-l-2 border-brand-soft pl-3 text-muted italic">
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>{renderInline(parseInline(line), `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            )
          case 'table':
            return <div key={key}>{renderTable(block.lines)}</div>
          case 'rule':
            return <hr key={key} className="border-border" />
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
