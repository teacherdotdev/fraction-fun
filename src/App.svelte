<script lang="ts">
  import { fly, scale } from 'svelte/transition'
  import Confetti from './components/Confetti.svelte'
  import Donut, { type LandedSprinkle } from './components/Donut.svelte'
  import Island, { type Highlight } from './components/Island.svelte'
  import Stepper from './components/Stepper.svelte'
  import { countingOrder, dealTo, sprinkleSlots } from './lib/donut'
  import type { Point } from './lib/donut'
  import { launchPoint, planFlight, positionAt, type Flight } from './lib/flight'
  import {
    answerOf,
    fractionName,
    fractionWords,
    MAX_DENOMINATOR,
    MAX_WHOLE,
    problemFromParams,
    shareOf,
  } from './lib/problem'
  import { isMuted, play, poof, setMuted, stepDown, stepUp, unlockAudio } from './lib/sound'
  import { hintFor, nextStep, STEPS, targetFor, type Step } from './lib/steps'

  const problem = problemFromParams(new URLSearchParams(location.search))
  const share = shareOf(problem)
  const pieces = fractionName(problem.denominator, 2)
  const COLORS = ['#ff4d4d', '#ffb020', '#ffe14d', '#2fbf71', '#3d8bff', '#9b5cff']
  const COUNTED_GROUP = 0
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

  type Flying = { id: number; color: string; rotation: number; x: number; y: number; spin: number }
  type Poof = { id: number; x: number; y: number; size: number }

  let step = $state<Step>('question')
  let groups = $state(1)
  let chopped = $state(false)
  let chopping = $state(false)
  let landed: LandedSprinkle[] = $state([])
  let flying: Flying[] = $state([])
  /** Sprinkles thrown so far, including ones still in the air. */
  let thrown = $state(0)
  /** Sprinkle ids in the order the student tapped them. */
  let countOrder: number[] = $state([])
  let poofs: Poof[] = $state([])
  let kept = $state(new Set<number>())
  let fallen = $state(new Set<number>())
  let attempts = $state(0)
  let wobble = $state(false)
  let busy = $state(false)
  let muted = $state(isMuted())
  let donut: Donut | undefined = $state()

  let nextId = 0
  type FlightEntry = { flight: Flight; started: number; onLand?: () => void; deal?: number }
  const flights = new Map<number, FlightEntry>()
  let frame = 0

  const hint = $derived(hintFor(problem, step, attempts))
  const target = $derived(targetFor(problem, step))

  const highlight: Highlight = $derived(
    step === 'groups' ? 'denominator' : step === 'sprinkles' ? 'whole' : step === 'pick' ? 'numerator' : null,
  )

  const prompt = $derived(
    {
      question: '',
      groups: 'How many equal groups do we need?',
      sprinkles: `What are we splitting into ${pieces}?`,
      count: 'How many sprinkles in one group?',
      pick: `How many ${pieces} do we need?`,
      answer: '',
    }[step],
  )

  /** The counted group's sprinkles, swept clockwise, for counting from the keyboard. */
  const countedSprinkles = $derived.by(() => {
    const inGroup = landed.filter((s) => s.group === COUNTED_GROUP)
    const slots = sprinkleSlots(COUNTED_GROUP, problem.denominator, Math.ceil(MAX_WHOLE / problem.denominator))
    const order = countingOrder(slots, COUNTED_GROUP, problem.denominator)
    return order.flatMap((slot) => inGroup.filter((s) => s.slot === slot))
  })

  const counts = $derived(new Map(countOrder.map((id, i) => [id, i + 1] as const)))
  const allCounted = $derived(countOrder.length > 0 && countOrder.length === countedSprinkles.length)

  const greyed = $derived.by(() => {
    if (step === 'pick' || step === 'answer') {
      return new Set(range(problem.denominator).filter((g) => !glazed.has(g)))
    }
    return new Set<number>()
  })

  /** "5 = 5", "5 + 5 = 10"… for the groups picked so far. */
  const pickedMath = $derived(
    kept.size ? `${Array(kept.size).fill(share).join(' + ')} = ${kept.size * share}` : '',
  )

  const instruction = $derived(
    step === 'count'
      ? 'Tap or click each sprinkle to count it.'
      : step === 'pick'
        ? `Tap or click the ${pieces} you need.`
        : '',
  )

  const dimmed = $derived.by(() => {
    if (step === 'count') {
      return new Set(range(problem.denominator).filter((i) => i !== COUNTED_GROUP))
    }
    return new Set<number>()
  })

  const glazed = $derived.by(() => {
    if (step === 'count') return new Set([COUNTED_GROUP])
    if (step === 'pick') return kept
    if (step === 'answer') return kept
    return new Set<number>()
  })

  const groupBadges = $derived.by(() => {
    if (step === 'pick') return new Map([...glazed].map((g) => [g, share] as const))
    return new Map<number, number>()
  })

  const pulse = $derived.by((): 'minus' | 'plus' | null => {
    if (!hint?.pulse || target === null) return null
    const value = step === 'groups' ? groups : thrown
    return value < target ? 'plus' : 'minus'
  })

  const pulseGroups = $derived.by(() => {
    if (step !== 'pick' || !hint?.pulse) return new Set<number>()
    const tooFew = kept.size < problem.numerator
    return new Set(range(problem.denominator).filter((g) => kept.has(g) !== tooFew))
  })

  function range(n: number) {
    return Array.from({ length: n }, (_, i) => i)
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function advance(delay = 0) {
    busy = true
    await wait(delay)
    attempts = 0
    hintShown = false
    step = nextStep(step)
    play('whoosh', { volume: 0.35 })
    busy = false
    if (step === 'answer') celebrate()
  }

  const HINT_SECONDS = 4
  // The hint floats over the donut for a few seconds, then slides away.
  let hintShown = $state(false)
  let hintTimer = 0

  function miss() {
    attempts += 1
    play('wrong')
    hintShown = true
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => (hintShown = false), HINT_SECONDS * 1000)
    if (reduceMotion) return
    wobble = false
    requestAnimationFrame(() => (wobble = true))
    setTimeout(() => (wobble = false), 520)
  }

  // ——— Question ———
  function start() {
    unlockAudio()
    play('click')
    advance()
  }

  // ——— Groups ———
  function changeGroups(delta: number) {
    const value = groups + delta
    if (value < 1 || value > MAX_DENOMINATOR) return play('limit')
    groups = value
    if (delta > 0) stepUp(value - 1)
    else stepDown(value - 1)
  }

  async function chop() {
    if (groups !== problem.denominator) return miss()
    busy = true
    // The knife swishes down each cut line in turn…
    chopping = true
    play('chop')
    await wait(220 + 70 * (groups - 1) + 60)
    // …then the pieces thunk apart.
    chopping = false
    chopped = true
    await wait(40)
    play('thunk')
    advance(950)
  }

  // ——— Sprinkles ———
  function throwSprinkle() {
    if (thrown >= MAX_WHOLE || !donut) return play('limit')
    const { group, slot } = dealTo(thrown, problem.denominator)
    const aim = donut.screenPoint(group, slot)
    if (!aim) return
    thrown += 1
    stepUp(thrown - 1)
    play('throw', { volume: 0.4, rate: 0.9 + Math.random() * 0.3 })
    const id = nextId++
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const rotation = Math.round(Math.random() * 180)
    const flight = planFlight(
      launchPoint(innerWidth, innerHeight),
      aim,
      reduceMotion ? 0.4 : 0.75 + Math.random() * 0.2,
    )
    const deal = thrown - 1
    launch(
      { id, color, rotation, spin: (Math.random() - 0.5) * 900 },
      flight,
      () => {
        landed = [...landed, { id, deal, group, slot, color, rotation }]
        play('land', { volume: 0.7, rate: 0.9 + Math.random() * 0.25 })
      },
      deal,
    )
  }

  /** Takes back the most recent sprinkle with a poof, whether it's landed or still in the air. */
  function unthrowSprinkle() {
    if (thrown === 0) return play('limit')
    thrown -= 1
    stepDown(thrown)
    poof()
    // Throws land at slightly different times, so find the sprinkle by its place in
    // the dealing order. Otherwise the next throw would land on a group that's full.
    const deal = thrown
    const inAir = [...flights].find(([, entry]) => entry.deal === deal)?.[0]
    if (inAir !== undefined) {
      const at = flying.find((f) => f.id === inAir)
      flights.delete(inAir)
      flying = flying.filter((f) => f.id !== inAir)
      if (at) puff(at)
      return
    }
    const gone = landed.find((s) => s.deal === deal)
    if (!gone || !donut) return
    landed = landed.filter((s) => s !== gone)
    const at = donut.screenPoint(gone.group, gone.slot)
    if (at) puff(at)
  }

  function repeat(times: number, action: () => void) {
    for (let i = 0; i < times; i += 1) setTimeout(action, i * 90)
  }

  function puff(at: { x: number; y: number }) {
    const id = nextId++
    poofs = [...poofs, { id, x: at.x, y: at.y, size: (donut?.unitScale() ?? 1) * 46 }]
    setTimeout(() => (poofs = poofs.filter((p) => p.id !== id)), 650)
  }

  async function share_() {
    if (thrown !== problem.whole) return miss()
    busy = true
    // Let the last throws land before moving on.
    while (flights.size) await wait(60)
    play('pop')
    advance(500)
  }

  // ——— Count ———
  function countSprinkle(id: number) {
    if (countOrder.includes(id)) return play('limit', { volume: 0.4 })
    countOrder = [...countOrder, id]
    play('pop', { rate: 0.9 + countOrder.length * 0.04 })
  }

  /** Keyboard counting: the next sprinkle not counted yet, going clockwise. */
  function countNext() {
    const next = countedSprinkles.find((s) => !countOrder.includes(s.id))
    if (!next) return play('limit')
    countSprinkle(next.id)
  }

  function doneCounting() {
    // Done! only shows once every sprinkle has a number.
    if (!allCounted) return
    advance(500)
  }

  // ——— Pick ———
  function toggleGroup(group: number) {
    const next = new Set(kept)
    if (next.has(group)) {
      next.delete(group)
      stepDown(next.size)
    } else {
      next.add(group)
      play('pop')
    }
    kept = next
  }

  async function keep() {
    if (kept.size !== problem.numerator) return miss()
    busy = true
    revealing = true
    fallen = new Set(range(problem.denominator).filter((g) => !kept.has(g)))
    play('fall')
    advance(950)
  }

  // ——— Answer ———
  // The kept groups' badges fly up into a sum, "=" fades in, the total pops,
  // then the whole donut and the summary come back underneath.
  const BADGE_STAGGER = 350
  const BADGE_FLIGHT = 650
  let revealing = $state(false)
  let showTotal = $state(false)
  let showWhole = $state(false)
  let confetti: Confetti | undefined = $state()
  const keptInOrder = $derived([...kept].sort((a, b) => a - b))
  const equalsAt = $derived(300 + keptInOrder.length * BADGE_STAGGER + BADGE_FLIGHT - 200)

  async function celebrate() {
    keptInOrder.forEach((_, i) => {
      setTimeout(() => play('pop', { rate: 1 + i * 0.08 }), 300 + i * BADGE_STAGGER + BADGE_FLIGHT)
    })
    await wait(equalsAt + 350)
    showTotal = true
    play('success')
    play('cheer', { volume: 0.7 })
    confetti?.burst({ few: reduceMotion })
    await wait(900)
    // Bring the fallen groups back, greyed, to show all the groups again.
    fallen = new Set()
    showWhole = true
  }

  /** Starts a sum badge where its group's badge sat on the donut, then glides it into place. */
  function flyFrom(node: HTMLElement, { from, delay }: { from: Point | null; delay: number }) {
    const box = node.getBoundingClientRect()
    const dx = from ? from.x - (box.left + box.width / 2) : 0
    const dy = from ? from.y - (box.top + box.height / 2) : 30
    node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.25)`, opacity: from ? 1 : 0 },
        { transform: 'none', opacity: 1 },
      ],
      {
        duration: reduceMotion ? 1 : BADGE_FLIGHT,
        delay,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
        fill: 'backwards',
      },
    )
  }

  function again() {
    play('click')
    flights.clear()
    flying = []
    step = 'question'
    groups = 1
    chopped = false
    landed = []
    thrown = 0
    countOrder = []
    kept = new Set()
    fallen = new Set()
    revealing = false
    showTotal = false
    showWhole = false
    confetti?.clear()
    attempts = 0
    play('whoosh', { volume: 0.5 })
  }

  // ——— Flights ———
  function launch(sprinkle: Omit<Flying, 'x' | 'y'>, flight: Flight, onLand?: () => void, deal?: number) {
    flights.set(sprinkle.id, { flight, started: performance.now(), onLand, deal })
    flying = [...flying, { ...sprinkle, x: flight.start.x, y: flight.start.y }]
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function tick(now: number) {
    const done: number[] = []
    flying = flying.map((f) => {
      const entry = flights.get(f.id)
      if (!entry) return f
      const seconds = (now - entry.started) / 1000
      if (seconds >= entry.flight.duration) done.push(f.id)
      const p = positionAt(entry.flight, seconds)
      return { ...f, x: p.x, y: p.y, rotation: f.rotation + f.spin / 60 }
    })
    for (const id of done) {
      const entry = flights.get(id)
      flights.delete(id)
      entry?.onLand?.()
    }
    flying = flying.filter((f) => flights.has(f.id))
    frame = flights.size ? requestAnimationFrame(tick) : 0
  }

  // ——— Controls ———
  function confirm() {
    if (busy) return
    if (step === 'question') start()
    else if (step === 'groups') chop()
    else if (step === 'sprinkles') share_()
    else if (step === 'count') doneCounting()
    else if (step === 'pick') keep()
    else again()
  }

  function onKey(event: KeyboardEvent) {
    if (busy || (event.repeat && event.key === 'Enter')) return
    const more = ['+', '=', 'ArrowRight', 'ArrowUp'].includes(event.key)
    const less = ['-', '_', 'ArrowLeft', 'ArrowDown'].includes(event.key)
    if (more || less) {
      event.preventDefault()
      if (step === 'groups') changeGroups(more ? 1 : -1)
      else if (step === 'sprinkles') (more ? throwSprinkle : unthrowSprinkle)()
      else if (step === 'count' && more) countNext()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      confirm()
    }
  }

  function toggleMute() {
    muted = !muted
    setMuted(muted)
    if (!muted) play('click')
  }

  const confirmLabel = $derived(
    { question: 'Start!', groups: 'Chop!', sprinkles: 'Confirm!', count: 'Done!', pick: 'Keep!', answer: 'Again!' }[step],
  )
</script>

<svelte:window onkeydown={onKey} />

<main class="app" class:started={step !== 'question'}>
  <Island {problem} pinned={step !== 'question'} {highlight} gone={revealing} />
  <Confetti bind:this={confetti} />

  <button class="mute" onclick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
    {#if muted}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9l5 6M21 9l-5 6" class="line" /></svg>
    {:else}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" class="line" /></svg>
    {/if}
  </button>

  {#if step !== 'question'}
    <ol class="dots" aria-label="Progress">
      {#each STEPS.slice(1) as s, i (s)}
        <li class:done={STEPS.indexOf(step) > i + 1} class:current={step === s}></li>
      {/each}
    </ol>

    <section class="prompt" aria-live="polite">
      {#key step}
        {#if step === 'answer'}
          <p class="sum" aria-label={`${keptInOrder.map(() => share).join(' plus ')} equals ${answerOf(problem)}`}>
            {#each keptInOrder as group, i (group)}
              {#if i > 0}
                <span class="op" style={`animation-delay: ${300 + i * BADGE_STAGGER + 300}ms`}>+</span>
              {/if}
              <span class="badge" use:flyFrom={{ from: donut?.badgePoint(group) ?? null, delay: 300 + i * BADGE_STAGGER }}>{share}</span>
            {/each}
            <span class="op" style={`animation-delay: ${equalsAt}ms`}>=</span>
            <strong class="total" class:shown={showTotal}>{answerOf(problem)}</strong>
          </p>
        {:else}
          <h2 in:fly={{ y: 24, duration: 400, delay: 150 }}>{prompt}</h2>
        {/if}
      {/key}
    </section>

    <section class="stage" class:answering={step === 'answer'} in:scale={{ start: 0.6, duration: 500, delay: 200 }}>
      <div class="donut-box" class:waiting={step === 'answer' && !showWhole}>
        <Donut
          bind:this={donut}
          groups={chopped ? problem.denominator : groups}
          {chopped}
          {chopping}
          sprinkles={landed}
          {glazed}
          dimmed={step === 'answer' ? new Set(range(problem.denominator).filter((g) => !glazed.has(g))) : dimmed}
          {fallen}
          counts={step === 'count' ? counts : new Map()}
          {groupBadges}
          {wobble}
          {pulseGroups}
          {greyed}
          greyArt={step === 'count'}
          focus={step === 'count' ? COUNTED_GROUP : null}
          onSprinkleTap={step === 'count' ? countSprinkle : undefined}
          onGroupTap={step === 'pick' && !busy ? toggleGroup : undefined}
        />
      </div>
      {#if step === 'pick' && pickedMath}
        <!-- Floats under the donut so it never pushes the layout around. -->
        {#key pickedMath}
          <p class="math-bubble" in:scale={{ start: 0.85, duration: 200 }}>{pickedMath}</p>
        {/key}
      {/if}
      {#if step === 'answer'}
        <!-- Space is kept from the start so nothing shifts when it fades in. -->
        <div class="summary" class:shown={showWhole}>
          <p class="equation">
            <span class="fraction" aria-hidden="true"><span>{problem.numerator}</span><span>{problem.denominator}</span></span>
            of {problem.whole} = <strong>{answerOf(problem)}</strong>
          </p>
          <p>{fractionWords(problem)} of {problem.whole} = {answerOf(problem)}</p>
          <p>
            {problem.numerator} {problem.numerator === 1 ? 'group' : 'groups'} of {share} → {problem.numerator} × {share} = {answerOf(problem)}
          </p>
          <p class="soft">{problem.denominator} groups of {share} = {problem.whole}</p>
        </div>
      {/if}
    </section>
  {/if}

  <footer class="control">
    <!-- Floats above the controls, over the donut, so showing it never moves anything. -->
    <div class="hint-spot" aria-live="polite">
      {#if hint && hintShown}
        {#key attempts}
          <p class="hint" in:fly={{ y: 16, duration: 280 }} out:fly={{ y: 16, duration: 320 }}>{hint.text}</p>
        {/key}
      {/if}
    </div>
    {#if instruction}
      <p class="instruction">{instruction}</p>
    {/if}
    {#if step === 'groups'}
      <Stepper value={groups} label={groups === 1 ? 'group' : 'groups'} onMinus={() => changeGroups(-1)} onPlus={() => changeGroups(1)} {pulse} />
    {:else if step === 'sprinkles'}
      <Stepper
        value={thrown}
        label={thrown === 1 ? 'sprinkle' : 'sprinkles'}
        onMinusFive={() => repeat(5, unthrowSprinkle)}
        onMinus={unthrowSprinkle}
        onPlus={throwSprinkle}
        onPlusFive={() => repeat(5, throwSprinkle)}
        {pulse}
      />
    {:else if step === 'count'}
      <div class="picked" aria-live="polite">
        {#key countOrder.length}<span class="number">{countOrder.length}</span>{/key}
        <span class="label">counted</span>
      </div>
    {:else if step === 'pick'}
      <div class="picked" aria-live="polite">
        {#key kept.size}<span class="number">{kept.size}</span>{/key}
        <span class="label">{fractionName(problem.denominator, kept.size)}</span>
      </div>
    {/if}
    <!-- Done! keeps its space while hidden, so the donut doesn't jump when it appears. -->
    <button
      class="go"
      class:big={step === 'question'}
      class:waiting={step === 'count' && !allCounted}
      onclick={confirm}
      disabled={busy || (step === 'count' && !allCounted)}
      aria-hidden={step === 'count' && !allCounted}>{confirmLabel}</button
    >
  </footer>

  <div class="flying" aria-hidden="true">
    {#each poofs as p (p.id)}
      <span class="poof" style={`transform: translate(${p.x}px, ${p.y}px); --size: ${p.size}px`}>
        {#each Array.from({ length: 6 }) as _, i (i)}
          <span class="puff" style={`--angle: ${i * 60 + 15}deg`}></span>
        {/each}
      </span>
    {/each}
    {#each flying as f (f.id)}
      <span
        class="sprinkle"
        style={`transform: translate(${f.x}px, ${f.y}px) rotate(${f.rotation}deg) scale(${donut?.unitScale() ?? 1}); background: ${f.color}`}
      ></span>
    {/each}
  </div>
</main>

<style>
  .app {
    height: 100dvh;
    display: grid;
    grid-template-rows: 104px auto minmax(0, 1fr) auto;
    overflow: hidden;
    position: relative;
  }

  .mute {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 6;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    background: #fff;
    box-shadow: 0 4px 16px #2b2b3a1f;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .mute svg {
    width: 26px;
    height: 26px;
    fill: var(--ink);
  }

  .mute .line {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  .dots {
    grid-row: 1;
    align-self: end;
    justify-self: center;
    display: flex;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .dots li {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #2b2b3a26;
    transition: background-color 0.3s, transform 0.3s;
  }

  .dots .done {
    background: var(--accent);
  }

  .dots .current {
    background: var(--ink);
    transform: scale(1.3);
  }

  .prompt {
    grid-row: 2;
    text-align: center;
    padding: 18px 16px 0;
    display: grid;
    justify-items: center;
    gap: 10px;
  }

  .prompt h2 {
    margin: 0;
    font: 700 clamp(24px, 3.4vw, 40px) / 1.2 var(--font);
  }

  .hint-spot {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 4px);
    display: grid;
    justify-items: center;
    padding: 0 16px;
    pointer-events: none;
  }

  /* Stack the old and new hint in one spot while they cross-fade. */
  .hint-spot > * {
    grid-area: 1 / 1;
  }

  .hint {
    margin: 0;
    box-shadow: 0 6px 20px #2b2b3a26;
    text-align: center;
    padding: 8px 18px;
    border-radius: 999px;
    background: #ffd23f;
    font: 600 clamp(17px, 2vw, 22px) / 1.3 var(--font);
  }

  /* The answer headline: the kept groups' badges, added up. */
  .sum {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.3em;
    font: 700 clamp(36px, 5.5vw, 64px) / 1 var(--font);
  }

  /* Above the stage, so badges fly over the donut, not behind it. */
  .sum {
    position: relative;
    z-index: 5;
  }

  .sum .op {
    animation: op-in 0.3s ease-out backwards;
  }

  @keyframes op-in {
    from {
      opacity: 0;
      transform: scale(0.4);
    }
  }

  .sum .badge {
    display: grid;
    place-items: center;
    width: 1.5em;
    height: 1.5em;
    border-radius: 50%;
    background: #fff;
    border: 0.07em solid var(--ink);
    font-size: 0.75em;
  }

  .sum .total {
    color: var(--accent);
    opacity: 0;
    transform: scale(0.3);
    transition:
      opacity 0.2s,
      transform 0.45s cubic-bezier(0.34, 1.8, 0.64, 1);
  }

  .sum .total.shown {
    opacity: 1;
    transform: none;
  }

  .summary {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 12px 28px 14px;
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 6px 24px #2b2b3a1a;
    font: 600 clamp(16px, 1.9vw, 21px) / 1.35 var(--font);
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 0.45s,
      transform 0.45s;
  }

  .summary.shown {
    opacity: 1;
    transform: none;
  }

  .summary p {
    margin: 0;
  }

  .summary .equation {
    font-size: 1.6em;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
  }

  .math-bubble {
    position: absolute;
    left: 50%;
    bottom: 6px;
    translate: -50% 0;
    margin: 0;
    padding: 8px 22px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 6px 20px #2b2b3a26;
    font: 700 clamp(20px, 2.4vw, 28px) / 1.2 var(--font);
    color: var(--accent);
    white-space: nowrap;
  }

  .equation strong {
    color: var(--accent);
  }

  .fraction {
    display: inline-grid;
    font-size: 0.62em;
    line-height: 1;
    text-align: center;
  }

  .fraction span:first-child {
    border-bottom: 0.09em solid currentColor;
    padding: 0 0.15em 0.05em;
  }

  .soft {
    color: var(--ink-soft);
    font-weight: 600;
  }

  .stage {
    position: relative;
    grid-row: 3;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 12px;
  }

  /* Donut above, summary below. */
  .stage.answering {
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 12px;
  }

  .donut-box.waiting {
    opacity: 0.55;
    transition: opacity 0.5s;
  }

  .donut-box {
    transition: opacity 0.5s;
    height: 100%;
    aspect-ratio: 1;
    max-width: 92vw;
    max-height: 100%;
  }

  .control {
    position: relative;
    grid-row: 4;
    display: grid;
    justify-items: center;
    gap: 14px;
    padding: 8px 16px 28px;
    z-index: 4;
  }

  .go {
    min-width: 200px;
    padding: 14px 36px;
    border: none;
    border-radius: 999px;
    background: var(--go);
    color: #fff;
    font: 700 30px/1 var(--font);
    box-shadow: 0 6px 0 #00000033;
    cursor: pointer;
    touch-action: manipulation;
    transition:
      transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.2s;
  }

  .go:active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 #00000033;
  }

  .go:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .go.waiting {
    visibility: hidden;
    transform: scale(0.6);
  }

  .go.big {
    font-size: 40px;
    padding: 20px 56px;
  }

  @media (hover: hover) {
    .go.big:hover {
      animation: breathe 1.4s ease-in-out infinite;
    }
  }

  @keyframes breathe {
    50% { transform: scale(1.06); }
  }

  .picked {
    display: grid;
    justify-items: center;
    line-height: 1;
    min-height: 76px;
    align-content: center;
  }

  .picked .number {
    font: 700 56px/1 var(--font);
  }

  .picked .label {
    font: 600 18px/1.2 var(--font);
    color: var(--ink-soft);
  }

  .instruction {
    margin: 0;
    font: 600 clamp(16px, 1.8vw, 20px) / 1.3 var(--font);
    color: var(--ink-soft);
  }

  .poof {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
  }

  /* Six little clouds that burst outward and fade. */
  .puff {
    position: absolute;
    left: calc(var(--size) * -0.22);
    top: calc(var(--size) * -0.22);
    width: calc(var(--size) * 0.44);
    height: calc(var(--size) * 0.44);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 2px #2b2b3a14;
    animation: puff 0.6s ease-out forwards;
  }

  @keyframes puff {
    from {
      transform: rotate(var(--angle)) translateX(0) scale(0.4);
      opacity: 1;
    }
    to {
      transform: rotate(var(--angle)) translateX(calc(var(--size) * 0.6)) scale(1.1);
      opacity: 0;
    }
  }

  .flying {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 3;
  }

  .flying .sprinkle {
    position: absolute;
    left: -13px;
    top: -4.5px;
    width: 26px;
    height: 9px;
    border-radius: 4.5px;
    box-shadow: 1px 2.5px 0 #2b2b3a2e;
  }

  .app:not(.started) {
    grid-template-rows: 1fr auto;
  }

  .app:not(.started) .control {
    grid-row: 2;
    padding-bottom: 8vh;
  }

  @media (prefers-reduced-motion: reduce) {
    .go.waiting {
    visibility: hidden;
    transform: scale(0.6);
  }

  .go.big { animation: none; }
  }
</style>
