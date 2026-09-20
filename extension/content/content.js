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
 * Resilience layer for DOM extraction.
 *
 * LinkedIn's HTML shifts (randomized/hashed class names) without warning, and until now that
 * broke extraction silently. This is the single place that tries an ordered list of extraction
 * strategies for one field, logs which one worked (or that all of them failed), and reports a
 * per-field confidence so the caller can decide whether the overall capture is trustworthy.
 *
 * `tiers` is ordered most-stable to least-stable:
 *   - 'stable'      structural/semantic selectors (data-test-*, href patterns) — least likely to break
 *   - 'known'       current hard-coded class names — may break on any LinkedIn redesign
 *   - 'last-resort' degraded-confidence structural guesses (e.g. "first <h1> on page") — logged
 *                   loudly so a human knows this tier firing means "go check this field"
 *
 * Each tier's `run()` returns a string (possibly empty) or null/undefined if nothing matched.
 * Returns { value, confidence, tier } — confidence is 'ok' for stable/known, 'degraded' for
 * last-resort, 'failed' if every tier came back empty/null.
 */
function jhaExtract(fieldName, tiers) {
  for (const t of tiers) {
    let raw
    try {
      raw = t.run()
    } catch (e) {
      console.error(`[JHA-SCRAPER] ${fieldName}: tier "${t.label}" (${t.tier}) threw an error:`, e)
      continue
    }

    if (raw === null || raw === undefined) {
      console.debug(`[JHA-SCRAPER] ${fieldName}: tier "${t.label}" (${t.tier}) — not found`)
      continue
    }

    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value === '') {
      console.warn(`[JHA-SCRAPER] ${fieldName}: tier "${t.label}" (${t.tier}) matched an element but its text was EMPTY — trying next tier`)
      continue
    }

    const confidence = t.tier === 'last-resort' ? 'degraded' : 'ok'
    if (t.tier === 'last-resort') {
      console.warn(`[JHA-SCRAPER] ${fieldName}: DEGRADED — only the last-resort tier "${t.label}" matched:`, value)
    } else {
      console.log(`[JHA-SCRAPER] ${fieldName}: found via "${t.label}" [${t.tier}]:`, value)
    }
    return { value, confidence, tier: t.label }
  }

  console.error(`[JHA-SCRAPER] ${fieldName}: FAILED — every selector in the fallback chain came back empty or missing. LinkedIn's markup may have changed.`)
  return { value: null, confidence: 'failed', tier: null }
}

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

  if (event.data && event.data.type === 'JHA_SET_ACTIVE_JOB') {
    chrome.storage.local.set(
      { jha_active_job_id: event.data.jobId, jha_active_job_ts: Date.now() },
      function () {
        console.log('[JHA] Active job_id stored:', event.data.jobId)
      }
    )
  }
})


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

function cleanCompanyLinkedInHref(href) {
  if (!href || !href.includes('linkedin.com/company/')) return null
  const match = href.match(/(https:\/\/www\.linkedin\.com\/company\/[^/?]+)/)
  return match ? match[1] : null
}

function extractCompanyLinkedInUrl() {
  try {
    // No text fallback here on purpose: guessing a company URL from page text risks fabricating
    // a wrong link (worse than returning null), so this chain is selectors only.
    const result = jhaExtract('company_linkedin_url', [
      { tier: 'stable', label: 'a[href*="linkedin.com/company/"]', run: () => cleanCompanyLinkedInHref(document.querySelector('a[href*="linkedin.com/company/"]')?.href) },
      { tier: 'known', label: '.job-details-jobs-unified-top-card__company-name a', run: () => cleanCompanyLinkedInHref(document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.href) },
      { tier: 'known', label: '.jobs-unified-top-card__company-name a', run: () => cleanCompanyLinkedInHref(document.querySelector('.jobs-unified-top-card__company-name a')?.href) },
      { tier: 'known', label: '.topcard__org-name-link', run: () => cleanCompanyLinkedInHref(document.querySelector('.topcard__org-name-link')?.href) },
    ])

    return result.value
  } catch (e) {
    console.error('[JHA-SCRAPER] extractCompanyLinkedInUrl: unexpected error:', e)
    return null
  }
}

