<script lang="ts">
  import { onMount } from 'svelte'
  import {
    DEFAULT_SETTINGS,
    DENOMINATOR_CHOICES,
    NUMBER_CHOICES,
    settingsFromParams,
    settingsToQuery,
    validProblemCount,
    type ActivitySettings,
    type Food,
  } from './lib/settings'

  type Problem = { numerator: number; denominator: number; total: number; food: Exclude<Food, 'mix'> }
  type Step = 'fraction' | 'groups' | 'slicer' | 'drop' | 'answer' | 'complete'

  const urlParams = new URLSearchParams(window.location.search)
  const studentMode = urlParams.get('play') === '1'
  let settings = $state<ActivitySettings>(
    studentMode ? settingsFromParams(urlParams) : structuredClone(DEFAULT_SETTINGS),
  )
  let origin = $state('')
  let loaded = $state(false)
  let copied = $state(false)
  let activityStarted = $state(false)
  let problems = $state<Problem[]>([])
  let questionIndex = $state(0)
  let step = $state<Step>('fraction')
  let message = $state('')
  let firstTry = $state(true)
  let stars = $state(0)
  let slicerAttached = $state(false)

  const problem = $derived(problems[questionIndex])
  const answer = $derived(problem ? (problem.total / problem.denominator) * problem.numerator : 0)
  const groupSize = $derived(problem ? problem.total / problem.denominator : 0)
  const shareLink = $derived(`${origin}/?${settingsToQuery(settings)}`)
  const validCount = $derived(validProblemCount(settings))
  const previewProblem = $derived(
    settings.numbers
      .flatMap((total) =>
        settings.denominators
          .filter((denominator) => total % denominator === 0)
          .map((denominator) => ({ total, denominator })),
      )[0] ?? { total: 20, denominator: 4 },
  )

  onMount(() => {
    origin = window.location.origin
    if (!studentMode) {
      const saved = localStorage.getItem('fractionfall-working')
      if (saved) settings = settingsFromParams(new URLSearchParams(saved))
    }
    loaded = true
  })

  $effect(() => {
    const query = settingsToQuery(settings)
    if (loaded && !studentMode) localStorage.setItem('fractionfall-working', query)
  })

  function toggleNumber(value: number) {
    const previous = settings.numbers
    if (settings.numbers.includes(value)) {
      if (settings.numbers.length > 1) settings.numbers = settings.numbers.filter((n) => n !== value)
    } else settings.numbers = [...settings.numbers, value].sort((a, b) => a - b)
    if (validProblemCount(settings) === 0) settings.numbers = previous
  }

  function toggleDenominator(value: number) {
    const previous = settings.denominators
    if (settings.denominators.includes(value)) {
      if (settings.denominators.length > 1) {
        settings.denominators = settings.denominators.filter((n) => n !== value)
      }
    } else settings.denominators = [...settings.denominators, value].sort((a, b) => a - b)
    if (validProblemCount(settings) === 0) settings.denominators = previous
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink)
    copied = true
    window.setTimeout(() => (copied = false), 1600)
  }

  function makeProblems(): Problem[] {
    const pairs = settings.numbers.flatMap((total) =>
      settings.denominators
        .filter((denominator) => total % denominator === 0)
        .map((denominator) => ({ total, denominator })),
    )
    const available = pairs.length ? pairs : [{ total: 20, denominator: 4 }]
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    return Array.from({ length: settings.questions }, (_, index) => {
      const pair = shuffled[index % shuffled.length]
      const maxNumerator = Math.min(pair.denominator - 1, 3)
      const numerator = settings.numerators === 'mixed' ? 1 + (index % maxNumerator) : 1
      const food = settings.food === 'mix' ? (index % 2 ? 'donut' : 'apple') : settings.food
      return { ...pair, numerator, food }
    })
  }

  function startActivity() {
    problems = makeProblems()
    questionIndex = 0
    stars = 0
    activityStarted = true
    beginQuestion()
  }

  function beginQuestion() {
    step = settings.guided ? 'fraction' : 'slicer'
    message = ''
    firstTry = true
    slicerAttached = false
  }

  function chooseFraction(numerator: number, denominator: number) {
    if (!problem) return
    if (numerator === problem.numerator && denominator === problem.denominator) {
      reward('Yes — that is the fraction we are finding!')
      window.setTimeout(() => {
        step = 'groups'
        message = ''
        firstTry = true
      }, 650)
    } else miss('Look at the numerator and denominator in the question. Try again.')
  }

  function chooseGroups(value: number) {
    if (!problem) return
    if (value === problem.denominator) {
      reward(`Exactly — the denominator tells us to make ${value} equal groups.`)
      window.setTimeout(() => {
        step = 'slicer'
        message = ''
        firstTry = true
      }, 800)
    } else miss(`Not quite. Which number is on the bottom of the fraction?`)
  }

  function attachSlicer() {
    slicerAttached = true
    message = 'Perfect fit! The whole is now ready to be shared equally.'
    if (firstTry) stars += 1
  }

  function dropCounters() {
    step = 'drop'
    message = `Watch ${problem.total} counters share themselves equally.`
    window.setTimeout(() => {
      step = 'answer'
      message = ''
      firstTry = true
    }, Math.min(3900, 1800 + problem.total * 55))
  }

  function chooseAnswer(value: number) {
    if (value === answer) {
      reward(`${problem.numerator === 1 ? 'One part has' : `${problem.numerator} parts have`} ${answer} counters!`)
      window.setTimeout(nextQuestion, 950)
    } else miss(`Count the counters in the highlighted ${problem.numerator === 1 ? 'part' : 'parts'}.`)
  }

  function nextQuestion() {
    if (questionIndex + 1 >= problems.length) {
      step = 'complete'
      return
    }
    questionIndex += 1
    beginQuestion()
  }

  function reward(text: string) {
    message = text
    if (firstTry) stars += 1
  }

  function miss(text: string) {
    firstTry = false
    message = text
  }

  function fractionOptions() {
    if (!problem) return []
    const values = [
      [problem.numerator, problem.denominator],
      [problem.numerator, Math.max(2, problem.denominator - 1)],
      [problem.denominator, problem.numerator],
    ]
    return uniquePairs(values).sort(() => Math.random() - 0.5)
  }

  function groupOptions() {
    if (!problem) return []
    return [...new Set([Math.max(2, problem.denominator - 1), problem.denominator, problem.denominator + 1])]
      .sort((a, b) => a - b)
  }

  function answerOptions() {
    return [...new Set([Math.max(1, answer - groupSize), answer, answer + groupSize])].sort((a, b) => a - b)
  }

  function uniquePairs(values: number[][]) {
    return values.filter((pair, index) => values.findIndex((other) => other.join('/') === pair.join('/')) === index)
  }

  function wedgePath(index: number, denominator: number) {
    const start = -90 + (index * 360) / denominator
    const end = -90 + ((index + 1) * 360) / denominator
    const startPoint = polar(49, start)
    const endPoint = polar(49, end)
    const large = 360 / denominator > 180 ? 1 : 0
    return `M 50 50 L ${startPoint.x} ${startPoint.y} A 49 49 0 ${large} 1 ${endPoint.x} ${endPoint.y} Z`
  }

  function polar(radius: number, degrees: number) {
    const radians = (degrees * Math.PI) / 180
    return { x: 50 + radius * Math.cos(radians), y: 50 + radius * Math.sin(radians) }
  }

  function counterPosition(index: number) {
    const group = index % problem.denominator
    const slot = Math.floor(index / problem.denominator)
    const perGroup = problem.total / problem.denominator
    const centerAngle = -90 + ((group + 0.5) * 360) / problem.denominator
    const spread = Math.min(18, 110 / problem.denominator)
    const offset = (slot - (perGroup - 1) / 2) * (spread / Math.max(1, perGroup - 1))
    const radius = 24 + (slot % 3) * 8
    const point = polar(radius, centerAngle + offset)
    return { x: point.x - 50, y: point.y - 50 }
  }

  const counterColors = ['#ffce56', '#f56f62', '#5cc9c5', '#8d77d9', '#7dbb55', '#f28ec1']
