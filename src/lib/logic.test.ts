import { describe, expect, it } from 'vitest'
import { countingOrder, dealTo, sprinkleSlots } from './donut'
import { planFlight, positionAt } from './flight'
import { answerOf, DEFAULT_PROBLEM, fractionWords, problemFromParams, shareOf } from './problem'
import { hintFor, nextStep, STEPS, targetFor } from './steps'

const params = (query: string) => new URLSearchParams(query)

describe('problemFromParams', () => {
  it('defaults to one fourth of 20', () => {
    expect(problemFromParams(params(''))).toEqual(DEFAULT_PROBLEM)
  })

  it('reads elevenths and twelfths', () => {
    expect(problemFromParams(params('n=3&d=11&of=33'))).toEqual({ numerator: 3, denominator: 11, whole: 33 })
    expect(problemFromParams(params('n=5&d=12&of=36'))).toEqual({ numerator: 5, denominator: 12, whole: 36 })
  })

  it('reads a valid problem', () => {
    expect(problemFromParams(params('n=2&d=6&of=24'))).toEqual({
      numerator: 2,
      denominator: 6,
      whole: 24,
    })
  })

  it.each([
    'n=1&d=4&of=21', // not shared equally
    'n=1&d=13&of=39', // too many groups
    'n=3&d=11', // 20 doesn't share into elevenths
    'n=1&d=1&of=5',
    'n=4&d=4&of=20', // not a proper fraction
    'n=0&d=4&of=20',
    'n=1&d=4&of=52', // too many sprinkles
    'n=1&d=4&of=abc',
    'n=1.5&d=4&of=20',
  ])('falls back to the default for %s', (query) => {
    expect(problemFromParams(params(query))).toEqual(DEFAULT_PROBLEM)
  })
})

describe('words and answers', () => {
  it('names the fraction', () => {
    expect(fractionWords({ numerator: 1, denominator: 4, whole: 20 })).toBe('one fourth')
    expect(fractionWords({ numerator: 3, denominator: 8, whole: 48 })).toBe('three eighths')
    expect(fractionWords({ numerator: 1, denominator: 2, whole: 8 })).toBe('one half')
    expect(fractionWords({ numerator: 5, denominator: 12, whole: 36 })).toBe('five twelfths')
  })

  it('finds the share and the answer', () => {
    const problem = { numerator: 2, denominator: 4, whole: 20 }
    expect(shareOf(problem)).toBe(5)
    expect(answerOf(problem)).toBe(10)
  })
})

describe('steps', () => {
  it('always ends Count → Pick → Answer, even for a unit fraction', () => {
    expect(STEPS).toEqual(['question', 'groups', 'sprinkles', 'count', 'pick', 'answer'])
    expect(nextStep('count')).toBe('pick')
    expect(nextStep('pick')).toBe('answer')
  })

  it('knows what each step needs', () => {
    const problem = { numerator: 2, denominator: 4, whole: 20 }
    expect(targetFor(problem, 'groups')).toBe(4)
    expect(targetFor(problem, 'sprinkles')).toBe(20)
    expect(targetFor(problem, 'count')).toBe(5)
    expect(targetFor(problem, 'pick')).toBe(2)
  })
})

describe('hints', () => {
  it('get more direct and pulse on the third try', () => {
    expect(hintFor(DEFAULT_PROBLEM, 'groups', 0)).toBeNull()
    expect(hintFor(DEFAULT_PROBLEM, 'groups', 1)).toEqual({
      text: 'Fourths means how many equal groups?',
      pulse: false,
    })
    expect(hintFor(DEFAULT_PROBLEM, 'groups', 2)?.text).toBe('Fourths → 4 equal groups.')
    expect(hintFor(DEFAULT_PROBLEM, 'groups', 5)?.pulse).toBe(true)
  })
})

describe('dealing', () => {
  it('deals sprinkles round the groups in turn', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => dealTo(n, 4))).toEqual([
      { group: 0, slot: 0 },
      { group: 1, slot: 0 },
      { group: 2, slot: 0 },
      { group: 3, slot: 0 },
      { group: 0, slot: 1 },
      { group: 1, slot: 1 },
    ])
  })

  it('places sprinkles far enough apart to tell apart', () => {
    for (const groups of [2, 3, 4, 6, 8, 10, 12]) {
      const slots = sprinkleSlots(0, groups, Math.ceil(48 / groups))
      const closest = Math.min(
        ...slots.flatMap((a, i) => slots.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
      )
      expect(closest).toBeGreaterThan(14)
    }
  })

  it('counts every sprinkle exactly once', () => {
    const slots = sprinkleSlots(0, 4, 12)
    expect([...countingOrder(slots, 0, 4)].sort((a, b) => a - b)).toEqual(
      slots.map((_, i) => i),
    )
  })
})

describe('flight', () => {
  it('lands on the target at the end of the throw', () => {
    const flight = planFlight({ x: -30, y: 700 }, { x: 600, y: 400 }, 0.8)
    const end = positionAt(flight, 0.8)
    expect(end.x).toBeCloseTo(600)
    expect(end.y).toBeCloseTo(400)
  })

  it('arcs above both ends', () => {
    const flight = planFlight({ x: 0, y: 700 }, { x: 600, y: 400 }, 0.8)
    expect(positionAt(flight, 0.4).y).toBeLessThan(400)
  })
})
