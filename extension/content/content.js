// Content script — runs on LinkedIn job pages

/**
 * Auto-detect API URL based on current environment.
 * NOTE: Content scripts run on LinkedIn, so window.location is always linkedin.com.
 * This defaults to production. Override via chrome.storage.sync { apiUrl } for dev.
 */
function getApiUrl() {
  if (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1') {
    console.log('🔧 Environment: DEVELOPMENT (localhost)')
    return 'http://localhost:3000'
  }
  if (window.location.hostname.includes('ngrok-free.app')) {
    console.log('🧪 Environment: TESTING (ngrok)')
    return window.location.origin
  }
  console.log('🚀 Environment: PRODUCTION (Vercel)')
  return 'https://job-hunt-autopilot.vercel.app'
}

const API_URL = getApiUrl()
console.log('%c🎯 Job Hunt Autopilot Active', 'color: #00ff00; font-weight: bold; font-size: 16px;')
console.log('API URL:', API_URL)

/**
 * Listen for token sent from the web app's /extension page
 */
window.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'JHA_SET_EXTENSION_TOKEN') {
    const token = event.data.token
    console.log('📝 Received extension token from web app')
    chrome.storage.sync.set({ extensionToken: token }, function () {
      console.log('✅ Extension token saved')
    })
  }
})

function isJobPage() {
  return window.location.href.includes('linkedin.com/jobs/view/')
}

function injectCaptureButton() {
  if (document.getElementById('jha-capture-button')) return

  // Try multiple possible containers
  const possibleContainers = [
    '.jobs-unified-top-card__content--two-pane',
    '.jobs-details',
    '.jobs-unified-top-card',
    '.job-details-jobs-unified-top-card__container',
    '.jobs-details__main-content',
  ]

  let actionsContainer = null
  for (const selector of possibleContainers) {
    actionsContainer = document.querySelector(selector)
    if (actionsContainer) {
      console.log('Job Hunt Autopilot: Found container:', selector)
      break
    }
  }

  if (!actionsContainer) {
    console.log('Job Hunt Autopilot: No container found. Using fixed position fallback.')
  }

  const button = document.createElement('button')
  button.id = 'jha-capture-button'
  button.className = 'jha-capture-btn'
  button.style.position = 'fixed'
  button.style.bottom = '20px'
  button.style.right = '20px'
  button.style.zIndex = '10000'
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span>Capture Job</span>
  `
  button.addEventListener('click', handleCaptureClick)
  document.body.appendChild(button)
  console.log('Job Hunt Autopilot: Capture button injected (fixed position)')
}

async function handleCaptureClick(event) {
  event.preventDefault()
  const button = event.currentTarget

  button.disabled = true
  button.innerHTML = `
    <svg class="jha-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.4" stroke-dashoffset="10"/>
    </svg>
    <span>Capturing...</span>
  `

  try {
    const jobData = extractJobData()

    // Get stored token
    const storage = await chrome.storage.sync.get(['extensionToken'])
    const token = storage.extensionToken

    if (!token) {
      console.error('❌ No extension token found!')
      const shouldConnect = confirm(
        '⚠️ Extension Not Connected\n\n' +
        'You need to connect the extension first.\n\n' +
        'Click OK to open the extension setup page.'
      )
      if (shouldConnect) {
        chrome.tabs.create({ url: `${API_URL}/extension` })
      }
      resetButton()
      return
    }

    console.log('📤 Sending job to:', `${API_URL}/api/extension/jobs/create`)
    const response = await fetch(`${API_URL}/api/extension/jobs/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(jobData),
    })

    const result = await response.json()

    if (response.ok && result.success) {
      console.log('✅ Job captured successfully:', result.job?.id)

      button.className = 'jha-capture-btn jha-success'
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Captured!</span>
      `
      setTimeout(resetButton, 2000)

      // Handle expiry warning
      if (result.warning) {
        const warning = result.warning
        console.warn('⚠️ Token expiry warning:', warning.message)

        if (chrome.action) {
          chrome.action.setBadgeText({ text: '!' })
          chrome.action.setBadgeBackgroundColor({
            color: warning.severity === 'urgent' ? '#FF0000' : '#FF9500',
          })
        }

        if (warning.expiresIn <= 3) {
          const reconnect = confirm(
            `⚠️ URGENT: Extension Token Expires in ${warning.expiresIn} Day${warning.expiresIn === 1 ? '' : 's'}!\n\n` +
            `Your extension will stop working soon.\n\n` +
            `Click OK to reconnect now (takes 10 seconds).`
          )
          if (reconnect) {
            chrome.tabs.create({ url: `${API_URL}/extension` })
          }
        } else {
          alert(`⏰ Token Expiring Soon\n\n${warning.message}`)
        }
      }

    } else {
      console.error('❌ Failed to capture job:', result)

      if (response.status === 401) {
        const errorMessage = result.error || 'Invalid token'

        if (errorMessage.includes('expired')) {
          const reconnect = confirm(
            '⏰ Extension Token Expired\n\n' +
            'Your extension token has expired.\n\n' +
            'Click OK to reconnect (takes 10 seconds).'
          )
          if (reconnect) {
            chrome.tabs.create({ url: `${API_URL}/extension` })
          }
        } else if (errorMessage.includes('revoked')) {
          alert('⚠️ Extension Token Revoked\n\nYour token was revoked. Opening setup page...')
          chrome.tabs.create({ url: `${API_URL}/extension` })
        } else {
          alert(`⚠️ Authentication Error\n\n${errorMessage}\n\nPlease reconnect your extension.`)
          chrome.tabs.create({ url: `${API_URL}/extension` })
        }
      } else {
        alert(`Failed to capture job:\n\n${result.error}`)
      }

      button.className = 'jha-capture-btn jha-error'
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>Error! Try again</span>
      `
      setTimeout(resetButton, 3000)
    }
  } catch (error) {
    console.error('Job Hunt Autopilot: Error capturing job:', error)

    button.className = 'jha-capture-btn jha-error'
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Error! Try again</span>
    `

    setTimeout(resetButton, 3000)
  }

  function resetButton() {
    button.disabled = false
    button.className = 'jha-capture-btn'
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Capture Job</span>
    `
  }
}

