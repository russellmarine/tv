/**
 * BaseCard.js
 * Base class for all Comm Dashboard cards
 * Provides common functionality: rendering, events, lifecycle management
 */

(function () {
  'use strict';

  // Ensure CommDashboard namespace exists
  if (!window.CommDashboard) {
    console.error('[BaseCard] CommDashboard namespace not found. Ensure comm-core.js loads first.');
    return;
  }

  const { Events, Storage, Layout } = window.CommDashboard;

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * BaseCard Class
   * All dashboard cards should extend this class
   */
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

      // Store intervals/timeouts for cleanup
      this._intervals = [];
      this._timeouts = [];
      this._eventUnsubscribers = [];
    }

    /**
     * Initialize the card - call after DOM is ready
     */
    init() {
      this.element = document.getElementById(this.id);
      this.bodyElement = document.getElementById(this.bodyId);
      this.metaElement = this.metaId ? document.getElementById(this.metaId) : null;

      if (!this.element) {
        console.warn(`[${this.constructor.name}] Element #${this.id} not found`);
        return;
      }

      if (!this.bodyElement) {
        console.warn(`[${this.constructor.name}] Body element #${this.bodyId} not found`);
      }

      this.isInitialized = true;
      this.render();

      console.log(`[${this.constructor.name}] Initialized`);
    }

    /**
     * Render the card body - override in subclass
     */
    renderBody() {
      return '<p class="comm-placeholder">Card content will appear here.</p>';
    }

    /**
     * Render meta/status area - override in subclass
     */
    getMetaText() {
      return '';
    }

    /**
     * Full render cycle
     */
    render() {
      if (!this.isInitialized || !this.bodyElement) return;

      const html = this.renderBody();
      this.bodyElement.innerHTML = html;

      if (this.metaElement) {
        this.metaElement.innerHTML = this.getMetaText();
      }

      this.afterRender();
      this.updateRowSpan();
    }

    /**
     * Called after render - override for event binding
     */
    afterRender() {
      // Override in subclass
    }

    /**
     * Update masonry row span based on content height
     */
    updateRowSpan() {
      if (!this.element) return;

      requestAnimationFrame(() => {
        if (Layout && Layout.updateCardSpan) {
          Layout.updateCardSpan(this.element);
        }
      });
    }

    /**
     * Show/hide the card
     */
    setVisible(visible) {
      this.isVisible = visible;
      if (this.element) {
        this.element.classList.toggle('comm-hidden', !visible);
      }
    }

    /**
     * Subscribe to an event with auto-cleanup
     */
    subscribe(eventName, callback) {
      const unsubscribe = Events.on(eventName, callback);
      this._eventUnsubscribers.push(unsubscribe);
      return unsubscribe;
    }

    /**
     * Set interval with auto-cleanup
     */
    setInterval(callback, ms) {
      const id = setInterval(callback, ms);
      this._intervals.push(id);
      return id;
    }

    /**
     * Set timeout with auto-cleanup
     */
    setTimeout(callback, ms) {
      const id = setTimeout(callback, ms);
      this._timeouts.push(id);
      return id;
    }

    /**
     * Cleanup - call when card is destroyed
     */
    destroy() {
      // Clear intervals
      this._intervals.forEach(id => clearInterval(id));
      this._intervals = [];

      // Clear timeouts
      this._timeouts.forEach(id => clearTimeout(id));
      this._timeouts = [];

      // Unsubscribe from events
      this._eventUnsubscribers.forEach(unsub => unsub());
      this._eventUnsubscribers = [];

      this.isInitialized = false;
      console.log(`[${this.constructor.name}] Destroyed`);
    }
  }

  // Export to namespace
  window.CommDashboard.BaseCard = BaseCard;
  window.CommDashboard.escapeHtml = escapeHtml;

})();
