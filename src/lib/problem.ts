export type Problem = {
  numerator: number
  denominator: number
  whole: number
}

export const DEFAULT_PROBLEM: Problem = { numerator: 1, denominator: 4, whole: 20 }

export const MIN_DENOMINATOR = 2
export const MAX_DENOMINATOR = 12
export const MAX_WHOLE = 48

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
]

const FRACTION_NAMES: Record<number, [singular: string, plural: string]> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['fourth', 'fourths'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'],
  9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'],
  11: ['eleventh', 'elevenths'],
  12: ['twelfth', 'twelfths'],
}

/** Reads `?n=1&d=4&of=20`. Any invalid value falls back to the whole default problem. */
export function problemFromParams(params: URLSearchParams): Problem {
  const numerator = Number(params.get('n') ?? DEFAULT_PROBLEM.numerator)
  const denominator = Number(params.get('d') ?? DEFAULT_PROBLEM.denominator)
  const whole = Number(params.get('of') ?? DEFAULT_PROBLEM.whole)
  const problem = { numerator, denominator, whole }
  return isValidProblem(problem) ? problem : DEFAULT_PROBLEM
}

export function isValidProblem({ numerator, denominator, whole }: Problem): boolean {
  return (
    [numerator, denominator, whole].every(Number.isInteger) &&
    denominator >= MIN_DENOMINATOR &&
    denominator <= MAX_DENOMINATOR &&
    numerator >= 1 &&
    numerator < denominator &&
    whole >= denominator &&
    whole <= MAX_WHOLE &&
    whole % denominator === 0
  )
}

/** How many sprinkles land on each group. */
export function shareOf(problem: Problem): number {
  return problem.whole / problem.denominator
}

export function answerOf(problem: Problem): number {
  return shareOf(problem) * problem.numerator
}

export function numberWord(value: number): string {
  return NUMBER_WORDS[value] ?? String(value)
}

/** "fourth" for one, "fourths" for any other count. */
export function fractionName(denominator: number, count = 1): string {
  const [singular, plural] = FRACTION_NAMES[denominator]
  return count === 1 ? singular : plural
}

/** "one fourth", "two fourths". */
export function fractionWords(problem: Problem): string {
  return `${numberWord(problem.numerator)} ${fractionName(problem.denominator, problem.numerator)}`
}
