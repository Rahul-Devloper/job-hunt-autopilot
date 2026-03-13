// Extract job data from LinkedIn job page
function extractJobData() {
  try {
    // Company name
    const companyElement = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name'
    )
    const companyName = companyElement?.innerText?.trim() || ''

    // Extract slug from LinkedIn company URL
    let companyDomain = ''
    const companyLink = document.querySelector(
      '.job-details-jobs-unified-top-card__company-name a'
    )
    if (companyLink) {
      const match = companyLink.href.match(/linkedin\.com\/company\/([^\/]+)/)
      if (match) {
        companyDomain = match[1] + '.com' // rough approximation
      }
    }

    // Job title
    const titleElement = document.querySelector(
      '.job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__job-title a'
    )
    const jobTitle = titleElement?.innerText?.trim() || ''

    // Job URL (strip query params)
    const jobUrl = window.location.href.split('?')[0]

    // Location
    const locationElement = document.querySelector(
      '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet'
    )
    const location = locationElement?.innerText?.trim() || ''

    // Salary (optional)
    const salaryElement = document.querySelector(
      '.job-details-jobs-unified-top-card__job-insight span'
    )
    const salary = salaryElement?.innerText?.trim() || null

    // Job description
    const descriptionElement = document.querySelector(
      '.jobs-description-content__text, .jobs-description__content'
    )
    const jobDescription = descriptionElement?.innerText?.trim() || ''

    if (!companyName || !jobTitle || !jobUrl) {
      throw new Error('Missing required job data')
    }

    return {
      company_name: companyName,
      company_domain: companyDomain || null,
      job_title: jobTitle,
      job_url: jobUrl,
      location: location || null,
      salary: salary,
      job_description: jobDescription || null,
      status: 'captured',
    }
  } catch (error) {
    console.error('Error extracting job data:', error)
    throw error
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractJobData }
}
