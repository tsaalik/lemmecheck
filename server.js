// Tiny local backend for Beantown Hub.
//
// It does three things, all so the frontend never needs a secret key:
//   GET /api/schedule?code=MLB         real schedule/scores from ESPN (no key needed)
//   GET /api/standing?code=MLB         real record + division standing from ESPN (no key needed)
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

// Each team's division, by ESPN team abbreviation — stable for a whole
// season, so it's simpler to list here than to work out from the API,
// which only groups standings down to conference/league, not division.
const DIVISIONS = {
  MLB: { name: 'AL East',  teamIds: ['NYY', 'BOS', 'TOR', 'TB', 'BAL'] },
  NFL: { name: 'AFC East', teamIds: ['NE', 'BUF', 'MIA', 'NYJ'] },
  NBA: { name: 'Atlantic', teamIds: ['BOS', 'NY', 'PHI', 'BKN', 'TOR'] },
  NHL: { name: 'Atlantic', teamIds: ['BOS', 'TOR', 'TB', 'FLA', 'BUF', 'DET', 'OTT', 'MTL'] },
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

async function fetchStanding(code) {
  const team = TEAMS[code];
  const division = DIVISIONS[code];
  if (!team || !division) return { record: null, standing: null };

  const url = `https://site.api.espn.com/apis/v2/sports/${team.espnSport}/${team.espnLeague}/standings`;
  const res = await fetch(url);
  const data = await res.json();
  return normalizeStanding(data, team, division);
}

// This endpoint only groups standings down to conference/league, not
// division, so divisional rank is computed here: flatten every
// conference's entries into one list, keep just the division's own teams,
// sort by win percentage, and find where our team landed.
function normalizeStanding(data, team, division) {
  const allEntries = [];
  (data.children || []).forEach(conf => {
    (conf.standings && conf.standings.entries || []).forEach(e => allEntries.push(e));
  });

  const divisionEntries = allEntries
    .filter(e => division.teamIds.includes(e.team.abbreviation))
    .map(e => {
      const winPercent = e.stats.find(s => s.name === 'winPercent');
      const overall = e.stats.find(s => s.name === 'overall');
      return {
        abbr: e.team.abbreviation,
        winPercent: winPercent ? winPercent.value : 0,
        record: overall ? overall.summary : null,
      };
    })
    .sort((a, b) => b.winPercent - a.winPercent);

  const rank = divisionEntries.findIndex(t => t.abbr === team.espnTeam.toUpperCase()) + 1;
  const us = divisionEntries[rank - 1];
  if (!us) return { record: null, standing: null };

  return { record: us.record, standing: `${ordinal(rank)} in ${division.name}` };
}

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// ---- Game recap (key plays, then stat leaders, then an article, in order) ----
// ESPN's play-by-play lives in different places depending on sport: a flat
// top-level `plays` array for MLB/NBA/NHL, but nested under `drives` for NFL
// (each drive already carries which team had the ball, so no id-lookup is
// needed there). If genuinely neither is available, this falls back to
// `leaders` (real per-team stat leaders), and only as a last resort to the
// AP article recap, which turned out to be a weak summary on its own:
// `description` is often just a scene-setting opening line ("If Jordan Love
// has played a better game than he did on Sunday, he can't remember it.")
// with no actual facts, so the `headline` (which does state facts) is
// included too.

async function fetchRecap(code, eventId) {
  const team = TEAMS[code];
  if (!team) return { type: 'none' };

  const url = `https://site.api.espn.com/apis/site/v2/sports/${team.espnSport}/${team.espnLeague}/summary?event=${eventId}`;
  const res = await fetch(url);
  const data = await res.json();

  const teamNames = buildTeamNameMap(data);
  const finalScore = buildFinalScoreLine(data);
  const winner = winnerTeamName(data);

  const items = extractKeyPlays(data.plays, teamNames) || extractKeyPlaysFromDrives(data.drives);
  if (items) {
    return { type: 'plays', finalScore, groups: groupByTeam(items, winner) };
  }
  const performerItems = extractTopPerformers(data.leaders, teamNames);
  if (performerItems) {
    return { type: 'performers', finalScore, groups: groupByTeam(performerItems, winner) };
  }
  if (data.article && data.article.description) {
    return { type: 'article', headline: data.article.headline, description: data.article.description };
  }
  return { type: 'none' };
}

// Groups a flat list of {team, text} items into [{team, plays}], ordered
// with the winning team's group first (matching the "Final Score: X
// defeated Y" line above it), each team's own items kept in their given
// order otherwise.
function groupByTeam(items, winner) {
  const order = [];
  const byTeam = {};
  items.forEach(({ team, text }) => {
    if (!byTeam[team]) { byTeam[team] = []; order.push(team); }
    byTeam[team].push(text);
  });
  order.sort((a, b) => (a === winner ? -1 : b === winner ? 1 : 0));
  return order.map(team => ({ team, plays: byTeam[team] }));
}

function winnerTeamName(data) {
  const competitors = data.header && data.header.competitions && data.header.competitions[0]
    ? data.header.competitions[0].competitors : [];
  const winner = competitors.find(c => c.winner);
  return winner ? winner.team.name : null;
}

function buildFinalScoreLine(data) {
  const competitors = data.header && data.header.competitions && data.header.competitions[0]
    ? data.header.competitions[0].competitors : [];
  if (competitors.length < 2) return null;
  const winner = competitors.find(c => c.winner) || competitors[0];
  const loser = competitors.find(c => c !== winner);
  return `${winner.team.name} defeated the ${loser.team.name} ${winner.score}-${loser.score}.`;
}

// NFL-specific: scoring plays nested under drives.previous[].plays, each
// drive already labeled with its own team. There's no scoreValue field here
// like the other sports have, so point values are inferred from the score
// type (touchdown/field goal/safety) for the same "biggest, then most
// recent" ranking extractKeyPlays uses. The raw text is broadcast-transcript
// style ("(Shotgun) D.Maye pass... Center-J.Ashby, Holder-M.Wishnowsky. **
// Injury Update: ...") so it's cleaned up before use.
const NFL_SCORE_VALUES = { touchdown: 6, fieldgoal: 3, safety: 2 };

function extractKeyPlaysFromDrives(drivesData, maxPlays = 5) {
  if (!drivesData || !drivesData.previous) return null;

  const scoring = [];
  drivesData.previous.forEach(drive => {
    (drive.plays || []).forEach(play => {
      if (!play.scoringPlay || !play.text) return;
      const scoreTypeName = play.scoringType && play.scoringType.name;
      scoring.push({
        text: cleanPlayText(play.text),
        team: drive.team.name,
        wallclock: play.wallclock,
        value: NFL_SCORE_VALUES[scoreTypeName] || 1,
      });
    });
  });
  if (!scoring.length) return null;

  scoring.sort((a, b) => b.value - a.value || new Date(b.wallclock) - new Date(a.wallclock));
  return scoring.slice(0, maxPlays).map(({ team, text }) => ({ team, text }));
}

// Strips broadcast-transcript clutter that doesn't help a casual reader:
// formation calls ("(Shotgun)"), injury asides, and the holder/center
// footnote on every kick. Simplifies the extra-point / two-point-conversion
// outcome down to one short clause instead of the full play-by-play of it.
function cleanPlayText(text) {
  let sentences = text.split(/(?<=\.)\s+/).filter(s =>
    !/injury update/i.test(s) &&
    !/was injured during the play/i.test(s) &&
    !/Center-\S+,?\s*Holder-\S+/i.test(s)
  );
  if (sentences.length) {
    sentences[0] = sentences[0].replace(/^\([^)]*\)\s*/, '');
  }
  sentences = sentences.map(s => {
    if (/extra point is good/i.test(s)) return 'Extra point good.';
    if (/extra point is no good/i.test(s)) return 'Extra point missed.';
    if (/two-point conversion attempt/i.test(s)) return null;
    if (/attempt succeeds/i.test(s)) return 'Two-point conversion good.';
    if (/attempt fails/i.test(s)) return 'Two-point conversion failed.';
    return s;
  }).filter(Boolean);
  return sentences.join(' ').trim();
}

