import type { Formula } from '@/types'

/** Formula Explorer — large, readable formulae with variable tables. */
export const FORMULAS: Formula[] = [
  {
    id: 'f-capacitor-energy',
    title: 'Energy stored in a capacitor',
    expression: 'U = ½CV²',
    subjectId: 'physics',
    chapter: 'Electrostatics',
    topic: 'Capacitors',
    siUnit: 'joule (J)',
    tags: ['capacitor energy', 'electrostatics', 'u = ½cv²', 'energy'],
    variables: [
      { symbol: 'U', meaning: 'Energy stored in the electric field', unit: 'J' },
      { symbol: 'C', meaning: 'Capacitance of the capacitor', unit: 'F (farad)' },
      { symbol: 'V', meaning: 'Potential difference across plates', unit: 'V (volt)' },
    ],
    related: [
      { title: 'Capacitance', expression: 'Q = CV' },
      { title: 'Energy in terms of charge', expression: 'U = Q² / 2C' },
      { title: 'Energy in terms of charge & voltage', expression: 'U = ½QV' },
    ],
    commonMistakes: [
      'Writing U = CV² — the½ is easy to drop under exam pressure.',
      'Mixing V (potential difference) with E (electric field); U = ½CV² uses the voltage across the capacitor.',
      'Forgetting that energy in a dielectric-filled capacitor becomes U = ½CV²/K.',
    ],
  },
  {
    id: 'f-capacitance',
    title: 'Capacitance definition',
    expression: 'Q = CV',
    subjectId: 'physics',
    chapter: 'Electrostatics',
    topic: 'Capacitors',
    siUnit: 'farad (F)',
    tags: ['capacitor', 'charge', 'capacitance'],
    variables: [
      { symbol: 'Q', meaning: 'Charge stored on either plate', unit: 'C (coulomb)' },
      { symbol: 'C', meaning: 'Capacitance', unit: 'F (farad)' },
      { symbol: 'V', meaning: 'Potential difference', unit: 'V (volt)' },
    ],
    related: [
      { title: 'Parallel plate capacitor', expression: 'C = ε₀A / d' },
      { title: 'Energy stored', expression: 'U = ½CV²' },
      { title: 'Sphere capacitance', expression: 'C = 4πε₀R' },
    ],
    commonMistakes: [
      'C depends on geometry, not on Q or V — changing the charge does not change capacitance.',
      'Using area in cm² without converting to m².',
    ],
  },
  {
    id: 'f-parallel-plate',
    title: 'Parallel plate capacitance',
    expression: 'C = ε₀A / d',
    subjectId: 'physics',
    chapter: 'Electrostatics',
    topic: 'Capacitors',
    siUnit: 'farad (F)',
    tags: ['capacitor', 'parallel plate', 'dielectric'],
    variables: [
      { symbol: 'ε₀', meaning: 'Permittivity of free space', unit: '8.85 × 10⁻¹² C²/N·m²' },
      { symbol: 'A', meaning: 'Area of each plate', unit: 'm²' },
      { symbol: 'd', meaning: 'Separation between plates', unit: 'm' },
    ],
    related: [
      { title: 'With dielectric', expression: 'C = Kε₀A / d' },
      { title: 'Energy stored', expression: 'U = ½CV²' },
    ],
    commonMistakes: [
      'd is inversely proportional — doubling separation halves C.',
      'With a dielectric slab of thickness t: C = ε₀A / (d – t + t/K).',
    ],
  },
  {
    id: 'f-ohm',
    title: 'Ohm’s law',
    expression: 'V = IR',
    subjectId: 'physics',
    chapter: 'Current Electricity',
    topic: 'Ohm’s law',
    siUnit: 'volt (V)',
    tags: ['ohm', 'resistance', 'current'],
    variables: [
      { symbol: 'V', meaning: 'Potential difference', unit: 'V' },
      { symbol: 'I', meaning: 'Current', unit: 'A' },
      { symbol: 'R', meaning: 'Resistance', unit: 'Ω' },
    ],
    related: [
      { title: 'Resistance', expression: 'R = ρL / A' },
      { title: 'Power', expression: 'P = VI = I²R' },
    ],
    commonMistakes: [
      'Ohm’s law holds only for ohmic conductors at constant temperature.',
      'ρ changes with temperature — do not treat resistivity as a constant in numericals.',
    ],
  },
  {
    id: 'f-drift',
    title: 'Drift velocity and mobility',
    expression: 'I = nAev_d',
    subjectId: 'physics',
    chapter: 'Current Electricity',
    topic: 'Drift velocity',
    siUnit: 'ampere (A)',
    tags: ['drift velocity', 'current density', 'mobility'],
    variables: [
      { symbol: 'n', meaning: 'Number density of free electrons', unit: 'm⁻³' },
      { symbol: 'e', meaning: 'Charge of an electron', unit: '1.6 × 10⁻¹⁹ C' },
      { symbol: 'v_d', meaning: 'Drift velocity', unit: 'm/s' },
      { symbol: 'A', meaning: 'Cross-sectional area', unit: 'm²' },
    ],
    related: [
      { title: 'Current density', expression: 'J = nev_d' },
      { title: 'Mobility', expression: 'μ = v_d / E' },
    ],
    commonMistakes: [
      'Drift velocity is tiny (≈ mm/s) — never confuse it with signal speed.',
      'n is per m³, not per cm³.',
    ],
  },
  {
    id: 'f-nernst',
    title: 'Nernst equation',
    expression: 'E = E° – (0.059 / n) · log Q',
    subjectId: 'chemistry',
    chapter: 'Electrochemistry',
    topic: 'Nernst equation',
    siUnit: 'volt (V)',
    tags: ['nernst', 'electrochemistry', 'cell potential', 'emf'],
    variables: [
      { symbol: 'E', meaning: 'Cell potential under given conditions', unit: 'V' },
      { symbol: 'E°', meaning: 'Standard electrode potential', unit: 'V' },
      { symbol: 'n', meaning: 'Number of electrons transferred', unit: 'dimensionless' },
      { symbol: 'Q', meaning: 'Reaction quotient (products/reactants)', unit: 'dimensionless' },
    ],
    related: [
      { title: 'Gibbs energy', expression: 'ΔG° = –nFE°' },
      { title: 'Equilibrium constant', expression: 'E° = (0.059 / n) · log K' },
      { title: 'Nernst (general form)', expression: 'E = E° – (RT / nF) · ln Q' },
    ],
    commonMistakes: [
      'Sign error in Q — write the balanced cell reaction first.',
      'Use 0.059 only at 298 K; otherwise use RT/F·2.303.',
      'Forgetting that solids and pure liquids are not included in Q.',
    ],
  },
  {
    id: 'f-rate-law',
    title: 'First-order rate law',
    expression: 'k = (2.303 / t) · log([A]₀ / [A])',
    subjectId: 'chemistry',
    chapter: 'Chemical Kinetics',
    topic: 'Order of reaction',
    siUnit: 's⁻¹ (first order)',
    tags: ['rate law', 'half life', 'kinetics', 'arrhenius'],
    variables: [
      { symbol: 'k', meaning: 'Rate constant', unit: 's⁻¹' },
      { symbol: '[A]₀', meaning: 'Initial concentration', unit: 'mol/L' },
      { symbol: '[A]', meaning: 'Concentration at time t', unit: 'mol/L' },
    ],
    related: [
      { title: 'Half-life', expression: 't½ = 0.693 / k' },
      { title: 'Arrhenius equation', expression: 'k = A·e^(–Ea/RT)' },
    ],
    commonMistakes: [
      'Half-life of a first-order reaction is independent of concentration.',
      'Log base 10 needs the 2.303 factor; ln does not.',
    ],
  },
  {
    id: 'f-first-law',
    title: 'First law of thermodynamics',
    expression: 'ΔU = q + w',
    subjectId: 'chemistry',
    chapter: 'Solutions',
    topic: 'Thermodynamics refresher',
    siUnit: 'joule (J)',
    tags: ['thermo', 'enthalpy', 'internal energy'],
    variables: [
      { symbol: 'ΔU', meaning: 'Change in internal energy', unit: 'J' },
      { symbol: 'q', meaning: 'Heat exchanged', unit: 'J' },
      { symbol: 'w', meaning: 'Work done', unit: 'J' },
    ],
    related: [
      { title: 'Enthalpy', expression: 'ΔH = ΔU + Δn_g RT' },
      { title: 'Work of expansion', expression: 'w = –P_extΔV' },
    ],
    commonMistakes: [
      'IUPAC sign convention: work done ON the system is positive.',
      'Δn_g counts only gaseous moles.',
    ],
  },
  {
    id: 'f-integration-by-parts',
    title: 'Integration by parts',
    expression: '∫u·dv = u·v – ∫v·du',
    subjectId: 'mathematics',
    chapter: 'Integrals',
    topic: 'Techniques of integration',
    siUnit: 'dimensionless',
    tags: ['integration', 'by parts', 'ilarte'],
    variables: [
      { symbol: 'u', meaning: 'First function (choose by ILATE order)', unit: '—' },
      { symbol: 'dv', meaning: 'Second function with dx', unit: '—' },
    ],
    related: [
      { title: 'Definite form', expression: '∫ₐᵇ u dv = [u v]ₐᵇ – ∫ₐᵇ v du' },
      { title: 'By substitution', expression: '∫ f(g(x)) g′(x) dx' },
    ],
    commonMistakes: [
      'ILATE priority: Inverse, Log, Algebraic, Trig, Exponential.',
      'Do not forget to evaluate the remaining integral — stopping at u·v is the classic 2-mark loss.',
    ],
  },
  {
    id: 'f-binomial',
    title: 'Binomial probability',
    expression: 'P(X = x) = ⁿCₓ · pˣ · qⁿ⁻ˣ',
    subjectId: 'mathematics',
    chapter: 'Probability',
    topic: 'Binomial distribution',
    siUnit: 'dimensionless',
    tags: ['probability', 'bayes', 'distribution'],
    variables: [
      { symbol: 'n', meaning: 'Number of trials', unit: '—' },
      { symbol: 'p', meaning: 'Probability of success', unit: '—' },
      { symbol: 'q', meaning: 'Probability of failure (1 – p)', unit: '—' },
    ],
    related: [
      { title: 'Mean', expression: 'Mean = np' },
      { title: 'Variance', expression: 'Variance = npq' },
      { title: 'Bayes’ theorem', expression: 'P(A|B) = P(B|A)·P(A) / P(B)' },
    ],
    commonMistakes: [
      'n is fixed and trials must be independent.',
      'q = 1 – p, not 1 – n.',
    ],
  },
  {
    id: 'f-lens',
    title: 'Lens maker’s formula',
    expression: '1/f = (n – 1) · (1/R₁ – 1/R₂)',
    subjectId: 'physics',
    chapter: 'Ray Optics',
    topic: 'Refraction by lenses',
    siUnit: 'metre (m)',
    tags: ['lens', 'focal length', 'refraction'],
    variables: [
      { symbol: 'f', meaning: 'Focal length of the lens', unit: 'm' },
      { symbol: 'n', meaning: 'Refractive index of lens material', unit: '—' },
      { symbol: 'R₁, R₂', meaning: 'Radii of curvature of the two surfaces', unit: 'm' },
    ],
    related: [
      { title: 'Thin lens formula', expression: '1/v – 1/u = 1/f' },
      { title: 'Magnification', expression: 'm = v/u' },
    ],
    commonMistakes: [
      'Sign convention: R is positive if the centre of curvature is on the right.',
      'f is positive for a convex lens in air.',
    ],
  },
  {
    id: 'f-magnetic-force',
    title: 'Force on a moving charge',
    expression: 'F = qvB sin θ',
    subjectId: 'physics',
    chapter: 'Moving Charges and Magnetism',
    topic: 'Lorentz force',
    siUnit: 'newton (N)',
    tags: ['magnetic force', 'lorentz', 'cyclotron'],
    variables: [
      { symbol: 'q', meaning: 'Charge', unit: 'C' },
      { symbol: 'v', meaning: 'Velocity of the charge', unit: 'm/s' },
      { symbol: 'B', meaning: 'Magnetic field', unit: 'T' },
      { symbol: 'θ', meaning: 'Angle between v and B', unit: 'degree' },
    ],
    related: [
      { title: 'Radius of circular path', expression: 'r = mv / qB' },
      { title: 'Cyclotron frequency', expression: 'f = qB / 2πm' },
    ],
    commonMistakes: [
      'Magnetic force does no work — speed never changes.',
      'θ = 0° means F = 0; maximum at θ = 90°.',
    ],
  },
]

export function searchFormulas(query: string): Formula[] {
  const clean = query.trim().toLowerCase()
  if (!clean) return FORMULAS
  return FORMULAS.filter((formula) => {
    const haystack = [
      formula.title,
      formula.expression,
      formula.chapter,
      formula.topic,
      formula.subjectId,
      ...formula.tags,
      ...formula.variables.map((variable) => `${variable.symbol} ${variable.meaning}`),
    ]
      .join(' ')
      .toLowerCase()
    return clean.split(/\s+/).every((token) => haystack.includes(token))
  })
}

export function getFormula(id?: string): Formula | undefined {
  return FORMULAS.find((formula) => formula.id === id)
}
