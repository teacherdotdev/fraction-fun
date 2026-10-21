<script lang="ts" module>
  export type Highlight = 'numerator' | 'denominator' | 'whole' | null
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import type { Problem } from '../lib/problem'

  type Props = {
    problem: Problem
    /** Full screen on the Question step, pinned top-middle after. */
    pinned: boolean
    highlight?: Highlight
    /** Slides down and fades away when the answer takes over. */
    gone?: boolean
  }

  let { problem, pinned, highlight = null, gone = false }: Props = $props()

  let width = $state(innerWidth)
  let height = $state(innerHeight)
  // Hidden until the font loads, so the text never jumps when it swaps in.
  let ready = $state(false)

  // The text is always laid out at its full-screen size on one line, and pinning
  // only scales it, so it can never re-wrap mid-move.
  const fullSize = $derived(Math.min(width * 0.085, height * 0.16, 150))
  const pinnedSize = $derived(Math.min(34, width * 0.045))
  const scale = $derived(pinned ? pinnedSize / fullSize : 1)

  onMount(() => {
    const show = () => (ready = true)
    document.fonts?.ready.then(show)
    const fallback = setTimeout(show, 1200)
    return () => clearTimeout(fallback)
  })
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<h1
  class="island"
  class:pinned
  class:ready
  class:gone
  style={`font-size: ${fullSize}px; --scale: ${scale}`}
  aria-label={`What is ${problem.numerator} over ${problem.denominator} of ${problem.whole}?`}
>
  What is
  <span class="fraction" aria-hidden="true">
    <span class="part" class:lit={highlight === 'numerator'}>{problem.numerator}</span>
    <span class="bar"></span>
    <span class="part" class:lit={highlight === 'denominator'}>{problem.denominator}</span>
  </span>
  of
  <span><span class="part" class:lit={highlight === 'whole'}>{problem.whole}</span>?</span>
</h1>

<style>
  .island {
    position: fixed;
    left: 50%;
    top: 42%;
    z-index: 5;
    margin: 0;
    padding: 0.12em 0.7em;
    border-radius: 999px;
    white-space: nowrap;
    font-family: var(--font);
    font-weight: 700;
    line-height: 1.15;
    color: var(--ink);
    background: transparent;
    display: flex;
    align-items: center;
    gap: 0.25em;
    opacity: 0;
    transform: translate(-50%, -50%) scale(var(--scale));
    transform-origin: center;
    transition:
      top 0.6s cubic-bezier(0.65, 0, 0.35, 1),
      transform 0.6s cubic-bezier(0.65, 0, 0.35, 1),
      background-color 0.4s,
      box-shadow 0.4s,
      opacity 0.3s;
  }

  .ready {
    opacity: 1;
  }

  .pinned {
    top: 52px;
    background: #fff;
    /* Scaled down with the text, so it's drawn large here. */
    box-shadow: 0 0.25em 1em #2b2b3a1f;
  }

  .ready.gone {
    top: 96px;
    opacity: 0;
  }

  .fraction {
    display: inline-grid;
    justify-items: center;
    font-size: 0.6em;
    line-height: 1;
  }

  /* Its own element so the highlight's rounded corners can't bend it. */
  .bar {
    width: 100%;
    min-width: 0.9em;
    height: 0.1em;
    margin: 0.06em 0;
    background: currentColor;
    position: relative;
    z-index: 1;
  }

  .part {
    display: inline-block;
    border-radius: 0.2em;
    transition:
      background-color 0.3s,
      box-shadow 0.3s,
      transform 0.3s;
  }

  /* A glow rather than padding, so lighting a part never shifts the text. */
  .lit {
    background: #ffd23f;
    /* Sideways only, so it never covers the fraction bar. */
    box-shadow:
      0.1em 0 0 #ffd23f,
      -0.1em 0 0 #ffd23f;
    transform: scale(1.12);
  }
</style>
