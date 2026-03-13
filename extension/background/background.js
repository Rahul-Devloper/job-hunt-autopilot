console.log('Job Hunt Autopilot: Background service worker loaded')

chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Hunt Autopilot: Extension installed')
  chrome.storage.sync.set({ apiUrl: 'http://localhost:3000' })
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'JOB_CAPTURED') {
    console.log('Job captured:', request.data)
    sendResponse({ success: true })
  }
  return true
})
