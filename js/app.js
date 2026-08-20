// ---- Sample data (real MLB scores as of Aug 20, 2026) ----
// In a real app, this array would come from a live sports API instead of
// being hard-coded — see the README for notes on swapping in real data.
const games = [
  {id:"a1",date:"Aug 18",away:"NYY",home:"BAL",awayScore:3,homeScore:1,status:"final"},
  {id:"a2",date:"Aug 18",away:"SF",home:"CLE",awayScore:1,homeScore:8,status:"final"},
  {id:"a3",date:"Aug 18",away:"DET",home:"PIT",awayScore:1,homeScore:4,status:"final"},
  {id:"a4",date:"Aug 18",away:"TOR",home:"TB",awayScore:10,homeScore:5,status:"final"},
  {id:"a5",date:"Aug 18",away:"STL",home:"CIN",awayScore:3,homeScore:0,status:"final"},
  {id:"a6",date:"Aug 18",away:"MIA",home:"PHI",awayScore:4,homeScore:6,status:"final"},
  {id:"a7",date:"Aug 18",away:"AZ",home:"BOS",awayScore:4,homeScore:9,status:"final"},
  {id:"a8",date:"Aug 18",away:"SD",home:"NYM",awayScore:5,homeScore:2,status:"final"},
  {id:"a9",date:"Aug 18",away:"SEA",home:"MIL",awayScore:0,homeScore:22,status:"final"},
  {id:"a10",date:"Aug 18",away:"LAD",home:"COL",awayScore:7,homeScore:6,status:"final"},

  {id:"b1",date:"Aug 19",away:"DET",home:"PIT",awayScore:3,homeScore:4,status:"final"},
  {id:"b2",date:"Aug 19",away:"SD",home:"NYM",awayScore:2,homeScore:4,status:"final"},
  {id:"b3",date:"Aug 19",away:"ATL",home:"MIN",awayScore:4,homeScore:6,status:"final"},
  {id:"b4",date:"Aug 19",away:"CWS",home:"CHC",awayScore:3,homeScore:0,status:"final"},
  {id:"b5",date:"Aug 19",away:"AZ",home:"BOS",awayScore:7,homeScore:6,status:"final"},
  {id:"b6",date:"Aug 19",away:"MIA",home:"PHI",awayScore:1,homeScore:4,status:"final"},
  {id:"b7",date:"Aug 19",away:"NYY",home:"BAL",awayScore:5,homeScore:3,status:"final"},
  {id:"b8",date:"Aug 19",away:"TOR",home:"TB",awayScore:6,homeScore:7,status:"final"},
  {id:"b9",date:"Aug 19",away:"SF",home:"CLE",awayScore:1,homeScore:0,status:"final"},
  {id:"b10",date:"Aug 19",away:"WSH",home:"TEX",awayScore:6,homeScore:0,status:"final"},

  {id:"c1",date:"Aug 20",away:"STL",home:"CIN",time:"11:40 AM",status:"scheduled"},
  {id:"c2",date:"Aug 20",away:"TOR",home:"TB",time:"12:10 PM",status:"scheduled"},
  {id:"c3",date:"Aug 20",away:"SF",home:"CLE",time:"12:10 PM",status:"scheduled"},
  {id:"c4",date:"Aug 20",away:"ATH",home:"KC",time:"1:10 PM",status:"scheduled"},
  {id:"c5",date:"Aug 20",away:"ATL",home:"CWS",time:"1:10 PM",status:"scheduled"},
  {id:"c6",date:"Aug 20",away:"NYY",home:"BAL",time:"5:35 PM",status:"scheduled"},
  {id:"c7",date:"Aug 20",away:"WSH",home:"TEX",time:"7:05 PM",status:"scheduled"},
  {id:"c8",date:"Aug 20",away:"LAA",home:"HOU",time:"7:10 PM",status:"scheduled"},
];

const teamNames = {NYY:"Yankees",BAL:"Orioles",SF:"Giants",CLE:"Guardians",DET:"Tigers",PIT:"Pirates",
  TOR:"Blue Jays",TB:"Rays",STL:"Cardinals",CIN:"Reds",MIA:"Marlins",PHI:"Phillies",AZ:"D-backs",
  BOS:"Red Sox",SD:"Padres",NYM:"Mets",SEA:"Mariners",MIL:"Brewers",LAD:"Dodgers",COL:"Rockies",
  ATL:"Braves",MIN:"Twins",CWS:"White Sox",CHC:"Cubs",WSH:"Nationals",TEX:"Rangers",ATH:"Athletics",
  KC:"Royals",HOU:"Astros",LAA:"Angels"};

const FAVORITES_KEY = "first-pitch-favorites";
let favorites = [];

