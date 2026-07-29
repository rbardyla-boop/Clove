(() => {
  'use strict';
  const dayNumber = Math.floor(Date.now() / 86400000);
  const tools = [
    ['/mindfulness-drill-full.html', 'One-minute grounding', 'Notice five things without trying to fix anything.'],
    ['/tipp-drill-full.html', 'Settle the body first', 'A short physical reset for an overloaded nervous system.'],
    ['/micro-ops.html', 'Make the next step tiny', 'Turn a stuck task into one action small enough to begin.'],
    ['/values-drill.html', 'Choose a direction', 'Use one value to guide one decision today.'],
    ['/thought-interceptor.html', 'Unhook from the loop', 'Catch a recurring thought and make room around it.'],
  ];
  const games = [
    ['/games/echo-bloom/', 'Echo Bloom', 'Your last seven seconds return as a living rail.'],
    ['/game/', 'Singularity Inc.', 'Build an AI company through crises, choices, and multiple endings.'],
    ['/game/vibecenter/', 'VibeCenter', 'Build a city-scale compute empire in a living strategy sandbox.'],
    ['/game/nodehopper/Node%20Hopper.html', 'Node Hopper', 'Flip gravity and survive the kernel panic.'],
  ];

  function fill(id, pick) {
    const card = document.getElementById(id);
    if (!card) return;
    card.href = pick[0];
    card.querySelector('h3').textContent = pick[1];
    card.querySelector('p').textContent = pick[2];
  }
  fill('todayTool', tools[dayNumber % tools.length]);
  fill('todayGame', games[dayNumber % games.length]);

  try {
    const plan = JSON.parse(localStorage.getItem('clovelearn_onboarding_v1') || 'null');
    if (plan?.completedAt) {
      const choice = document.getElementById('planChoice');
      choice.href = '/growth-plan.html';
      document.getElementById('planChoiceText').textContent = 'Your plan is ready on this device. Return to it whenever it is useful.';
      document.getElementById('planChoiceCta').textContent = 'CONTINUE MY PLAN →';
    }

    const last = JSON.parse(localStorage.getItem('clove_last_activity_v1') || 'null');
    if (last?.href && last?.title && Number(last.at) > Date.now() - 90 * 86400000) {
      const card = document.getElementById('continueCard');
      card.hidden = false;
      document.getElementById('continueTitle').textContent = `Continue ${String(last.title).slice(0, 60)}`;
      document.getElementById('continueText').textContent = 'Saved locally in this browser—no account or cloud profile.';
      document.getElementById('continueLink').href = String(last.href);
    } else if (plan?.completedAt) {
      const card = document.getElementById('continueCard');
      card.hidden = false;
      document.getElementById('continueTitle').textContent = 'Continue your growth plan';
      document.getElementById('continueLink').href = '/growth-plan.html';
    }
  } catch {}
})();
