/**
 * AudioManager - Utility for handling audio initialization and fallbacks
 * Provides safe audio operations that won't cause promise rejections
 */

export class AudioManager {
    constructor(scene) {
        this.scene = scene;
        this.audioAvailable = false;
        this.audioUnlocked = false;
        this.checkAudioAvailability();
    }

    /**
     * Check if audio is available and properly initialized
     */
    checkAudioAvailability() {
        try {
            // Check if Phaser sound system exists
            if (!this.scene.sound) {
                console.log('[AUDIO] Phaser sound system not available');
                this.audioAvailable = false;
                return;
            }

            // Check if audio was unlocked (set by main.js)
            this.audioUnlocked = this.scene.registry.get('audioUnlocked') || false;

            // Check if WebAudio is disabled (mobile devices)
            const isMobile = this.scene.registry.get('isMobile') || false;
            if (isMobile && this.scene.sound.context === null) {
                console.log('[AUDIO] WebAudio disabled on mobile - using HTML5 audio fallback');
                this.audioAvailable = true; // HTML5 audio should still work
                return;
            }

            // Check AudioContext state if available
            if (this.scene.sound.context) {
                const contextState = this.scene.sound.context.state;
                console.log('[AUDIO] AudioContext state:', contextState);
                
                if (contextState === 'running') {
                    this.audioAvailable = true;
                } else if (contextState === 'suspended') {
                    this.audioAvailable = true; // Can be resumed later
                } else {
                    this.audioAvailable = false;
                }
            } else {
                // No AudioContext but sound system exists - probably HTML5 audio
                this.audioAvailable = true;
            }

            console.log('[AUDIO] Audio availability check:', {
                audioAvailable: this.audioAvailable,
                audioUnlocked: this.audioUnlocked,
                hasContext: !!this.scene.sound.context,
                contextState: this.scene.sound.context?.state || 'none'
            });

        } catch (error) {
            console.warn('[AUDIO] Error checking audio availability:', error);
            this.audioAvailable = false;
        }
    }

    /**
     * Safely play a sound with fallback behavior
     * @param {string} key - Sound key to play
     * @param {object} config - Sound configuration (volume, loop, etc.)
     * @returns {object|null} Sound object or null if audio unavailable
     */
    safePlay(key, config = {}) {
        try {
            if (!this.audioAvailable || !this.scene.sound) {
                console.log('[AUDIO] Audio not available, skipping sound:', key);
                return null;
            }

            // Check if the sound key exists
            if (!this.scene.cache.audio.exists(key)) {
                console.warn('[AUDIO] Sound key does not exist:', key);
                return null;
            }

            // Try to play the sound
            const sound = this.scene.sound.play(key, config);
            console.log('[AUDIO] Successfully played sound:', key);
            return sound;

        } catch (error) {
            console.warn('[AUDIO] Failed to play sound:', key, error);
            return null;
        }
    }

    /**
     * Safely add a sound with fallback behavior
     * @param {string} key - Sound key
     * @param {object} config - Sound configuration
     * @returns {object|null} Sound object or null if audio unavailable
     */
    safeAdd(key, config = {}) {
        try {
            if (!this.audioAvailable || !this.scene.sound) {
                console.log('[AUDIO] Audio not available, skipping sound add:', key);
                return null;
            }

            // Check if the sound key exists
            if (!this.scene.cache.audio.exists(key)) {
                console.warn('[AUDIO] Sound key does not exist:', key);
                return null;
            }

            const sound = this.scene.sound.add(key, config);
            console.log('[AUDIO] Successfully added sound:', key);
            return sound;

        } catch (error) {
            console.warn('[AUDIO] Failed to add sound:', key, error);
            return null;
        }
    }

    /**
     * Safely pause all sounds
     */
    safePauseAll() {
        try {
            if (this.audioAvailable && this.scene.sound) {
                this.scene.sound.pauseAll();
                console.log('[AUDIO] Paused all sounds');
            }
        } catch (error) {
            console.warn('[AUDIO] Failed to pause all sounds:', error);
        }
    }

