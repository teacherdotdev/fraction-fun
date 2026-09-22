import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Cloudflare Web Analytics is enabled only when the production token is present.
const beaconToken = import.meta.env.VITE_CF_BEACON
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
