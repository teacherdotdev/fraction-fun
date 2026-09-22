export type Food = 'apple' | 'donut' | 'mix'
export type Numerators = 'unit' | 'mixed'

export type ActivitySettings = {
  title: string
  numbers: number[]
  denominators: number[]
  numerators: Numerators
  questions: number
  food: Food
  guided: boolean
}

export const NUMBER_CHOICES = [8, 12, 18, 20, 24, 30, 35, 36, 40, 42, 48]
export const DENOMINATOR_CHOICES = [2, 3, 4, 5, 6, 7, 8]

export const DEFAULT_SETTINGS: ActivitySettings = {
  title: 'Finding a Fraction of a Number',
  numbers: [20, 24, 35, 48],
  denominators: [4, 6, 7, 8],
  numerators: 'unit',
  questions: 5,
  food: 'mix',
  guided: true,
}

export function settingsToQuery(settings: ActivitySettings): string {
  const params = new URLSearchParams()
  params.set('play', '1')
  params.set('title', settings.title.trim() || DEFAULT_SETTINGS.title)
  params.set('nums', settings.numbers.join(','))
  params.set('dens', settings.denominators.join(','))
  params.set('parts', settings.numerators)
  params.set('questions', String(settings.questions))
  params.set('food', settings.food)
  params.set('guided', settings.guided ? '1' : '0')
  return params.toString()
}

export function settingsFromParams(params: URLSearchParams): ActivitySettings {
  const numbers = csvNumbers(params.get('nums')).filter((value) => NUMBER_CHOICES.includes(value))
  const denominators = csvNumbers(params.get('dens')).filter((value) =>
    DENOMINATOR_CHOICES.includes(value),
  )
  const rawQuestions = Number(params.get('questions'))
  const rawFood = params.get('food')
  const rawParts = params.get('parts')

  return {
    title: (params.get('title') || DEFAULT_SETTINGS.title).slice(0, 80),
    numbers: numbers.length ? numbers : DEFAULT_SETTINGS.numbers,
    denominators: denominators.length ? denominators : DEFAULT_SETTINGS.denominators,
    numerators: rawParts === 'mixed' ? 'mixed' : 'unit',
    questions: [3, 5, 10].includes(rawQuestions) ? rawQuestions : DEFAULT_SETTINGS.questions,
    food: rawFood === 'apple' || rawFood === 'donut' ? rawFood : 'mix',
    guided: params.get('guided') !== '0',
  }
}

export function validProblemCount(settings: ActivitySettings): number {
  return settings.numbers.reduce(
    (count, number) =>
      count + settings.denominators.filter((denominator) => number % denominator === 0).length,
    0,
  )
}

function csvNumbers(value: string | null): number[] {
  return (value || '')
    .split(',')
    .map(Number)
    .filter(Number.isFinite)
}
