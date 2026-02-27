/*
 * To enable BBCode text support, download:
 * https://github.com/rexrainbow/phaser3-rex-notes/tree/master/dist/rexbbcodetextplugin.min.js
 * and place it in a 'plugins/' directory at the project root.
 * Then add this to your index.html BEFORE your main.js script:
 * <script src="plugins/rexbbcodetextplugin.min.js"></script>
 * The plugin will be available as window.rexbbcodetextplugin.
 */

window.onerror = function(message, source, lineno, colno, error) {
    alert("Global error: " + message + " at " + source + ":" + lineno + ":" + colno);
    console.error("Global error:", message, source, lineno, colno, error);
};
window.onunhandledrejection = function(event) {
    // Suppress alert for known IndexedDB/Firestore errors on mobile
    const reason = event.reason && event.reason.message ? event.reason.message : (event.reason || "");
    const knownIndexedDBErrorPatterns = [
        "Error looking up record in object store by key range",
        "UnknownError",
        "A mutation operation was attempted on a database that did not allow mutations"
    ];
    const knownAudioErrorPatterns = [
        "failed to start the audio device",
        "AudioContext",
        "audio device",
        "Web Audio",
        "audio context"
    ];
    
    const isKnownIndexedDBError = knownIndexedDBErrorPatterns.some(pattern =>
        reason && reason.toString().includes(pattern)
    );
    const isKnownAudioError = knownAudioErrorPatterns.some(pattern =>
        reason && reason.toString().toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isKnownIndexedDBError) {
        // Log to console, but do not alert
        console.warn("Suppressed IndexedDB/Firestore error:", reason);
        return;
    }
    
    if (isKnownAudioError) {
        // Log to console, but do not alert
        console.warn("Suppressed audio device error:", reason);
        return;
    }
    
    alert("Unhandled promise rejection: " + reason);
    console.error("Unhandled promise rejection:", reason);
};

//import Phaser from 'phaser';

import BaseGameScene from "./scenes/BaseGameScene.js";
import Boot from "./scenes/Boot.js";
import Preloader from "./scenes/Preloader.js";
import FeedbackScene from "./scenes/FeedbackScene.js";
import InstructionScene from "./scenes/InstructionsScene.js";
import DoneScene from "./scenes/DoneScene.js";
import LeaderboardScene from "./scenes/LeaderboardScene.js";
import UsernameScene from "./scenes/UsernameScene.js";
import BadgeGenerator from "./scenes/BadgeGenerator.js";
import GameOverScene from "./scenes/GameOverScene.js";

// Import centralized dimensions configuration
import { isMobileDevice, getOptimalDimensions, SCALE_CONFIG, detectDeviceType, DEVICE_TYPES } from "./config/dimensions.js";

// Get optimal dimensions and device info
const dimensions = getOptimalDimensions();
const isMobile = isMobileDevice();

const config = {
    type: Phaser.AUTO,
    scene: [
        Boot, 
        Preloader, 
        InstructionScene, 
        BaseGameScene, 
        DoneScene, 
        FeedbackScene, 
        LeaderboardScene, 
        UsernameScene, 
        GameOverScene, 
        BadgeGenerator
    ],
    physics: { 
        default: 'arcade', 
        arcade: { 
            debug: false,
            // Adjust physics for desktop (higher precision)
            fps: isMobile ? 60 : 120,
            timeScale: 1,
            gravity: { y: 0 }
        } 
    },
    plugins: {
        global: [{
            key: 'rexBBCodeTextPlugin',
            plugin: window.rexbbcodetextplugin,
            start: true
        }]
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: dimensions.width,
        height: dimensions.height,
        parent: 'game-container',
        expandParent: false,  // Don't expand parent - let FIT mode work within container
        resolution: window.devicePixelRatio || 1,
        autoRound: false,  // Disable auto rounding for more precise scaling
        // Ensure proper scaling
        zoom: 1,
        // Force refresh on resize
        fullscreenTarget: 'game-container'
    },
    render: {
        pixelArt: false,
        antialias: true,
        powerPreference: isMobile ? 'default' : 'high-performance',
        transparent: true,  // Allow background images to show through
        // Better rendering for desktop
        mipmapFilter: 'LINEAR',
        roundPixels: false,
        // Enable if you have text-heavy scenes
        batchSize: isMobile ? 2048 : 4096
    },
    input: {
        activePointers: isMobile ? 3 : 1,
        smoothFactor: isMobile ? 0.5 : 0,
        // Enable keyboard for desktop; let Phaser use the canvas as the target
        keyboard: {
            target: null
        },
        // Mouse settings for desktop
        mouse: {
            preventDefaultWheel: true,
            preventDefaultDown: false,
            preventDefaultUp: false,
            preventDefaultMove: false
        }
    },
    fps: {
        // Higher FPS target for desktop
        target: isMobile ? 60 : 120,
        min: 30,
        forceSetTimeOut: false
    },
    dom: {
        createContainer: true
    },
    // Audio settings optimized per platform
    audio: {
        disableWebAudio: false,
        noAudio: false
    },
    // Disable context menu on right-click for desktop
    disableContextMenu: !isMobile
};

const game = new Phaser.Game(config);


