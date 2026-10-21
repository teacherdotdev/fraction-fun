<script lang="ts">
  import SiteChrome from './components/SiteChrome.svelte'
  import {
    answerOf,
    MAX_DENOMINATOR,
    MAX_WHOLE,
    MIN_DENOMINATOR,
    modeFromParams,
    problemFromParams,
    problemIssues,
    problemQuery,
    shareOf,
    type Mode,
    type Problem,
    type ProblemField,
  } from './lib/problem'

  // The pizza itself (`?item=pizza`) is drawn by the activity; setup only writes the param.
  type Item = 'donut' | 'pizza'

  // Opened from a student link ("For teachers"), the form starts on that problem.
  const params = new URLSearchParams(location.search)
  const start = problemFromParams(params)

  let numerator = $state<number | null>(start.numerator)
  let denominator = $state<number | null>(start.denominator)
  let whole = $state<number | null>(start.whole)
  let item = $state<Item>(params.get('item') === 'pizza' ? 'pizza' : 'donut')
  let mode = $state<Mode>(modeFromParams(params))
  let copied = $state(false)
  let copyTimer = 0
  let linkField: HTMLInputElement | undefined = $state()

  const problem: Problem = $derived({
    numerator: numerator ?? NaN,
    denominator: denominator ?? NaN,
    whole: whole ?? NaN,
  })
  const issues = $derived(problemIssues(problem))
  const issueFor = (field: ProblemField) => issues.find((issue) => issue.field === field)
  const valid = $derived(issues.length === 0)
  const link = $derived(`${location.origin}/?${problemQuery(problem, { item, mode })}`)

  const FIELDS: { field: ProblemField; label: string; help: string; min: number; max: number }[] = [
    { field: 'numerator', label: 'Numerator', help: 'Groups to keep', min: 1, max: MAX_DENOMINATOR - 1 },
    {
      field: 'denominator',
      label: 'Denominator',
      help: `Groups to cut, ${MIN_DENOMINATOR}–${MAX_DENOMINATOR}`,
      min: MIN_DENOMINATOR,
      max: MAX_DENOMINATOR,
    },
    { field: 'whole', label: 'Whole', help: `The "of" number, max ${MAX_WHOLE}`, min: 1, max: MAX_WHOLE },
  ]

  function valueOf(field: ProblemField): number | null {
    return field === 'numerator' ? numerator : field === 'denominator' ? denominator : whole
  }

  function set(field: ProblemField, value: number | null) {
    copied = false
    if (field === 'numerator') numerator = value
    else if (field === 'denominator') denominator = value
    else whole = value
  }

  function nudge(field: ProblemField, delta: number, min: number, max: number) {
    const current = valueOf(field)
    const next = current === null || Number.isNaN(current) ? min : Math.round(current) + delta
    set(field, Math.min(max, Math.max(min, next)))
  }

  function onInput(field: ProblemField, event: Event) {
    const text = (event.currentTarget as HTMLInputElement).value
    set(field, text === '' ? null : Number(text))
  }

  async function copy() {
    if (!valid) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Older browsers or no permission: select the link so Ctrl/Cmd+C works.
      linkField?.select()
      document.execCommand?.('copy')
    }
    copied = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied = false), 2500)
  }

  function open() {
    if (valid) window.open(link, '_blank', 'noopener')
  }

  const itemName = $derived(item === 'pizza' ? 'pizza' : 'donut')
</script>

<svelte:head>
  <title>Teacher setup · Fraction Fun</title>
</svelte:head>

