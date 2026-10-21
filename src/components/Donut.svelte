<script lang="ts" module>
  export type LandedSprinkle = {
    id: number
    /** Its place in the dealing order: 0 for the first sprinkle thrown. */
    deal: number
    group: number
    slot: number
    color: string
    rotation: number
  }
</script>

<script lang="ts">
  import { FROSTING_PATH } from '../lib/donutArt'
  import {
    CENTER,
    chopOffset,
    focusOn,
    groupCentre,
    sprinkleSlots,
    wedgePath,
    type Point,
  } from '../lib/donut'
  import { MAX_WHOLE } from '../lib/problem'

  type Props = {
    /** Groups shown as cut lines before the chop, or as pieces after it. */
    groups: number
    chopped: boolean
    /** Briefly true while the knife goes through. */
    chopping?: boolean
    sprinkles?: LandedSprinkle[]
    glazed?: Set<number>
    dimmed?: Set<number>
    fallen?: Set<number>
    /** Numbers popped over sprinkles while counting, by sprinkle id. */
    counts?: Map<number, number>
    /** Big number on a whole group, by group index. */
    groupBadges?: Map<number, number>
    wobble?: boolean
    pulseGroups?: Set<number>
    /** Zoom in so this group fills the view. */
    focus?: number | null
    /** Groups drawn in greyscale, sprinkles and all, so colour marks what matters. */
    greyed?: Set<number>
    /** Grey the donut itself but keep every sprinkle in colour. */
    greyArt?: boolean
    onSprinkleTap?: (id: number) => void
    onGroupTap?: (group: number) => void
  }

  let {
    groups,
    chopped,
    chopping = false,
    sprinkles = [],
    glazed = new Set(),
    dimmed = new Set(),
    fallen = new Set(),
    counts = new Map(),
    groupBadges = new Map(),
    wobble = false,
    pulseGroups = new Set(),
    focus = null,
    greyed = new Set(),
    greyArt = false,
    onSprinkleTap,
    onGroupTap,
  }: Props = $props()

  const FROSTING = '#f28ab0'
  const GLAZE = '#ff4f98'
  const RING = (r: number) =>
    `M${CENTER - r} ${CENTER}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`

  let svg: SVGSVGElement
  const groupEls: SVGGElement[] = $state([])
  // Groups drift apart one frame after the chop so the move animates.
  let spread = $state(false)

  $effect(() => {
    if (!chopped) {
      spread = false
      return
    }
    // Two frames: one for the pieces to paint in place, one to start the move.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => (spread = true))
    })
    return () => cancelAnimationFrame(frame)
  })

  const slots = $derived(
    Array.from({ length: groups }, (_, i) => sprinkleSlots(i, groups, Math.ceil(MAX_WHOLE / groups))),
  )
  // Pre-compute fall directions so each piece tumbles its own way.
  const tumbles = $derived(
    Array.from({ length: groups }, (_, i) => ({
      x: (i % 2 ? 1 : -1) * (40 + ((i * 53) % 90)),
      spin: (i % 2 ? 1 : -1) * (25 + ((i * 37) % 40)),
    })),
  )

  /** Where a sprinkle slot is on screen, for aiming throws at it. */
  export function screenPoint(group: number, slot: number): Point | null {
    const el = groupEls[group] ?? svg
    const matrix = el?.getScreenCTM()
    const point = slots[group]?.[slot]
    if (!matrix || !point) return null
    const p = new DOMPoint(point.x, point.y).matrixTransform(matrix)
    return { x: p.x, y: p.y }
  }

  /** Where a group's big number badge sits on screen. */
  export function badgePoint(group: number): Point | null {
    const matrix = (groupEls[group] ?? svg)?.getScreenCTM()
    if (!matrix) return null
    const at = groupCentre(group, groups)
    const p = new DOMPoint(at.x, at.y).matrixTransform(matrix)
    return { x: p.x, y: p.y }
  }

  /** Screen size of one donut unit, so flying sprinkles match landed ones. */
  export function unitScale(): number {
    return svg ? svg.getBoundingClientRect().width / 400 : 1
  }

  export function centre(): Point {
    const box = svg.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  }

  const camera = $derived.by(() => {
    if (focus === null || !chopped) return 'transform: none'
    const { centre, scale } = focusOn(focus, groups)
    return `transform: translate(200px, 200px) scale(${scale}) translate(${-centre.x}px, ${-centre.y}px)`
  })

  function groupStyle(i: number) {
    if (fallen.has(i)) {
      const t = tumbles[i]
      return `transform: translate(${t.x}px, 700px) rotate(${t.spin}deg); opacity: 0;`
    }
    const offset = spread ? chopOffset(i, groups) : { x: 0, y: 0 }
    return `transform: translate(${offset.x}px, ${offset.y}px);`
  }
