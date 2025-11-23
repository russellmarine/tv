// Keyboard Channel Switcher for RussellTV
// Maps keyboard numbers to channels based on CHANNEL_ORDER
(function() {
    'use strict';
    
    // Build channel map dynamically from CHANNEL_ORDER
    function buildChannelMap() {
        const map = {};
        
        // Map numbers 1-9 to channels in order
        if (window.CHANNEL_ORDER) {
            window.CHANNEL_ORDER.forEach((channelKey, index) => {
                const keyNumber = (index + 1).toString();
                if (parseInt(keyNumber) <= 9) {
                    map[keyNumber] = channelKey;
                }
            });
        }
        
        // Add 'g' and 'G' for grid mode
        map['g'] = 'grid-mode';
        map['G'] = 'grid-mode';
        
        return map;
    }

    // Listen for keyboard events
    document.addEventListener('keydown', function(event) {
        const key = event.key;
        
        // Ignore if user is typing in an input field
        if (event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA' ||
            event.target.tagName === 'SELECT' ||
            event.target.isContentEditable) {
            return;
        }

        const channelMap = buildChannelMap();
        
        // Check if the key is in our channel map
        if (channelMap.hasOwnProperty(key)) {
            event.preventDefault(); // Prevent default browser behavior
            
            const channelId = channelMap[key];
            
            // Handle grid mode
            if (channelId === 'grid-mode') {
                const gridBtn = document.getElementById('btn-grid');
                if (gridBtn) {
                    gridBtn.click();
                    console.log('Switched to Grid mode via keyboard');
                }
                return;
            }
            
            // Handle channel switching
            const channelButton = document.getElementById('btn-' + channelId);
            
            if (channelButton) {
                channelButton.click();
                flashButton(channelButton);
                console.log(`Switched to channel ${key}: ${channelId}`);
            } else {
                console.warn(`Channel button not found for key ${key}: ${channelId}`);
            }
        }
    });

    // Visual feedback when channel is switched via keyboard
    function flashButton(button) {
        const originalBg = button.style.backgroundColor;
        const originalTransform = button.style.transform;
        
        button.style.backgroundColor = '#ff6b35'; // Fire highlight color
        button.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            button.style.backgroundColor = originalBg;
            button.style.transform = originalTransform;
        }, 200);
    }

    // Show keyboard shortcuts on page load
    function showKeyboardHint() {
        console.log('🎮 RussellTV Keyboard Shortcuts:');
        console.log('═══════════════════════════════════');
        
        const channelMap = buildChannelMap();
        
        // Show channel shortcuts
        Object.entries(channelMap).forEach(([key, channelId]) => {
            if (channelId === 'grid-mode') {
                console.log(`  ${key.toUpperCase()}: Grid Mode`);
            } else if (window.CHANNELS && window.CHANNELS[channelId]) {
                const label = window.CHANNELS[channelId].label;
                console.log(`  ${key}: ${label}`);
            }
        });
        
        console.log('═══════════════════════════════════');
    }

    // Initialize when page loads
    window.addEventListener('load', showKeyboardHint);

})();
