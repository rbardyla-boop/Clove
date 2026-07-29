document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('feedbackForm');
  const status = document.getElementById('feedbackStatus');
  if (!form || !status) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    const data = new FormData(form);
    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch('/__clove/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: String(data.get('category')),
          note: String(data.get('note')).trim(),
          surface: 'feedback',
          device: innerWidth <= 600 ? 'phone' : innerWidth <= 1024 ? 'tablet' : 'desktop',
          diagnostic: 'none',
          company: String(data.get('company') || ''),
        }),
      });
      if (!response.ok) throw new Error('send_failed');
      form.reset();
      status.textContent = 'Sent. Thank you—it reached the builder.';
    } catch {
      status.textContent = 'It did not send. Please try again in a moment.';
    } finally {
      button.disabled = false;
    }
  });
});