<div class="teacher">
  <div class="page">
  <main>
    <header>
      <a class="home" href="/">Fraction Fun</a>
      <h1>Teacher setup</h1>
      <p class="lede">Choose a problem, then share the link with your students. Each link is one problem.</p>
    </header>

    <section class="card" aria-labelledby="problem-heading">
      <h2 id="problem-heading">Problem</h2>
      <div class="fields">
        {#each FIELDS as { field, label, help, min, max } (field)}
          {@const issue = issueFor(field)}
          <div class="field" class:invalid={issue}>
            <label for={field}>{label}</label>
            <div class="spin">
              <button type="button" aria-label={`${label} one less`} onclick={() => nudge(field, -1, min, max)}>−</button>
              <input
                id={field}
                type="number"
                inputmode="numeric"
                {min}
                {max}
                step="1"
                value={valueOf(field) ?? ''}
                oninput={(event) => onInput(field, event)}
                aria-invalid={issue ? 'true' : undefined}
                aria-describedby={`${field}-help`}
              />
              <button type="button" aria-label={`${label} one more`} onclick={() => nudge(field, 1, min, max)}>+</button>
            </div>
            <p class="help" id={`${field}-help`}>{help}</p>
          </div>
        {/each}
      </div>

      <div class="issues" aria-live="polite">
        {#each issues as issue (issue.field + issue.message)}
          <p class="issue">
            {issue.message}
            {#if issue.suggestions?.length}
              Try
              {#each issue.suggestions as suggestion, i (suggestion)}
                {#if i > 0}{' or '}{/if}<button type="button" class="suggestion" onclick={() => set('whole', suggestion)}>{suggestion}</button>
              {/each}
            {/if}
          </p>
        {/each}
      </div>

      <fieldset class="choice">
        <legend>Item</legend>
        <div class="options">
          <label class:on={item === 'donut'}><input type="radio" bind:group={item} value="donut" />Donut</label>
          <label class:on={item === 'pizza'}><input type="radio" bind:group={item} value="pizza" />Pizza</label>
        </div>
      </fieldset>

      <fieldset class="choice">
        <legend>Mode</legend>
        <div class="options">
          <label class:on={mode === 'interactive'}>
            <input type="radio" bind:group={mode} value="interactive" />Interactive
          </label>
          <label class:on={mode === 'watch'}><input type="radio" bind:group={mode} value="watch" />Watch</label>
        </div>
        <p class="help">
          {#if mode === 'watch'}
            Each press of the button plays the next step as an animation. Good for modelling to the class.
          {:else}
            Students do each step themselves, with hints if they get stuck.
          {/if}
        </p>
      </fieldset>
    </section>

    <section class="card preview" class:stale={!valid} aria-labelledby="preview-heading">
      <h2 id="preview-heading">Students see</h2>
      <p class="question" aria-label={`What is ${numerator ?? '?'} over ${denominator ?? '?'} of ${whole ?? '?'}?`}>
        <span>What is</span>
        <span class="fraction" aria-hidden="true">
          <span>{numerator ?? '?'}</span>
          <span class="bar"></span>
          <span>{denominator ?? '?'}</span>
        </span>
        <span>of {whole ?? '?'}?</span>
      </p>
      {#if valid}
        <p class="working">
          {problem.denominator} equal groups of {shareOf(problem)} on the {itemName}; keep {problem.numerator}.
          Answer: <strong>{answerOf(problem)}</strong>
        </p>
      {:else}
        <p class="working">Fix the problem above to get a link.</p>
      {/if}

      <label class="link-label" for="link">Student link</label>
      <input
        id="link"
        class="link"
        bind:this={linkField}
        readonly
        value={valid ? link : ''}
        placeholder="No link yet"
        onfocus={(event) => event.currentTarget.select()}
      />
      <div class="actions">
        <button type="button" class="primary" disabled={!valid} onclick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        <button type="button" class="secondary" disabled={!valid} onclick={open}>Open</button>
      </div>
      <p class="help">Paste the link into Google Classroom, an email or a slide.</p>
    </section>
  </main>
  <SiteChrome scrolls />
  </div>
</div>

<style>
  .teacher {
    height: 100dvh;
    overflow-y: auto;
    user-select: text;
    -webkit-user-select: text;
  }

  /* The corner buttons sit on this, so they scroll with the page. */
  .page {
    position: relative;
    min-height: 100%;
  }

  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 16px 72px;
    display: grid;
    gap: 20px;
  }

  header {
    display: grid;
    gap: 6px;
  }

  .home {
    justify-self: start;
    color: var(--accent);
    font: 700 18px/1.2 var(--font);
    text-decoration: none;
  }

  .home:hover {
    text-decoration: underline;
  }

  h1 {
    margin: 0;
    font: 700 clamp(30px, 6vw, 40px) / 1.1 var(--font);
  }

  .lede {
    margin: 0;
    color: var(--ink-soft);
    font: 400 18px/1.4 var(--font-text);
  }

  .card {
    display: grid;
    gap: 16px;
    padding: 20px;
    border-radius: 24px;
    background: #fff;
    box-shadow: 0 6px 24px #2b2b3a1a;
  }

  h2 {
    margin: 0;
    font: 700 22px/1.2 var(--font);
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .field {
    display: grid;
    gap: 6px;
    align-content: start;
  }

  .field > label,
  legend,
  .link-label {
    font: 600 17px/1.2 var(--font);
    padding: 0;
  }

  .spin {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    align-items: center;
    border: 2px solid #2b2b3a26;
    border-radius: 14px;
    overflow: hidden;
    background: #fff;
  }

  .field.invalid .spin {
    border-color: #d9363e;
    background: #fff4f4;
  }

  .spin button {
    height: 48px;
    border: none;
    background: transparent;
    color: var(--ink);
    font: 700 24px/1 var(--font);
    cursor: pointer;
    touch-action: manipulation;
  }

  .spin button:hover {
    background: #2b2b3a0d;
  }

  .spin input {
    width: 100%;
    min-width: 0;
    height: 48px;
    border: none;
    background: transparent;
    text-align: center;
    color: var(--ink);
    font: 700 24px/1 var(--font);
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .spin input::-webkit-inner-spin-button,
  .spin input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .spin input:focus {
    outline: none;
  }

  .spin:focus-within {
    outline: 3px solid #ffd23f;
    outline-offset: 1px;
  }

  .help {
    margin: 0;
    color: var(--ink-soft);
    font: 400 15px/1.35 var(--font-text);
  }

  .issues {
    display: grid;
    gap: 8px;
  }

  .issues:empty {
    display: none;
  }

  .issue {
    margin: 0;
    padding: 10px 14px;
    border-radius: 14px;
    background: #fff1d6;
    color: var(--ink);
    font: 400 16px/1.5 var(--font-text);
  }

  .suggestion {
    padding: 2px 12px;
    margin: 0 2px;
    border: 2px solid var(--go);
    border-radius: 999px;
    background: #fff;
    color: var(--go);
    font: 700 16px/1.3 var(--font);
    cursor: pointer;
  }

  .suggestion:hover {
    background: var(--go);
    color: #fff;
  }

  .choice {
    margin: 0;
    padding: 0;
    border: none;
    display: grid;
    gap: 8px;
  }

  .options {
    display: inline-flex;
    justify-self: start;
    padding: 4px;
    gap: 4px;
    border-radius: 999px;
    background: #2b2b3a12;
  }

  .options label {
    padding: 8px 18px;
    border-radius: 999px;
    font: 600 17px/1.2 var(--font);
    color: var(--ink-soft);
    cursor: pointer;
  }

  .options label.on {
    background: #fff;
    color: var(--ink);
    box-shadow: 0 2px 8px #2b2b3a1f;
  }

  .options label:has(input:focus-visible) {
    outline: 3px solid #ffd23f;
  }

  .options input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .question {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.3em;
    font: 700 clamp(30px, 8vw, 44px) / 1.15 var(--font);
    transition: opacity 0.2s;
  }

  .fraction {
    display: inline-grid;
    justify-items: center;
    font-size: 0.6em;
    line-height: 1;
  }

  .fraction .bar {
    width: 100%;
    min-width: 0.9em;
    height: 0.1em;
    margin: 0.06em 0;
    background: currentColor;
  }

  .stale .question {
    opacity: 0.4;
  }

  .working {
    margin: 0;
    text-align: center;
    color: var(--ink-soft);
    font: 400 17px/1.4 var(--font-text);
  }

  .working strong {
    color: var(--accent);
  }

  .link {
    width: 100%;
    padding: 12px 14px;
    border: 2px solid #2b2b3a26;
    border-radius: 14px;
    background: var(--bg);
    color: var(--ink);
    font: 400 16px/1.3 var(--font-text);
  }

  .link:focus {
    outline: 3px solid #ffd23f;
    outline-offset: 1px;
  }

  .link-label {
    margin-bottom: -8px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .actions button {
    padding: 12px 28px;
    border-radius: 999px;
    font: 700 20px/1 var(--font);
    cursor: pointer;
    touch-action: manipulation;
  }

  .primary {
    min-width: 160px;
    border: none;
    background: var(--go);
    color: #fff;
    box-shadow: 0 4px 0 #00000033;
  }

  .primary:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 1px 0 #00000033;
  }

  .secondary {
    border: 2px solid var(--ink);
    background: #fff;
    color: var(--ink);
  }

  .actions button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* Clear the logo in the top-left corner once the page is too narrow to sit beside it. */
  @media (max-width: 800px) {
    main {
      padding-top: 84px;
    }
  }

  @media (max-width: 520px) {

    .card {
      padding: 16px;
    }

    .fields {
      grid-template-columns: 1fr;
    }

    .field {
      grid-template-columns: minmax(0, 1fr) 136px;
      align-items: center;
      column-gap: 12px;
    }

    .field .help {
      grid-column: 1;
      grid-row: 2;
      margin-top: -4px;
    }

    .spin {
      grid-column: 2;
      grid-row: 1 / span 2;
    }

    .actions button {
      flex: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .question {
      transition: none;
    }
  }
</style>
