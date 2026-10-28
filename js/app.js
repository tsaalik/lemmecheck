// ---- Boston teams ----
// Each code maps to exactly one Boston team, since that's all this app tracks.
const TEAMS = [
  {code:"MLB", name:"Red Sox",   emoji:"⚾"},
  {code:"NFL", name:"Patriots",  emoji:"🏈"},
  {code:"NBA", name:"Celtics",   emoji:"🏀"},
  {code:"NHL", name:"Bruins",    emoji:"🏒"},
];

// ---- Sample data ----
// Placeholder scores and schedule, listed oldest to newest per team.
// In a real app this would come from a live sports API — see the README.
const games = [
  // Red Sox — regular season has wrapped up for the year
  {id:"mlb1", code:"MLB", date:"Sep 24", opponent:"Yankees",  home:true,  teamScore:4, oppScore:2, status:"final"},
  {id:"mlb2", code:"MLB", date:"Sep 28", opponent:"Orioles",  home:false, teamScore:3, oppScore:6, status:"final"},

  // Patriots — mid NFL season
  {id:"nfl1", code:"NFL", date:"Oct 19", opponent:"Bills",    home:true,  teamScore:24, oppScore:20, status:"final"},
  {id:"nfl2", code:"NFL", date:"Oct 25", opponent:"Jets",     home:false, teamScore:17, oppScore:27, status:"final"},
  {id:"nfl3", code:"NFL", date:"Nov 1",  opponent:"Dolphins", home:true,  time:"1:00 PM", status:"scheduled"},

  // Celtics — NBA season just tipped off
  {id:"nba1", code:"NBA", date:"Oct 22", opponent:"Knicks",   home:true,  teamScore:112, oppScore:104, status:"final"},
  {id:"nba2", code:"NBA", date:"Oct 25", opponent:"76ers",    home:false, teamScore:98,  oppScore:101, status:"final"},
  {id:"nba3", code:"NBA", date:"Oct 29", opponent:"Heat",     home:true,  time:"7:30 PM", status:"scheduled"},

  // Bruins — NHL season underway
  {id:"nhl1", code:"NHL", date:"Oct 23", opponent:"Rangers",      home:false, teamScore:3, oppScore:2, status:"final"},
  {id:"nhl2", code:"NHL", date:"Oct 26", opponent:"Maple Leafs",  home:true,  teamScore:2, oppScore:4, status:"final"},
  {id:"nhl3", code:"NHL", date:"Oct 30", opponent:"Canadiens",    home:false, time:"7:00 PM", status:"scheduled"},
];

let selectedTab = "All";

function mockHighlights(g, teamName){
  if(g.status !== 'final') return null;
  const diff = Math.abs(g.teamScore - g.oppScore);
  const won = g.teamScore > g.oppScore;
  const leader = won ? teamName : g.opponent;
  const bullets = [];
  if(diff >= 8) bullets.push(`${leader} pulled away early and never looked back.`);
  else if(diff <= 1) bullets.push(`Tight one — decided late.`);
  else bullets.push(`${leader} took control in the middle of the game.`);
  const us = g.home ? teamName : g.opponent;
  const them = g.home ? g.opponent : teamName;
  const usScore = g.home ? g.teamScore : g.oppScore;
  const themScore = g.home ? g.oppScore : g.teamScore;
  bullets.push(`Final: ${us} ${usScore} — ${them} ${themScore}`);
  return bullets;
}

function renderTabs(){
  const bar = document.getElementById('teamTabs');
  const labels = ["All", ...TEAMS.map(t=>t.name)];
  bar.innerHTML = labels.map(label=>
    `<div class="team-chip ${selectedTab===label?'active':''}" data-tab="${label}">${label}</div>`
  ).join('');
  bar.querySelectorAll('.team-chip').forEach(el=>{
    el.addEventListener('click', ()=>{
      selectedTab = el.dataset.tab;
      render();
    });
  });
}

function render(){
  renderTabs();
  const sectionsEl = document.getElementById('sections');
  let html = '';
  let anyTeams = false;

  TEAMS.forEach(team=>{
    if(selectedTab !== 'All' && selectedTab !== team.name) return;
    const teamGames = games.filter(g=>g.code===team.code);
    if(!teamGames.length) return;
    anyTeams = true;

    html += `<div class="section-label"><span class="emoji">${team.emoji}</span> ${team.name}</div>`;

    const hasUpcoming = teamGames.some(g=>g.status==='scheduled');

    teamGames.forEach(g=>{
      const hl = mockHighlights(g, team.name);
      // Always show the away team on top, home team on the bottom — Boston's
      // row gets the gold highlight no matter which side it's on.
      const awayLabel = g.home ? g.opponent : team.name;
      const homeLabel = g.home ? team.name : g.opponent;
      const awayScore = g.home ? g.oppScore : g.teamScore;
      const homeScore = g.home ? g.teamScore : g.oppScore;
      html += `
      <div class="game" id="game-${g.id}">
        <div class="game-row" data-id="${g.id}">
          <div class="matchup">
            <div class="team">
              <span class="team-name ${!g.home ? 'boston' : ''}">${awayLabel}</span>
              ${g.status==='final' ? `<span class="score">${awayScore}</span>` : ''}
            </div>
            <div class="team">
              <span class="team-name ${g.home ? 'boston' : ''}">${homeLabel}</span>
              ${g.status==='final' ? `<span class="score">${homeScore}</span>` : ''}
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

    if(!hasUpcoming){
      html += `<div class="season-note">Season complete for the ${team.name} — next game will show here once it's scheduled.</div>`;
    }
  });

  if(!anyTeams){
    html = `<div class="empty">No games to show for that team yet.</div>`;
  }

  sectionsEl.innerHTML = html;

  sectionsEl.querySelectorAll('.game-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      document.getElementById(`game-${row.dataset.id}`).classList.toggle('open');
    });
  });
}

render();
