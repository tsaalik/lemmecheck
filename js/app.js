// ---- Boston teams ----
// `color` tints each team's launcher badge — a simple stand-in for a real logo.
const TEAMS = [
  {code:"MLB", name:"Red Sox",   emoji:"⚾", color:"#bd3039"},
  {code:"NFL", name:"Patriots",  emoji:"🏈", color:"#002244"},
  {code:"NBA", name:"Celtics",   emoji:"🏀", color:"#007a33"},
  {code:"NHL", name:"Bruins",    emoji:"🏒", color:"#111111"},
];

// The local backend (see server.js) that fetches real schedule data from
// ESPN and a matching highlight video from YouTube — run it with `npm run api`.
const API_BASE = "http://localhost:3001";

// ---- YouTube player embedding ----
// The backend's "is this embeddable" check (YouTube's status.embeddable
// field) turned out to not be fully reliable — a video can report
// embeddable: true and still fail to actually play, since that field
// doesn't capture everything that can block embedded playback (region
// restrictions, rights-management claims, etc.). So instead of trusting
// that field as a hard gate, every matched video gets a real embed
// attempt, and YouTube's own player tells us — via a genuine onError
// event — whether it actually failed, which is the only fully reliable
// signal. On a real failure, the broken player is swapped out for just
// the "Watch on YouTube" link instead.
let youtubeApiReady = false;
const pendingPlayers = [];
window.onYouTubeIframeAPIReady = function(){
  youtubeApiReady = true;
  pendingPlayers.forEach(create => create());
  pendingPlayers.length = 0;
};

function embedVideo(containerId, videoId, onReady, onFail){
  let settled = false;
  const fail = ()=>{ if(!settled){ settled = true; onFail(); } };

  function create(){
    if(!document.getElementById(containerId)) return; // panel was closed/replaced before the API loaded
    new YT.Player(containerId, {
      videoId: videoId,
      playerVars: { rel: 0 },
      events: {
        onReady: ()=>{ settled = true; onReady(); },
        onError: fail,
      },
    });
  }
  if(youtubeApiReady && window.YT && window.YT.Player) create();
  else pendingPlayers.push(create);

  // If an ad blocker or similar keeps YouTube's player script from ever
  // loading at all, neither onReady nor onError would ever fire, leaving a
  // permanently empty box — this catches that case too.
  setTimeout(fail, 6000);
}

