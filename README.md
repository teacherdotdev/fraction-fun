# Fraction Fall

A visual Svelte 5 activity for understanding fractions of whole numbers. Teachers choose the numbers, denominators, fraction level, number of questions, visual, and amount of scaffolding. Every choice is encoded in a shareable student link, so there are no accounts or backend to manage.

## Student experience

1. Identify the fraction.
2. Connect the denominator to the number of equal groups.
3. Drag or tap the matching slicer onto an apple or donut.
4. Watch counters fall and distribute equally.
5. Read the highlighted part and answer the question.

## Development

```bash
npm install
npm run dev
```

Validate and build the production site:

```bash
npm run check
npm run build
```

Cloudflare Web Analytics is enabled in production when `VITE_CF_BEACON` is set.
