// Content script — runs on LinkedIn job pages

/**
 * Auto-detect API URL based on current environment.
 * NOTE: Content scripts run on LinkedIn, so window.location is always linkedin.com.
 * This defaults to production. Override via chrome.storage.sync { apiUrl } for dev.
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

console.log('%c🎯 Job Hunt Autopilot Active', 'color: #00ff00; font-weight: bold; font-size: 16px;')

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
    console.log('[JHA] Waiting for poster section to load...')
    await waitForPoster(5000)
    const jobData = extractJobData()
    const API_URL = await getApiUrl()

    // Get stored token
    const storage = await chrome.storage.sync.get(['extensionToken'])
    const token = storage.extensionToken
    console.log('extensionToken from storage:', token ? token : '❌ Not found')

    if (!token) {
      console.error('❌ No extension token found!')
      const shouldConnect = confirm(
        '⚠️ Extension Not Connected\n\n' +
        'You need to connect the extension first.\n\n' +
        'Click OK to open the extension setup page.'
      )
      if (shouldConnect) {
        window.open(`${API_URL}/extension`, '_blank')
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
            window.open(`${API_URL}/extension`, '_blank')
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
            window.open(`${API_URL}/extension`, '_blank')
          }
        } else if (errorMessage.includes('revoked')) {
          alert('⚠️ Extension Token Revoked\n\nYour token was revoked. Opening setup page...')
          window.open(`${API_URL}/extension`, '_blank')
        } else {
          alert(`⚠️ Authentication Error\n\n${errorMessage}\n\nPlease reconnect your extension.`)
          window.open(`${API_URL}/extension`, '_blank')
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

/**
 * Recursively search a JSON object for LinkedIn job poster data.
 * Bounded to depth 6 to avoid blowing the stack on large payloads.
 */
function searchJsonForPoster(obj, depth) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = searchJsonForPoster(item, depth + 1)
      if (r) return r
    }
    return null
  }

  const keys = Object.keys(obj)

  // Explicit posterFullName key — LinkedIn's canonical field
  if (obj.posterFullName) {
    return {
      name: obj.posterFullName,
      title: obj.posterTitle || null,
      linkedin_url: obj.posterPublicIdentifier
        ? 'https://www.linkedin.com/in/' + obj.posterPublicIdentifier
        : null,
    }
  }

  // firstName + lastName pair near a poster/hirer/recruiter context
  if (obj.firstName && obj.lastName) {
    const keyStr = keys.join(',').toLowerCase()
    if (
      keyStr.includes('poster') ||
      keyStr.includes('hirer') ||
      keyStr.includes('recruiter') ||
      keyStr.includes('talent')
    ) {
      return {
        name: (obj.firstName + ' ' + obj.lastName).trim(),
        title: obj.headline || obj.title || null,
        linkedin_url: obj.publicIdentifier
          ? 'https://www.linkedin.com/in/' + obj.publicIdentifier
          : null,
      }
    }
  }

  for (const key of keys) {
    const val = obj[key]
    if (val && typeof val === 'object') {
      const r = searchJsonForPoster(val, depth + 1)
      if (r) return r
    }
  }

  return null
}

/**
 * Poll the DOM until the "Job poster" or "Meet the hiring team" section appears.
 * LinkedIn lazy-loads the hiring team section after main content — without this,
 * extractPosterData() runs before the poster DOM exists and always returns null.
 */
function waitForPoster(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now()

    function check() {
      const allP = document.querySelectorAll('p')
      for (const p of allP) {
        if (p.textContent?.trim() === 'Job poster') {
          console.log('[JHA] Poster section detected in DOM')
          resolve(true)
          return
        }
      }
      for (const p of allP) {
        if (p.textContent?.trim() === 'Meet the hiring team') {
          console.log('[JHA] Hiring team section detected in DOM')
          resolve(true)
          return
        }
      }
      if (Date.now() - start > timeoutMs) {
        console.log('[JHA] Poster section not found after timeout — proceeding without poster')
        resolve(false)
        return
      }
      setTimeout(check, 300)
    }

    check()
  })
}

/**
 * Extract the job poster's name, title, and LinkedIn URL from the current page.
 * Anchors on the visible "Job poster" label text — more reliable than hashed class names.
 * Always returns an object — nulls mean "not found".
 */
