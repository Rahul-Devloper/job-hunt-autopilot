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

    // Job title - try multiple approaches
    // Debug: log all headings to find the right one
    const allH1 = Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim()).filter(Boolean)
    const allH2 = Array.from(document.querySelectorAll('h2')).map(el => el.innerText.trim()).filter(Boolean)
    console.log('All h1 elements:', allH1)
    console.log('All h2 elements:', allH2)

    let titleElement = null
    // Try h1 first — but skip ones that look like LinkedIn nav/branding
    for (const el of document.querySelectorAll('h1')) {
      const text = el.innerText.trim()
      if (text && text.length > 2) {
        titleElement = el
        console.log('Found title in h1:', text)
        break
      }
    }
    // Fallback: h2
    if (!titleElement) {
      for (const el of document.querySelectorAll('h2')) {
        const text = el.innerText.trim()
        if (text && text.length > 2) {
          titleElement = el
          console.log('Found title in h2:', text)
          break
        }
      }
    }
    // Fallback: element near the company link
    if (!titleElement && companyElement) {
      const parent = companyElement.closest('[class]')?.parentElement
      if (parent) {
        const nearby = parent.querySelector('p, span, div')
        if (nearby?.innerText?.trim()) {
          titleElement = nearby
          console.log('Found title near company element:', nearby.innerText.trim())
        }
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
