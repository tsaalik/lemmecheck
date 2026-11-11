# Beantown Hub

A scoreboard for Boston's four major pro teams — Red Sox (MLB), Patriots (NFL),
Celtics (NBA), and Bruins (NHL). The home screen is just four team launchers; tapping
one opens that team's recent results, next game, and (when available) a real highlight
video for each finished game.

## Project structure

```
beantown-hub/
├── index.html       # page structure
├── css/
│   └── style.css    # all styling
├── js/
│   └── app.js        # frontend logic — talks to the local API server below
├── server.js         # tiny local backend — fetches real data, keeps the YouTube key secret
├── package.json      # scripts + dependencies
├── .env.example      # copy to .env and add your own YouTube API key
└── README.md
```

No frameworks, no build step — just HTML, CSS, and JavaScript on the frontend, plus one
small plain-Node backend file.

## Why there's a backend at all

The schedule and scores come from ESPN's public scoreboard API, which needs no API key,
so the frontend could call it directly. But matching highlight videos uses the YouTube
Data API, which does need a key — and a key embedded directly in frontend JavaScript is
visible to anyone who views the page source or your public GitHub repo. `server.js` is a
small Node script that holds that key (read from a local `.env` file that's never
committed to git) and the frontend calls it instead of YouTube directly.

## Running it locally

You run two things at once, in two separate terminal windows/tabs.

### 1. Install dependencies (one-time setup)

```
npm install
```

This downloads [`live-server`](https://www.npmjs.com/package/live-server), the only
third-party package this project uses, into `node_modules/`. (Requires
[Node.js](https://nodejs.org/), which includes `npm`.)

### 2. Set up a YouTube API key (optional, but needed for real highlight videos)

Without this step, the app still works — it'll just show "No highlight video found"
instead of real clips.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/), create a project
   (any name), and select it.
2. Search for **YouTube Data API v3** and click **Enable**.
3. Go to **APIs & Services → Credentials → Create Credentials → API key**.
4. Click **Edit API key**, and under **API restrictions** choose **Restrict key** →
   check only **YouTube Data API v3** → **Save**.
5. Copy the key, then copy `.env.example` to a new file named `.env` in this folder, and
   paste your key in:
   ```
   YOUTUBE_API_KEY=your-real-key-here
   ```
   `.env` is already in `.gitignore`, so it never gets committed.

No billing/credit card is required — the free quota (10,000 units/day) is far more than
this app needs.

### 3. Start both servers

**Terminal 1** — the frontend, with live-reload:
```
npm run dev
```
Opens `http://localhost:8080` in your browser automatically.

**Terminal 2** — the local API backend:
```
npm run api
```
Runs on `http://localhost:3001`. Leave this running the whole time you're using the app —
if it's not running, the app will tell you so (rather than silently breaking) when it
tries to load a team's schedule or highlights.

### 4. Make changes

Edit `index.html`, `css/style.css`, or `js/app.js` and save — the browser tab reloads
automatically. Changes to `server.js` require stopping and restarting `npm run api`
(`Ctrl+C`, then run it again) since it's a plain Node process, not a live-reloading one.

## Where the data comes from

- **Schedule and scores:** ESPN's public (but unofficial/undocumented) scoreboard API.
  It could change or go away without notice, but it's free and needs no signup.
- **Highlight videos:** a YouTube search for `"<team> vs <opponent> Highlights"`, matched
  to the specific game by requiring the team name, opponent name, *and* game date to all
  appear in a candidate video's title — a loose match (just team names, no date) was
  tested and found unreliable, since the same two teams often play each other multiple
  times a season with near-identical video titles. If no confident match is found, the
  app says so rather than guessing.