function formatDate(iso){
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function formatTime(iso){
  return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

function summarizeGame(g, team){
  const won = g.teamScore > g.oppScore;
  const winnerScore = Math.max(g.teamScore, g.oppScore);
  const loserScore = Math.min(g.teamScore, g.oppScore);
  const location = g.home ? 'at home' : 'on the road';
  return won
    ? `The ${team.name} beat the ${g.opponent} ${winnerScore}-${loserScore} ${location}.`
    : `The ${team.name} fell to the ${g.opponent} ${loserScore}-${winnerScore} ${location}.`;
}

async function fetchSchedule(code){
  const res = await fetch(`${API_BASE}/api/schedule?code=${code}`);
  if(!res.ok) throw new Error('schedule request failed');
  return res.json();
}

async function fetchHighlight(team, game){
  const params = new URLSearchParams({
    team: team.name,
    opponent: game.opponent,
    date: game.dateISO,
  });
  const res = await fetch(`${API_BASE}/api/highlights?${params}`);
  if(!res.ok) throw new Error('highlights request failed');
  return res.json();
}

async function fetchStanding(code){
  const res = await fetch(`${API_BASE}/api/standing?code=${code}`);
  if(!res.ok) throw new Error('standing request failed');
  return res.json();
}

async function fetchRecap(team, game){
  const params = new URLSearchParams({ code: team.code, eventId: game.id });
  const res = await fetch(`${API_BASE}/api/recap?${params}`);
  if(!res.ok) throw new Error('recap request failed');
  return res.json();
}

function recapHtml(recap, game, team){
  if(recap.type === 'plays' || recap.type === 'performers'){
    const label = recap.type === 'plays' ? 'Key Plays' : 'Top Performers';
    const finalScoreHtml = recap.finalScore
      ? `<p class="final-score"><strong>Final Score:</strong> ${recap.finalScore}</p>` : '';
    const groupsHtml = recap.groups.map(g => `
      <p class="team-group-label">${g.team}</p>
      <ul class="key-plays">${g.plays.map(p=>`<li>${p}</li>`).join('')}</ul>
    `).join('');
    return `<p class="key-plays-label">${label}</p>${finalScoreHtml}${groupsHtml}`;
  }
  if(recap.type === 'article'){
    return `<p class="summary"><strong>${recap.headline}</strong><br>${recap.description}</p>`;
  }
  return `<p class="summary">${summarizeGame(game, team)}</p>`;
}

function gameCardHtml(g, team){
  // Always show the away team on top, home team on the bottom — Boston's
  // row gets the highlight color no matter which side it's on.
  const awayLabel = g.home ? g.opponent : team.name;
  const homeLabel = g.home ? team.name : g.opponent;
  const awayScore = g.home ? g.oppScore : g.teamScore;
  const homeScore = g.home ? g.teamScore : g.oppScore;

  let statusHtml;
  if(g.status === 'final') statusHtml = `FINAL · ${formatDate(g.dateISO)}`;
  else if(g.status === 'live') statusHtml = `LIVE`;
  else statusHtml = `${formatDate(g.dateISO)} · ${formatTime(g.dateISO)}`;

  return `
  <div class="game" id="game-${g.id}">
    <div class="game-row" data-id="${g.id}">
      <div class="matchup">
        <div class="team">
          <span class="team-name ${!g.home ? 'boston' : ''}">${awayLabel}</span>
          ${g.status!=='scheduled' && awayScore!==null ? `<span class="score">${awayScore}</span>` : ''}
        </div>
        <div class="team">
          <span class="team-name ${g.home ? 'boston' : ''}">${homeLabel}</span>
          ${g.status!=='scheduled' && homeScore!==null ? `<span class="score">${homeScore}</span>` : ''}
        </div>
      </div>
      <div class="status ${g.status}">${statusHtml}</div>
      <div class="chev">▶</div>
    </div>
    <div class="highlights" id="hl-${g.id}">
      <p>Highlights</p>
      ${g.status === 'final'
        ? `<div class="note">Tap to load highlights…</div>`
        : `<div class="note">Game hasn't finished yet — highlights will appear here once it's final.</div>`}
    </div>
  </div>`;
}

async function loadHighlightsInto(gameEl, team, game){
  const body = gameEl.querySelector(`#hl-${game.id}`);
  body.innerHTML = `<p>Highlights</p><div class="note">Loading highlights…</div>`;
  try{
    const [result, recap] = await Promise.all([
      fetchHighlight(team, game),
      fetchRecap(team, game),
    ]);
    const recapSection = recapHtml(recap, game, team);
    if(result.available){
      tryVideoCandidates(body, game, result.candidates, 0, recapSection);
    } else {
      body.innerHTML = `<p>Highlights</p><div class="note">No highlight video found for this game yet.</div>${recapSection}`;
    }
  }catch(e){
    body.innerHTML = `<p>Highlights</p><div class="note">Couldn't reach the local API server — make sure "npm run api" is running in a separate terminal.</div>`;
  }
}

// Tries each candidate video in turn (real embed attempt, not just the
// backend's embeddable check) until one actually plays, falling back to a
// plain "Watch on YouTube" link for the best match only once every
// candidate has genuinely failed.
function tryVideoCandidates(body, game, candidates, index, recapSection){
  if(index >= candidates.length){
    const best = candidates[0];
    body.innerHTML = `
      <p>Highlights</p>
      <div class="note">${best.title}</div>
      <a class="watch-link" href="https://www.youtube.com/watch?v=${best.videoId}" target="_blank" rel="noopener">Watch on YouTube ↗</a>
      ${recapSection}`;
    return;
  }

  const candidate = candidates[index];
  const playerContainerId = `player-${game.id}`;
  body.innerHTML = `
    <p>Highlights</p>
    <div class="video-embed" id="wrap-${playerContainerId}">
      <div class="player-loading">Loading video…</div>
      <div id="${playerContainerId}"></div>
    </div>
    <div class="note">${candidate.title}</div>
    <a class="watch-link" href="https://www.youtube.com/watch?v=${candidate.videoId}" target="_blank" rel="noopener">Watch on YouTube ↗</a>
    ${recapSection}`;
  const wrapperEl = document.getElementById(`wrap-${playerContainerId}`);
  embedVideo(
    playerContainerId,
    candidate.videoId,
    ()=>{ wrapperEl?.querySelector('.player-loading')?.remove(); },
    ()=>{ tryVideoCandidates(body, game, candidates, index + 1, recapSection); }
  );
}

function renderHome(){
  const grid = document.getElementById('launcherGrid');
  grid.innerHTML = TEAMS.map(team=>`
    <div class="launcher" data-code="${team.code}">
      <div class="icon" style="background:${team.color}">${team.emoji}</div>
      <div class="name">${team.name}</div>
      <div class="launcher-stats" id="stats-${team.code}">Loading…</div>
    </div>
  `).join('');
  grid.querySelectorAll('.launcher').forEach(el=>{
    el.addEventListener('click', ()=>showTeam(el.dataset.code));
  });

  TEAMS.forEach(async team=>{
    const statsEl = document.getElementById(`stats-${team.code}`);
    try{
      const { record, standing } = await fetchStanding(team.code);
      statsEl.textContent = (record && standing) ? `${record} · ${standing}` : 'Record unavailable';
    }catch(e){
      statsEl.textContent = 'Record unavailable';
    }
  });
}

function showHome(){
  document.getElementById('home-screen').classList.add('active');
  document.getElementById('team-screen').classList.remove('active');
}

// One line per team: a live game takes priority, then the most recent
// final result, then the next scheduled game — whichever is most relevant
// to "what's going on with this team right now."
async function tickerItemFor(team){
  try{
    const games = await fetchSchedule(team.code);
    const sorted = games.slice().sort((a,b)=> new Date(a.dateISO) - new Date(b.dateISO));
    const live = sorted.find(g=>g.status==='live');
    const upcoming = sorted.find(g=>g.status==='scheduled');
    const finals = sorted.filter(g=>g.status==='final');
    const recent = finals[finals.length-1];

    if(live){
      const scoreText = (live.teamScore!==null && live.oppScore!==null)
        ? ` ${live.teamScore}-${live.oppScore}` : '';
      return `<span class="live-dot">●</span> ${team.name} live vs ${live.opponent}${scoreText}`;
    }
    if(recent){
      return summarizeGame(recent, team).replace(/\.$/, '');
    }
    if(upcoming){
      return `${team.name} next: ${formatDate(upcoming.dateISO)} vs ${upcoming.opponent}, ${formatTime(upcoming.dateISO)}`;
    }
    return `${team.name}: no games scheduled`;
  }catch(e){
    return `${team.name}: scores unavailable`;
  }
}

async function renderTicker(){
  const items = await Promise.all(TEAMS.map(tickerItemFor));
  const itemsHtml = items.map(text=>`<span class="ticker-item">${text}</span>`).join('');
  // Duplicated once so the track can loop seamlessly: animating to -50%
  // lands exactly back on the same content as the start.
  const track = document.getElementById('tickerTrack');
  track.innerHTML = itemsHtml + itemsHtml;

  const ticker = document.getElementById('ticker');
  ticker.addEventListener('click', ()=> track.classList.toggle('paused'));
}

async function showTeam(code){
  const team = TEAMS.find(t=>t.code===code);
  document.getElementById('teamHeader').innerHTML = `
    <div class="team-header">
      <div class="icon" style="background:${team.color}">${team.emoji}</div>
      <h2>${team.name}</h2>
    </div>`;

  const sectionsEl = document.getElementById('teamSections');
  sectionsEl.innerHTML = `<div class="empty">Loading schedule…</div>`;

  document.getElementById('home-screen').classList.remove('active');
  document.getElementById('team-screen').classList.add('active');

  let teamGames;
  try{
    teamGames = await fetchSchedule(code);
  }catch(e){
    sectionsEl.innerHTML = `<div class="empty">Couldn't reach the local API server — make sure "npm run api" is running in a separate terminal.</div>`;
    return;
  }

  const sorted = teamGames.slice().sort((a,b)=> new Date(a.dateISO) - new Date(b.dateISO));
  const upcoming = sorted.find(g=>g.status==='scheduled' || g.status==='live');
  // Most recent result first.
  const recent = sorted.filter(g=>g.status==='final').reverse().slice(0,5);

  let html = '';
  if(upcoming){
    html += `<div class="section-label">${upcoming.status==='live' ? 'Live Now' : 'Next Game'}</div>`;
    html += gameCardHtml(upcoming, team);
  }

  html += `<div class="section-label">Recent Games</div>`;
  if(recent.length){
    html += recent.map(g=>gameCardHtml(g, team)).join('');
  } else {
    html += `<div class="empty">No recent games yet.</div>`;
  }
  if(!upcoming){
    html += `<div class="season-note">Season complete for the ${team.name} — next game will show here once it's scheduled.</div>`;
  }

  sectionsEl.innerHTML = html;

  const byId = {};
  [upcoming, ...recent].filter(Boolean).forEach(g => byId[g.id] = g);

  sectionsEl.querySelectorAll('.game-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      const gameEl = document.getElementById(`game-${row.dataset.id}`);
      const wasOpen = gameEl.classList.contains('open');
      gameEl.classList.toggle('open');
      const game = byId[row.dataset.id];
      if(!wasOpen && game.status === 'final' && !gameEl.dataset.loaded){
        gameEl.dataset.loaded = 'true';
        loadHighlightsInto(gameEl, team, game);
      }
    });
  });
}

document.getElementById('backBtn').addEventListener('click', showHome);

renderHome();
renderTicker();
