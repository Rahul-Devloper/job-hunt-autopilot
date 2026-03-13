async function checkConnection() {
  const statusEl = document.getElementById('connection-status')
  const jobsCountEl = document.getElementById('jobs-count')

  try {
    const { apiUrl = 'http://localhost:3000' } =
      await chrome.storage.sync.get(['apiUrl'])

    const response = await fetch(`${apiUrl}/api/health`)

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
  const { apiUrl = 'http://localhost:3000' } =
    await chrome.storage.sync.get(['apiUrl'])
  chrome.tabs.create({ url: `${apiUrl}/dashboard/jobs` })
})

document.getElementById('settings-btn').addEventListener('click', () => {
  alert('Settings coming soon! API URL: http://localhost:3000')
})

checkConnection()
