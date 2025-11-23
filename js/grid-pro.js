// ========================================
// GRID-PRO DROPDOWN COMPATIBILITY PATCH
// This hooks grid-pro's custom dropdowns to the modular GridPlayer
// ========================================

(function() {
  'use strict';
  
  console.log('🔧 Grid-Pro Compatibility Patch Loading...');
  
  // Wait for DOM and modules to be ready
  function initCompatibility() {
    // Make sure the modular GridPlayer is available
    if (!window.RussellTV || !window.RussellTV.GridPlayer) {
      console.log('⏳ Waiting for GridPlayer module...');
      setTimeout(initCompatibility, 100);
      return;
    }
    
    console.log('✅ GridPlayer module found');
    
    // Create the global playGridCell wrapper if needed
    if (!window.playGridCell) {
      window.playGridCell = function(cell, channelKey) {
        console.log('📺 playGridCell called:', cell, channelKey);
        if (window.RussellTV && window.RussellTV.GridPlayer) {
          window.RussellTV.GridPlayer.playCell(cell, channelKey);
        } else {
          console.error('❌ GridPlayer not available');
        }
      };
      console.log('✅ playGridCell wrapper created');
    }
    
    // Patch UIControls.buildGrid to do nothing (grid-pro builds the grid)
    if (window.RussellTV && window.RussellTV.UIControls) {
      window.RussellTV.UIControls.buildGrid = function() {
        console.log('✅ Grid building delegated to grid-pro.js');
        // Don't build - grid-pro handles this
      };
      console.log('✅ UIControls.buildGrid patched');
    }
    
    // Hook into grid-pro's channel selection
    // Wait a bit for grid-pro to build its UI, then attach listeners
    setTimeout(function() {
      attachDropdownListeners();
    }, 500);
  }
  
  function attachDropdownListeners() {
    const channelOptions = document.querySelectorAll('.channel-option');
    
    if (channelOptions.length === 0) {
      console.log('⏳ No channel options found yet, retrying...');
      setTimeout(attachDropdownListeners, 500);
      return;
    }
    
    console.log(`🎯 Found ${channelOptions.length} channel options, attaching listeners...`);
    
    channelOptions.forEach(option => {
      // Remove any existing listeners (if this runs multiple times)
      const newOption = option.cloneNode(true);
      option.parentNode.replaceChild(newOption, option);
      
      // Add new listener
      newOption.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const channelKey = this.getAttribute('data-channel');
        
        // Find which cell this belongs to
        const cellElement = this.closest('[data-cell]');
        const cellNum = cellElement ? parseInt(cellElement.getAttribute('data-cell'), 10) : null;
        
        if (cellNum && channelKey) {
          console.log(`🎬 Channel option clicked: Cell ${cellNum} → ${channelKey}`);
          
          // Call the modular player
          if (window.RussellTV && window.RussellTV.GridPlayer) {
            window.RussellTV.GridPlayer.playCell(cellNum, channelKey);
            
            // Update the button label
            const btn = cellElement.querySelector('.channel-selector-btn');
            if (btn && window.CHANNELS && window.CHANNELS[channelKey]) {
              btn.textContent = window.CHANNELS[channelKey].label;
            }
            
            // Close the dropdown
            const dropdown = this.closest('.channel-dropdown');
            if (dropdown) {
              dropdown.style.display = 'none';
            }
          } else {
            console.error('❌ GridPlayer not available when option clicked');
          }
        } else {
          console.warn('⚠️ Could not determine cell or channel:', cellNum, channelKey);
        }
      });
    });
    
    console.log('✅ All channel dropdown listeners attached!');
  }
  
  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompatibility);
  } else {
    initCompatibility();
  }
  
  // Also re-attach listeners when grid is rebuilt (layout changes)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        // Check if grid cells were added
        const hasGridCells = Array.from(mutation.addedNodes).some(node => 
          node.classList && node.classList.contains('grid-cell-pro')
        );
        if (hasGridCells) {
          console.log('🔄 Grid rebuilt detected, re-attaching listeners...');
          setTimeout(attachDropdownListeners, 200);
        }
      }
    });
  });
  
  // Start observing
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener('load', function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  
  console.log('✅ Grid-Pro Compatibility Patch loaded');
})();

