// Tiny local backend for Beantown Hub.
//
// It does three things, all so the frontend never needs a secret key:
//   GET /api/schedule?code=MLB         real schedule/scores from ESPN (no key needed)
//   GET /api/recap?code=MLB&eventId=.. a few real key plays (or an article recap) for
//                                       one game, from ESPN (no key needed)
//   GET /api/highlights?sport=...&team=...&opponent=...&date=...
//                                       a matching YouTube highlight video, if one
//                                       can be found with confidence — this needs
//                                       a YouTube Data API key, kept in a local
//                                       .env file that's never committed to git.
//
// See README.md for how to get a YouTube API key and set up the .env file.

const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  });
}
loadEnvFile();

const PORT = process.env.PORT || 3001;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// ---- Team -> ESPN API path mapping ----
const TEAMS = {
  MLB: { name: 'Red Sox',  espnSport: 'baseball',   espnLeague: 'mlb', espnTeam: 'bos' },
  NFL: { name: 'Patriots', espnSport: 'football',   espnLeague: 'nfl', espnTeam: 'ne'  },
  NBA: { name: 'Celtics',  espnSport: 'basketball', espnLeague: 'nba', espnTeam: 'bos' },
  NHL: { name: 'Bruins',   espnSport: 'hockey',     espnLeague: 'nhl', espnTeam: 'bos' },
};

async function fetchSchedule(code) {
  const team = TEAMS[code];
  if (!team) return [];

  const url = `https://site.api.espn.com/apis/site/v2/sports/${team.espnSport}/${team.espnLeague}/teams/${team.espnTeam}/schedule`;
  const res = await fetch(url);
  const data = await res.json();
  return normalizeSchedule(data, team);
}

// Pulled out from fetchSchedule so the ESPN->our-shape transformation can be
// tested on its own against real saved responses, without needing a network
// call every time.
function normalizeSchedule(data, team) {
  const events = data.events || [];

  return events.map(event => {
    const comp = event.competitions[0];
    const us = comp.competitors.find(c => c.team.abbreviation.toLowerCase() === team.espnTeam.toLowerCase());
    const them = comp.competitors.find(c => c !== us);
    const statusType = comp.status.type;

    let status = 'scheduled';
    if (statusType.completed) status = 'final';
    else if (statusType.state === 'in') status = 'live';

    return {
      id: event.id,
      dateISO: event.date,
      opponent: them.team.shortDisplayName,
      home: us.homeAway === 'home',
      teamScore: us.score ? Number(us.score.value) : null,
      oppScore: them.score ? Number(them.score.value) : null,
      status,
    };
  });
}

// ---- Game recap (key plays, or an article fallback) ----
// ESPN's play-by-play data is inconsistent across sports via this endpoint:
// confirmed present for MLB/NBA/NHL, but reliably empty for NFL even though
// the game itself has a boxscore. So this falls back to the AP article
// recap (also present for all four sports) when no plays are available,
// rather than showing nothing.

async function fetchRecap(code, eventId) {
  const team = TEAMS[code];
  if (!team) return { type: 'none' };

  const url = `https://site.api.espn.com/apis/site/v2/sports/${team.espnSport}/${team.espnLeague}/summary?event=${eventId}`;
  const res = await fetch(url);
  const data = await res.json();

  const keyPlays = extractKeyPlays(data.plays);
  if (keyPlays) {
    return { type: 'plays', plays: keyPlays.map(p => p.text) };
  }
  if (data.article && data.article.description) {
    return { type: 'article', headline: data.article.headline, description: data.article.description };
  }
  return { type: 'none' };
}

// Picks the biggest scoring plays (3-pointers before 2-pointers, multi-run
// innings before single-run ones, etc.), breaking ties toward whichever
// happened later in the game. Not the same as "the plays that actually
// decided the game" — win-probability data that would support that more
// rigorous definition isn't reliably available across all four sports
// (MLB's isn't aligned with its play list, NHL's isn't provided at all) —
// but it's an honest, simple signal that works the same way everywhere
// play data exists at all.
function extractKeyPlays(playsData, maxPlays = 5) {
  const scoring = (playsData || []).filter(p => p.scoringPlay && p.text);
  if (!scoring.length) return null;

  const ranked = scoring.slice().sort((a, b) =>
    (b.scoreValue || 0) - (a.scoreValue || 0) || new Date(b.wallclock) - new Date(a.wallclock)
  );
  return ranked.slice(0, maxPlays);
}

