(function() {
  'use strict';

  console.log('✅ [GunnyChat] module loaded');

  const API_BASE = '/api';

  let panelEl = null;
  let messagesEl = null;
  let inputEl = null;
  let formEl = null;
  let statusEl = null;
  let typingEl = null;
  let isOpen = false;

  // ---------- Styles ----------
  function injectStyles() {
    if (document.getElementById('gunny-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'gunny-chat-styles';
    style.textContent = `
      .gunny-chat-panel {
        position: fixed;
        bottom: 3.2rem;
        right: 1rem;
        width: 420px;
        height: 420px;
        background: rgba(0,0,0,0.95);
        color: #f5f5f5;
        border-radius: 12px;
        border: 1px solid rgba(255,120,0,0.6);
        box-shadow: 0 8px 24px rgba(0,0,0,0.8);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 9999;
        font-size: 0.85rem;
        resize: both;
        min-width: 320px;
        min-height: 260px;
      }
      .gunny-chat-panel.open {
        display: flex;
      }
      .gunny-chat-header {
        padding: 0.4rem 0.6rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: radial-gradient(circle at top left,
          rgba(255,120,0,0.4),
          rgba(0,0,0,0.95));
        border-bottom: 1px solid rgba(255,120,0,0.4);
        cursor: move;
        user-select: none;
      }
      .gunny-chat-title {
        font-weight: 600;
        font-size: 0.8rem;
      }
      .gunny-chat-close {
        background: transparent;
        border: none;
        color: #fff;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .gunny-chat-messages {
        padding: 0.5rem 0.6rem;
        flex: 1 1 auto;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        overscroll-behavior: contain;
        touch-action: pan-y;
      }
      .gunny-chat-msg {
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        max-width: 85%;
        line-height: 1.3;
        word-break: break-word;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .gunny-chat-msg-text {
        white-space: pre-wrap;
      }
      .gunny-chat-msg-meta {
        font-size: 0.65rem;
        opacity: 0.65;
        text-align: right;
      }
      .gunny-chat-msg.from-me {
        align-self: flex-end;
        background: rgba(255,140,0,0.85); /* 🔥 Marine-orange */
        color: #000;
        border: 1px solid rgba(255,180,60,0.9);
      }
      .gunny-chat-msg.from-gunny {
        align-self: flex-start;
        background: rgba(50,50,50,0.95); /* dark radio-chatter */
        color: #ff9d42; /* tactical amber text */
        border: 1px solid rgba(255,120,0,0.6);
      }
      .gunny-chat-msg.from-other {
        align-self: flex-start;
        background: rgba(80,80,80,0.9);
      }
      .gunny-chat-footer {
        border-top: 1px solid rgba(255,255,255,0.1);
        padding: 0.35rem 0.4rem 0.45rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .gunny-chat-status {
        min-height: 1.1em;
        font-size: 0.7rem;
        color: rgba(220,220,220,0.8);
      }
      .gunny-chat-status.error {
        color: #ff8080;
      }
      .gunny-chat-typing {
        min-height: 1.1em;
        font-size: 0.7rem;
        color: rgba(220,220,220,0.85);
        opacity: 0.9;
        display: none;
      }
      .gunny-chat-typing .dot {
        display: inline-block;
        animation: gunny-dots 1.2s infinite ease-in-out;
      }
      .gunny-chat-typing .dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      .gunny-chat-typing .dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes gunny-dots {
        0%, 20%   { opacity: 0.2; transform: translateY(0); }
        50%       { opacity: 1;   transform: translateY(-1px); }
        100%      { opacity: 0.2; transform: translateY(0); }
      }

      .gunny-chat-form {
        display: flex;
        gap: 0.35rem;
      }
      .gunny-chat-input {
        flex: 1 1 auto;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(0,0,0,0.7);
        color: #fff;
        padding: 0.25rem 0.6rem;
        font-size: 0.8rem;
      }
      .gunny-chat-input:focus {
        outline: none;
        border-color: rgba(255,120,0,0.85);
        box-shadow: 0 0 4px rgba(255,120,0,0.8);
      }
      .gunny-chat-send {
        border-radius: 999px;
        border: none;
        padding: 0.3rem 0.8rem;
        font-size: 0.8rem;
        cursor: pointer;
        background: linear-gradient(135deg, #ff8800, #ff4500);
        color: #000;
        font-weight: 600;
      }
      .gunny-chat-send:hover {
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- API helper ----------
  async function apiJson(path, options) {
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      ...options,
    });
    if (!res.ok) {
      let body;
      try { body = await res.text(); } catch { body = '<no body>'; }
      throw new Error('API ' + path + ' failed: ' + res.status + ' ' + body);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return {};
    return await res.json();
  }

  // ---------- Webex login ----------
  async function ensureLoggedIn() {
    try {
      const login = await apiJson('/webex/login');

      if (login && login.logged_in) {
        return true;
      }

      if (login && login.url) {
        setStatus('Redirecting to Webex login…', false);
        window.location.href = login.url;
        return false;
      }

      setStatus('Unable to start Webex login flow.', true);
      return false;
    } catch (err) {
      console.error('[GunnyChat] ensureLoggedIn error', err);
      setStatus('Webex auth check failed. Try again.', true);
      return false;
    }
  }

  // ---------- UI helpers ----------
  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('error', !!isError);
  }

  function clearStatus() {
    setStatus('');
  }

  function showTyping() {
    if (typingEl) typingEl.style.display = 'block';
  }

  function hideTyping() {
    if (typingEl) typingEl.style.display = 'none';
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateStr} ${timeStr}`;
  }

  function renderMessage(msg) {
    if (!messagesEl) return;

    const wrapper = document.createElement('div');
    const cls = msg.fromMe ? 'from-me'
              : msg.fromGunny ? 'from-gunny'
              : 'from-other';
    wrapper.className = 'gunny-chat-msg ' + cls;

    const textDiv = document.createElement('div');
    textDiv.className = 'gunny-chat-msg-text';
    textDiv.textContent = msg.text || '';

    const tsRaw = msg.timestamp || msg.ts || msg.createdAt || Date.now();
    const tsStr = formatTimestamp(tsRaw);

    wrapper.appendChild(textDiv);

    if (tsStr) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'gunny-chat-msg-meta';
      metaDiv.textContent = tsStr;
      wrapper.appendChild(metaDiv);
    }

    messagesEl.appendChild(wrapper);
  }

  // ---------- History ----------
  async function loadHistory() {
    try {
      setStatus('Loading history…');
      const data = await apiJson('/chat/history');
      messagesEl.innerHTML = '';
      const list = (data && data.messages) || [];
      for (const m of list) {
        renderMessage(m);
      }
      scrollToBottom();
      clearStatus();
    } catch (err) {
      console.error('[GunnyChat] history error', err);
      setStatus('Unable to load history. Try again, Devil Dog.', true);
    }
  }

  // ---------- Sending ----------
  async function onSend(e) {
    e.preventDefault();
    const text = (inputEl.value || '').trim();
    if (!text) return;

    // Local echo
    renderMessage({ text, fromMe: true, timestamp: Date.now() });
    scrollToBottom();
    inputEl.value = '';

    showTyping();

    try {
      const logged = await ensureLoggedIn();
      if (!logged) {
        hideTyping();
        return;
      }

      const resp = await apiJson('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (resp && resp.markdown) {
        renderMessage({
          text: resp.markdown,
          fromGunny: true,
          timestamp: resp.timestamp || Date.now(),
        });
        scrollToBottom();
      }

      clearStatus();
    } catch (err) {
      console.error('[GunnyChat] send error', err);
      setStatus('Send failed. Check Webex auth or try again.', true);
    } finally {
      hideTyping();
    }
  }

  // ---------- Drag handling ----------
  function makeDraggable(panel, handle) {
    if (!panel || !handle) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;

      const rect = panel.getBoundingClientRect();
      // Switch to top/left positioning when dragging
      panel.style.top = rect.top + 'px';
      panel.style.left = rect.left + 'px';
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';

      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = startLeft + dx + 'px';
      panel.style.top = startTop + dy + 'px';
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
  }

  // ---------- Panel ----------
  function ensurePanel() {
    if (panelEl) return;

    injectStyles();

    panelEl = document.getElementById('gunny-chat-container');
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'gunny-chat-container';
      panelEl.className = 'gunny-chat-panel';
      panelEl.innerHTML = `
        <div class="gunny-chat-header">
          <div class="gunny-chat-title">🔥 GunnyGPT · Comm Planner</div>
          <button class="gunny-chat-close" type="button" aria-label="Close Gunny chat">✕</button>
        </div>
        <div class="gunny-chat-messages"></div>
        <div class="gunny-chat-footer">
          <div class="gunny-chat-status"></div>
          <div class="gunny-chat-typing">
            GunnyGPT is thinking<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
          </div>
          <form class="gunny-chat-form">
            <input class="gunny-chat-input" type="text"
                   placeholder="Ask Gunny about your comm plan…"
                   autocomplete="off" />
            <button class="gunny-chat-send" type="submit">Send</button>
          </form>
        </div>
      `;
      document.body.appendChild(panelEl);
    }

    messagesEl = panelEl.querySelector('.gunny-chat-messages');
    inputEl    = panelEl.querySelector('.gunny-chat-input');
    formEl     = panelEl.querySelector('.gunny-chat-form');
    statusEl   = panelEl.querySelector('.gunny-chat-status');
    typingEl   = panelEl.querySelector('.gunny-chat-typing');

    const closeBtn = panelEl.querySelector('.gunny-chat-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closePanel();
      });
    }

    if (formEl) {
      formEl.addEventListener('submit', onSend);
    }

    const headerEl = panelEl.querySelector('.gunny-chat-header');
    makeDraggable(panelEl, headerEl);

    console.log('✅ [GunnyChat] panel initialized');
  }

  async function openPanel() {
    ensurePanel();
    panelEl.classList.add('open');
    isOpen = true;

    try {
      const logged = await ensureLoggedIn();
      if (!logged) return;
      await loadHistory();
    } catch (err) {
      console.error('[GunnyChat] open error', err);
      setStatus('Auth or API error talking to Gunny.', true);
    }
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    isOpen = false;
  }

  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // ---------- Export globals ----------
  window.RussellTV = window.RussellTV || {};
  window.RussellTV.GunnyChat = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    isOpen: function() { return !!isOpen; },
  };

  window.GunnyChat = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    isOpen: function() { return !!isOpen; },
  };

  console.log('✅ [GunnyChat] globals ready (window.GunnyChat + RussellTV.GunnyChat)');
})();