</script>

{#snippet art(frosting: string, shine: boolean)}
  <g class="art">
  <path d={`${RING(186)} ${RING(56)}`} fill="#e3a35c" fill-rule="evenodd" />
  <path
    d={`${RING(186)} M12 190a180 180 0 1 1 360 0a180 180 0 1 1 -360 0Z`}
    fill-rule="evenodd"
    fill="#2b2b3a"
    opacity="0.16"
    clip-path="url(#donut-dough)"
    class="rim"
  />
  <path d={`${RING(70)} ${RING(56)}`} fill="#2b2b3a" opacity="0.18" fill-rule="evenodd" />
  <path d={FROSTING_PATH} fill="#2b2b3a" opacity="0.16" fill-rule="evenodd" transform="translate(3 6)" />
  <path d={FROSTING_PATH} fill={frosting} fill-rule="evenodd" class="frosting" />
  <g fill="none" stroke="#fff" stroke-linecap="round" stroke-width={shine ? 16 : 12} opacity={shine ? 0.55 : 0.35}>
    <path d="M96 168C112 124 150 96 196 90" />
    <path d="M90 204C90 196 91 189 93 183" />
  </g>
  </g>
{/snippet}

{#snippet sprinkle(s: LandedSprinkle, at: Point, tap?: () => void)}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <g
    class="sprinkle"
    class:tappable={!!tap}
    style={`transform: translate(${at.x}px, ${at.y}px)`}
    role={tap ? 'button' : undefined}
    tabindex={tap ? 0 : undefined}
    aria-label={tap ? 'Count this sprinkle' : undefined}
    onclick={tap}
    onkeydown={(event) => {
      if (tap && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        event.stopPropagation()
        tap()
      }
    }}
  >
    {#if tap}<circle r="15" fill="transparent" />{/if}
    <g class="land">
      <rect x="-13" y="-4.5" width="26" height="9" rx="4.5" fill="#2b2b3a" opacity="0.18" transform={`translate(1 2.5) rotate(${s.rotation})`} />
      <rect x="-13" y="-4.5" width="26" height="9" rx="4.5" fill={s.color} transform={`rotate(${s.rotation})`} />
    </g>
  </g>
{/snippet}

<svg
  bind:this={svg}
  class="donut"
  class:wobble
  class:focused={focus !== null}
  class:grey-art={greyArt}
  viewBox="-20 -20 440 440"
  role="img"
  aria-label={chopped ? `A donut cut into ${groups} equal groups` : 'A donut'}
>
  <defs>
    <clipPath id="donut-dough"><path d={`${RING(186)} ${RING(56)}`} clip-rule="evenodd" /></clipPath>
    {#each Array.from({ length: groups }) as _, i (i)}
      <clipPath id={`donut-wedge-${groups}-${i}`}><path d={wedgePath(i, groups)} /></clipPath>
    {/each}
  </defs>

  <g class="camera" style={camera}>
  {#if !chopped}
    {@render art(FROSTING, false)}
    {#if groups > 1}
      <g class="cuts" class:chopping>
        {#each Array.from({ length: groups }) as _, i (i)}
          <g class="cut" style={`transform: rotate(${(i * 360) / groups}deg); --delay: ${i * 70}ms`}>
            <line x1="200" y1="150" x2="200" y2="2" class="cut-band" />
            <line x1="200" y1="150" x2="200" y2="2" class="cut-line" />
            {#if chopping}<line x1="200" y1="2" x2="200" y2="150" class="slash" pathLength="100" />{/if}
          </g>
        {/each}
      </g>
    {/if}
  {:else}
    {#each Array.from({ length: groups }) as _, i (i)}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g
        bind:this={groupEls[i]}
        class="group"
        class:dimmed={dimmed.has(i)}
        class:fallen={fallen.has(i)}
        class:grey={greyed.has(i)}
        class:pulse={pulseGroups.has(i)}
        class:tappable={!!onGroupTap}
        style={groupStyle(i)}
        role={onGroupTap ? 'button' : undefined}
        tabindex={onGroupTap ? 0 : undefined}
        aria-label={onGroupTap ? `Group ${i + 1}${glazed.has(i) ? ', kept' : ''}` : undefined}
        aria-pressed={onGroupTap ? glazed.has(i) : undefined}
        onclick={() => onGroupTap?.(i)}
        onkeydown={(event) => {
          if (onGroupTap && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            event.stopPropagation()
            onGroupTap(i)
          }
        }}
      >
        <g clip-path={`url(#donut-wedge-${groups}-${i})`}>
          {@render art(glazed.has(i) ? GLAZE : FROSTING, glazed.has(i))}
        </g>
        {#each sprinkles.filter((s) => s.group === i) as s (s.id)}
          {@render sprinkle(
            s,
            slots[i][s.slot],
            onSprinkleTap && focus === i ? () => onSprinkleTap(s.id) : undefined,
          )}
        {/each}
        {#each sprinkles.filter((s) => s.group === i && counts.has(s.id)) as s (s.id)}
          {@const at = slots[i][s.slot]}
          <!-- Sits just above its sprinkle so the sprinkle still shows. -->
          <g class="badge" style={`transform: translate(${at.x}px, ${at.y - 9}px)`}>
            <g class="pop">
              <circle r="9" fill="#fff" stroke="#2b2b3a" stroke-width="2" />
              <text text-anchor="middle" dominant-baseline="central" y="1">{counts.get(s.id)}</text>
            </g>
          </g>
        {/each}
        {#if groupBadges.has(i)}
          {@const at = groupCentre(i, groups)}
          <g class="badge big" style={`transform: translate(${at.x}px, ${at.y}px)`}>
            <g class="pop">
              <circle r="28" fill="#fff" stroke="#2b2b3a" stroke-width="3.5" />
              <text text-anchor="middle" dominant-baseline="central" y="1.5">{groupBadges.get(i)}</text>
            </g>
          </g>
        {/if}
      </g>
    {/each}
  {/if}
  </g>
</svg>

<style>
  .donut {
    width: 100%;
    height: 100%;
    overflow: visible;
    display: block;
  }

  .focused {
    overflow: hidden;
    mask-image: radial-gradient(circle at center, #000 55%, transparent 72%);
  }

  .camera {
    transition: transform 0.7s cubic-bezier(0.65, 0, 0.35, 1);
  }

  .wobble {
    animation: wobble 0.5s ease-in-out;
  }

  @keyframes wobble {
    20% { transform: rotate(-5deg); }
    40% { transform: rotate(4deg); }
    60% { transform: rotate(-3deg); }
    80% { transform: rotate(2deg); }
  }

  .cut {
    transform-origin: 200px 200px;
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: cut-in 0.3s ease-out;
  }

  @keyframes cut-in {
    from { opacity: 0; }
  }

  .cut-band {
    stroke: #7cc4ff;
    stroke-width: 22;
    stroke-linecap: round;
    opacity: 0.35;
  }

  .cut-line {
    stroke: #1f7ae0;
    stroke-width: 5;
    stroke-linecap: round;
    stroke-dasharray: 10 10;
    animation: march 0.8s linear infinite;
  }

  @keyframes march {
    to { stroke-dashoffset: -20; }
  }

  .chopping .cut-line,
  .chopping .cut-band {
    opacity: 0;
    transition: opacity 0.2s;
  }

  /* The knife: a white streak drawn down each cut line in turn. */
  .slash {
    stroke: #fff;
    stroke-width: 9;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: slash 0.22s ease-in forwards;
    animation-delay: var(--delay);
  }

  @keyframes slash {
    to { stroke-dashoffset: 0; }
  }

  .art {
    transition: filter 0.4s;
  }

  .grey,
  .grey-art .art {
    filter: grayscale(1) brightness(1.05);
  }

  .sprinkle.tappable {
    cursor: pointer;
  }

  .group {
    transition:
      filter 0.4s,
      transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.35s;
    transform-box: view-box;
  }

  .group.fallen {
    transition:
      transform 0.9s cubic-bezier(0.55, 0, 0.9, 0.5),
      opacity 0.9s ease-in;
  }

  .dimmed {
    opacity: 0.45;
  }

  .tappable {
    cursor: pointer;
    outline: none;
  }

  .tappable:focus-visible .frosting {
    stroke: #1f7ae0;
    stroke-width: 6;
  }

  .pulse {
    animation: group-pulse 0.9s ease-in-out infinite;
  }

  @keyframes group-pulse {
    50% { opacity: 0.6; }
  }

  .land {
    animation: land 0.25s ease-out;
  }

  @keyframes land {
    from { transform: scale(1.5); }
  }

  .badge text {
    font-family: var(--font);
    font-weight: 700;
    font-size: 12px;
    fill: #2b2b3a;
  }

  .badge.big text {
    font-size: 32px;
  }

  .pop {
    animation: pop 0.3s cubic-bezier(0.34, 1.8, 0.64, 1);
  }

  @keyframes pop {
    from { transform: scale(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .wobble,
    .pulse,
    .cut-line {
      animation: none;
    }
  }
</style>