function extractJobData() {
  try {
    console.log('Job Hunt Autopilot: Starting data extraction...')

    // Company name - find link that goes to /company/
    const companyElement = document.querySelector('a[href*="/company/"]')
    const companyName = companyElement?.innerText?.trim() || ''
    console.log('Company name:', companyName)

    // Extract domain from company URL
    let companyDomain = ''
    if (companyElement) {
      const match = companyElement.href.match(/linkedin\.com\/company\/([^\/]+)/)
      if (match) companyDomain = match[1] + '.com'
    }
    console.log('Company domain:', companyDomain)

    // Job title - LinkedIn puts it in a <p> that is a direct child of div[data-display-contents]
    // The company name <p> is nested inside an <a>, so we skip those
    let titleElement = null
    for (const p of document.querySelectorAll('div[data-display-contents] > p')) {
      if (!p.closest('a')) { titleElement = p; break }
    }
    if (!titleElement) {
      // Fallback: first h1 with meaningful text
      for (const el of document.querySelectorAll('h1')) {
        const text = el.innerText.trim()
        if (text && text.length > 2) { titleElement = el; break }
      }
    }
    const jobTitle = titleElement?.innerText?.trim() || ''
    console.log('Job title:', jobTitle)

    // Job URL
    const jobUrl = window.location.href.split('?')[0]
    console.log('Job URL:', jobUrl)

    // Location
    const locationElement = document.querySelector('span.ad41daa7')
    const location = locationElement?.innerText?.trim() || ''
    console.log('Location:', location)

    // Salary - regex scan for currency pattern in page text
    let salary = null
    const salaryMatch = document.body.innerText.match(/Salary\s+(£|\$)[\d,k\-\s]+/i)
    if (salaryMatch) salary = salaryMatch[0].trim()
    console.log('Salary:', salary)

    // Job description
    const descriptionElement = document.querySelector('span[data-testid="expandable-text-box"]')
    const jobDescription = descriptionElement?.innerText?.trim() || ''
    console.log('Description length:', jobDescription.length, 'characters')

    // Validate required fields
    if (!companyName || !jobTitle || !jobUrl) {
      console.error('Missing required fields:', { companyName, jobTitle, jobUrl })
      console.log('=== DEBUG ===')
      console.log('Company link found:', companyElement)
      console.log('Title element found:', titleElement)
      console.log('First p tag:', document.querySelector('p')?.innerText)
      console.log('First h1 tag:', document.querySelector('h1')?.innerText)
      throw new Error('Missing required job data. Company: ' + !!companyName + ', Title: ' + !!jobTitle)
    }

    const result = {
      company_name: companyName,
      company_domain: companyDomain || null,
      job_title: jobTitle,
      job_url: jobUrl,
      location: location || null,
      salary,
      job_description: jobDescription || null,
      status: 'captured',
    }

    console.log('Job Hunt Autopilot: Successfully extracted data:', result)
    return result

  } catch (error) {
    console.error('Job Hunt Autopilot: Error extracting job data:', error)
    throw error
  }
}

// Initialize
if (isJobPage()) {
  setTimeout(injectCaptureButton, 2000)

  // Watch for DOM changes (LinkedIn is a SPA)
  const observer = new MutationObserver(() => {
    if (isJobPage()) injectCaptureButton()
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// Watch for SPA navigation
let lastUrl = location.href
new MutationObserver(() => {
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    if (isJobPage()) setTimeout(injectCaptureButton, 2000)
  }
}).observe(document, { subtree: true, childList: true })