function extractJobData() {
  try {
    console.log('[JHA-SCRAPER] Starting data extraction...')

    // ── Company name ─────────────────────────────────────────────────────────
    // Priority 1 (stable): data-test-* attribute and href-pattern anchors.
    // Priority 2 (known): current hard-coded LinkedIn class names — may break on any redesign.
    // Priority 3 (last-resort): og:title / page <title> text parsing — degraded confidence.
    const companyResult = jhaExtract('company_name', [
      { tier: 'stable', label: '[data-test-id="job-details-company-name"]', run: () => document.querySelector('[data-test-id="job-details-company-name"]')?.textContent },
      { tier: 'stable', label: 'a[data-tracking-control-name="public_jobs_topcard-org-name"]', run: () => document.querySelector('a[data-tracking-control-name="public_jobs_topcard-org-name"]')?.textContent },
      { tier: 'stable', label: 'a[href*="/company/"]', run: () => document.querySelector('a[href*="/company/"]')?.textContent },
      { tier: 'known', label: '.job-details-jobs-unified-top-card__company-name a', run: () => document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent },
      { tier: 'known', label: '.job-details-jobs-unified-top-card__company-name', run: () => document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent },
      { tier: 'known', label: '.jobs-unified-top-card__company-name a', run: () => document.querySelector('.jobs-unified-top-card__company-name a')?.textContent },
      { tier: 'known', label: '.jobs-unified-top-card__company-name', run: () => document.querySelector('.jobs-unified-top-card__company-name')?.textContent },
      { tier: 'known', label: '.topcard__org-name-link', run: () => document.querySelector('.topcard__org-name-link')?.textContent },
      { tier: 'known', label: '.topcard__flavor a', run: () => document.querySelector('.topcard__flavor a')?.textContent },
      { tier: 'known', label: '.jobs-details-top-card__company-url', run: () => document.querySelector('.jobs-details-top-card__company-url')?.textContent },
      {
        tier: 'last-resort',
        label: 'og:title meta ("Title at Company")',
        run: () => {
          const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
          return ogTitle && ogTitle.includes(' at ') ? ogTitle.split(' at ').pop() : null
        },
      },
      {
        tier: 'last-resort',
        label: 'document.title ("Title at Company | LinkedIn")',
        run: () => (document.title.includes(' at ') ? document.title.split(' at ')[1]?.split('|')[0] : null),
      },
    ])
    const companyName = companyResult.value || ''

    // Company domain is derived from whichever selector matched an <a href="…/company/…">
    // above — best-effort supplementary field, not part of extraction_confidence.
    const companyLinkEl = document.querySelector(
      '[data-test-id="job-details-company-name"] a, a[data-tracking-control-name="public_jobs_topcard-org-name"], a[href*="/company/"]'
    )
    let companyDomain = ''
    if (companyLinkEl?.href) {
      const match = companyLinkEl.href.match(/linkedin\.com\/company\/([^/?]+)/)
      if (match) companyDomain = match[1] + '.com'
    }
    console.log('[JHA-SCRAPER] company_domain (derived, best-effort):', companyDomain || null)

    // ── Job title ─────────────────────────────────────────────────────────────
    const titleResult = jhaExtract('job_title', [
      { tier: 'stable', label: '[data-test-id="job-details-job-title"]', run: () => document.querySelector('[data-test-id="job-details-job-title"]')?.textContent },
      { tier: 'known', label: '.job-details-jobs-unified-top-card__job-title h1', run: () => document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.textContent },
      { tier: 'known', label: '.job-details-jobs-unified-top-card__job-title', run: () => document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent },
      { tier: 'known', label: '.jobs-unified-top-card__job-title h1', run: () => document.querySelector('.jobs-unified-top-card__job-title h1')?.textContent },
      { tier: 'known', label: '.jobs-unified-top-card__job-title', run: () => document.querySelector('.jobs-unified-top-card__job-title')?.textContent },
      { tier: 'known', label: '.topcard__title', run: () => document.querySelector('.topcard__title')?.textContent },
      { tier: 'known', label: 'h1.t-24', run: () => document.querySelector('h1.t-24')?.textContent },
      {
        tier: 'last-resort',
        label: 'div[data-display-contents] > p (not inside <a>)',
        run: () => {
          for (const p of document.querySelectorAll('div[data-display-contents] > p')) {
            if (!p.closest('a')) return p.textContent
          }
          return null
        },
      },
      { tier: 'last-resort', label: 'first <h1> on page', run: () => document.querySelector('h1')?.textContent },
    ])
    const jobTitle = titleResult.value || ''

    // Job URL — not selector-based, no fallback chain needed.
    const jobUrl = window.location.href.split('?')[0]
    console.log('[JHA-SCRAPER] job_url:', jobUrl)

    // ── Location ──────────────────────────────────────────────────────────────
    // No known stable LinkedIn attribute for this field today. The current hashed class
    // (span.ad41daa7) is demoted from "primary strategy" (it should never have held that
    // position) to a 'known' tier, tried before brand-new structural guesses that are
    // NOT verified against a live LinkedIn page this session — flagged loudly if they fire.
    const locationResult = jhaExtract('location', [
      { tier: 'known', label: 'span.ad41daa7 (hashed class, currently observed)', run: () => document.querySelector('span.ad41daa7')?.textContent },
      {
        tier: 'last-resort',
        label: 'text node near a location-labeled icon (UNVERIFIED)',
        run: () => document.querySelector('[aria-label*="ocation" i] + span, svg[aria-label*="ocation" i] ~ span')?.textContent,
      },
      {
        tier: 'last-resort',
        label: '.job-details-jobs-unified-top-card__primary-description-container (UNVERIFIED)',
        run: () => document.querySelector('.job-details-jobs-unified-top-card__primary-description-container')?.textContent,
      },
    ])
    const location = locationResult.value || ''

    // ── Salary ────────────────────────────────────────────────────────────────
    // Regex scan of body text rather than a selector — inherently resistant to class renames,
    // but not to LinkedIn changing the wording. No further tiers invented here; there's nothing
    // more structural to try without guessing.
    let salary = null
    const salaryMatch = document.body.innerText.match(/Salary\s+(£|\$)[\d,k\-\s]+/i)
    if (salaryMatch) {
      salary = salaryMatch[0].trim()
      console.log('[JHA-SCRAPER] salary: found via body-text regex scan [known]:', salary)
    } else {
      console.warn('[JHA-SCRAPER] salary: FAILED — regex scan found no match. LinkedIn wording may have changed, or this job has no listed salary (expected/common).')
    }

    // ── Job description ──────────────────────────────────────────────────────
    // The existing data-testid selector is already a good, stable signal (priority-1 per the
    // resilience playbook) — kept as 'stable'. One last-resort tier added, unverified.
    const descriptionResult = jhaExtract('job_description', [
      { tier: 'stable', label: 'span[data-testid="expandable-text-box"]', run: () => document.querySelector('span[data-testid="expandable-text-box"]')?.textContent },
      {
        tier: 'last-resort',
        label: 'largest text block under jobs-details container (UNVERIFIED)',
        run: () => {
          const candidates = [...document.querySelectorAll('.jobs-details *')]
            .filter(el => el.children.length === 0 && (el.textContent?.length || 0) > 200)
          if (candidates.length === 0) return null
          return candidates.reduce((a, b) => (a.textContent.length > b.textContent.length ? a : b)).textContent
        },
      },
    ])
    const jobDescription = descriptionResult.value || ''

    // ── Job-level extraction confidence ──────────────────────────────────────
    // Computed from the two CRITICAL fields only (company name, job title), per the
    // resilience-layer spec. Location/salary/description/poster failures are common and
    // expected (e.g. many listings have no salary) and would make "degraded" too noisy to be
    // a useful signal if they counted — poster is explicitly a Tier 2 signal already.
    let extractionConfidence = 'ok'
    if (companyResult.confidence === 'failed' || titleResult.confidence === 'failed') {
      extractionConfidence = 'failed'
    } else if (companyResult.confidence === 'degraded' || titleResult.confidence === 'degraded') {
      extractionConfidence = 'degraded'
    }

    // Fragility summary — which fields fell back furthest this capture. Cheap to compute,
    // read this first the next time LinkedIn changes something.
    console.log('[JHA-SCRAPER] === Extraction summary ===', {
      company_name: { tier: companyResult.tier, confidence: companyResult.confidence },
      job_title: { tier: titleResult.tier, confidence: titleResult.confidence },
      location: { tier: locationResult.tier, confidence: locationResult.confidence },
      job_description: { tier: descriptionResult.tier, confidence: descriptionResult.confidence },
      overall: extractionConfidence,
    })

    if (extractionConfidence !== 'ok') {
      console.warn(`[JHA-SCRAPER] ⚠️ CAPTURE CONFIDENCE: ${extractionConfidence.toUpperCase()} — one or more critical fields did not come from a known-good selector. Check the summary above.`)
    }

    // Validate required fields
    if (!companyName || !jobTitle || !jobUrl) {
      console.error('[JHA-SCRAPER] Missing required fields:', { companyName, jobTitle, jobUrl })
      throw new Error('Missing required job data. Company: ' + !!companyName + ', Title: ' + !!jobTitle)
    }

    // Poster data — fault-tolerant, never throws. Tier 2 signal: never affects extraction_confidence.
    let posterData = { poster_name: null, poster_title: null, poster_linkedin_url: null }
    try {
      posterData = extractPosterData()
      console.log('[JHA-SCRAPER] poster data:', posterData)
    } catch {
      console.warn('[JHA-SCRAPER] Poster extraction failed (non-fatal, Tier 2 signal)')
    }

    const result = {
      company_name: companyName,
      company_domain: companyDomain || null,
      company_linkedin_url: extractCompanyLinkedInUrl(),
      job_title: jobTitle,
      job_url: jobUrl,
      location: location || null,
      salary,
      job_description: jobDescription || null,
      status: 'captured',
      poster_name: posterData.poster_name,
      poster_title: posterData.poster_title,
      poster_linkedin_url: posterData.poster_linkedin_url,
      extraction_confidence: extractionConfidence,
    }

    console.log('[JHA-SCRAPER] Successfully extracted data:', result)
    return result

  } catch (error) {
    console.error('[JHA-SCRAPER] Error extracting job data:', error)
    throw error
  }
}

