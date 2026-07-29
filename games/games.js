(() => {
  'use strict';
  const catalogue = {
    'echo-bloom': ['/games/echo-bloom/', 'Echo Bloom', 'Your movement becomes the level.', 'Collect a musical pattern, grow living rails, bend enemies, and cut your routes into blooms.'],
    singularity: ['/game/', 'Singularity Inc.', 'A complete AI strategy simulation.', 'Build an AI company through daily scenarios, compounding choices, crises, and multiple endings.'],
    vibecenter: ['/game/vibecenter/', 'VibeCenter', 'A living compute-city tycoon.', 'Route payloads, build server floors, and win a city-scale compute empire your way.'],
    'neon-circuit': ['/whats-live.html', 'Neon Circuit', 'A live multiplayer arcade city.', 'Walk the city with other players and enter three original arcade cabinets.'],
    'operators-deck': ['/game/Arcade/', "Operator's Deck", 'Six retro-inspired games in one session.', 'Move through physics, pattern, focus, memory, and block-unlocking games.'],
    'node-hopper': ['/game/nodehopper/Node%20Hopper.html', 'Node Hopper', 'Flip gravity. Survive the kernel panic.', 'Collect data nodes, dodge hazards, and use gravity to reach the next platform.'],
    'mind-machine': ['/game/theincrediblemindmachine/', 'Mind Machine', 'A tactile physics puzzle.', 'Guide the Ball of Clarity through obstacles and toward insight.'],
  };
  const dailyKeys = ['echo-bloom', 'singularity', 'vibecenter', 'node-hopper', 'mind-machine'];
  const dailyKey = dailyKeys[Math.floor(Date.now() / 86400000) % dailyKeys.length];
  const daily = catalogue[dailyKey];
  const dailyCard = document.getElementById('dailyGame');
  dailyCard.href = daily[0];
  dailyCard.dataset.game = dailyKey;
  document.getElementById('dailyTitle').textContent = daily[1];
  dailyCard.querySelector('h3').textContent = daily[2];
  dailyCard.querySelector('p').textContent = daily[3];

  function remember(key) {
    if (!catalogue[key]) return;
    try {
      const profile = JSON.parse(localStorage.getItem('clove_games_profile_v1') || '{"games":{}}');
      profile.games = profile.games && typeof profile.games === 'object' ? profile.games : {};
      profile.games[key] = { ...profile.games[key], lastPlayed: Date.now() };
      localStorage.setItem('clove_games_profile_v1', JSON.stringify(profile));
      localStorage.setItem('clove_last_activity_v1', JSON.stringify({
        kind: 'game', slug: key, title: catalogue[key][1], href: catalogue[key][0], at: Date.now(),
      }));
    } catch {}
  }
  document.addEventListener('click', event => {
    const card = event.target.closest?.('[data-game]');
    if (card) remember(card.dataset.game);
  });

  try {
    const profile = JSON.parse(localStorage.getItem('clove_games_profile_v1') || '{"games":{}}');
    const entries = Object.entries(profile.games || {})
      .filter(([key, value]) => catalogue[key] && Number(value?.lastPlayed) > 0)
      .sort((a, b) => Number(b[1].lastPlayed) - Number(a[1].lastPlayed));
    if (entries.length) {
      const [key] = entries[0];
      const card = document.getElementById('gameContinue');
      card.hidden = false;
      document.getElementById('gameContinueTitle').textContent = catalogue[key][1];
      document.getElementById('gameContinueLink').href = catalogue[key][0];
    }
  } catch {}
})();