// ========================================
// END COMPATIBILITY PATCH
// Your original grid-pro.js code continues below...
// ========================================

(function() {
    'use strict';

    // Grid configuration
    const GRID_LAYOUTS = {
        '1x2': { rows: 1, cols: 2, cells: 2, label: '2 Wide' },
        '2x2': { rows: 2, cols: 2, cells: 4, label: '4 Square' },
        '1x3': { rows: 1, cols: 3, cells: 3, label: '3 Wide' },
        '2x3': { rows: 2, cols: 3, cells: 6, label: '6 Grid' },
        '1x4': { rows: 1, cols: 4, cells: 4, label: '4 Wide' }
    };

    let currentLayout = '2x2';
    let focusedCell = null;
    let audioCell = 1; // Which cell has audio active
    let allMuted = true; // Start with everything muted

    // Replace the grid button with a dropdown version
    function replaceGridButton() {
        const gridBtn = document.getElementById('btn-grid');
        if (!gridBtn) return;

        // Create container for button + dropdown
        const container = document.createElement('div');
        container.className = 'grid-btn-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        // Create the main button
        const mainBtn = document.createElement('button');
        mainBtn.id = 'btn-grid-main';
        mainBtn.className = 'btn';
        const config = GRID_LAYOUTS[currentLayout];
        mainBtn.textContent = `Grid: ${config.label}`;
        
        // Create dropdown arrow button
        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'btn grid-dropdown-toggle';
        dropdownBtn.innerHTML = '▼';
        dropdownBtn.style.padding = '0.35rem 0.5rem';
        dropdownBtn.style.marginLeft = '-1px';

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'grid-layout-dropdown';

        Object.entries(GRID_LAYOUTS).forEach(([key, config]) => {
            const option = document.createElement('div');
            option.className = 'grid-layout-option';
            option.textContent = config.label;
            option.dataset.layout = key;
            
            if (key === currentLayout) {
                option.classList.add('active');
            }
            
            option.onclick = () => {
                // First, switch to grid view if not already there
                const gridView = document.getElementById('grid-view');
                if (gridView && gridView.style.display === 'none') {
                    if (window.enterGridMode) {
                        window.enterGridMode();
                    }
                }
                
                // Then change the layout
                changeLayout(key);
                dropdown.classList.remove('show');
                mainBtn.textContent = `Grid: ${config.label}`;
                
                // Update active state
                dropdown.querySelectorAll('.grid-layout-option').forEach(o => {
                    o.classList.remove('active');
                });
                option.classList.add('active');
            };
            
            dropdown.appendChild(option);
        });

        // Toggle dropdown
        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };

        // Main button enters grid mode
        mainBtn.onclick = () => {
            if (window.enterGridMode) {
                window.enterGridMode();
            }
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });

        container.appendChild(mainBtn);
        container.appendChild(dropdownBtn);
        container.appendChild(dropdown);

        // Replace the old button
        gridBtn.parentNode.replaceChild(container, gridBtn);
    }

    // Change grid layout
    function changeLayout(layoutKey) {
        if (!GRID_LAYOUTS[layoutKey]) return;
        
        currentLayout = layoutKey;
        const config = GRID_LAYOUTS[layoutKey];
        
        focusedCell = null; // Reset focus when changing layouts
        
        rebuildGrid(config);
        
        // Save layout preference
        try {
            localStorage.setItem('russelltv.gridLayout', layoutKey);
        } catch (e) {}
    }

    // Rebuild grid with new layout
    function rebuildGrid(config) {
        const wrapper = document.querySelector('#grid-view .grid-wrapper');
        if (!wrapper) return;

        // Stop all current streams
        stopAllGridCells();

        // Set data attribute for CSS sizing
        wrapper.setAttribute('data-layout', currentLayout);

        // Remove old grid styles
        wrapper.style.gridTemplateColumns = '';
        wrapper.style.gridTemplateRows = '';
        
        // Clear and rebuild cells
        wrapper.innerHTML = '';

        for (let cell = 1; cell <= config.cells; cell++) {
            const cellDiv = createGridCell(cell);
            wrapper.appendChild(cellDiv);
        }

        // Load channels immediately after DOM update
        setTimeout(() => loadDefaultChannelsForLayout(config.cells), 100);
    }

    // Create a professional grid cell
    function createGridCell(cellNum) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell-pro';
        cell.dataset.cell = cellNum;
        
        if (cellNum === audioCell) {
            cell.classList.add('audio-active');
        }

        // Header with custom channel selector
        const header = document.createElement('div');
        header.className = 'grid-cell-header';

        // Audio indicator
        const audioBtn = document.createElement('button');
        audioBtn.className = 'grid-audio-btn';
        audioBtn.innerHTML = '🔇'; // Start muted
        audioBtn.title = 'Click for audio from this cell';
        audioBtn.onclick = () => {
            if (cellNum === audioCell && !allMuted) {
                // If clicking the active cell, mute all
                muteAll();
            } else {
                // Otherwise, set this cell as audio source
                setAudioCell(cellNum);
            }
        };
        header.appendChild(audioBtn);

        // Custom channel selector
        const selector = createChannelSelector(cellNum);
        header.appendChild(selector);

        // Focus button
        const focusBtn = document.createElement('button');
        focusBtn.className = 'grid-focus-btn';
        focusBtn.innerHTML = '⛶';
        focusBtn.title = 'Focus this cell';
        focusBtn.onclick = () => toggleFocus(cellNum);
        header.appendChild(focusBtn);

        cell.appendChild(header);

        // Video container
        const body = document.createElement('div');
        body.className = 'grid-cell-body';

        const frame = document.createElement('div');
        frame.className = 'grid-cell-frame';

        // HLS video element
        const video = document.createElement('video');
        video.id = `grid-video-${cellNum}`;
        video.autoplay = true;
        video.muted = true; // Start muted for autoplay
        video.controls = false;
        video.playsInline = true;
        video.setAttribute('playsinline', '');

        // YouTube container
        const ytDiv = document.createElement('div');
        ytDiv.id = `grid-yt-${cellNum}`;
        ytDiv.className = 'yt-container';
        ytDiv.style.display = 'none';
        ytDiv.style.background = 'transparent';

        frame.appendChild(video);
        frame.appendChild(ytDiv);
        body.appendChild(frame);
        cell.appendChild(body);

        return cell;
    }

    // Create professional channel selector
    function createChannelSelector(cellNum) {
        const container = document.createElement('div');
        container.className = 'channel-selector-pro';

        const button = document.createElement('button');
        button.className = 'channel-selector-btn';
        button.textContent = 'Select Channel';
        button.dataset.cell = cellNum;

        const dropdown = document.createElement('div');
        dropdown.className = 'channel-dropdown';

        if (window.CHANNELS) {
            Object.entries(window.CHANNELS).forEach(([key, channel]) => {
                const option = document.createElement('div');
                option.className = 'channel-option';
                option.textContent = channel.label;
                option.dataset.channel = key;
                
                option.onclick = (e) => {
                    e.stopPropagation();
                    selectChannel(cellNum, key, channel.label);
                    dropdown.classList.remove('show');
                };
                
                dropdown.appendChild(option);
            });
        }

        button.onclick = (e) => {
            e.stopPropagation();
            
            // Close all other dropdowns
            document.querySelectorAll('.channel-dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            
            dropdown.classList.toggle('show');
        };

        container.appendChild(button);
        container.appendChild(dropdown);

        return container;
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.channel-dropdown.show').forEach(d => {
            d.classList.remove('show');
        });
    });

    // Select a channel for a cell
    function selectChannel(cellNum, channelKey, channelLabel) {
        console.log(`>>> selectChannel called <<<`);
        console.log('    cellNum:', cellNum);
        console.log('    channelKey:', channelKey);
        
        const cell = document.querySelector(`[data-cell="${cellNum}"]`);
        if (!cell) {
            console.error(`    ERROR: Cell ${cellNum} not found in DOM`);
            return;
        }

        const btn = cell.querySelector('.channel-selector-btn');
        if (btn) {
            btn.textContent = channelLabel;
        }

        // Save selection
        saveGridChannelSelection(cellNum, channelKey);

        // Call playGridCell
        if (typeof window.playGridCell === 'function') {
            console.log('    Calling window.playGridCell...');
            window.playGridCell(cellNum, channelKey);
            
            // playGridCell destroys and recreates videos, so we need to wait
            // then attach event listeners to control audio
            const ch = window.CHANNELS[channelKey];
            
            if (ch && ch.type === 'yt') {
                // YouTube - wait for player to be created
                console.log(`    Waiting for YouTube player for cell ${cellNum}...`);
                waitForYouTubePlayer(cellNum, 0);
            } else {
                // HLS - wait for video element to be ready
                console.log(`    Waiting for HLS video for cell ${cellNum}...`);
                waitForHLSVideo(cellNum, 0);
            }
        } else {
            console.error('    window.playGridCell not found!');
        }
    }

    // Wait for HLS video to be ready and set audio state
    function waitForHLSVideo(cellNum, attempts) {
        if (attempts > 20) {
            console.warn(`    Gave up waiting for HLS video ${cellNum}`);
            return;
        }
        
        setTimeout(() => {
            const video = document.getElementById(`grid-video-${cellNum}`);
            
            if (video && video.readyState >= 2) { // HAVE_CURRENT_DATA or better
                console.log(`    HLS video ready for cell ${cellNum}`);
                const shouldBeMuted = allMuted || (cellNum !== audioCell);
                video.muted = shouldBeMuted;
                console.log(`    Set HLS video ${cellNum} muted: ${shouldBeMuted}`);
                
                // Ensure it's playing
                if (video.paused) {
                    video.play().catch(e => console.log(`    Play failed: ${e.message}`));
                }
            } else {
                // Not ready yet, try again
                waitForHLSVideo(cellNum, attempts + 1);
            }
        }, 100);
    }

    // Wait for YouTube player to be ready and set audio state
    function waitForYouTubePlayer(cellNum, attempts) {
        if (attempts > 30) {
            console.warn(`    Gave up waiting for YouTube player ${cellNum}`);
            return;
        }
        
        setTimeout(() => {
            const ytPlayerKey = `grid-${cellNum}`;
            
            if (window.YT_PLAYERS && window.YT_PLAYERS[ytPlayerKey]) {
                console.log(`    YouTube player ready for cell ${cellNum}`);
                
                try {
                    const player = window.YT_PLAYERS[ytPlayerKey];
                    
                    // Wait for player state to be ready
                    const state = player.getPlayerState();
                    
                    if (state === -1 || state === 3) {
                        // Still loading, wait more
                        waitForYouTubePlayer(cellNum, attempts + 1);
                        return;
                    }
                    
                    // Player is ready, set audio state
                    if (!allMuted && cellNum === audioCell) {
                        player.unMute();
                        player.setVolume(100);
                        console.log(`    YouTube ${cellNum} unmuted and volume 100`);
                    } else {
                        player.mute();
                        console.log(`    YouTube ${cellNum} muted`);
                    }
                } catch (e) {
                    console.warn(`    YouTube ${cellNum} control error:`, e);
                    waitForYouTubePlayer(cellNum, attempts + 1);
                }
            } else {
                // Player doesn't exist yet, wait
                waitForYouTubePlayer(cellNum, attempts + 1);
            }
        }, 200);
    }

    // Save grid channel selections
    function saveGridChannelSelection(cellNum, channelKey) {
        try {
            const key = `russelltv.gridCell${cellNum}`;
            localStorage.setItem(key, channelKey);
        } catch (e) {}
    }

    // Load saved grid channel selections
    function loadSavedGridSelections(numCells) {
        const savedSelections = {};
        for (let i = 1; i <= numCells; i++) {
            try {
                const key = `russelltv.gridCell${i}`;
                const saved = localStorage.getItem(key);
                if (saved) {
                    savedSelections[i] = saved;
                }
            } catch (e) {}
        }
        return savedSelections;
    }

    // Mute all streams
    function muteAll() {
        console.log('>>> Muting all streams <<<');
        allMuted = true;
        
        // Save state
        try {
            localStorage.setItem('russelltv.allMuted', 'true');
        } catch (e) {}
        
        // Update all buttons to show muted
        document.querySelectorAll('.grid-cell-pro').forEach(cell => {
            cell.classList.remove('audio-active');
            const audioBtn = cell.querySelector('.grid-audio-btn');
            if (audioBtn) audioBtn.innerHTML = '🔇';
        });
        
        // Mute all videos
        for (let i = 1; i <= 9; i++) {
            const video = document.getElementById(`grid-video-${i}`);
            if (video) video.muted = true;
            
            if (window.YT_PLAYERS && window.YT_PLAYERS[`grid-${i}`]) {
                try {
                    window.YT_PLAYERS[`grid-${i}`].mute();
                } catch (e) {}
            }
        }
        
        console.log('All streams muted');
    }

    // Set which cell has audio
    function setAudioCell(cellNum) {
        console.log(`>>> setAudioCell called with cell ${cellNum} <<<`);
        console.log('    Previous audio cell:', audioCell);
        
        audioCell = cellNum;
        allMuted = false; // Unmute when selecting a cell
        
        // Save preferences
        try {
            localStorage.setItem('russelltv.audioCell', cellNum);
            localStorage.setItem('russelltv.allMuted', 'false');
        } catch (e) {
            console.error('    Error saving audio cell:', e);
        }
        
        // Update all audio buttons and mute states
        document.querySelectorAll('.grid-cell-pro').forEach(cell => {
            const num = parseInt(cell.dataset.cell);
            const audioBtn = cell.querySelector('.grid-audio-btn');
            
            if (num === audioCell) {
                cell.classList.add('audio-active');
                if (audioBtn) audioBtn.innerHTML = '🔊';
                console.log(`    Cell ${num}: Set as ACTIVE (unmuted)`);
            } else {
                cell.classList.remove('audio-active');
                if (audioBtn) audioBtn.innerHTML = '🔇';
                console.log(`    Cell ${num}: Set as inactive (muted)`);
            }
        });

        // Force update audio states
        console.log('    Calling updateAudioStates...');
        updateAudioStates();
    }

    // Update mute state on all video elements
    function updateAudioStates() {
        console.log(`>>> updateAudioStates called <<<`);
        console.log('    Active audio cell:', audioCell);
        console.log('    All muted:', allMuted);
        
        for (let i = 1; i <= 9; i++) {
            const video = document.getElementById(`grid-video-${i}`);
            if (video) {
                const shouldMute = allMuted || (i !== audioCell);
                video.muted = shouldMute;
                console.log(`    Cell ${i} HLS video - muted: ${shouldMute}, actually muted: ${video.muted}`);
            } else {
                console.log(`    Cell ${i} HLS video - not found`);
            }

            // Update YouTube players
            if (window.YT_PLAYERS && window.YT_PLAYERS[`grid-${i}`]) {
                try {
                    const player = window.YT_PLAYERS[`grid-${i}`];
                    
                    // Check if player still exists in DOM
                    if (player && typeof player.getPlayerState === 'function') {
                        if (!allMuted && i === audioCell) {
                            player.unMute();
                            player.setVolume(100);
                            console.log(`    Cell ${i} YouTube - unmuted and volume set to 100`);
                        } else {
                            player.mute();
                            console.log(`    Cell ${i} YouTube - muted`);
                        }
                    } else {
                        console.log(`    Cell ${i} YouTube - player no longer valid`);
                    }
                } catch (e) {
                    // Player was destroyed or iframe removed - just skip it
                    console.log(`    Cell ${i} YouTube - skipped (player not ready):`, e.message);
                }
            } else {
                console.log(`    Cell ${i} YouTube - player not found`);
            }
        }
        console.log('>>> updateAudioStates complete <<<');
    }

    // Toggle focus mode
    function toggleFocus(cellNum) {
        const wrapper = document.querySelector('#grid-view .grid-wrapper');
        if (!wrapper) return;

        if (focusedCell === cellNum) {
            // Exit focus mode
            focusedCell = null;
            wrapper.classList.remove('focus-mode');
            document.querySelectorAll('.grid-cell-pro').forEach(cell => {
                cell.classList.remove('focused', 'unfocused');
            });
        } else {
            // Enter focus mode
            focusedCell = cellNum;
            wrapper.classList.add('focus-mode');
            
            document.querySelectorAll('.grid-cell-pro').forEach(cell => {
                const num = parseInt(cell.dataset.cell);
                if (num === cellNum) {
                    cell.classList.add('focused');
                    cell.classList.remove('unfocused');
                } else {
                    cell.classList.add('unfocused');
                    cell.classList.remove('focused');
                }
            });
        }
    }

    // Load default channels for layout
    function loadDefaultChannelsForLayout(numCells) {
        const defaults = window.GRID_DEFAULTS || {};
        const savedSelections = loadSavedGridSelections(numCells);
        
        console.log('=== LOADING CHANNELS ===');
        console.log('Number of cells:', numCells);
        console.log('Defaults:', defaults);
        console.log('Saved selections:', savedSelections);
        
        // Load channels with staggered delays
        for (let i = 1; i <= numCells; i++) {
            const channelKey = savedSelections[i] || defaults[i];
            
            console.log(`Cell ${i}: Will load "${channelKey}"`);
            
            if (channelKey && window.CHANNELS && window.CHANNELS[channelKey]) {
                setTimeout(() => {
                    console.log(`>>> Attempting to load cell ${i} with ${channelKey}`);
                    const cell = document.querySelector(`[data-cell="${i}"]`);
                    
                    if (cell && window.CHANNELS[channelKey]) {
                        selectChannel(i, channelKey, window.CHANNELS[channelKey].label);
                    }
                }, i * 200); // Slightly slower stagger to give each cell time
            }
        }
        
        console.log('========================');
    }

    // Stop all grid cells
    function stopAllGridCells() {
        // Stop HLS instances
        if (window.hlsGrid) {
            Object.values(window.hlsGrid).forEach(hls => {
                if (hls) hls.destroy();
            });
        }

        // Stop YouTube players
        if (window.YT_PLAYERS) {
            Object.keys(window.YT_PLAYERS).forEach(key => {
                if (key.startsWith('grid-')) {
                    try {
                        window.YT_PLAYERS[key].destroy();
                    } catch (e) {}
                }
            });
        }
    }

    // Keyboard shortcuts for layouts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        const gridView = document.getElementById('grid-view');
        if (!gridView || gridView.style.display === 'none') return;

        // Layout shortcuts (when in grid mode)
        const layoutMap = {
            '2': '1x2',
            '4': '2x2',
            '3': '1x3',
            '6': '2x3',
            'u': '1x4',
            'U': '1x4'
        };

        if (layoutMap[e.key]) {
            e.preventDefault();
            changeLayout(layoutMap[e.key]);
            
            // Update selector
            const mainBtn = document.getElementById('btn-grid-main');
            if (mainBtn) {
                const config = GRID_LAYOUTS[layoutMap[e.key]];
                mainBtn.textContent = `Grid: ${config.label}`;
            }
        }

        // F key for focus mode
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFocus(focusedCell || 1);
        }

        // A key to cycle audio between cells
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            const config = GRID_LAYOUTS[currentLayout];
            const nextCell = (audioCell % config.cells) + 1;
            setAudioCell(nextCell);
        }
    });

    // Initialize when grid button is clicked
    const originalEnterGridMode = window.enterGridMode;
    window.enterGridMode = function() {
        console.log('>>> enterGridMode called <<<');
        
        if (originalEnterGridMode) originalEnterGridMode();
        
        const config = GRID_LAYOUTS[currentLayout];
        console.log('Current layout config:', config);
        
        // Always rebuild if config doesn't match existing cells
        const existingCells = document.querySelectorAll('.grid-cell-pro').length;
        console.log('Existing cells:', existingCells, 'Expected cells:', config.cells);
        
        if (existingCells !== config.cells) {
            console.log('Cell count mismatch - rebuilding grid');
            rebuildGrid(config);
        } else if (!document.querySelector('.grid-cell-pro')) {
            console.log('No cells exist - building grid');
            rebuildGrid(config);
        } else {
            console.log('Grid exists with correct cell count - reloading channels');
            loadDefaultChannelsForLayout(config.cells);
        }
    };

    // Initialize
    window.addEventListener('load', () => {
        replaceGridButton();
        
        // DIAGNOSTIC: Check what functions are available
        console.log('=== DIAGNOSTIC INFO ===');
        console.log('window.playGridCell exists?', typeof window.playGridCell);
        console.log('window.createOrReplaceYTPlayer exists?', typeof window.createOrReplaceYTPlayer);
        console.log('window.hlsGrid exists?', typeof window.hlsGrid);
        console.log('window.Hls exists?', typeof window.Hls);
        console.log('window.YT_PLAYERS exists?', typeof window.YT_PLAYERS);
        console.log('window.CHANNELS:', window.CHANNELS);
        console.log('window.GRID_DEFAULTS:', window.GRID_DEFAULTS);
        console.log('=======================');
        
        // Load saved preferences
        try {
            const savedLayout = localStorage.getItem('russelltv.gridLayout');
            if (savedLayout && GRID_LAYOUTS[savedLayout]) {
                currentLayout = savedLayout;
                console.log('Loaded saved layout:', currentLayout);
                
                // Update the grid button label to match saved layout
                setTimeout(() => {
                    const mainBtn = document.getElementById('btn-grid-main');
                    if (mainBtn) {
                        const config = GRID_LAYOUTS[currentLayout];
                        mainBtn.textContent = `Grid: ${config.label}`;
                        console.log('Updated button label to:', config.label);
                    }
                }, 100);
            }
            
            const savedAudioCell = localStorage.getItem('russelltv.audioCell');
            if (savedAudioCell) {
                audioCell = parseInt(savedAudioCell);
                console.log('Loaded saved audio cell:', audioCell);
            }
            
            const savedMuted = localStorage.getItem('russelltv.allMuted');
            if (savedMuted === 'false') {
                // Only unmute if user explicitly saved unmuted state
                allMuted = false;
                console.log('Loaded muted state: unmuted');
            } else {
                // Default to muted
                allMuted = true;
                console.log('Loaded muted state: all muted (default)');
            }
            
            // Check saved channel selections
            console.log('Saved channel selections:');
            for (let i = 1; i <= 9; i++) {
                const saved = localStorage.getItem(`russelltv.gridCell${i}`);
                if (saved) {
                    console.log(`  Cell ${i}: ${saved}`);
                }
            }
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
        
        // Check if grid visible on startup
        setTimeout(() => {
            const gridView = document.getElementById('grid-view');
            console.log('Grid view display:', gridView ? gridView.style.display : 'not found');
            
            if (gridView && gridView.style.display !== 'none') {
                // Count existing cells
                const existingCells = document.querySelectorAll('.grid-cell-pro').length;
                const config = GRID_LAYOUTS[currentLayout];
                
                console.log('On startup - existing cells:', existingCells);
                console.log('On startup - expected cells for layout', currentLayout, ':', config.cells);
                
                if (existingCells === 0) {
                    console.log('No cells - initializing grid');
                    rebuildGrid(config);
                } else if (existingCells !== config.cells) {
                    console.log('Cell count mismatch - rebuilding');
                    rebuildGrid(config);
                } else {
                    console.log('Cells match - reloading channels');
                    loadDefaultChannelsForLayout(config.cells);
                }
            }
        }, 300);
    });

})();
