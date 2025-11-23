/**
 * single-view-controls.js - Compact video controls for single view
 * Matches grid-pro.js styling with audio and fullscreen buttons
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.SingleViewControls = (function() {
  'use strict';

  let isMuted = true; // Start muted for autoplay

  function createControlBar() {
    const videoCard = document.querySelector('.single-video-card');
    if (!videoCard) return;

    // Check if control bar already exists
    if (document.getElementById('single-control-bar')) return;

    const videoPlayer = document.getElementById('single-player-hls');
    if (!videoPlayer) return;

    // Create control bar (matches grid-pro header style)
    const controlBar = document.createElement('div');
    controlBar.id = 'single-control-bar';
    controlBar.className = 'single-control-bar';
    controlBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px 8px 0 0;
      gap: 0.75rem;
    `;

    // Left: Audio button (matches grid-pro audio button)
    const audioBtn = document.createElement('button');
    audioBtn.id = 'single-audio-btn';
    audioBtn.className = 'single-audio-btn';
    audioBtn.innerHTML = '🔇';
    audioBtn.title = 'Click for audio (or press M)';
    audioBtn.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.26);
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 1.1rem;
      cursor: pointer;
      transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.12s ease, border-color 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 36px;
      color: #fff;
    `;

    audioBtn.addEventListener('click', toggleMute);
    audioBtn.addEventListener('mouseenter', () => {
      audioBtn.style.background = 'linear-gradient(90deg, rgba(255,80,0,0.25), rgba(255,150,0,0.25))';
      audioBtn.style.boxShadow = '0 0 8px rgba(255,120,0,0.6), 0 0 12px rgba(255,80,0,0.4)';
      audioBtn.style.transform = 'translateY(-1px)';
    });
    audioBtn.addEventListener('mouseleave', () => {
      audioBtn.style.background = 'rgba(0, 0, 0, 0.7)';
      audioBtn.style.boxShadow = 'none';
      audioBtn.style.transform = 'translateY(0)';
    });

    // Center: Channel info
    const channelInfo = document.createElement('div');
    channelInfo.id = 'single-channel-info';
    channelInfo.style.cssText = `
      flex: 1;
      text-align: center;
      font-size: 0.9rem;
      font-weight: 500;
      opacity: 0.9;
      user-select: none;
    `;
    channelInfo.textContent = 'Loading...';

    // Right: Fullscreen button (matches grid-pro focus button style)
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'single-fullscreen-btn';
    fullscreenBtn.className = 'single-fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = 'Fullscreen (or press F)';
    fullscreenBtn.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.26);
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 1.1rem;
      cursor: pointer;
      transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.12s ease, border-color 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 36px;
      color: #fff;
    `;

    fullscreenBtn.addEventListener('click', toggleFullscreen);
    fullscreenBtn.addEventListener('mouseenter', () => {
      fullscreenBtn.style.background = 'linear-gradient(90deg, rgba(255,80,0,0.25), rgba(255,150,0,0.25))';
      fullscreenBtn.style.boxShadow = '0 0 8px rgba(255,120,0,0.6), 0 0 12px rgba(255,80,0,0.4)';
      fullscreenBtn.style.transform = 'translateY(-1px)';
    });
    fullscreenBtn.addEventListener('mouseleave', () => {
      fullscreenBtn.style.background = 'rgba(0, 0, 0, 0.7)';
      fullscreenBtn.style.boxShadow = 'none';
      fullscreenBtn.style.transform = 'translateY(0)';
    });

    // Assemble control bar
    controlBar.appendChild(audioBtn);
    controlBar.appendChild(channelInfo);
    controlBar.appendChild(fullscreenBtn);

    // Insert before video player
    videoPlayer.parentNode.insertBefore(controlBar, videoPlayer);

    // Update video border radius (remove top corners since control bar has them)
    videoPlayer.style.borderRadius = '0 0 12px 12px';

    console.log('✅ Single view control bar created');
    
    // Update channel info when channel changes
    updateChannelInfo();
  }

  function updateChannelInfo() {
    const channelInfo = document.getElementById('single-channel-info');
    if (!channelInfo) return;

    // Get current channel from SinglePlayer
    const currentChannel = window.RussellTV?.SinglePlayer?.getCurrentChannel();
    if (currentChannel && window.CHANNELS && window.CHANNELS[currentChannel]) {
      channelInfo.textContent = window.CHANNELS[currentChannel].label;
    } else {
      channelInfo.textContent = 'Select a channel';
    }
  }

  function updateAudioButton() {
    const audioBtn = document.getElementById('single-audio-btn');
    if (!audioBtn) return;

    if (isMuted) {
      audioBtn.innerHTML = '🔇';
      audioBtn.title = 'Click for audio (or press M)';
      audioBtn.style.background = 'rgba(0, 0, 0, 0.7)';
      audioBtn.style.boxShadow = 'none';
      audioBtn.style.borderColor = 'rgba(255, 255, 255, 0.26)';
    } else {
      audioBtn.innerHTML = '🔊';
      audioBtn.title = 'Mute audio (or press M)';
      // Active state - fiery glow
      audioBtn.style.background = 'linear-gradient(90deg, rgba(255,80,0,0.4), rgba(255,150,0,0.4))';
      audioBtn.style.boxShadow = '0 0 10px rgba(255,120,0,0.8), 0 0 14px rgba(255,80,0,0.6)';
      audioBtn.style.borderColor = 'rgba(255,180,0,0.9)';
    }
  }

  function toggleMute() {
    const video = document.getElementById('single-player-hls');
    if (!video) return;

    isMuted = !isMuted;
    video.muted = isMuted;

    updateAudioButton();

    console.log('🔊 Single view:', isMuted ? 'Muted' : 'Unmuted');
  }

  function toggleFullscreen() {
    const video = document.getElementById('single-player-hls');
    if (!video) return;

    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (video.requestFullscreen) {
        video.requestFullscreen();
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
      } else if (video.mozRequestFullScreen) {
        video.mozRequestFullScreen();
      } else if (video.msRequestFullscreen) {
        video.msRequestFullscreen();
      }
      console.log('📺 Entering fullscreen');
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      console.log('📺 Exiting fullscreen');
    }
  }

  function getMuteState() {
    return isMuted;
  }

  function setMuteState(muted) {
    isMuted = muted;
    const video = document.getElementById('single-player-hls');
    if (video) {
      video.muted = isMuted;
    }
    updateAudioButton();
  }

  // Initialize when single view is shown
  function init() {
    // Create control bar on load
    window.addEventListener('load', () => {
      setTimeout(createControlBar, 500);
    });

    // Watch for channel changes to update label
    // Hook into channel button clicks
    document.addEventListener('click', (e) => {
      if (e.target.dataset.channelKey || e.target.closest('[data-channel-key]')) {
        setTimeout(updateChannelInfo, 500);
      }
    });
  }

  // Public API
  return {
    init,
    toggleMute,
    toggleFullscreen,
    getMuteState,
    setMuteState,
    createControlBar,
    updateChannelInfo
  };
})();

// Initialize
window.RussellTV.SingleViewControls.init();