    /**
     * Safely resume all sounds
     */
    safeResumeAll() {
        try {
            if (this.audioAvailable && this.scene.sound) {
                this.scene.sound.resumeAll();
                console.log('[AUDIO] Resumed all sounds');
            }
        } catch (error) {
            console.warn('[AUDIO] Failed to resume all sounds:', error);
        }
    }

    /**
     * Safely stop all sounds
     */
    safeStopAll() {
        try {
            if (this.audioAvailable && this.scene.sound) {
                this.scene.sound.stopAll();
                console.log('[AUDIO] Stopped all sounds');
            }
        } catch (error) {
            console.warn('[AUDIO] Failed to stop all sounds:', error);
        }
    }

    /**
     * Attempt to unlock audio (for user interaction events)
     */
    async attemptUnlock() {
        try {
            if (!this.scene.sound) {
                console.warn('[AUDIO] No sound system available for unlock');
                return false;
            }

            console.log('[AUDIO] Attempting to unlock audio...');

            // Try Phaser's unlock method
            if (typeof this.scene.sound.unlock === 'function') {
                try {
                    this.scene.sound.unlock();
                    console.log('[AUDIO] Phaser unlock method called');
                } catch (unlockError) {
                    console.warn('[AUDIO] Phaser unlock failed:', unlockError);
                }
            }

            // Try to resume AudioContext if suspended
            if (this.scene.sound.context && this.scene.sound.context.state === 'suspended') {
                try {
                    await this.scene.sound.context.resume();
                    console.log('[AUDIO] AudioContext resumed successfully');
                } catch (resumeError) {
                    console.warn('[AUDIO] AudioContext resume failed:', resumeError);
                    // Don't return false here - the game can still work without audio
                }
            }

            // Update status
            this.checkAudioAvailability();
            this.audioUnlocked = true;
            this.scene.registry.set('audioUnlocked', true);

            console.log('[AUDIO] Audio unlock attempt completed');
            return true;

        } catch (error) {
            console.warn('[AUDIO] Failed to unlock audio:', error);
            // Still mark as unlocked to prevent repeated attempts
            this.audioUnlocked = true;
            this.scene.registry.set('audioUnlocked', true);
            return false;
        }
    }

    /**
     * Get audio status information
     * @returns {object} Audio status object
     */
    getStatus() {
        return {
            audioAvailable: this.audioAvailable,
            audioUnlocked: this.audioUnlocked,
            hasSound: !!this.scene.sound,
            hasContext: !!(this.scene.sound && this.scene.sound.context),
            contextState: this.scene.sound?.context?.state || 'none',
            isMobile: this.scene.registry.get('isMobile') || false
        };
    }

    /**
     * Create a user-friendly audio enable button for scenes that want to offer audio
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {object|null} Button object or null if not needed
     */
    createAudioEnableButton(x, y) {
        // Only create button if audio is available but not unlocked
        if (!this.audioAvailable || this.audioUnlocked) {
            return null;
        }

        try {
            const button = this.scene.add.text(x, y, '🔊 Enable Audio', {
                fontSize: '16px',
                fill: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 10, y: 5 },
                borderRadius: 5
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', async () => {
                const success = await this.attemptUnlock();
                if (success) {
                    button.setText('🔊 Audio Enabled');
                    button.setStyle({ fill: '#00ff00' });
                    // Hide button after 2 seconds
                    this.scene.time.delayedCall(2000, () => {
                        button.destroy();
                    });
                } else {
                    button.setText('🔇 Audio Unavailable');
                    button.setStyle({ fill: '#ff0000' });
                }
            });

            return button;

        } catch (error) {
            console.warn('[AUDIO] Failed to create audio enable button:', error);
            return null;
        }
    }
}

// Export a factory function for easy use in scenes
export function createAudioManager(scene) {
    return new AudioManager(scene);
}

export default AudioManager;