// ---- Highlight-video matching ----
// This is the same matching logic validated separately against real YouTube
// search results: team + opponent + date must ALL appear in a title before
// it's trusted, since two teams that play each other repeatedly in a season
// produce near-identical titles for completely different games.

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(name) {
  return normalize(name).split(' ').filter(w => w.length > 2 || /^[0-9]/.test(w));
}

function isoToShortDate(iso) {
  // ESPN's event dates are UTC, but a game starting in the evening Eastern
  // Time (true for most games involving these Boston teams) often crosses
  // midnight UTC, landing on the next calendar day. Highlight video titles
  // follow the game's local (Eastern) date, not UTC, so convert to Eastern
  // before matching — using plain UTC here caused real same-game videos to
  // be rejected over an off-by-one-day mismatch.
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

function dateAppears(title, dateStr) {
  const [monthAbbr, dayStr] = dateStr.split(' ');
  const day = parseInt(dayStr, 10);
  const monthNames = {
    jan: ['jan', 'january'], feb: ['feb', 'february'], mar: ['mar', 'march'], apr: ['apr', 'april'],
    may: ['may'], jun: ['jun', 'june'], jul: ['jul', 'july'], aug: ['aug', 'august'],
    sep: ['sep', 'sept', 'september'], oct: ['oct', 'october'], nov: ['nov', 'november'], dec: ['dec', 'december'],
  };
  const key = monthAbbr.toLowerCase().slice(0, 3);
  const names = monthNames[key] || [monthAbbr.toLowerCase()];
  const monthNum = Object.keys(monthNames).indexOf(key) + 1;
  const lower = title.toLowerCase();

  const monthWordPattern = new RegExp(`\\b(${names.join('|')})\\.?\\s+${day}\\b`);
  if (monthWordPattern.test(lower)) return true;

  const numPattern = new RegExp(`\\b0?${monthNum}[/-]0?${day}\\b`);
  return numPattern.test(lower);
}

function scoreCandidate(game, teamName, video) {
  const title = video.title;
  const normTitle = normalize(title);
  const hasTeam = tokens(teamName).every(w => normTitle.includes(w));
  const hasOpp = tokens(game.opponent).every(w => normTitle.includes(w));

  let score = 0;
  if (hasTeam) score += 2;
  if (hasOpp) score += 2;
  if (/highlight|recap|condensed/.test(normTitle)) score += 1;
  const dateMatched = dateAppears(title, game.date);
  if (dateMatched) score += 2;

  return { video, score, eligible: hasTeam && hasOpp && dateMatched };
}

function bestMatch(game, teamName, candidates) {
  const scored = candidates.map(v => scoreCandidate(game, teamName, v)).sort((a, b) => b.score - a.score);
  return scored.find(r => r.eligible) || null;
}

async function findHighlight(teamName, opponent, dateISO) {
  if (!YOUTUBE_API_KEY) return { available: false, reason: 'missing-api-key' };

  const query = `${teamName} vs ${opponent} Highlights`;
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '8', order: 'relevance', q: query,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    headers: { 'x-goog-api-key': YOUTUBE_API_KEY },
  });
  const data = await res.json();
  if (data.error) return { available: false, reason: data.error.message };

  const candidates = (data.items || []).map(item => ({
    title: item.snippet.title,
    videoId: item.id.videoId,
  }));
  const game = { date: isoToShortDate(dateISO), opponent };
  const winner = bestMatch(game, teamName, candidates);

  if (!winner) return { available: false, reason: 'no-confident-match' };
  return { available: true, videoId: winner.video.videoId, title: winner.video.title };
}

// ---- HTTP server ----
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === '/api/schedule') {
      const games = await fetchSchedule(url.searchParams.get('code'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(games));
    } else if (url.pathname === '/api/recap') {
      const recap = await fetchRecap(url.searchParams.get('code'), url.searchParams.get('eventId'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(recap));
    } else if (url.pathname === '/api/highlights') {
      const team = url.searchParams.get('team');
      const opponent = url.searchParams.get('opponent');
      const date = url.searchParams.get('date');
      const result = await findHighlight(team, opponent, date);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  if (!YOUTUBE_API_KEY) {
    console.log('No YOUTUBE_API_KEY set yet — highlight videos will show as unavailable. See README.md.');
  }
});
