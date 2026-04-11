const crypto = require('crypto')

console.log('Generating encryption key...\n')

const key = crypto.randomBytes(32).toString('hex')

console.log('Add this to your .env.local file:\n')
console.log(`ENCRYPTION_KEY=${key}\n`)
console.log('Key generated successfully!')
console.log('Keep this secret! Never commit to Git!')