function extractPosterData() {
  try {
    const posterParagraphs = [...document.querySelectorAll('p')]
      .filter(p => p.textContent?.trim() === 'Job poster')
    console.log('[JHA] "Job poster" paragraphs found:', posterParagraphs.length)

    const hiringParagraphs = [...document.querySelectorAll('p')]
      .filter(p => p.textContent?.trim() === 'Meet the hiring team')
    console.log('[JHA] "Meet the hiring team" paragraphs found:', hiringParagraphs.length)
    const allParagraphs = document.querySelectorAll('p')

    // Strategy 1: Find the "Job poster" label, walk up to the poster card
    let jobPosterLabel = null
    for (const p of allParagraphs) {
      if (p.textContent?.trim() === 'Job poster') {
        jobPosterLabel = p
        break
      }
    }

    if (jobPosterLabel) {
      const posterCard = jobPosterLabel.closest('a[href*="linkedin.com/in/"]')
      if (posterCard) {
        const linkedinUrl = posterCard.href?.split('?')[0] || null
        const paragraphs = posterCard.querySelectorAll('p')
        let name = null
        let title = null

        for (const p of paragraphs) {
          const text = p.textContent?.trim()
          if (!text || text === 'Job poster') continue
          if (!name && text.length > 2 && text.length < 60 && !text.includes('•')) {
            name = text
          } else if (!title && text.length > 5 && text !== name) {
            title = text
          }
        }

        // Fallback: derive name from LinkedIn URL slug
        if (!name && linkedinUrl) {
          const slug = linkedinUrl.split('/in/')[1]?.replace(/\/$/, '') || ''
          name = slug.split('-').slice(0, -1).join(' ') || slug
        }

        console.log('[JHA] Poster found via "Job poster" label:', { name, title, linkedinUrl })
        return { poster_name: name, poster_title: title, poster_linkedin_url: linkedinUrl }
      }
    }

    // Strategy 2: "Meet the hiring team" section
    for (const p of allParagraphs) {
      if (p.textContent?.trim() === 'Meet the hiring team') {
        const section = p.closest('div')
        const link = section?.querySelector('a[href*="linkedin.com/in/"]')
        if (link) {
          const name = link.textContent?.trim() || null
          const linkedinUrl = link.href?.split('?')[0] || null
          console.log('[JHA] Poster found via "Meet the hiring team":', name)
          return { poster_name: name, poster_title: null, poster_linkedin_url: linkedinUrl }
        }
      }
    }

    // Strategy 3: JSON script tags (LinkedIn embedded data)
    try {
      const scripts = document.querySelectorAll('script[type="application/json"]')
      for (const script of scripts) {
        try {
          const text = script.textContent || ''
          if (!text.includes('poster') && !text.includes('hirer') && !text.includes('recruiter')) continue
          const json = JSON.parse(text)
          const poster = searchJsonForPoster(json, 0)
          if (poster) return { poster_name: poster.name, poster_title: poster.title, poster_linkedin_url: poster.linkedin_url }
        } catch {}
      }
    } catch {}

    console.log('[JHA] No poster found on this page')
    return { poster_name: null, poster_title: null, poster_linkedin_url: null }

  } catch (e) {
    console.error('[JHA] extractPosterData error:', e)
    return { poster_name: null, poster_title: null, poster_linkedin_url: null }
  }
}

function extractJobData() {
  try {
    console.log('Job Hunt Autopilot: Starting data extraction...')

    // ── Company name ─────────────────────────────────────────────────────────
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '[data-test-id="job-details-company-name"]',
      '.topcard__org-name-link',
      '.topcard__flavor a',
      '.jobs-details-top-card__company-url',
      'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
      'a[href*="/company/"]',
    ]

    let companyName = ''
    let companyElement = null
    for (const sel of companySelectors) {
      const el = document.querySelector(sel)
      const text = el?.textContent?.trim() || el?.innerText?.trim()
      if (text && text.length > 0) {
        companyName = text
        companyElement = el
        console.log(`[JHA] Company via selector "${sel}":`, companyName)
        break
      }
    }

    // og:title fallback: "Job Title at Company Name"
    if (!companyName) {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      if (ogTitle && ogTitle.includes(' at ')) {
        const company = ogTitle.split(' at ').pop()?.trim()
        if (company) { companyName = company; console.log('[JHA] Company via og:title:', companyName) }
      }
    }

    // Page title fallback: "Title at Company | LinkedIn"
    if (!companyName && document.title.includes(' at ')) {
      const company = document.title.split(' at ')[1]?.split('|')[0]?.trim()
      if (company) { companyName = company; console.log('[JHA] Company via page title:', companyName) }
    }

    // Extract domain from company /company/ URL
    let companyDomain = ''
    if (companyElement && companyElement.href) {
      const match = companyElement.href.match(/linkedin\.com\/company\/([^/?]+)/)
      if (match) companyDomain = match[1] + '.com'
    }
    console.log('Company domain:', companyDomain)

    // ── Job title ─────────────────────────────────────────────────────────────
    const titleSelectors = [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title',
      '.topcard__title',
      '[data-test-id="job-details-job-title"]',
      'h1.t-24',
      'h1',
    ]

    let jobTitle = ''
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel)
      const text = el?.textContent?.trim() || el?.innerText?.trim()
      if (text && text.length > 2) {
        jobTitle = text
        console.log(`[JHA] Title via selector "${sel}":`, jobTitle)
        break
      }
    }

    // Fallback: <p> that is a direct child of div[data-display-contents] and not inside <a>
    if (!jobTitle) {
      for (const p of document.querySelectorAll('div[data-display-contents] > p')) {
        if (!p.closest('a')) {
          const text = p.innerText?.trim()
          if (text && text.length > 2) { jobTitle = text; break }
        }
      }
    }

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
      console.log('og:title:', document.querySelector('meta[property="og:title"]')?.getAttribute('content'))
      console.log('page title:', document.title)
      console.log('First h1:', document.querySelector('h1')?.innerText)
      console.log('First p:', document.querySelector('p')?.innerText)
      throw new Error('Missing required job data. Company: ' + !!companyName + ', Title: ' + !!jobTitle)
    }

    // Poster data — fault-tolerant, never throws
    let posterData = { poster_name: null, poster_title: null, poster_linkedin_url: null }
    try {
      posterData = extractPosterData()
      console.log('Poster data:', posterData)
    } catch {
      console.warn('Job Hunt Autopilot: Poster extraction failed (non-fatal)')
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
      poster_name: posterData.poster_name,
      poster_title: posterData.poster_title,
      poster_linkedin_url: posterData.poster_linkedin_url,
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
