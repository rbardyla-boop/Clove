(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  async function sha256(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function initHashLab() {
    const input = $('#hash-input');
    const run = $('#hash-run');
    const originalOutput = $('#hash-original');
    const alteredOutput = $('#hash-altered');
    if (!input || !run || !originalOutput || !alteredOutput) return;

    const update = async () => {
      const original = input.value;
      const altered = original.length ? `${original.slice(0, -1)}${original.at(-1) === 'X' ? 'Y' : 'X'}` : 'X';
      originalOutput.textContent = await sha256(original);
      alteredOutput.textContent = await sha256(altered);
    };

    run.addEventListener('click', update);
    input.addEventListener('input', update);
    await update();
  }

  async function initBrokenChain() {
    const editor = $('#block-editor');
    const note = $('#chain-note');
    if (!editor || !note) return;

    const blocks = [
      { name: 'Block 1', data: 'Fictional deed: Ada records 10 town tokens.' },
      { name: 'Block 2', data: 'Fictional deed: Bo sends 3 town tokens to Cora.' },
      { name: 'Block 3', data: 'Fictional deed: Cora records a workshop receipt.' },
    ];
    const committedHashes = [];
    let previous = 'GENESIS-FICTIONAL-0000';
    for (const block of blocks) {
      const hash = await sha256(`${previous}|${block.data}`);
      committedHashes.push(hash);
      previous = hash;
    }

    const render = async () => {
      let chainPrevious = 'GENESIS-FICTIONAL-0000';
      const currentHashes = [];
      for (const block of blocks) {
        currentHashes.push(await sha256(`${chainPrevious}|${block.data}`));
        chainPrevious = currentHashes.at(-1);
      }
      editor.innerHTML = blocks.map((block, index) => {
        const valid = currentHashes[index] === committedHashes[index];
        const previousHash = index ? currentHashes[index - 1] : 'GENESIS-FICTIONAL-0000';
        return `<article class="block-card${valid ? '' : ' is-invalid'}">
          <h4>${escapeHtml(block.name)}</h4>
          <label for="block-data-${index}">Fictional block data</label>
          <textarea id="block-data-${index}" data-block-index="${index}">${escapeHtml(block.data)}</textarea>
          <div class="block-meta"><span>Previous link</span><code>${escapeHtml(previousHash.slice(0, 18))}…</code><span>Committed hash</span><code>${escapeHtml(committedHashes[index].slice(0, 18))}…</code><span>Replay hash</span><code>${escapeHtml(currentHashes[index].slice(0, 18))}…</code></div>
          <span class="block-status">${valid ? 'LINK VALID' : 'LINK INVALID'}</span>
        </article>`;
      }).join('');
      $$('textarea[data-block-index]', editor).forEach((textarea) => {
        textarea.addEventListener('input', (event) => {
          blocks[Number(event.currentTarget.dataset.blockIndex)].data = event.currentTarget.value;
          render();
        });
      });
      const invalidCount = currentHashes.filter((hash, index) => hash !== committedHashes[index]).length;
      note.textContent = invalidCount ? `${invalidCount} link${invalidCount === 1 ? '' : 's'} invalidated. Later blocks cannot silently keep the old history.` : 'The fictional chain is intact.';
    };

    await render();
  }

  const sendFlows = {
    bitcoin: {
      note: 'Bitcoin-shaped example: a wallet signs a transaction spending selected UTXOs; nodes validate it before a miner proposes a block.',
      steps: [
        ['Wallet', 'constructs transaction'], ['Sign', 'key authorizes it'], ['Broadcast', 'peers receive it'], ['Validate', 'rules are checked'], ['Block', 'miner proposes it'], ['Confirm', 'more work supports history']
      ]
    },
    ethereum: {
      note: 'Ethereum-shaped example: a wallet signs a state-changing request; nodes execute and validate it before validators propose, attest to, and finalize blocks.',
      steps: [
        ['Wallet', 'constructs request'], ['Sign', 'key authorizes it'], ['Broadcast', 'peers receive it'], ['Execute', 'state transition runs'], ['Block', 'validator proposes it'], ['Finalize', 'consensus strengthens state']
      ]
    }
  };

  function initPressSend() {
    const flow = $('#send-flow');
    const note = $('#send-note');
    if (!flow || !note) return;
    const render = (network) => {
      const selected = sendFlows[network];
      flow.innerHTML = selected.steps.map((step, index) => `<div class="send-step${index === 0 ? ' is-current' : ''}" tabindex="0"><strong>${escapeHtml(step[0])}</strong><small>${escapeHtml(step[1])}</small></div>`).join('');
      note.textContent = selected.note;
    };
    $$('[data-network]').forEach((button) => button.addEventListener('click', () => {
      $$('[data-network]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
      render(button.dataset.network);
    }));
    render('bitcoin');
  }

  const trustModels = {
    self: ['Self-custody', 'You control the signing material and recovery process.', 'Key risk: loss, theft, phishing, or an irrecoverable backup mistake. The network does not know whether you are the rightful human.'],
    exchange: ['Exchange custody', 'A custodian controls the signing process while you hold an account relationship.', 'Counterparty risk: access controls, operational failure, insolvency, withdrawal limits, and the custodian’s internal records.'],
    stablecoin: ['Stablecoin', 'A token transfer may be decentralised while redemption depends on an issuer, reserve, or collateral design.', 'Issuer, reserve, custody, liquidity, legal-claim, governance, and de-pegging assumptions sit beside the transfer mechanics.'],
    contract: ['Smart contract', 'Deterministic code changes state when a transaction triggers it.', 'Code bugs, upgrade keys, oracle inputs, admin powers, governance, and user-interface deception can all matter.'],
    bridge: ['Bridge', 'A bridge represents or acts on an event from another network.', 'The proof system, relayers, validators, custody model, upgrade path, and withdrawal assumptions add a new trust surface.'],
    l2: ['Layer 2', 'A Layer 2 moves some execution, ordering, or batching away from the base layer.', 'Sequencer availability, data availability, settlement rules, upgrade keys, and withdrawal paths become part of the model.'],
    deposit: ['Tokenised bank deposit', 'A regulated bank claim may be represented as a token on programmable infrastructure.', 'The bank, legal claim, reserve/settlement arrangement, compliance rules, platform, and redemption process still matter.'],
  };

  function initTrustMap() {
    const detail = $('#trust-detail');
    if (!detail) return;
    const render = (key) => {
      const [title, description, risk] = trustModels[key];
      detail.innerHTML = `<h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p><p><strong>Additional assumptions:</strong> ${escapeHtml(risk)}</p>`;
    };
    $$('[data-trust]').forEach((button) => button.addEventListener('click', () => {
      $$('[data-trust]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
      render(button.dataset.trust);
    }));
    render('self');
  }

  function initMessageExplorer() {
    const input = $('#payment-sentence');
    const run = $('#message-run');
    const human = $('#message-human');
    const output = $('#message-json');
    if (!input || !run || !human || !output) return;
    const render = () => {
      const sentence = input.value.trim() || 'Send Bob 500 Canadian dollars for the workshop';
      const match = sentence.match(/^send\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(.+?)(?:\s+for\s+(.+))?$/i);
      const record = match ? {
        messageType: 'simplified-payment-instruction',
        debtor: 'Fictional sender',
        creditor: match[1],
        amount: match[2],
        currencyOrUnit: match[3],
        remittanceInformation: match[4] || 'Fictional learning example',
      } : {
        messageType: 'simplified-payment-instruction',
        humanInstruction: sentence,
        note: 'Toy structure: fields are illustrative, not a validated financial message.',
      };
      human.textContent = sentence;
      output.textContent = JSON.stringify(record, null, 2);
    };
    run.addEventListener('click', render);
    input.addEventListener('input', render);
    render();
  }

  const settlementModels = {
    sequential: {
      steps: [['Message', 'instruction travels'], ['Checks', 'compliance and reconciliation'], ['Correspondent', 'account updates'], ['Settlement', 'obligation is discharged'], ['Reconcile', 'records are matched']],
      note: 'Sequential systems can involve messages, checks, correspondent updates, settlement, and reconciliation in separate steps.'
    },
    atomic: {
      steps: [['Conditions', 'rules are evaluated'], ['Reserve', 'fictional balances lock'], ['Match', 'legs are ready together'], ['Settle', 'all legs change atomically'], ['Record', 'shared state updates']],
      note: 'An atomic model attempts to make linked legs settle together or not settle, but governance, legal claims, platform design, and operational risks remain.'
    }
  };

  function initTokenisationDemo() {
    const steps = $('#settlement-steps');
    const note = $('#settlement-note');
    if (!steps || !note) return;
    const render = (model) => {
      const selected = settlementModels[model];
      steps.innerHTML = selected.steps.map((step, index) => `<div class="settlement-step${model === 'atomic' ? ' is-atomic' : ''}"><strong>${escapeHtml(step[0])}</strong><small>${escapeHtml(step[1])}</small></div>`).join('');
      note.textContent = selected.note;
    };
    $$('[data-settlement]').forEach((button) => button.addEventListener('click', () => {
      $$('[data-settlement]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
      render(button.dataset.settlement);
    }));
    render('sequential');
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHashLab();
    initBrokenChain();
    initPressSend();
    initTrustMap();
    initMessageExplorer();
    initTokenisationDemo();
  });
})();
