/**
 * BaseCard.js
 * Base class for all Comm Dashboard cards
 */

(function () {
  'use strict';

  if (!window.CommDashboard) {
    console.error('[BaseCard] CommDashboard namespace not found.');
    return;
  }

  const { Events, Storage, Layout } = window.CommDashboard;

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  class BaseCard {
    constructor(config = {}) {
      this.id = config.id || 'comm-card-unknown';
      this.title = config.title || 'Card';
      this.metaId = config.metaId || null;
      this.bodyId = config.bodyId || `${this.id.replace('comm-card-', 'comm-')}-body`;
      this.element = null;
      this.bodyElement = null;
      this.metaElement = null;
      this.isInitialized = false;
      this.isVisible = true;
      this._intervals = [];
      this._timeouts = [];
      this._eventUnsubscribers = [];
    }

    init() {
      this.element = document.getElementById(this.id);
      this.bodyElement = document.getElementById(this.bodyId);
      this.metaElement = this.metaId ? document.getElementById(this.metaId) : null;
      if (!this.element) {
        console.warn(`[${this.constructor.name}] Element #${this.id} not found`);
        return;
      }
      this.isInitialized = true;
      this.render();
      console.log(`[${this.constructor.name}] Initialized`);
    }

    renderBody() {
      return '<p class="comm-placeholder">Card content will appear here.</p>';
    }

    getMetaText() {
      return '';
    }

    render() {
      if (!this.isInitialized || !this.bodyElement) return;
      this.bodyElement.innerHTML = this.renderBody();
      if (this.metaElement) {
        this.metaElement.innerHTML = this.getMetaText();
      }
      this.afterRender();
      this.updateRowSpan();
    }

    afterRender() {}

    $(selector) {
      return this.element ? this.element.querySelector(selector) : null;
    }

    $$(selector) {
      return this.element ? this.element.querySelectorAll(selector) : [];
    }

    updateStatus(text) {
      if (this.metaElement) {
        this.metaElement.innerHTML = text;
      }
    }

    updateRowSpan() {
      if (!this.element) return;
      requestAnimationFrame(() => {
        if (Layout && Layout.updateCardSpan) {
          Layout.updateCardSpan(this.element);
        }
      });
    }

    setVisible(visible) {
      this.isVisible = visible;
      if (this.element) {
        this.element.classList.toggle('comm-hidden', !visible);
      }
    }

    subscribe(eventName, callback) {
      const unsubscribe = Events.on(eventName, callback);
      this._eventUnsubscribers.push(unsubscribe);
      return unsubscribe;
    }

    setInterval(callback, ms) {
      const id = setInterval(callback, ms);
      this._intervals.push(id);
      return id;
    }

    setTimeout(callback, ms) {
      const id = setTimeout(callback, ms);
      this._timeouts.push(id);
      return id;
    }

    destroy() {
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];
      this._eventUnsubscribers.forEach(unsub => unsub());
      this._eventUnsubscribers = [];
      this.isInitialized = false;
    }
  }

  window.CommDashboard.BaseCard = BaseCard;
  window.CommDashboard.escapeHtml = escapeHtml;
})();