// Maps each team's ESPN id (e.g. "2") to its short name (e.g. "Red Sox"), so
// a play or stat line that only carries a team id can be labeled by name.
// Both `plays[].team.id` and `leaders[].team.id` use this same id scheme.
function buildTeamNameMap(data) {
  const map = {};
  const competitors = data.header && data.header.competitions && data.header.competitions[0]
    ? data.header.competitions[0].competitors : [];
  competitors.forEach(c => { map[c.team.id] = c.team.name; });
  return map;
}

// Takes each team's first few stat-leader categories (ESPN already orders
// these by relevance — passing/rushing/receiving before sacks/tackles for
// NFL, points before assists for NBA, etc.) and turns the top name in each
// into a plain-language stat line.
function extractTopPerformers(leadersData, teamNames, maxPerTeam = 3) {
  if (!leadersData || !leadersData.length) return null;

  const items = [];
  leadersData.forEach(teamLeaders => {
    const name = teamNames[teamLeaders.team.id] || teamLeaders.team.displayName;
    teamLeaders.leaders.slice(0, maxPerTeam).forEach(category => {
      const top = category.leaders && category.leaders[0];
      if (!top) return;
      items.push({ team: name, text: `${top.athlete.displayName}: ${top.displayValue}` });
    });
  });
  return items.length ? items : null;
}

