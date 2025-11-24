/**
 * keyboard-av-controls.js - Keyboard shortcuts for audio/video
 * M = Mute/Unmute (single view, or grid-global in grid view)
 * F = Fullscreen (single view only)
 */

(function() {
  'use strict';

  console.log('⌨️ Keyboard A/V controls loading...');

  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input fields
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'SELECT') {
      return;
    }

    const singleView = document.getElementById('single-view');
    const gridView = document.getElementById('grid-view');
    const inSingleView = singleView && singleView.style.display !== 'none';
    const inGridView = gridView && gridView.style.display !== 'none';

    // M key for mute/unmute
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();

      if (inSingleView) {
        // Single view - toggle mute via controls module
        if (window.RussellTV && window.RussellTV.SingleViewControls) {
          window.RussellTV.SingleViewControls.toggleMute();
          console.log('⌨️ M pressed - toggled single view mute');
        } else {
          // Fallback
          const video = document.getElementById('single-player-hls');
          if (video) {
            video.muted = !video.muted;
            console.log('⌨️ M pressed - toggled video mute (fallback)');
          }
        }
      } else if (inGridView) {
        // Grid view - use GridAudio API to toggle global mute for all grid cells
        if (window.RussellTV && window.RussellTV.GridAudio && window.RussellTV.GridAudio.toggleMuteAll) {
          window.RussellTV.GridAudio.toggleMuteAll();
          const state = window.RussellTV.GridAudio.getState
            ? window.RussellTV.GridAudio.getState()
            : null;
          console.log('⌨️ M pressed in grid - toggled global grid mute', state);
          showNotification(state && !state.allMuted
            ? 'Grid audio: ON (use 🔊 buttons or M to mute all)'
            : 'Grid audio: ALL MUTED');
        } else {
          console.log('⌨️ M pressed in grid - GridAudio API not available');
          showNotification('Audio controls not ready yet');
        }
      }
    }

    // F key for fullscreen (single view only)
    if (e.key === 'f' || e.key === 'F') {
      if (inSingleView) {
        e.preventDefault();
        
        if (window.RussellTV && window.RussellTV.SingleViewControls) {
          window.RussellTV.SingleViewControls.toggleFullscreen();
          console.log('⌨️ F pressed - toggled fullscreen');
        } else {
          // Fallback
          const video = document.getElementById('single-player-hls');
          if (video) {
            if (!document.fullscreenElement) {
              video.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
            console.log('⌨️ F pressed - toggled fullscreen (fallback)');
          }
        }
      }
      // Note: Grid view uses F for focus mode via grid-pro, so we don't interfere
    }
  });

  // Simple notification function
  function showNotification(message) {
    let notification = document.getElementById('av-keyboard-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'av-keyboard-notification';
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 999px;
        font-size: 0.9rem;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        border: 1px solid rgba(255, 180, 0, 0.5);
        box-shadow: 0 0 10px rgba(255, 120, 0, 0.8);
      `;
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);

    // Fade out after 2.5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
    }, 2500);
  }

  console.log('✅ Keyboard A/V controls loaded');
  console.log('   M = Mute/Unmute (single or grid-global)');
  console.log('   F = Fullscreen (single view)');
})();
