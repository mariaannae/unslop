// AnimationHelpers.js - Reusable animation utility functions
// Extracted from BaseGameScene to provide consistent animation patterns across all scenes

/**
 * Animation duration constants
 */
export const ANIMATION_DURATION = {
    FAST: 200,
    MEDIUM: 500,
    SLOW: 800,
    VERY_SLOW: 1200
};

/**
 * Fade in animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [duration=500] - Animation duration in milliseconds
 * @param {string} [ease='Quad.Out'] - Easing function
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function fadeIn(scene, targets, duration = ANIMATION_DURATION.MEDIUM, ease = 'Quad.Out', onComplete = null) {
    return scene.tweens.add({
        targets: targets,
        alpha: { from: 0, to: 1 },
        duration: duration,
        ease: ease,
        onComplete: onComplete
    });
}

/**
 * Fade out animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [duration=500] - Animation duration in milliseconds
 * @param {string} [ease='Quad.In'] - Easing function
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function fadeOut(scene, targets, duration = ANIMATION_DURATION.MEDIUM, ease = 'Quad.In', onComplete = null) {
    return scene.tweens.add({
        targets: targets,
        alpha: { from: 1, to: 0 },
        duration: duration,
        ease: ease,
        onComplete: onComplete
    });
}

/**
 * Flash animation helper (quickly fade in and out)
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [flashCount=3] - Number of flashes
 * @param {number} [duration=500] - Total duration
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function flash(scene, targets, flashCount = 3, duration = ANIMATION_DURATION.MEDIUM, onComplete = null) {
    return scene.tweens.add({
        targets: targets,
        alpha: { from: 1, to: 0 },
        duration: duration / (flashCount * 2),
        yoyo: true,
        repeat: flashCount - 1,
        ease: 'Sine.InOut',
        onComplete: onComplete
    });
}

/**
 * Slide in animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {string} [direction='left'] - Direction to slide from ('left', 'right', 'top', 'bottom')
 * @param {number} [distance=100] - Distance to slide
 * @param {number} [duration=500] - Animation duration
 * @param {string} [ease='Cubic.Out'] - Easing function
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function slideIn(scene, targets, direction = 'left', distance = 100, duration = ANIMATION_DURATION.MEDIUM, ease = 'Cubic.Out', onComplete = null) {
    const props = {};
    
    switch(direction) {
        case 'left':
            props.x = { from: '-=' + distance, to: '+=' + distance };
            break;
        case 'right':
            props.x = { from: '+=' + distance, to: '-=' + distance };
            break;
        case 'top':
            props.y = { from: '-=' + distance, to: '+=' + distance };
            break;
        case 'bottom':
            props.y = { from: '+=' + distance, to: '-=' + distance };
            break;
    }
    
    props.alpha = { from: 0, to: 1 };
    props.duration = duration;
    props.ease = ease;
    props.onComplete = onComplete;
    
    return scene.tweens.add({
        targets: targets,
        ...props
    });
}

/**
 * Bounce animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [bounceHeight=20] - Height of bounce in pixels
 * @param {number} [duration=500] - Animation duration
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function bounce(scene, targets, bounceHeight = 20, duration = ANIMATION_DURATION.MEDIUM, onComplete = null) {
    return scene.tweens.add({
        targets: targets,
        y: '-=' + bounceHeight,
        duration: duration / 2,
        ease: 'Quad.Out',
        yoyo: true,
        onComplete: onComplete
    });
}

/**
 * Pulse animation helper (scale in and out)
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [scaleAmount=1.1] - Maximum scale during pulse
 * @param {number} [duration=1000] - Animation duration
 * @param {number} [repeat=-1] - Number of times to repeat (-1 for infinite)
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function pulse(scene, targets, scaleAmount = 1.1, duration = 1000, repeat = -1) {
    return scene.tweens.add({
        targets: targets,
        scale: { from: 1, to: scaleAmount },
        duration: duration,
        yoyo: true,
        repeat: repeat,
        ease: 'Sine.InOut'
    });
}

/**
 * Scale pop in animation helper (scale from 0 to 1)
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [duration=500] - Animation duration in milliseconds
 * @param {string} [ease='Back.Out'] - Easing function
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function scalePopIn(scene, targets, duration = ANIMATION_DURATION.MEDIUM, ease = 'Back.Out', onComplete = null) {
    return scene.tweens.add({
        targets: targets,
        scale: { from: 0, to: 1 },
        duration: duration,
        ease: ease,
        onComplete: onComplete
    });
}

/**
 * Fade out with scale animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [duration=500] - Animation duration in milliseconds
 * @param {string} [ease='Back.In'] - Easing function
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function fadeOutScale(scene, targets, duration = ANIMATION_DURATION.MEDIUM, ease = 'Back.In', onComplete = null) {
    return scene.tweens.add({
        targets: targets,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.8 },
        duration: duration,
        ease: ease,
        onComplete: onComplete
    });
}

/**
 * Shake animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [intensity=10] - Shake intensity in pixels
 * @param {number} [duration=500] - Animation duration
 * @param {Function} [onComplete] - Callback when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function shake(scene, targets, intensity = 10, duration = ANIMATION_DURATION.MEDIUM, onComplete = null) {
    // Store original position
    const originalX = Array.isArray(targets) ? targets[0].x : targets.x;
    
    return scene.tweens.add({
        targets: targets,
        x: `+=${intensity}`,
        duration: 50,
        yoyo: true,
        repeat: Math.floor(duration / 100),
        ease: 'Sine.InOut',
        onComplete: () => {
            // Reset to original position
            if (Array.isArray(targets)) {
                targets.forEach(target => target.x = originalX);
            } else {
                targets.x = originalX;
            }
            if (onComplete) onComplete();
        }
    });
}

/**
 * Glow effect animation helper
 * @param {Phaser.Scene} scene - The scene instance
 * @param {Phaser.GameObjects.GameObject|Array} targets - Target(s) to animate
 * @param {number} [duration=1000] - Animation duration
 * @param {number} [repeat=-1] - Number of times to repeat (-1 for infinite)
 * @returns {Phaser.Tweens.Tween} The created tween
 */
