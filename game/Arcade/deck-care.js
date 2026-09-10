/* Operator's Deck care pass. Classic defer script; does not own game state. */
(function () {
  'use strict';

  const KEY = (label, key, code) => ({ label, key, code });
  const ARROWS = [KEY('↑', 'ArrowUp', 'ArrowUp'), KEY('←', 'ArrowLeft', 'ArrowLeft'), KEY('↓', 'ArrowDown', 'ArrowDown'), KEY('→', 'ArrowRight', 'ArrowRight')];
  const LEFT_RIGHT = [KEY('←', 'ArrowLeft', 'ArrowLeft'), KEY('→', 'ArrowRight', 'ArrowRight')];
  const UP_DOWN = [KEY('↑', 'ArrowUp', 'ArrowUp'), KEY('↓', 'ArrowDown', 'ArrowDown')];
  const FIRE = KEY('SPACE', ' ', 'Space');
  const DECK_CARE_TABS = [
    { id: 'imm', goal: 'Guide the amber pulse through the arrows to the green goal.', controls: 'Tap an arrow to turn it; press TEST ROUTE.' },
    { id: 'unblock', goal: 'Slide the red core through the right gate.', controls: 'Drag each block along its track.' },
    { id: 'mario', goal: 'Clear all pathogens from the bottle.', controls: 'Arrows move; ↑ rotates; ↓ drops.', keys: ARROWS },
    { id: 'c2048', goal: 'Merge tiles until you reach 2048.', controls: 'Use the arrow keys to slide the grid.', keys: ARROWS },
    { id: 'serpent', goal: 'Eat 10 focus markers without hitting a wall.', controls: 'Swipe the field or use arrows to turn.', keys: ARROWS },
    { id: 'match', goal: 'Find all matching card pairs.', controls: 'Tap two cards at a time.' },
    { id: 'stacker', goal: 'Clear five lines before the stack reaches the top.', controls: 'Arrows move; ↑ rotates.', keys: ARROWS },
    { id: 'mine', goal: 'Reveal every safe cell.', controls: 'Tap cells to reveal; right-click or Shift-click flags a cell.' },
    { id: 'rally', goal: 'Return the ball five times with your shield.', controls: '↑/↓ moves the shield; mouse or touch also positions it.', keys: UP_DOWN },
    { id: 'break', goal: 'Break every block before the ball escapes.', controls: 'Move the paddle with ←/→; mouse or touch also positions it.', keys: LEFT_RIGHT },
    { id: 'push', goal: 'Put all three crates on their targets.', controls: 'Use arrows to move one step at a time.', keys: ARROWS },
    { id: 'switch', goal: 'Turn every pathway light off.', controls: 'Tap a node; its four neighbours invert too.' },
    { id: 'scorch', goal: 'Reduce the critic tank to zero HP.', controls: '←/→ aim; ↑/↓ power; Space fires.', keys: ARROWS.concat([FIRE]) },
    { id: 'asteroids', goal: 'Destroy every rock before losing three lives.', controls: '←/→ rotate; ↑ thrust; Space fires.', keys: [KEY('←', 'ArrowLeft', 'ArrowLeft'), KEY('→', 'ArrowRight', 'ArrowRight'), KEY('↑', 'ArrowUp', 'ArrowUp'), FIRE] },
    { id: 'invaders', goal: 'Destroy all invaders before they reach the ground.', controls: '←/→ moves the cannon; Space fires.', keys: LEFT_RIGHT.concat([FIRE]) }
  ];

  const pressed = new Map();
  const dispatchKey = (type, binding) => {
    const event = new KeyboardEvent(type, { key: binding.key, code: binding.code, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
  };
  const releaseAll = () => {
    for (const binding of pressed.values()) dispatchKey('keyup', binding);
    document.querySelectorAll('.deck-care-key.is-held').forEach(button => button.classList.remove('is-held'));
    pressed.clear();
  };
  const installKey = (button, binding) => {
    let pointerGesture = false;
    const press = event => {
      event.preventDefault();
      pointerGesture = true;
      if (pressed.has(button)) return;
      button.setPointerCapture?.(event.pointerId);
      pressed.set(button, binding);
      button.classList.add('is-held');
      dispatchKey('keydown', binding);
    };
    const release = event => {
      event.preventDefault();
      if (event.type === 'pointercancel') pointerGesture = false;
      if (!pressed.has(button)) return;
      dispatchKey('keyup', pressed.get(button));
      pressed.delete(button);
      button.classList.remove('is-held');
    };
    const click = event => {
      event.preventDefault();
      if (pointerGesture) { pointerGesture = false; return; }
      dispatchKey('keydown', binding);
      dispatchKey('keyup', binding);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('click', click);
  };

  const buildStrip = definition => {
    const strip = document.createElement('section');
    strip.className = 'deck-care-strip';
    strip.dataset.deckCareTarget = definition.id;
    strip.setAttribute('aria-label', `${definition.id} goal and controls`);
    strip.innerHTML = `<div class="deck-care-copy"><div class="deck-care-label">YOUR GOAL</div><p class="deck-care-goal"><strong>${definition.goal}</strong></p></div><p class="deck-care-controls"><strong>Controls:</strong> ${definition.controls}</p>`;
    if (definition.keys) {
      const keys = document.createElement('div');
      keys.className = 'deck-care-keys';
      keys.setAttribute('aria-label', 'Touch keys');
      definition.keys.forEach(binding => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'deck-care-key';
        button.textContent = binding.label;
        button.dataset.key = binding.key;
        button.dataset.code = binding.code;
        button.setAttribute('aria-label', `Press ${binding.label}`);
        installKey(button, binding);
        keys.appendChild(button);
      });
      strip.appendChild(keys);
    }
    return strip;
  };

  const init = () => {
    DECK_CARE_TABS.forEach(definition => {
      const panel = document.getElementById(`panel-${definition.id}`);
      const layout = panel?.querySelector(':scope > .game-layout');
      if (layout && !panel.querySelector(':scope > .deck-care-strip')) panel.insertBefore(buildStrip(definition), layout);
    });
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    document.querySelectorAll('#arcade-tabs .tab-btn').forEach(tab => tab.addEventListener('click', releaseAll, { capture: true }));
    window.DeckCare = { definitions: DECK_CARE_TABS, releaseAll };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
