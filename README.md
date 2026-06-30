# ChefTag

**ChefTag** is a lightweight private chef booking website for matching guests with chefs by location, event style, cuisine, guest count, and rate.

Built with vanilla HTML/CSS/JS + **Supabase** for auth, database, and realtime chat.

## Quick Start

Open `index.html` in a browser — the app works with hardcoded fallback chefs out of the box.

To enable the full backend (auth, chat, admin), follow the [Supabase Setup](#supabase-setup) below.

---

## Project Structure

```
cheftag/
├── index.html              # Main page — chef discovery, filters, booking inquiry
├── styles.css              # Responsive layout and visual design
├── app.js                  # Chef matching, filters, sorting, booking shortlist
│
├── auth.html               # Sign up / Sign in page
├── auth.js                 # Authentication logic (email + Google OAuth)
├── auth-check.js           # Auth state checker — included on every page
├── supabase-client.js      # Supabase client setup + full SQL schema docs
│
├── chat.html               # Client chat page
├── chat.js                 # Real-time chat client logic
│
├── chef-inbox.html         # Chef inbox page
├── chef-inbox.js           # Chef inbox logic (login, conversations, replies)
│
├── chef-signup.html        # Chef application form
├── chef-signup.js          # Chef sign-up form logic (photo upload, submission)
│
├── admin-chefs.html        # Admin dashboard
├── admin-chefs.js          # Admin logic (auth gate, approve/reject chefs, reviews)
│
├── auth-setup.sql          # SQL schema — profiles table + auth trigger
├── chat-setup.sql          # SQL schema — conversations + messages + RLS
│
├── assets/
│   ├── cheftag-logo.svg    # Brand logo (SVG)
│   ├── favicon.svg         # Favicon (SVG)
│   └── booking-hero.svg    # OG share image placeholder
│
└── README.md               # This file
```

## Features

| Feature | Description |
|---------|-------------|
| **Chef Discovery** | Search/filter by location, cuisine, event type, guest count, rate |
| **Chef Sorting** | Sort by best match, lowest rate, or top rated |
| **Booking Inquiry** | Shortlist chefs and send an inquiry |
| **Real-time Chat** | Client ↔ Chef messaging via Supabase Realtime |
| **Auth System** | Email/password + Google OAuth (Supabase Auth) |
| **Chef Sign-up** | Online application with photo upload |
| **Admin Dashboard** | Stats, approve/reject chefs, manage reviews |
| **Responsive Design** | Mobile-first, works on all screen sizes |

## Supabase Setup

### 1. Create a Supabase project
- Go to [supabase.com](https://supabase.com) and create a free account
- Create a new project (e.g. "cheftag")

### 2. Run the SQL schemas
In Supabase SQL Editor, run these files **in order**:
1. `auth-setup.sql` — creates the `profiles` table + trigger
2. `chat-setup.sql` — creates `conversations` + `messages` tables + RLS
3. Schema from `supabase-client.js` — creates `chefs`, `reviews`, `booking_inquiries` tables

### 3. Configure credentials
Edit `supabase-client.js` and replace:
```js
var SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
var SUPABASE_ANON_KEY = "your-anon-key-here";
```
Get these from **Supabase Dashboard → Project Settings → API**

### 4. Enable Google Auth (optional)
In Supabase Dashboard → Authentication → Providers → Google
Add your Google OAuth credentials

### 5. Enable Realtime for chat
In Supabase Dashboard → Database → Replication
Ensure `conversations` and `messages` tables are in the `supabase_realtime` publication

### 6. Admin access
Go to `admin-chefs.html` and enter your Supabase **Service Role Key**
(Found in Project Settings → API → service_role key)

## Deployment

The site is designed for **GitHub Pages** or any static hosting:

```bash
# Deploy to GitHub Pages
git add .
git commit -m "Deploy ChefTag"
git push origin main
```

Then enable GitHub Pages in your repo settings from the `main` branch.

## Tech Stack

- **Frontend:** Vanilla HTML + CSS3 + JavaScript (ES5-compatible)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Storage:** Supabase Storage (chef profile photos)
- **Hosting:** GitHub Pages (or any static host)

## Notes

- The app works **without Supabase** using 5 hardcoded fallback chefs
- All external chef images are loaded from CDN URLs
- Supabase anon key is safe to embed in client-side code (RLS protects the data)
- The `service_role` key must **never** be hardcoded in the frontend