</script>

{#snippet fraction(numerator: number, denominator: number, small = false)}
  <span class:small class="fraction" aria-label={`${numerator} over ${denominator}`}>
    <span>{numerator}</span><span>{denominator}</span>
  </span>
{/snippet}

{#snippet logo()}
  <span class="logo-mark" aria-hidden="true"><span></span></span>
  <span>Fraction <strong>Fall</strong></span>
{/snippet}

{#if !studentMode}
  <div class="builder-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Fraction Fall home">{@render logo()}</a>
      <span class="teacher-badge">Teacher builder</span>
    </header>

    <main class="builder">
      <header class="builder-heading">
        <p class="eyebrow">Build an activity</p>
        <h1>Make fractions make sense.</h1>
        <p>Choose the numbers and supports your students need. Your link opens straight into their activity.</p>
      </header>

      <div class="builder-grid">
        <section class="settings-card" aria-label="Activity settings">
          <label class="title-field">
            <span>Activity title</span>
            <input maxlength="80" bind:value={settings.title} />
          </label>

          <fieldset>
            <legend>1. Numbers to divide</legend>
            <p class="field-help">Students will see a mix from your selected numbers.</p>
            <div class="choice-grid numbers">
              {#each NUMBER_CHOICES as value}
                <button
                  type="button"
                  class:active={settings.numbers.includes(value)}
                  class="choice-chip"
                  aria-pressed={settings.numbers.includes(value)}
                  onclick={() => toggleNumber(value)}
                >{value}</button>
              {/each}
            </div>
          </fieldset>

          <fieldset>
            <legend>2. Equal groups</legend>
            <p class="field-help">Only combinations that divide evenly will be used.</p>
            <div class="choice-grid denominators">
              {#each DENOMINATOR_CHOICES as value}
                <button
                  type="button"
                  class:active={settings.denominators.includes(value)}
                  class="choice-chip"
                  aria-pressed={settings.denominators.includes(value)}
                  onclick={() => toggleDenominator(value)}
                >{value}</button>
              {/each}
            </div>
            <p class="combination-count">{validCount} valid number {validCount === 1 ? 'combination' : 'combinations'}</p>
          </fieldset>

          <fieldset>
            <legend>3. Fraction type</legend>
            <div class="segmented">
              <button
                type="button"
                class:active={settings.numerators === 'unit'}
                onclick={() => (settings.numerators = 'unit')}
              >Unit fractions <small>1 part</small></button>
              <button
                type="button"
                class:active={settings.numerators === 'mixed'}
                onclick={() => (settings.numerators = 'mixed')}
              >Build up <small>1–3 parts</small></button>
            </div>
          </fieldset>

          <div class="field-row">
            <fieldset>
              <legend>Questions</legend>
              <div class="compact-options">
                {#each [3, 5, 10] as value}
                  <button type="button" class:active={settings.questions === value} onclick={() => (settings.questions = value)}>{value}</button>
                {/each}
              </div>
            </fieldset>
            <fieldset>
              <legend>Visual</legend>
              <div class="compact-options">
                {#each [['apple', 'Apple'], ['donut', 'Donut'], ['mix', 'Mix']] as option}
                  <button type="button" class:active={settings.food === option[0]} onclick={() => (settings.food = option[0] as Food)}>{option[1]}</button>
                {/each}
              </div>
            </fieldset>
          </div>

          <label class="toggle-row">
            <span><strong>Guided steps</strong><small>Ask about the fraction and denominator before slicing.</small></span>
            <input type="checkbox" bind:checked={settings.guided} />
          </label>
        </section>

        <aside class="preview-column">
          <p class="preview-label">Student preview</p>
          <div class="preview-card">
            <div class="preview-top"><span>Question 1 of {settings.questions}</span><span>★ ★ ☆</span></div>
            <div class="preview-question">
              <span>What is</span>
              {@render fraction(settings.numerators === 'mixed' ? Math.min(2, previewProblem.denominator - 1) : 1, previewProblem.denominator)}
              <span>of {previewProblem.total}?</span>
            </div>
            <div class="mini-stage">
              <div class="mini-food" class:donut={settings.food === 'donut'}>
                {#each Array(previewProblem.denominator) as _, index}
                  <i style={`transform:rotate(${(index * 360) / previewProblem.denominator}deg)`}></i>
                {/each}
                <b></b>
              </div>
              <div class="mini-sprinkles"><i></i><i></i><i></i><i></i><i></i></div>
            </div>
            <p>Choose the slicer with <strong>{previewProblem.denominator} equal parts.</strong></p>
          </div>

          <div class="share-card">
            <div><p>Ready to share</p><small>The settings travel inside this link—no student accounts needed.</small></div>
            <div class="link-box"><span>{shareLink || 'Your link will appear here'}</span><button type="button" onclick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button></div>
            <a class="open-activity" href={shareLink} target="_blank" rel="noopener">Open student activity <span>↗</span></a>
          </div>
        </aside>
      </div>
    </main>
  </div>
{:else}
  <div class="student-shell">
    <header class="student-topbar">
      <a class="brand light" href="/" aria-label="Go to the Fraction Fall teacher builder">{@render logo()}</a>
      {#if activityStarted && step !== 'complete'}
        <div class="question-progress" aria-label={`Question ${questionIndex + 1} of ${problems.length}`}>
          {#each problems as _, index}<i class:done={index < questionIndex} class:current={index === questionIndex}></i>{/each}
        </div>
        <span class="star-count">★ {stars}</span>
      {/if}
    </header>

    {#if !activityStarted}
      <main class="ready-screen">
        <div class="ready-art" aria-hidden="true">
          <span class="fall-dot a"></span><span class="fall-dot b"></span><span class="fall-dot c"></span>
          <div class="ready-apple"><i></i><i></i><i></i><i></i><b></b></div>
        </div>
        <p class="eyebrow">Your activity</p>
        <h1>{settings.title}</h1>
        <p>{settings.questions} visual fraction {settings.questions === 1 ? 'question' : 'questions'} · {settings.guided ? 'Guided steps' : 'Independent practice'}</p>
        <button class="primary-button" type="button" onclick={startActivity}>Start activity <span>→</span></button>
      </main>
    {:else if step === 'complete'}
      <main class="complete-screen">
        <div class="celebration" aria-hidden="true">★</div>
        <p class="eyebrow">Activity complete</p>
        <h1>You shared every whole!</h1>
        <p>You worked through {problems.length} fraction {problems.length === 1 ? 'question' : 'questions'} and collected {stars} stars.</p>
        <div class="complete-actions">
          <button class="primary-button" type="button" onclick={startActivity}>Play again</button>
          <a href="/">Make an activity</a>
        </div>
      </main>
    {:else if problem}
      <main class="activity-page">
        <section class="instruction-panel">
          <p class="step-label">Question {questionIndex + 1} of {problems.length}</p>
          <div class="big-question">
            <span>What is</span>
            {@render fraction(problem.numerator, problem.denominator)}
            <span>of {problem.total}?</span>
          </div>

          {#if step === 'fraction'}
            <div class="prompt-block">
              <p class="prompt-number">Step 1</p>
              <h2>Which fraction are we finding?</h2>
              <div class="answer-buttons fractions">
                {#each fractionOptions() as option}
                  <button type="button" onclick={() => chooseFraction(option[0], option[1])}>{@render fraction(option[0], option[1], true)}</button>
                {/each}
              </div>
            </div>
          {:else if step === 'groups'}
            <div class="prompt-block">
              <p class="prompt-number">Step 2</p>
              <h2>How many equal groups do we need?</h2>
              <p class="hint">The denominator is the number on the bottom.</p>
              <div class="answer-buttons">
                {#each groupOptions() as option}
                  <button type="button" onclick={() => chooseGroups(option)}>{option}</button>
                {/each}
              </div>
            </div>
          {:else if step === 'slicer'}
            <div class="prompt-block">
              <p class="prompt-number">{settings.guided ? 'Step 3' : 'Get ready'}</p>
              <h2>Place the {problem.denominator}-part slicer.</h2>
              <p class="hint">Drag it onto the {problem.food}, or tap it once.</p>
              <button
                type="button"
                class="slicer-pick"
                class:attached={slicerAttached}
                draggable="true"
                ondragstart={(event) => event.dataTransfer?.setData('text/plain', 'slicer')}
                onclick={attachSlicer}
              >
                <span class="tiny-slicer">
                  {#each Array(problem.denominator) as _, index}<i style={`transform:rotate(${(index * 360) / problem.denominator}deg)`}></i>{/each}
                  <b></b>
                </span>
                <span>{slicerAttached ? 'Slicer placed!' : `${problem.denominator}-part slicer`}</span>
              </button>
              {#if slicerAttached}<button class="primary-button smaller" type="button" onclick={dropCounters}>Drop {problem.total} counters ↓</button>{/if}
            </div>
          {:else if step === 'drop'}
            <div class="prompt-block watching">
              <p class="prompt-number">Watch closely</p>
              <h2>Each part gets the same amount.</h2>
              <div class="equal-groups"><span>{problem.total}</span><span>÷</span><span>{problem.denominator} groups</span></div>
            </div>
          {:else if step === 'answer'}
            <div class="prompt-block">
              <p class="prompt-number">Last step</p>
              <h2>How many counters are in the highlighted {problem.numerator === 1 ? 'part' : `${problem.numerator} parts`}?</h2>
              <div class="answer-buttons">
                {#each answerOptions() as option}
                  <button type="button" onclick={() => chooseAnswer(option)}>{option}</button>
                {/each}
              </div>
            </div>
          {/if}

          <p class="feedback" class:visible={message} aria-live="polite">{message || '\u00a0'}</p>
        </section>

        <section class="visual-panel" aria-label="Visual fraction model">
          <div class="counter-source" class:open={step === 'drop'}>
            <span></span><span></span><span></span>
            <b>{problem.total} counters</b>
          </div>
          <div
            class="food-board"
            class:donut={problem.food === 'donut'}
            class:ready={slicerAttached || step === 'drop' || step === 'answer'}
            class:highlighting={step === 'answer'}
            ondragover={(event) => event.preventDefault()}
            ondrop={attachSlicer}
            role="presentation"
          >
            <div class="food-texture"></div>
            <svg class="wedges" viewBox="0 0 100 100" aria-hidden="true">
              {#if step === 'answer'}
                {#each Array(problem.numerator) as _, index}<path class="highlight-wedge" d={wedgePath(index, problem.denominator)} />{/each}
              {/if}
              {#if slicerAttached || step === 'drop' || step === 'answer'}
                {#each Array(problem.denominator) as _, index}
                  <line x1="50" y1="50" x2={polar(48, -90 + (index * 360) / problem.denominator).x} y2={polar(48, -90 + (index * 360) / problem.denominator).y} />
                {/each}
                <circle cx="50" cy="50" r="6" />
              {/if}
            </svg>
            {#if step === 'drop' || step === 'answer'}
              <div class="counter-layer">
                {#each Array(problem.total) as _, index}
                  {@const point = counterPosition(index)}
                  <i
                    class="counter"
                    style={`--x:${point.x}%;--y:${point.y}%;--delay:${index * 0.055}s;--color:${counterColors[index % counterColors.length]};--drift:${((index * 37) % 90) - 45}px`}
                  ></i>
                {/each}
              </div>
            {/if}
            {#if problem.food === 'donut'}<div class="donut-hole"></div>{/if}
          </div>
          <p class="visual-caption">
            {#if step === 'answer'}
              {@render fraction(problem.numerator, problem.denominator, true)} of {problem.total} = <strong>{answer}</strong>
            {:else if !slicerAttached}
              Drop the slicer here
            {:else}
              {problem.denominator} equal parts
            {/if}
          </p>
        </section>
      </main>
    {/if}
  </div>
{/if}
