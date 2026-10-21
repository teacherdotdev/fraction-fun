// The round food a problem is worked on, and the words students see for it.

export type Item = 'donut' | 'pizza'

export type ItemWords = {
  /** The food itself: "donut". */
  name: string
  /** One topping dealt onto it: "sprinkle". */
  topping: string
  /** More than one topping: "sprinkles". */
  toppings: string
}

export const ITEM_WORDS: Record<Item, ItemWords> = {
  donut: { name: 'donut', topping: 'sprinkle', toppings: 'sprinkles' },
  // "How many pepperoni in one group?" reads more naturally than "pepperonis".
  pizza: { name: 'pizza', topping: 'pepperoni', toppings: 'pepperoni' },
}

/** Reads `?item=pizza`. Anything else is a donut. */
export function itemFromParams(params: URLSearchParams): Item {
  return params.get('item') === 'pizza' ? 'pizza' : 'donut'
}

/** "1 sprinkle", "2 sprinkles": the topping word for a count. */
export function toppingsFor(item: Item, count: number): string {
  const words = ITEM_WORDS[item]
  return count === 1 ? words.topping : words.toppings
}
