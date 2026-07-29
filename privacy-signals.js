document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('privacyToggle');
  const status = document.getElementById('privacyStatus');
  if (!button || !window.cloveSignal) return;
  function render() {
    const off = window.cloveSignal.isDisabled();
    button.textContent = off ? 'Turn aggregate signals on' : 'Turn aggregate signals off';
    status.textContent = off
      ? 'Aggregate signals are off in this browser.'
      : 'Aggregate signals are on. No user profile or identifier is created.';
  }
  button.addEventListener('click', () => {
    if (window.cloveSignal.isDisabled()) window.cloveSignal.optIn();
    else window.cloveSignal.optOut();
    render();
  });
  render();
});
