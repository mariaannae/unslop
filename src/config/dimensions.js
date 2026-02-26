// dimensions.js - Centralized configuration for all dimensions and ratios

/**
 * Improved mobile detection
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
    
    // Consider it mobile if:
    // 1. Has mobile user agent OR
    // 2. Has touch capability AND small screen OR
    // 3. Explicitly mobile/tablet in UA
    const result = isMobileUA || (hasTouch && isSmallScreen);
    
    // Debug logging
    console.log('[MOBILE DETECTION]', {
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

/**
 * Device type constants
 */
export const DEVICE_TYPES = {
    DESKTOP: "desktop",
    TABLET: "tablet",
    PHONE: "phone"
};

/**
 * Detect device type based on screen size and user agent
 * @returns {string} Device type
 */
export function detectDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    const width = window.screen.width;
    const height = window.screen.height;
    const minDim = Math.min(width, height);

    // iPad or Android tablet detection
    // Also detect iPad Pro with MacIntel platform and multiple touch points
    if (
        (ua.includes("ipad")) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        (ua.includes("android") && !ua.includes("mobile")) ||
        (minDim >= 600 && minDim < 900)
    ) {
        console.log("[DEVICE DETECTION] Tablet detected");
        return DEVICE_TYPES.TABLET;
    }
    // Phone detection
    if (
        (ua.includes("iphone")) ||
        (ua.includes("android") && ua.includes("mobile")) ||
        (minDim < 600)
    ) {
        console.log("[DEVICE DETECTION] Phone detected");
        return DEVICE_TYPES.PHONE;
    }
    // Default to desktop
    console.log("[DEVICE DETECTION] Desktop detected");
    return DEVICE_TYPES.DESKTOP;
}

/**
 * Base dimensions by device type and orientation
 */
export const BASE_DIMENSIONS = {
    [DEVICE_TYPES.DESKTOP]: {
        LANDSCAPE: {
            width: 1280,
            height: 720
        },
        PORTRAIT: {
            width: 720,
            height: 1280
        }
    },
    [DEVICE_TYPES.TABLET]: {
        LANDSCAPE: {
            width: 1000,
            height: 800
        },
        PORTRAIT: {
            width: 800,
            height: 1000
        }
    },
    [DEVICE_TYPES.PHONE]: {
        LANDSCAPE: {
            width: 1280,
            height: 720
        },
        PORTRAIT: {
            width: 720,
            height: 1280
        }
    }
};

/**
 * Calculate optimal game dimensions based on device and screen
 * @returns {object} Optimal dimensions and scale mode
 */
export function getOptimalDimensions() {
    // Use visualViewport if available for the most accurate visible area
    const viewportWidth = (window.visualViewport && window.visualViewport.width) ||
        window.innerWidth || document.documentElement.clientWidth || screen.width;
    const viewportHeight = (window.visualViewport && window.visualViewport.height) ||
        window.innerHeight || document.documentElement.clientHeight || screen.height;
    const aspectRatio = viewportWidth / viewportHeight;
    const isLandscape = aspectRatio >= 1;
    const deviceType = detectDeviceType();
    
    // Get dimensions based on device type
    let dimensions;
    
    // For desktop, ALWAYS use landscape dimensions
    if (deviceType === DEVICE_TYPES.DESKTOP) {
        // Always use landscape dimensions for desktop regardless of window size
        const baseHeight = 720;
        dimensions = {
            width: 1280,
            height: baseHeight
        };
        
        console.log(`[DIMENSIONS] Desktop base: ${dimensions.width}x${dimensions.height} (forced landscape)`);
        console.log(`[DIMENSIONS] Viewport: ${viewportWidth}x${viewportHeight} (aspect: ${aspectRatio.toFixed(2)})`);
    } else {
        // For ALL mobile devices (phones and tablets), ALWAYS use portrait dimensions
        dimensions = BASE_DIMENSIONS[DEVICE_TYPES.PHONE].PORTRAIT;
        console.log(`[DIMENSIONS] Mobile device (${deviceType}): Using portrait dimensions ${dimensions.width}x${dimensions.height}`);
    }
    
    return {
        width: dimensions.width,
        height: dimensions.height,
        isLandscape,
        deviceType,
        mode: Phaser.Scale.FIT,
        maxWidth: Math.round(viewportWidth),
        maxHeight: Math.round(viewportHeight)
    };
}

/**
 * Get dimensions for a specific device type and orientation
 * @param {string} deviceType - The device type
 * @param {boolean} isLandscape - Whether the orientation is landscape
 * @returns {object} Width and height
 */
export function getDimensionsForDevice(deviceType, isLandscape) {
    const orientation = isLandscape ? 'LANDSCAPE' : 'PORTRAIT';
    return BASE_DIMENSIONS[deviceType][orientation];
}

/**
 * Scale config options
 */
export const SCALE_CONFIG = {
    FIT: Phaser.Scale.FIT,
    CENTER_BOTH: Phaser.Scale.CENTER_BOTH
};