export function glow(scene, targets, duration = 1000, repeat = -1) {
    return scene.tweens.add({
        targets: targets,
        alpha: { from: 0.8, to: 1 },
        duration: duration,
        yoyo: true,
        repeat: repeat,
        ease: 'Sine.InOut'
    });
}

/**
 * Create a mixin that adds animation helpers as methods to a scene
 * Usage: Object.assign(YourScene.prototype, AnimationMixin);
 */
export const AnimationMixin = {
    fadeIn(targets, duration, ease, onComplete) {
        return fadeIn(this, targets, duration, ease, onComplete);
    },
    fadeOut(targets, duration, ease, onComplete) {
        return fadeOut(this, targets, duration, ease, onComplete);
    },
    flash(targets, flashCount, duration, onComplete) {
        return flash(this, targets, flashCount, duration, onComplete);
    },
    slideIn(targets, direction, distance, duration, ease, onComplete) {
        return slideIn(this, targets, direction, distance, duration, ease, onComplete);
    },
    bounce(targets, bounceHeight, duration, onComplete) {
        return bounce(this, targets, bounceHeight, duration, onComplete);
    },
    pulse(targets, scaleAmount, duration, repeat) {
        return pulse(this, targets, scaleAmount, duration, repeat);
    },
    scalePopIn(targets, duration, ease, onComplete) {
        return scalePopIn(this, targets, duration, ease, onComplete);
    },
    fadeOutScale(targets, duration, ease, onComplete) {
        return fadeOutScale(this, targets, duration, ease, onComplete);
    },
    shake(targets, intensity, duration, onComplete) {
        return shake(this, targets, intensity, duration, onComplete);
    },
    glow(targets, duration, repeat) {
        return glow(this, targets, duration, repeat);
    }
};