// Ensure the game canvas is focusable for keyboard input
game.events.once('ready', () => {
    if (game.canvas) {
        game.canvas.setAttribute('tabindex', '1');
        game.canvas.style.outline = 'none';
    }
    
    // Force a scale refresh to ensure FIT mode works correctly
    if (game.scale) {
        game.scale.refresh();
        console.log('[SCALE] Forced refresh after game ready');
        console.log('[SCALE] Parent size:', game.scale.parentSize.width, 'x', game.scale.parentSize.height);
        console.log('[SCALE] Canvas size:', game.canvas.width, 'x', game.canvas.height);
        console.log('[SCALE] Display size:', game.scale.displaySize.width, 'x', game.scale.displaySize.height);
    }
});

// Helper to compute and store the current scale factor in the registry
function updateUIScale() {
    // The scale factor is the ratio between the actual canvas size and the design resolution
    const scaleWidth = game.scale.displaySize.width / game.scale.gameSize.width;
    const scaleHeight = game.scale.displaySize.height / game.scale.gameSize.height;
    // Use the smaller scale to ensure everything fits and maintains aspect ratio
    const uiScale = Math.min(scaleWidth, scaleHeight);
    
    // Store both the uniform scale and the individual dimensions for flexibility
    game.registry.set('uiScale', uiScale);
    // ALWAYS use uniform scale to prevent stretching on any device
    game.registry.set('uiScaleX', uiScale);
    game.registry.set('uiScaleY', uiScale);
    
    // Log the scales for debugging
    console.log('[SCALE] Display:', game.scale.displaySize.width, 'x', game.scale.displaySize.height);
    console.log('[SCALE] Game:', game.scale.gameSize.width, 'x', game.scale.gameSize.height);
    console.log('[SCALE] Scales - Width:', scaleWidth.toFixed(3), 'Height:', scaleHeight.toFixed(3), 'UI:', uiScale.toFixed(3));
}

// Store device type and base dimensions globally for scenes to access
game.registry.set('isMobile', isMobile);
game.registry.set('baseWidth', dimensions.width);
game.registry.set('baseHeight', dimensions.height);
updateUIScale();

// Handle window resize events
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (game.scale) {
            // With FIT mode, we don't need to resize the game dimensions
            // Phaser will handle the scaling automatically
            // Just update the UI scale factor
            updateUIScale();
            // Emit custom resize event for scenes
            game.events.emit('resize', game.scale.width, game.scale.height);
        }
    }, 100);
});

// Desktop-specific: fullscreen handling
if (!isMobile) {
    // Combined desktop keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F11') {
            e.preventDefault();
            if (game.scale.isFullscreen) {
                game.scale.stopFullscreen();
            } else {
                game.scale.startFullscreen();
            }
        } else if (e.key === 'Escape') {
            game.events.emit('toggle-pause');
        }
    });
}

    // Mobile-specific: prevent unwanted mobile behaviors
    if (isMobile) {
        // Lock orientation to portrait mode for ALL mobile devices (phones and tablets)
        const lockOrientation = async () => {
            if (screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock('portrait');
                    console.log('[ORIENTATION] Successfully locked to portrait mode');
                } catch (error) {
                    console.log('[ORIENTATION] Failed to lock orientation:', error);
                    // Fallback: try the older API
                    if (screen.lockOrientation) {
                        screen.lockOrientation('portrait');
                    } else if (screen.mozLockOrientation) {
                        screen.mozLockOrientation('portrait');
                    } else if (screen.msLockOrientation) {
                        screen.msLockOrientation('portrait');
                    }
                }
            }
        };

        // Try to lock orientation immediately for all mobile devices
        lockOrientation();

        // Also try to lock on first user interaction (some browsers require this)
        let hasLockedOrientation = false;
        const tryLockOnInteraction = () => {
            if (!hasLockedOrientation) {
                lockOrientation();
                hasLockedOrientation = true;
            }
        };
        document.addEventListener('touchstart', tryLockOnInteraction, { once: true });
        document.addEventListener('click', tryLockOnInteraction, { once: true });

        // Prevent unwanted mobile behaviors
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('#game-container')) {
                e.preventDefault();
            }
        }, { passive: false });

        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Fix: Resume audio context on first user gesture to prevent AudioContext error
        const unlockAudio = async () => {
            try {
                if (game.sound && typeof game.sound.unlock === 'function') {
                    game.sound.unlock();
                }
                // For extra safety, also try to resume the context directly if available
                if (game.sound && game.sound.context && game.sound.context.state === 'suspended') {
                    await game.sound.context.resume();
                    console.log('[AUDIO] AudioContext resumed successfully');
                    game.registry.set('audioUnlocked', true);
                }
            } catch (error) {
                console.warn('[AUDIO] Failed to unlock audio context:', error);
                // Don't throw the error - just log it and continue
            }
            document.removeEventListener('touchstart', unlockAudio, true);
            document.removeEventListener('mousedown', unlockAudio, true);
        };
        document.addEventListener('touchstart', unlockAudio, true);
        document.addEventListener('mousedown', unlockAudio, true);
    }

 // Performance monitoring for optimization
if (
    !isMobile &&
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV === 'development'
) {
    // Add FPS display for development
    game.events.on('postrender', () => {
        // Your FPS monitoring code here
    });
}

// Visibility change handling (pause when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        game.events.emit('game-blur');
        if (game.sound) {
            game.sound.pauseAll();
        }
    } else {
        game.events.emit('game-focus');
        if (game.sound) {
            game.sound.resumeAll();
        }
    }
});

// Export game instance
export default game;
