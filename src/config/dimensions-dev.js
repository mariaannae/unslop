// Development version with relaxed mobile detection for testing

/**
 * Improved mobile detection - DEVELOPMENT VERSION
 * @returns {boolean} Whether the device is mobile
 */
export function isMobileDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const touchPoints = navigator.maxTouchPoints || 'ontouchstart' in window;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // More comprehensive mobile detection
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
    const hasTouch = touchPoints > 0 || 'ontouchstart' in window;
    const isSmallScreen = width <= 900 || height <= 600;
    
    // FOR DEVELOPMENT: Consider small screen alone as mobile
    // This makes it easier to test mobile layouts in desktop browsers
    const result = isMobileUA || hasTouch || isSmallScreen; // Changed from (hasTouch && isSmallScreen)
    
    // Debug logging
    console.log('[MOBILE DETECTION - DEV MODE]', {
        ua: ua.substring(0, 50) + '...',
        isMobileUA,
        hasTouch,
        touchPoints,
        width,
        height,
        isSmallScreen,
        result
    });
    
    return result;
}

// Export all other functions from the original
export * from './dimensions.js';