function waitForPeoplePageLoad(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now()

    function check() {
      const cards = document.querySelectorAll('a[href*="linkedin.com/in/"]')
      if (cards.length > 0) {
        console.log('[JHA] People page loaded, found', cards.length, 'profiles')
        resolve(true)
        return
      }
      if (Date.now() - start > timeoutMs) {
        console.log('[JHA] People page timeout — injecting anyway')
        resolve(false)
        return
      }
      setTimeout(check, 500)
    }
    check()
  })
}

function isPeopleSearchPage() {
  return location.href.includes('/search/results/people/')
}

function waitForResults(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now()
    function check() {
      const results = document.querySelectorAll('a[href*="/in/"]')
      if (results.length > 0) return resolve(true)
      if (Date.now() - start > timeoutMs) return resolve(false)
      setTimeout(check, 400)
    }
    check()
  })
}

function injectExtractButton() {
  if (document.getElementById('jha-extract-btn')) return

  const btn = document.createElement('div')
  btn.id = 'jha-extract-btn'
  btn.innerHTML = `
    <button id="jha-extract-inner" style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      🎯 Extract HR Contacts
    </button>
  `
  document.body.appendChild(btn)
  document.getElementById('jha-extract-inner').addEventListener('click', handleExtractClick)
  console.log('[JHA] Extract HR Contacts button injected')
}