function loadFavorites(){
  try{
    const saved = localStorage.getItem(FAVORITES_KEY);
    if(saved) favorites = JSON.parse(saved);
  }catch(e){ /* no favorites saved yet */ }
  renderTeamBar();
  render();
}

function saveFavorites(){
  try{ localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); }
  catch(e){ console.error("Could not save favorites", e); }
}

function toggleFavorite(team){
  if(favorites.includes(team)) favorites = favorites.filter(t=>t!==team);
  else favorites.push(team);
  saveFavorites();
  renderTeamBar();
  render();
}

function renderTeamBar(){
  const bar = document.getElementById('teambar');
  const teams = Object.keys(teamNames).sort();
  bar.innerHTML = teams.map(t=>
    `<div class="team-chip ${favorites.includes(t)?'fav':''}" data-team="${t}">${t}</div>`
  ).join('');
  bar.querySelectorAll('.team-chip').forEach(el=>{
    el.addEventListener('click', ()=>toggleFavorite(el.dataset.team));
  });
}

function mockHighlights(g){
  if(g.status !== 'final') return null;
  const diff = Math.abs(g.homeScore - g.awayScore);
  const leader = g.homeScore > g.awayScore ? g.home : g.away;
  const bullets = [];
  if(diff >= 8) bullets.push(`${teamNames[leader]} pulled away early and never looked back.`);
  else if(diff <= 1) bullets.push(`Tight one — decided in the late innings.`);
  else bullets.push(`${teamNames[leader]} took control in the middle innings.`);
  bullets.push(`Final: ${g.away} ${g.awayScore} — ${g.home} ${g.homeScore}`);
  return bullets;
}

function render(){
  const onlyFav = document.getElementById('myTeamsToggle').checked;
  const sectionsEl = document.getElementById('sections');
  const dateOrder = ["Aug 18","Aug 19","Aug 20"];
  const dateTitle = {"Aug 18":"Tuesday","Aug 19":"Wednesday · Yesterday","Aug 20":"Thursday · Today"};

  document.getElementById('favCount').textContent =
    favorites.length ? `${favorites.length} team${favorites.length>1?'s':''} followed` : '';

  let html = '';
  let anyGames = false;

  dateOrder.forEach(d=>{
    let dayGames = games.filter(g=>g.date===d);
    if(onlyFav) dayGames = dayGames.filter(g=>favorites.includes(g.home)||favorites.includes(g.away));
    if(!dayGames.length) return;
    anyGames = true;
    html += `<div class="section-label">${dateTitle[d]}</div>`;
    dayGames.forEach(g=>{
      const hl = mockHighlights(g);
      const awayFav = favorites.includes(g.away);
      const homeFav = favorites.includes(g.home);
      html += `
      <div class="game" id="game-${g.id}">
        <div class="game-row" data-id="${g.id}">
          <div class="matchup">
            <div class="team">
              <span class="star ${awayFav?'on':''}" data-team="${g.away}">★</span>
              <span class="team-name ${awayFav?'fav':''}">${teamNames[g.away]}</span>
              ${g.status==='final' ? `<span class="score">${g.awayScore}</span>` : ''}
            </div>
            <div class="team">
              <span class="star ${homeFav?'on':''}" data-team="${g.home}">★</span>
              <span class="team-name ${homeFav?'fav':''}">${teamNames[g.home]}</span>
              ${g.status==='final' ? `<span class="score">${g.homeScore}</span>` : ''}
            </div>
          </div>
          <div class="status ${g.status==='final'?'final':''}">${g.status==='final' ? 'FINAL' : g.time}</div>
          <div class="chev">▶</div>
        </div>
        ${g.status==='final' ? `
        <div class="highlights">
          <p>Highlights</p>
          <ul>${hl.map(h=>`<li>${h}</li>`).join('')}</ul>
          <div class="note">These highlight lines are placeholders — swap in a real sports-highlights API to show actual clips and plays.</div>
        </div>` : `
        <div class="highlights">
          <p>Highlights</p>
          <div class="note">Game hasn't started yet — highlights will appear here once it's final.</div>
        </div>`}
      </div>`;
    });
  });

  if(!anyGames){
    html = `<div class="empty">No games to show. Star a team above, or turn off "Show only my teams."</div>`;
  }

  sectionsEl.innerHTML = html;

  sectionsEl.querySelectorAll('.game-row').forEach(row=>{
    row.addEventListener('click', (e)=>{
      if(e.target.classList.contains('star')) return;
      document.getElementById(`game-${row.dataset.id}`).classList.toggle('open');
    });
  });
  sectionsEl.querySelectorAll('.star').forEach(star=>{
    star.addEventListener('click', ()=>toggleFavorite(star.dataset.team));
  });
}

document.getElementById('myTeamsToggle').addEventListener('change', render);
loadFavorites();