// Picks the biggest scoring plays (3-pointers before 2-pointers, multi-run
// innings before single-run ones, etc.), breaking ties toward whichever
// happened later in the game. Not the same as "the plays that actually
// decided the game" — win-probability data that would support that more
// rigorous definition isn't reliably available across all four sports
// (MLB's isn't aligned with its play list, NHL's isn't provided at all) —
// but it's an honest, simple signal that works the same way everywhere
// play data exists at all.
function extractKeyPlays(playsData, teamNames, maxPlays = 5) {
  const scoring = (playsData || []).filter(p => p.scoringPlay && p.text);
  if (!scoring.length) return null;

  const ranked = scoring.slice().sort((a, b) =>
    (b.scoreValue || 0) - (a.scoreValue || 0) || new Date(b.wallclock) - new Date(a.wallclock)
  );
  return ranked.slice(0, maxPlays).map(p => ({
    team: (p.team && teamNames[p.team.id]) || 'Unknown',
    text: p.text,
  }));
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

function eligibleMatches(game, teamName, candidates) {
  return candidates
    .map(v => scoreCandidate(game, teamName, v))
    .filter(r => r.eligible)
    .sort((a, b) => b.score - a.score);
}

// Checked whether "prefer a specific channel" (ESPN Deportes was suggested)
// would reliably give embeddable videos, and it doesn't hold up: a check of
// real official-NBA-channel uploads showed `embeddable: true` just as often
// as third-party ones, so it's not a channel-level rule at all — it varies
// per video. The actual fix is to check embeddability directly and pick
// whichever eligible match actually works, in one cheap batched call (1
// quota unit total, vs. 100 for the search that already ran).
async function checkEmbeddable(videoIds) {
  if (!videoIds.length) return {};
  const params = new URLSearchParams({ part: 'status', id: videoIds.join(',') });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    headers: { 'x-goog-api-key': YOUTUBE_API_KEY },
  });
  const data = await res.json();
  const map = {};
  (data.items || []).forEach(item => { map[item.id] = item.status.embeddable; });
  return map;
}

// How many matching candidates to hand to the frontend, which tries them
// in order — via a real embed attempt, not just this endpoint's embeddable
// check — until one actually plays or the list runs out.
const MAX_HIGHLIGHT_CANDIDATES = 3;

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
  const matches = eligibleMatches(game, teamName, candidates);

  if (!matches.length) return { available: false, reason: 'no-confident-match' };

  // The embeddable flag still isn't fully reliable on its own (confirmed: a
  // video can report embeddable: true and still fail to actually play), so
  // it's only used here to put more-likely-to-work candidates first — real
  // verification happens in the browser via a genuine embed attempt.
  const embeddableMap = await checkEmbeddable(matches.map(m => m.video.videoId));
  const ranked = matches.slice().sort((a, b) =>
    (embeddableMap[b.video.videoId] ? 1 : 0) - (embeddableMap[a.video.videoId] ? 1 : 0)
  );

  return {
    available: true,
    candidates: ranked.slice(0, MAX_HIGHLIGHT_CANDIDATES).map(m => ({
      videoId: m.video.videoId,
      title: m.video.title,
    })),
  };
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
    } else if (url.pathname === '/api/standing') {
      const standing = await fetchStanding(url.searchParams.get('code'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(standing));
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