async function scrapeCompanyDomain() {
  try {
    const slug = location.pathname.split('/company/')[1]?.split('/')[0]
    if (!slug) return null

    const res = await fetch(`https://www.linkedin.com/company/${slug}/about/`)
    if (!res.ok) {
      console.log('[JHA] About page fetch failed:', res.status)
      return null
    }

    const html = await res.text()

    const allDomains = (html.match(/https?:\/\/(?:www\.)?([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi) || [])
      .map(d => d.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''))
      .filter(d =>
        !d.includes('linkedin') &&
        !d.includes('licdn') &&
        !d.includes('w3.org') &&
        !d.includes('schema.org')
      )

    const uniqueDomains = [...new Set(allDomains)]
    if (uniqueDomains.length === 0) return null

    const slugBase = slug
      .replace(/-(online|ltd|inc|corp|uk|group|limited|llc)$/gi, '')
      .replace(/-/g, '')
      .toLowerCase()

    const scored = uniqueDomains.map(d => {
      const domainName = d.split('.')[0].replace(/-/g, '').toLowerCase()
      let score = 0
      if (domainName === slugBase) score = 100
      else if (domainName.includes(slugBase)) score = 80
      else if (slugBase.includes(domainName)) score = 60
      score -= Math.abs(domainName.length - slugBase.length)
      return { domain: d, score }
    })

    scored.sort((a, b) => b.score - a.score)

    const best = scored[0]
    if (best && best.score >= 40) {
      console.log('[JHA] Verified company domain:', best.domain)
      return best.domain
    }

    console.log('[JHA] No confident domain match. Candidates:', uniqueDomains)
    return null
  } catch (err) {
    console.error('[JHA] scrapeCompanyDomain error:', err)
    return null
  }
}

/**
 * Scraper for the old company /people/ page. LinkedIn has since removed
 * individual profiles from that page (it now shows aggregate stat cards
 * only), so this reliably finds nothing there anymore — kept as a harmless
 * fallback in case that ever changes, but scrapeSearchResultsProfiles() is
 * the live path (see PROBLEM in the HR-extraction-on-search-page feature).
 */
function scrapeCompanyPeopleProfiles() {
  const allProfileLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]')
  const seen = new Set()
  const profiles = []

  for (const link of allProfileLinks) {
    const href = link.href?.split('?')[0]
    if (!href) continue

    // Skip URN-based links
    if (href.includes('ACoAA') || href.includes('urn%3A')) continue

    if (seen.has(href)) continue
    seen.add(href)

    // Try text content first, fall back to img alt for image links
    let name = link.textContent?.trim() || null
    if (!name || name.length < 2) {
      name = link.querySelector('img')?.alt?.trim() || null
    }

    if (!name || name.length < 2 || name.length > 80) {
      console.log('[JHA] Skipping — no name found:', href)
      continue
    }

    // Strip LinkedIn activity suffixes
    const activitySuffixes = [
      ' follows this page', ' is hiring', ' shared a post',
      ' commented on', ' likes this', ' posted', ' reacted to',
      ' follows you', ' is open to work',
    ]
    for (const suffix of activitySuffixes) {
      const idx = name.toLowerCase().indexOf(suffix.toLowerCase())
      if (idx > 0) {
        name = name.substring(0, idx).trim()
        break
      }
    }

    // Skip names still containing activity words
    const invalidWords = ['follows', 'hiring', 'shared', 'commented', 'posted', 'reacted', 'likes this', 'open to work']
    if (invalidWords.some(w => name.toLowerCase().includes(w))) {
      console.log('[JHA] Skipping invalid name:', name)
      continue
    }

    console.log('[JHA] Found:', name, '→', href)

    // Walk up to card for title
    const card = link.closest('li')
      || link.closest('[class*="org-people-profile-card"]')
      || link.closest('[class*="artdeco-entity-lockup"]')
      || link.parentElement?.parentElement

    let title = null
    if (card) {
      const lines = (card.innerText || '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('degree connection')) continue
        if (line.startsWith('·')) continue
        if (line === '1st' || line === '2nd' || line === '3rd') continue
        if (['Connect', 'Message', 'Follow', 'Pending'].includes(line)) continue
        if (line.startsWith('Provides services')) continue
        if (line.includes('followers') || line.includes('connections')) continue
        title = line
        break
      }
    }

    console.log('[JHA] Profile:', name, '|', title, '|', href)

    const hrKeywords = [
      'recruit', 'talent', 'hr ', 'human resource',
      'hiring', 'people ops', 'people partner', 'people & culture',
      'head of people', 'acquisition', 'people director', 'resourcing',
    ]
    const isRelevant = !title || hrKeywords.some(kw =>
      title.toLowerCase().includes(kw)
    )

    if (isRelevant) {
      profiles.push({ name, title: title || 'Unknown', linkedin_url: href })
      console.log('[JHA] ✅ Added:', name, '—', title)
    } else {
      console.log('[JHA] ❌ Skipped (not HR):', name, '—', title)
    }
  }

  return profiles
}

