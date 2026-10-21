import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

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

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
