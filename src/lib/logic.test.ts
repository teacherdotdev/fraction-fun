import { describe, expect, it } from 'vitest'
import { angleOf, CENTER, countingOrder, dealTo, focusOn, PEPPERONI_RADIUS, sprinkleSlots } from './donut'
import { planFlight, positionAt } from './flight'
import { itemFromParams, toppingsFor } from './items'
import { CHEESE_MIN_RADIUS } from './pizzaArt'
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

describe('items', () => {
  it('reads ?item=pizza and treats anything else as a donut', () => {
    expect(itemFromParams(params('item=pizza&n=1&d=4&of=20'))).toBe('pizza')
    expect(itemFromParams(params(''))).toBe('donut')
    expect(itemFromParams(params('item=Pizza'))).toBe('donut')
    expect(itemFromParams(params('item=bagel'))).toBe('donut')
  })

  it('names the pieces for each item', () => {
    expect(toppingsFor('donut', 1)).toBe('sprinkle')
    expect(toppingsFor('donut', 20)).toBe('sprinkles')
    expect(toppingsFor('pizza', 1)).toBe('pepperoni')
    expect(toppingsFor('pizza', 20)).toBe('pepperoni')
    expect(hintFor(DEFAULT_PROBLEM, 'sprinkles', 2, 'pizza')?.text).toBe("We're sharing 20 pepperoni.")
    expect(hintFor(DEFAULT_PROBLEM, 'sprinkles', 2)?.text).toBe("We're sharing 20 sprinkles.")
  })
})

describe('pepperoni on a pizza', () => {
  // Every group count, with the most pepperoni each group can get (48 shared out).
  const cases = Array.from({ length: 11 }, (_, i) => i + 2).map((groups) => ({
    groups,
    count: Math.floor(48 / groups),
  }))

  it.each(cases)('never overlap in $groups groups of $count', ({ groups, count }) => {
    for (let index = 0; index < groups; index += 1) {
      const slots = sprinkleSlots(index, groups, count, 'pizza')
      const closest = Math.min(
        ...slots.flatMap((a, i) => slots.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
      )
      // A clear gap between neighbours, not just touching.
      expect(closest).toBeGreaterThan(PEPPERONI_RADIUS * 2 + 2)
    }
  })

  it.each(cases)('stay whole inside their slice and on the cheese in $groups groups', ({ groups, count }) => {
    for (let index = 0; index < groups; index += 1) {
      const start = angleOf(index, groups)
      const span = (Math.PI * 2) / groups
      for (const p of sprinkleSlots(index, groups, count, 'pizza')) {
        const radius = Math.hypot(p.x - CENTER, p.y - CENTER)
        const turn = (((Math.atan2(p.y - CENTER, p.x - CENTER) - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        expect(turn).toBeLessThanOrEqual(span)
        // Straight-line distance to each cut is more than a pepperoni's radius.
        const toCut = (t: number) => (t >= Math.PI / 2 ? radius : radius * Math.sin(t))
        expect(toCut(turn)).toBeGreaterThan(PEPPERONI_RADIUS + 1)
        expect(toCut(span - turn)).toBeGreaterThan(PEPPERONI_RADIUS + 1)
        // On the cheese, clear of the sauce and crust.
        expect(radius + PEPPERONI_RADIUS).toBeLessThanOrEqual(CHEESE_MIN_RADIUS)
      }
    }
  })

  it('leave the donut exactly as it was', () => {
    expect(sprinkleSlots(2, 6, 8, 'donut')).toEqual(sprinkleSlots(2, 6, 8))
    // Pinned from before pizzas existed, so the donut's sprinkles never move.
    const before = [
      { x: 334.55818065524784, y: 227.71406274432405 },
      { x: 286.37841853178094, y: 242.7496303790514 },
      { x: 301.3902644858037, y: 209.73447100247748 },
      { x: 313.8643829443874, y: 254.8952293234624 },
    ]
    sprinkleSlots(3, 12, 4).forEach((slot, i) => {
      expect(slot.x).toBeCloseTo(before[i].x, 9)
      expect(slot.y).toBeCloseTo(before[i].y, 9)
    })
  })

  it('zoom keeps a pizza slice inside the clear middle of the view', () => {
    for (let groups = 2; groups <= 12; groups += 1) {
      const { scale } = focusOn(0, groups, 'pizza')
      expect(scale).toBeGreaterThanOrEqual(1)
      expect(scale).toBeLessThanOrEqual(focusOn(0, groups).scale)
    }
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
