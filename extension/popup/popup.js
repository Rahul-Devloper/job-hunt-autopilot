/**
 * Auto-detect API URL for popup.
 * Popup has no meaningful window.location, so we check devMode from storage.
 * Set devMode via: chrome.storage.local.set({ devMode: true }) in DevTools console.
 */
async function getApiUrl() {
  const { devMode } = await chrome.storage.local.get(['devMode'])
  if (devMode) {
    console.log('🔧 Environment: DEVELOPMENT (localhost)')
    return 'http://localhost:3000'
  }
  console.log('🚀 Environment: PRODUCTION (Vercel)')
  return 'https://job-hunt-autopilot.vercel.app'
}

async function checkConnection() {
  const statusEl = document.getElementById('connection-status')
  const jobsCountEl = document.getElementById('jobs-count')

  try {
    const API_URL = await getApiUrl()

    const response = await fetch(`${API_URL}/api/health`)

    if (response.ok) {
      statusEl.textContent = 'Connected ✓'
      statusEl.className = 'status-value connected'
    } else {
      throw new Error('API not responding')
    }
  } catch {
    statusEl.textContent = 'Disconnected ✗'
    statusEl.className = 'status-value disconnected'
  }

  jobsCountEl.textContent = '-'
}

document.getElementById('open-dashboard').addEventListener('click', async () => {
  const API_URL = await getApiUrl()
  chrome.tabs.create({ url: `${API_URL}/dashboard/jobs` })
})

document.getElementById('settings-btn').addEventListener('click', async () => {
  const API_URL = await getApiUrl()
  const env = API_URL.includes('localhost') ? 'DEV (localhost)' : 'PROD (Vercel)'
  alert(`Settings coming soon!\nEnvironment: ${env}\nAPI URL: ${API_URL}`)
})

checkConnection()
