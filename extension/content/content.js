// Content script — runs on LinkedIn job pages
console.log('Job Hunt Autopilot: Content script loaded')

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

    const result = await chrome.storage.sync.get(['apiUrl'])
    const apiUrl = result.apiUrl || 'http://localhost:3000'

    const response = await fetch(`${apiUrl}/api/jobs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    button.className = 'jha-capture-btn jha-success'
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Captured!</span>
    `

    setTimeout(resetButton, 2000)
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

    // Company name - try multiple selectors
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__primary-description-container a',
      '[data-test-job-details-company-name]',
    ]

    let companyElement = null
    for (const selector of companySelectors) {
      companyElement = document.querySelector(selector)
      if (companyElement) {
        console.log('Found company with selector:', selector)
        break
      }
    }

    const companyName = companyElement?.innerText?.trim() || ''
    console.log('Company name:', companyName)

    // Extract domain
    let companyDomain = ''
    if (companyElement && companyElement.tagName === 'A') {
      const match = companyElement.href.match(/linkedin\.com\/company\/([^\/]+)/)
      if (match) companyDomain = match[1] + '.com'
    }
    console.log('Company domain:', companyDomain)

    // Job title - try multiple selectors
    const titleSelectors = [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title a',
      '[data-test-job-details-job-title]',
    ]

    let titleElement = null
    for (const selector of titleSelectors) {
      titleElement = document.querySelector(selector)
      if (titleElement) {
        console.log('Found title with selector:', selector)
        break
      }
    }

    const jobTitle = titleElement?.innerText?.trim() || ''
    console.log('Job title:', jobTitle)

    // Job URL
    const jobUrl = window.location.href.split('?')[0]
    console.log('Job URL:', jobUrl)

    // Location - try multiple selectors
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__primary-description-container span',
      '[data-test-job-details-location]',
    ]

    let locationElement = null
    for (const selector of locationSelectors) {
      locationElement = document.querySelector(selector)
      if (locationElement) {
        console.log('Found location with selector:', selector)
        break
      }
    }

    const location = locationElement?.innerText?.trim() || ''
    console.log('Location:', location)

    // Salary - try multiple selectors
    const salarySelectors = [
      '.job-details-jobs-unified-top-card__job-insight span',
      '.jobs-unified-top-card__job-insight span',
      '[data-test-job-details-salary]',
    ]

    let salaryElement = null
    for (const selector of salarySelectors) {
      salaryElement = document.querySelector(selector)
      if (salaryElement && salaryElement.innerText.includes('$')) {
        console.log('Found salary with selector:', selector)
        break
      }
    }

    const salary = salaryElement?.innerText?.trim() || null
    console.log('Salary:', salary)

    // Job description - try multiple selectors
    const descriptionSelectors = [
      '.jobs-description-content__text',
      '.jobs-description__content',
      '.job-details-jobs-unified-top-card__job-description',
      '[data-test-job-details-description]',
      '.jobs-box__html-content',
    ]

    let descriptionElement = null
    for (const selector of descriptionSelectors) {
      descriptionElement = document.querySelector(selector)
      if (descriptionElement) {
        console.log('Found description with selector:', selector)
        break
      }
    }

    const jobDescription = descriptionElement?.innerText?.trim() || ''
    console.log('Description length:', jobDescription.length, 'characters')

    // Validate required fields
    if (!companyName || !jobTitle || !jobUrl) {
      console.error('Missing required fields:', { companyName, jobTitle, jobUrl })
      console.log('=== DEBUG: Page content ===')
      console.log('All h1 elements:', Array.from(document.querySelectorAll('h1')).map(el => el.innerText))
      console.log('All a[href*="company"] elements:', Array.from(document.querySelectorAll('a[href*="company"]')).map(el => el.innerText))
      throw new Error('Missing required job data. Make sure you are on a LinkedIn job detail page.')
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

    console.log('Job Hunt Autopilot: Extracted data:', result)
    return result

  } catch (error) {
    console.error('Job Hunt Autopilot: Error in extractJobData:', error)
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
