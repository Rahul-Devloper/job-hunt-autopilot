# Job Hunt Autopilot

Open-source job hunting automation tool that reduces application time from 20 minutes to 2 minutes.

## Features

- One-click job capture from LinkedIn/Indeed (Chrome extension)
- Free HR email finding (community database + pattern guessing)
- Automated cold emails via Gmail with tracking
- Auto-scheduled follow-up reminders
- Analytics dashboard (open rates, reply rates, conversion funnel)
- Community-powered email database

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API routes
- **Database:** Supabase (PostgreSQL + Auth)
- **Auth:** Supabase Auth (Google OAuth)
- **Extension:** Chrome Extension (Manifest V3)
- **Email:** Gmail API
- **Hosting:** Vercel + Supabase

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Copy your project URL and anon key
4. Create `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials in `.env.local`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Chrome Extension Setup

1. Go to `chrome://extensions` → Enable **Developer mode**
2. Click **Load unpacked** → select the `extension/` folder
3. Log in at `http://localhost:3000`
4. Go to `/extension` page → click **Generate New Token**
5. Token is automatically saved to the extension via `window.postMessage`
6. Go to any LinkedIn job page → click **Capture Job**

#### Extension Dev Mode (point extension to localhost instead of Vercel)

Open the extension's service worker console (`chrome://extensions` → **Service worker**) and run:

```js
// Use localhost:3000 (local dev)
chrome.storage.local.set({ devMode: true })

// Use Vercel (production)
chrome.storage.local.set({ devMode: false })
```

After setting devMode, reload the LinkedIn page. Extension API calls will now hit your local server and logs will appear in your terminal.

> **Note:** Do not use ngrok to access the web app — after sign-in, Supabase redirects to the configured Site URL (Vercel). Use `localhost:3000` directly in your browser for the web app.

#### Debugging API Routes

In VS Code: **Run & Debug** (`Ctrl+Shift+D`) → select **"Next.js: debug server-side"** → press **F5**.

Set breakpoints in any `app/api/**` route. Hit the endpoint once to compile the route (breakpoint turns solid red), then the second request will pause at the breakpoint.

## Project Status

- [x] Session 1: Project Foundation (COMPLETE)
- [ ] Session 2: Database Schema (NEXT)
- [ ] Session 3: Chrome Extension
- [ ] Session 4: Dashboard UI
- [ ] Session 5: Email Finding Logic
- [ ] Session 6: Email Sending
- [ ] Session 7: Analytics
- [ ] Session 8: Community Features

## License

MIT