/**
 * Scraper for the people SEARCH results page — the working replacement for
 * the now-dead company /people/ page.
 *
 * Verified LinkedIn structure: each RESULT is an <a href="…/in/USERNAME/">
 * that carries a `componentkey` attribute and wraps the entire card (name
 * div, title <p>, location <p>). That combination — /in/ href + componentkey
 * — is a stable hook for "this is a result card", unlike matching on
 * hashed/random class names. Anchoring on it also sidesteps the earlier
 * messy-duplicate-link problem entirely, since only the card wrapper anchor
 * (not the inner name-only link) carries componentkey.
 *
 * Mutual-connection mentions (e.g. "You and Amit are mutual connections")
 * also render as /in/ links, but live inside a <p> containing "mutual" —
 * skipped so they're never scraped as if they were search results.
 */
function scrapeSearchResultsProfiles() {
  const seen = new Set()
  const profiles = []

  const resultAnchors = document.querySelectorAll('a[href*="/in/"][componentkey]')

  for (const anchor of resultAnchors) {
    const href = anchor.href.split('?')[0].replace(/\/$/, '')

    // must be a clean profile url: /in/username with no sub-path
    const afterIn = href.split('/in/')[1]
    if (!afterIn || afterIn.includes('/')) continue
    if (href.includes('ACoAA')) continue // skip URN-based
    if (seen.has(href)) continue

    // This anchor must be a RESULT wrapper, not a mutual-connection mention.
    const inMutualP = anchor.closest('p')?.textContent?.toLowerCase().includes('mutual')
    if (inMutualP) continue

    // A real result card has name + title + location lines. A bare mention
    // (e.g. just the name, no headline structure) isn't a result.
    const cardText = (anchor.innerText || '').split('\n').map(s => s.trim()).filter(Boolean)
    if (cardText.length < 2) continue

    // NAME: first line, stripped of degree/badge noise
    const name = cardText[0].replace(/•.*$/, '').trim()
    if (!name || name.length < 2 || name.length > 80) continue

    // TITLE: prefer a line with an HR keyword; else the first substantial
    // non-noise, non-location line right after the name.
    const hrKeywords = [
      'recruit', 'talent', 'hr', 'human resource', 'hiring',
      'people', 'acquisition', 'sourcer', 'staffing',
    ]
    let title = 'Unknown'
    for (let i = 1; i < cardText.length; i++) {
      const line = cardText[i]
      const low = line.toLowerCase()
      if (low.includes('mutual connection')) continue
      if (low.includes('follower')) continue
      if (low.includes('connect') || low === 'follow' || low === 'message') continue
      if (/•\s*(1st|2nd|3rd)/.test(low) || /^(1st|2nd|3rd)/.test(low)) continue
      if (hrKeywords.some(k => low.includes(k))) { title = line; break }
      if (title === 'Unknown' && line.length > 5 && line.length < 200 && !line.includes(',')) {
        title = line
      }
    }

    // LOCATION (optional, for display only — not required by the backend)
    let location = null
    for (const line of cardText) {
      if (/India|Area|,\s*[A-Z]/.test(line) && line.length < 60 && !line.toLowerCase().includes('mutual')) {
        location = line
        break
      }
    }

    seen.add(href)
    console.log('[JHA] Profile:', name, '|', title, '|', location, '|', href)
    profiles.push({ name, title, linkedin_url: href, location })
  }

  return profiles
}

