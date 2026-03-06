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
