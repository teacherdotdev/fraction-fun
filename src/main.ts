import { mount } from 'svelte'
// Fonts are served from this site, so no font service sees who visits.
import '@fontsource-variable/fredoka/wght.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './app.css'
import App from './App.svelte'
import { preloadSounds } from './lib/sound'
import Teacher from './Teacher.svelte'

// Cloudflare Web Analytics, production builds only. The token is public (it ships in
// every page), so the fractionfun.org one lives here unless a build overrides it.
const FRACTION_FUN_BEACON = '0ffe3aef55e94bc981d3756d644b8d78'
const beaconToken = import.meta.env.PROD
  ? import.meta.env.VITE_CF_BEACON || FRACTION_FUN_BEACON
  : undefined
if (beaconToken) {
  const script = document.createElement('script')
  script.defer = true
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  script.dataset.cfBeacon = JSON.stringify({ token: beaconToken })
  document.head.appendChild(script)
}

// /teacher is the same single-page app (vercel.json rewrites it to index.html).
const forTeachers = /^\/teacher\/?$/.test(location.pathname)
if (!forTeachers) preloadSounds()

const app = mount(forTeachers ? Teacher : App, {
  target: document.getElementById('app')!,
})

export default app
