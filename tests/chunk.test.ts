/**
 * Academic chunker — unit tests.
 *
 * The chunker is what citations and retrieval quality depend on: chunks must
 * be semantically whole (never split a formula, never cross a heading) and
 * carry the metadata a citation is built from.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  chunkDocument,
  estimateTokens,
  DEFAULT_MAX_TOKENS,
  type Chunk,
} from '../supabase/functions/_shared/ai/retrieval/chunk.ts'

const METADATA = {
  board: 'CBSE',
  className: '12',
  subject: 'Physics',
  chapter: 'Electrostatic Potential',
  resource: 'Class 12 Physics Notes',
  resourceType: 'notes',
}

function contents(chunks: Chunk[]): string[] {
  return chunks.map((chunk) => chunk.content)
}

test('empty and whitespace input produce no chunks', () => {
  assert.deepEqual(chunkDocument(''), [])
  assert.deepEqual(chunkDocument('   \n\n  '), [])
  assert.deepEqual(chunkDocument(undefined as unknown as string), [])
})

test('every chunk carries the citation metadata it was created with', () => {
  const text = `# Electrostatic Potential

The potential energy of a system of charges is the work done in assembling them.

V = kQ/r

Q1. Define electric potential.
Solution: Work done per unit positive charge in bringing it from infinity.`
  const chunks = chunkDocument(text, { metadata: METADATA })

  assert.ok(chunks.length >= 2)
  chunks.forEach((chunk) => {
    assert.equal(chunk.metadata.board, 'CBSE')
    assert.equal(chunk.metadata.className, '12')
    assert.equal(chunk.metadata.subject, 'Physics')
    assert.equal(chunk.metadata.chapter, 'Electrostatic Potential')
    assert.equal(chunk.metadata.resourceType, 'notes')
    assert.ok(chunk.tokenCount > 0)
  })
})

test('headings become sections and never mix with the next section', () => {
  const text = `# Gauss Law

Gauss law relates flux through a closed surface to the enclosed charge.

# Potential

Electric potential is work done per unit charge. It is a scalar quantity.`
  const chunks = chunkDocument(text, { metadata: METADATA })

  const sections = new Set(chunks.map((chunk) => chunk.sectionTitle))
  assert.ok(sections.has('Gauss Law'))
  assert.ok(sections.has('Potential'))

  for (const chunk of chunks) {
    /* A chunk may only mention content from the section it belongs to —
       specifically it must not contain both section bodies. */
    const mentionsGauss = chunk.content.includes('flux through a closed surface')
    const mentionsPotential = chunk.content.includes('scalar quantity')
    assert.ok(!(mentionsGauss && mentionsPotential), `chunk mixed sections: ${chunk.content}`)
    if (mentionsGauss) assert.equal(chunk.sectionTitle, 'Gauss Law')
    if (mentionsPotential) assert.equal(chunk.sectionTitle, 'Potential')
  }
})

test('formulas are never merged into surrounding prose', () => {
  const text = `Electric field is the force per unit charge.

E = F/q

The direction of the field is the direction of the force on a positive charge.`
  const chunks = chunkDocument(text, { metadata: METADATA })

  const formulaChunk = chunks.find((chunk) => chunk.content.includes('E = F/q'))
  assert.ok(formulaChunk, 'expected a chunk containing the formula')
  assert.equal(formulaChunk.contentKind, 'formula')
  /* The formula chunk contains the formula only — not the prose around it. */
  assert.ok(!formulaChunk.content.includes('force per unit charge'))
})

test('questions and solutions keep their own kind so PYQ/archive links work', () => {
  const text = `Q1. State Gauss law in electrostatics.
Solution: The total electric flux through a closed surface equals the enclosed charge divided by epsilon naught.
Q2. What is a dipole?`
  const chunks = chunkDocument(text, { metadata: METADATA })

  const kinds = contents(chunks).map((content, index) => ({
    content,
    kind: chunks[index].contentKind,
  }))
  assert.ok(kinds.some((entry) => entry.kind === 'question' && entry.content.startsWith('Q1.')))
  assert.ok(kinds.some((entry) => entry.kind === 'solution' && entry.content.startsWith('Solution')))
})

test('no chunk exceeds the token cap (oversized prose is split on sentences)', () => {
  const sentences: string[] = []
  for (let index = 0; index < 200; index += 1) {
    sentences.push(
      `This is sentence number ${index} explaining a long physics idea in enough words to be meaningful prose.`,
    )
  }
  const chunks = chunkDocument(sentences.join(' '), { metadata: METADATA, maxTokens: 200 })

  assert.ok(chunks.length > 3, 'expected the prose to be split into several chunks')
  for (const chunk of chunks) {
    assert.ok(
      chunk.tokenCount <= 200,
      `chunk of ${chunk.tokenCount} tokens exceeded the 200 cap: ${chunk.content.slice(0, 60)}…`,
    )
  }
  /* Nothing is lost: every sentence still appears somewhere. */
  const joined = contents(chunks).join(' ')
  for (let index = 0; index < 200; index += 1) {
    assert.ok(joined.includes(`sentence number ${index}`), `sentence ${index} was dropped`)
  }
})

test('page breaks from PDF extraction become page metadata', () => {
  const text = `Photosynthesis is the process by which plants prepare food.\fChlorophyll is the pigment that absorbs light.`
  const chunks = chunkDocument(text, { metadata: METADATA })

  const pages = chunks.map((chunk) => chunk.metadata.page)
  assert.ok(pages.includes(1), 'first page should be labelled page 1')
  assert.ok(pages.includes(2), 'second page should be labelled page 2')
})

test('chunk indexes are dense and sequential (stable ids for citations)', () => {
  const text = `# Topic A

Some content for topic A that is long enough to survive the noise filter.

# Topic B

Some content for topic B that is long enough to survive the noise filter.`
  const chunks = chunkDocument(text, { metadata: METADATA })
  chunks.forEach((chunk, index) => assert.equal(chunk.chunkIndex, index))
})

test('estimateTokens is monotonic and never zero for non-empty text', () => {
  assert.equal(estimateTokens(''), 0)
  assert.ok(estimateTokens('a') >= 1)
  assert.ok(estimateTokens('word '.repeat(40)) > estimateTokens('word '.repeat(4)))
  assert.equal(DEFAULT_MAX_TOKENS, 420)
})
