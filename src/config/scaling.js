// config/scaling.js
import { 
  detectDeviceType, 
  DEVICE_TYPES, 
  getDimensionsForDevice 
} from './dimensions.js';

export class ScalingManager {
    constructor(scene) {
      this.scene = scene;
      this.deviceType = detectDeviceType();
      
      // Set initial dimensions
      this.updateBaseDimensions();
      this.updateScaleRatios();
      
      // Listen for resize events
      if (this.scene.game && this.scene.game.events) {
        this.scene.game.events.on('resize', () => {
          // Update base dimensions when window size changes
          this.updateBaseDimensions();
          this.updateScaleRatios();
          console.log(`[ScalingManager] Resize detected, updated dimensions`);
        });
      }
    }
    
    // Set base dimensions based on device type and orientation
    updateBaseDimensions() {
      // Check if camera exists before accessing it
      let width, height;
      if (this.scene.cameras && this.scene.cameras.main) {
        width = this.scene.cameras.main.width;
        height = this.scene.cameras.main.height;
      } else {
        // Fallback to game dimensions if camera not ready
        width = this.scene.game.config.width;
        height = this.scene.game.config.height;
      }
      
      const isLandscape = width >= height;
      
      // For desktop, use standard dimensions
      if (this.deviceType === DEVICE_TYPES.DESKTOP) {
        if (isLandscape) {
          this.baseWidth = 1280;
          this.baseHeight = 720;
        } else {
          this.baseWidth = 405;
          this.baseHeight = 720;
        }
      } else if (this.deviceType === DEVICE_TYPES.TABLET) {
        // For tablets: use desktop dimensions when in landscape, phone dimensions when in portrait
        if (isLandscape) {
          // Use desktop dimensions for landscape tablets
          this.baseWidth = 1280;
          this.baseHeight = 720;
          console.log(`[ScalingManager] Tablet (landscape): Using desktop base dimensions ${this.baseWidth}x${this.baseHeight}`);
        } else {
          // Use phone dimensions for portrait tablets
          const phoneDimensions = getDimensionsForDevice(DEVICE_TYPES.PHONE, false);
          this.baseWidth = phoneDimensions.width;
          this.baseHeight = phoneDimensions.height;
          console.log(`[ScalingManager] Tablet (portrait): Using phone base dimensions ${this.baseWidth}x${this.baseHeight}`);
        }
      } else {
        // For phones, use dimensions from config
        const dimensions = getDimensionsForDevice(this.deviceType, isLandscape);
        this.baseWidth = dimensions.width;
        this.baseHeight = dimensions.height;
      }
    }
  
    updateScaleRatios() {
      // Check if camera exists before accessing it
      if (!this.scene.cameras || !this.scene.cameras.main) {
        // Camera not ready yet, use default scale
        this.scale = 1;
        this.scaleX = 1;
        this.scaleY = 1;
        this.textScale = 1;
        return;
      }
      
      const { width, height } = this.scene.cameras.main;
      
      // Calculate scale ratios
      const scaleX = width / this.baseWidth;
      const scaleY = height / this.baseHeight;
      
      // ALWAYS use uniform scaling to prevent stretching on any device
      this.scale = Math.min(scaleX, scaleY);
      this.scaleX = this.scale;
      this.scaleY = this.scale;
      
      // For text that might need different scaling
      this.textScale = Math.max(this.scale, 0.5); // Ensure text isn't too small
      
      // Enable diagnostic logging to help debug scaling issues
      console.log(`[ScalingManager] Base: ${this.baseWidth}x${this.baseHeight}, Camera: ${width}x${height}`);
      console.log(`[ScalingManager] Raw Scale - X: ${scaleX.toFixed(3)}, Y: ${scaleY.toFixed(3)}`);
      console.log(`[ScalingManager] Applied Uniform Scale: ${this.scale.toFixed(3)}, Device: ${this.deviceType}`);
    }

    buttonWidth(cameraWidth) {
        // Scale button width for all device types
        return 115 * this.scale;
    }

    buttonHeight(buttonWidth) {
        // Scale button height based on device type
        // Reduce desktop button height by 5px
        return (this.deviceType === DEVICE_TYPES.DESKTOP ? 30 : 40) * this.scale;
    }

    buttonSpacing(buttonHeight) {
        return buttonHeight;
    }
    
    // Helper functions for common scaling needs
    scaleValue(value) {
      return value * this.scale;
    }
    
    scaleValueX(value) {
      // Always use uniform scaling to prevent stretching
      return value * this.scale;
    }
    
    scaleValueY(value) {
      // Always use uniform scaling to prevent stretching
      return value * this.scale;
    }
    
    scaleText(size) {
      return Math.floor(size * this.textScale);
    }
    
    // Calculate responsive positions
    centerX() {
      return this.scene.cameras.main.width / 2;
    }
    
    centerY() {
      return this.scene.cameras.main.height / 2;
    }
    
    // Return position relative to screen size (percentage-based)
    widthPercent(percent) {
      return this.scene.cameras.main.width * (percent / 100);
    }
    
    heightPercent(percent) {
      return this.scene.cameras.main.height * (percent / 100);
    }
  }
