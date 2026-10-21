// Geometry for a donut drawn in a 400×400 box centred on (200, 200).
// Group 0 starts at twelve o'clock and groups go clockwise.

export const CENTER = 200
export const OUTER_RADIUS = 186
export const HOLE_RADIUS = 56
/** Sprinkles stay on the frosting, between these radii. */
const SPRINKLE_INNER = 92
const SPRINKLE_OUTER = 138
/** How far each group moves out from the centre once chopped. */
export const CHOP_GAP = 12

export type Point = { x: number; y: number }

export function angleOf(index: number, groups: number): number {
  return -Math.PI / 2 + (index / groups) * Math.PI * 2
}

export function polar(radius: number, angle: number): Point {
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) }
}

/** An annular sector covering one group, padded past the donut so it can clip the art. */
export function wedgePath(index: number, groups: number): string {
  if (groups === 1) {
    const r = OUTER_RADIUS + 8
    return `M${CENTER - r} ${CENTER}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
  }
  const start = angleOf(index, groups)
  const end = angleOf(index + 1, groups)
  const large = end - start > Math.PI ? 1 : 0
  const r = OUTER_RADIUS + 8
  const a = polar(r, start)
  const b = polar(r, end)
  return `M${CENTER} ${CENTER}L${a.x} ${a.y}A${r} ${r} 0 ${large} 1 ${b.x} ${b.y}Z`
}

/** Direction a chopped group drifts: out along the middle of its wedge. */
export function chopOffset(index: number, groups: number, distance = CHOP_GAP): Point {
  if (groups === 1) return { x: 0, y: 0 }
  const middle = angleOf(index + 0.5, groups)
  return { x: Math.cos(middle) * distance, y: Math.sin(middle) * distance }
}

/** How to zoom so one group fills the view: the point to centre on and the scale. */
export function focusOn(index: number, groups: number): { centre: Point; scale: number } {
  if (groups === 1) return { centre: { x: CENTER, y: CENTER }, scale: 1 }
  const offset = chopOffset(index, groups)
  const points: Point[] = []
  for (let step = 0; step <= 16; step += 1) {
    const angle = angleOf(index + step / 16, groups)
    points.push(polar(OUTER_RADIUS, angle), polar(HOLE_RADIUS, angle))
  }
  const xs = points.map((p) => p.x + offset.x)
  const ys = points.map((p) => p.y + offset.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  return {
    centre: { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 },
    scale: Math.min(Math.max(340 / Math.max(width, height), 1), 2.4),
  }
}

/** The visual centre of a group's frosting, for badges. */
export function groupCentre(index: number, groups: number): Point {
  return polar((SPRINKLE_INNER + SPRINKLE_OUTER) / 2, angleOf(index + 0.5, groups))
}

/**
 * Spread-out sprinkle positions inside one group, in the order they get filled.
 * Uses best-candidate sampling with a fixed seed so a problem always looks the same.
 */
export function sprinkleSlots(index: number, groups: number, count: number): Point[] {
  const random = seeded(index * 977 + groups * 131 + 7)
  const span = (Math.PI * 2) / groups
  const start = angleOf(index, groups)
  // Keep sprinkles clear of the cut on both sides.
  const margin = Math.min(span * 0.12, 16 / SPRINKLE_INNER)
  const slots: Point[] = []
  for (let n = 0; n < count; n += 1) {
    let best: Point | null = null
    let bestDistance = -1
    for (let tries = 0; tries < 80; tries += 1) {
      // Area-uniform radius so the outer band isn't sparse.
      const radius = Math.sqrt(
        SPRINKLE_INNER ** 2 + random() * (SPRINKLE_OUTER ** 2 - SPRINKLE_INNER ** 2),
      )
      const angle = start + margin + random() * (span - margin * 2)
      const candidate = polar(radius, angle)
      const nearest = slots.reduce(
        (closest, slot) => Math.min(closest, Math.hypot(slot.x - candidate.x, slot.y - candidate.y)),
        Infinity,
      )
      if (nearest > bestDistance) {
        best = candidate
        bestDistance = nearest
      }
    }
    slots.push(best!)
  }
  return slots
}

/** Counting order inside a group: sweep clockwise so the numbers march round. */
export function countingOrder(slots: Point[], index: number, groups: number): number[] {
  const start = angleOf(index, groups)
  const sweep = (p: Point) => {
    const a = Math.atan2(p.y - CENTER, p.x - CENTER) - start
    return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  }
  return slots.map((_, i) => i).sort((a, b) => sweep(slots[a]) - sweep(slots[b]))
}

/** Sprinkle number `n` (0-based) is dealt to the next group in turn. */
export function dealTo(n: number, groups: number): { group: number; slot: number } {
  return { group: n % groups, slot: Math.floor(n / groups) }
}

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}
