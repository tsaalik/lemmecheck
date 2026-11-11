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

function formatDate(iso){
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function formatTime(iso){
  return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
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
    const result = await fetchHighlight(team, game);
    if(result.available){
      body.innerHTML = `
        <p>Highlights</p>
        <div class="video-embed">
          <iframe src="https://www.youtube.com/embed/${result.videoId}" allowfullscreen></iframe>
        </div>
        <div class="note">${result.title}</div>`;
    } else {
      body.innerHTML = `<p>Highlights</p><div class="note">No highlight video found for this game yet.</div>`;
    }
  }catch(e){
    body.innerHTML = `<p>Highlights</p><div class="note">Couldn't reach the local API server — make sure "npm run api" is running in a separate terminal.</div>`;
  }
}

function renderHome(){
  const grid = document.getElementById('launcherGrid');
  grid.innerHTML = TEAMS.map(team=>`
    <div class="launcher" data-code="${team.code}">
      <div class="icon" style="background:${team.color}">${team.emoji}</div>
      <div class="name">${team.name}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.launcher').forEach(el=>{
    el.addEventListener('click', ()=>showTeam(el.dataset.code));
  });
}

function showHome(){
  document.getElementById('home-screen').classList.add('active');
  document.getElementById('team-screen').classList.remove('active');
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