async function handleExtractClick() {
  const btn = document.getElementById('jha-extract-inner')
  btn.textContent = '⏳ Extracting...'
  btn.disabled = true

  try {
    console.log('[JHA] Starting HR contact extraction...')

    const profiles = isPeopleSearchPage()
      ? scrapeSearchResultsProfiles()
      : scrapeCompanyPeopleProfiles()

    console.log('[JHA] Total HR profiles:', profiles.length)
    console.log('[JHA] Profiles:', JSON.stringify(profiles, null, 2))

    if (profiles.length === 0) {
      btn.textContent = '⚠️ No HR contacts found — try scrolling first'
      btn.style.background = '#f59e0b'
      btn.disabled = false
      return
    }

    // STEP 6: Send to backend
    // Storage is the primary source — LinkedIn rewrites the URL to its
    // canonical form on load and strips jha_job_id, so the URL param only
    // survives as a harmless fallback for the rare case storage is empty.
    const storedJob = await chrome.storage.local.get(['jha_active_job_id', 'jha_active_job_ts'])
    const storedJobId = storedJob.jha_active_job_id
    const storedTs = storedJob.jha_active_job_ts || 0

    // A stored job_id from an abandoned session (opened Find Contacts, never
    // extracted) must never silently attach contacts to the wrong job later —
    // so anything older than 30 minutes is treated as expired, not reused.
    const THIRTY_MIN = 30 * 60 * 1000
    if (storedJobId && Date.now() - storedTs > THIRTY_MIN) {
      chrome.storage.local.remove(['jha_active_job_id', 'jha_active_job_ts'])
      btn.textContent = '❌ Session expired — click "Find Contacts" in JHA again'
      btn.style.background = '#dc2626'
      btn.disabled = false
      return
    }

    const urlParams = new URLSearchParams(window.location.search)
    const jobId = storedJobId || urlParams.get('jha_job_id')

    if (!jobId) {
      btn.textContent = '❌ No job linked — click "Find Contacts" in JHA first'
      btn.style.background = '#dc2626'
      btn.disabled = false
      return
    }

    const API_URL = await getApiUrl()
    const storage = await chrome.storage.sync.get(['extensionToken'])
    const token = storage.extensionToken

    if (!token) {
      btn.textContent = '⚠️ Not connected'
      btn.style.background = '#f59e0b'
      btn.disabled = false
      return
    }

    console.log('[JHA] Scraping verified company domain...')
    const verifiedDomain = await scrapeCompanyDomain()
    console.log('[JHA] Domain to send:', verifiedDomain)

    const response = await fetch(
      `${API_URL}/api/jobs/${jobId}/contacts/from-linkedin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ profiles, verified_domain: verifiedDomain }),
      }
    )

    const data = await response.json()

    if (data.success) {
      btn.textContent = `✅ Found ${data.data.contacts_saved} contacts!`
      btn.style.background = '#16a34a'
      chrome.storage.local.remove(['jha_active_job_id', 'jha_active_job_ts'])
    } else {
      btn.textContent = '❌ Error saving contacts'
      btn.style.background = '#dc2626'
      btn.disabled = false
    }

  } catch (error) {
    console.error('[JHA] Extract error:', error)
    btn.textContent = '❌ Error — try again'
    btn.style.background = '#dc2626'
    btn.disabled = false
  }
}

// Initialize + SPA navigation detection.
//
// LinkedIn's search-results page in particular re-renders aggressively on
// scroll/filter/navigation. An observer scoped to document/document.body
// with subtree:true fires on every single DOM mutation across the whole
// page — on a page that churns like this, that's thousands of callback
// invocations per scroll, which has frozen the browser in real usage.
// Never widen this scope back to document/document.body — watch a tiny,
// stable element instead (here, <title>, which LinkedIn updates on every
// SPA route change) and debounce the callback so it only reacts once the
// DOM has settled, not on every intermediate mutation.
function detectPageAndInject() {
  const url = location.href
  if (url.includes('linkedin.com/jobs/view/')) {
    console.log('[JHA] Job page detected')
    setTimeout(injectCaptureButton, 2000)
  } else if (url.includes('linkedin.com/company/') && url.includes('/people/')) {
    console.log('[JHA] LinkedIn company people page detected')
    waitForPeoplePageLoad().then(() => injectExtractButton())
  } else if (isPeopleSearchPage()) {
    console.log('[JHA] LinkedIn people search page detected')
    waitForResults().then(() => injectExtractButton())
  }
}

detectPageAndInject() // initial load

let navDebounce = null
function onPossibleNavChange() {
  clearTimeout(navDebounce)
  navDebounce = setTimeout(detectPageAndInject, 500)
}

const titleEl = document.querySelector('title')
if (titleEl) {
  new MutationObserver(onPossibleNavChange).observe(titleEl, { childList: true })
} else {
  console.warn('[JHA] No <title> element found — SPA nav detection disabled on this page')
}
