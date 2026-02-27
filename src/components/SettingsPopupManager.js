// SettingsPopupManager.js - Extracted from BaseGameScene
// Manages the settings popup UI and interactions

import { BASIC_COLORS_HEX, SCENE_CONFIG } from '../config/design.js';
import ButtonFactory from '../utils/ButtonFactory.js';
import { getTextStyle } from '../config/textStyles.js';
import { detectDeviceType } from '../config/dimensions.js';

export class SettingsPopupManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = options;
        
        // Current values
        this.levelValue = options.levelValue || 1;
        this.topKValue = options.topKValue || 1;
        this.temperature = options.temperature || 0.5;
        this.frequencyPenalty = options.frequencyPenalty || 2.0;
        
        // Callbacks
        this.onLevelChange = options.onLevelChange || (() => {});
        this.onClose = options.onClose || (() => {});
        
        // State
        this.popup = null;
        this.isOpen = false;
        
        // Scaling
        this.scalingManager = scene.scalingManager;
    }
    
    /**
     * Open the settings popup
     */
    open() {
        if (this.isOpen) return;
        
        // Hide keyboard on mobile when opening settings
        if (this.scene.isMobile && this.scene._hiddenInput) {
            this.scene._hiddenInput.blur();
        }
        
        // Pause the timer when settings popup is opened
        if (this.scene.timerEvent && !this.scene.timerEvent.paused) {
            this.scene.timerEvent.paused = true;
        }
        
        // Calculate popup dimensions
        const { popupWidth, popupHeight, popupX, popupY } = this._calculateDimensions();
        
        // Create popup container
        this.popup = this.scene.add.container(0, 0).setDepth(999);
        
        // Create overlay
        this._createOverlay(popupX, popupY, popupWidth, popupHeight);
        
        // Create background
        this._createBackground(popupX, popupY, popupWidth, popupHeight);
        
        // Create UI elements
        const { levelSliderHandle, levelLabel } = this._createLevelSlider(popupX, popupY, popupWidth, popupHeight);
        const { tempSliderHandle, tempLabel } = this._createTemperatureSlider(popupX, popupY, popupWidth, popupHeight);
        
        // Create buttons
        this._createButtons(popupX, popupY, popupWidth, popupHeight);
        
        // Setup drag functionality
        this._setupSliderDrag(levelSliderHandle, levelLabel, tempSliderHandle, tempLabel);
        
        // Animate popup appearance
        this._animateIn();
        
        this.isOpen = true;
    }
    
    /**
     * Close the settings popup
     */
    close() {
        if (!this.isOpen || !this.popup) return;
        
        // Update level indicator
        if (this.scene.updateLevelModeIndicator) {
            this.scene.updateLevelModeIndicator();
        }
        
        // Resume the timer when settings popup is closed
        if (this.scene.timerEvent && this.scene.timerEvent.paused) {
            this.scene.timerEvent.paused = false;
        }
        
        // Clean up slider drag functionality
        if (this._sliderCleanup) {
            this._sliderCleanup();
            this._sliderCleanup = null;
        }
        
        // Clean up event handlers
        if (this._dragHandlers) {
            this.scene.input.off('dragstart', this._dragHandlers.dragstart);
            this.scene.input.off('drag', this._dragHandlers.drag);
            this.scene.input.off('dragend', this._dragHandlers.dragend);
            this._dragHandlers = null;
        }
        
        if (this._pointerMoveHandler) {
            this.scene.input.off('pointermove', this._pointerMoveHandler);
            this._pointerMoveHandler = null;
        }
        
        if (this._overlayHandler) {
            this.scene.input.off('pointerdown', this._overlayHandler);
            this._overlayHandler = null;
        }
        
        // Animate out and destroy
        this.scene.tweens.add({
            targets: this.popup,
            alpha: 0,
            scale: 0.8,
            duration: 200,
            ease: 'Back.In',
            onComplete: () => {
                if (this.popup) {
                    this.popup.destroy();
                    this.popup = null;
                }
            }
        });
        
        this.isOpen = false;
        
        // Call close callback
        this.onClose();
    }
    
    /**
     * Calculate popup dimensions
     * @private
     */
    _calculateDimensions() {
        const sm = this.scalingManager;
        const popupWidth = sm.scaleValue(400);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        const gap2 = sm.scaleValue(this.scene.isMobile ? 50 : 30);
        const sliderRowHeight2 = sm.scaleValue(44);
        const gap3 = sm.scaleValue(15);
        const buttonRowHeight = sm.scaleValue(54);
        const bottomPadding = sm.scaleValue(30);
        
        const popupHeight = bannerHeight + gap1 + sliderRowHeight + gap2 + sliderRowHeight2 + gap3 + buttonRowHeight + bottomPadding;
        const popupX = this.scene.cameras.main.centerX - popupWidth / 2;
        const popupY = this.scene.cameras.main.centerY - popupHeight / 2;
        
        return { popupWidth, popupHeight, popupX, popupY };
    }
    
    /**
     * Create overlay background
     * @private
     */
    _createOverlay(popupX, popupY, popupWidth, popupHeight) {
        const overlay = this.scene.add.rectangle(
            0, 0,
            this.scene.sys.game.canvas.width,
            this.scene.cameras.main.height,
            0x000000, 0.7
        ).setOrigin(0, 0);
        
        this.popup.addAt(overlay, 0);
        
        // Add pointer handler to close on outside click
        const pointerDownHandler = (pointer) => {
            if (pointer.x < popupX || pointer.x > popupX + popupWidth ||
                pointer.y < popupY || pointer.y > popupY + popupHeight) {
                this.close();
            }
        };
        
        this.scene.input.on('pointerdown', pointerDownHandler);
        this._overlayHandler = pointerDownHandler;
    }
    
    /**
     * Create popup background
     * @private
     */
    _createBackground(popupX, popupY, popupWidth, popupHeight) {
        const COLORS_HEX = this.scene.COLORS_HEX;
        
        const popupBg = this.scene.add.graphics();
        popupBg.fillStyle(COLORS_HEX.BACKGROUND, 0.95);
        popupBg.fillRoundedRect(popupX, popupY, popupWidth, popupHeight, 15);
        popupBg.lineStyle(3, COLORS_HEX.BOX_OUTLINE, 1);
        popupBg.strokeRoundedRect(popupX, popupY, popupWidth, popupHeight, 15);
        popupBg.setDepth(0);
        this.popup.add(popupBg);
        
        // Create title banner
        const bannerHeight = 54;
        const bannerBg = this.scene.add.graphics();
        bannerBg.fillStyle(COLORS_HEX.ACCENT, 0.8);
        bannerBg.fillRoundedRect(popupX, popupY, popupWidth, bannerHeight, {
            tl: 15, tr: 15, bl: 0, br: 0
        });
        bannerBg.lineStyle(2, 0xffffff, 0.5);
        bannerBg.strokeRoundedRect(popupX, popupY, popupWidth, bannerHeight, {
            tl: 15, tr: 15, bl: 0, br: 0
        });
        bannerBg.setDepth(1);
        this.popup.add(bannerBg);
        
        // Add title text
        const deviceType = detectDeviceType();
        const uiScale = this.scene.registry && this.scene.registry.get && this.scene.registry.get('uiScale') || 1;
        const titleStyle = getTextStyle('settings', deviceType, this.scene.mode || 'basic', uiScale);
        const title = this.scene.add.text(
            this.scene.cameras.main.centerX,
            popupY + bannerHeight / 2,
            'SETTINGS',
            {
                ...titleStyle,
                fontSize: `${parseInt(titleStyle.fontSize) * 1.4}px`,
                fill: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5, 0.5);
        title.setDepth(2);
        this.popup.add(title);
        
        // Add close button
        const minTouchSize = 44;
        const closeBtn = this.scene.add.text(
            popupX + popupWidth - 25,
            popupY + 20,
            '✕',
            {
                ...titleStyle,
                fill: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5)
        .setInteractive({
            useHandCursor: true,
            hitArea: new Phaser.Geom.Rectangle(
                -minTouchSize / 2,
                -minTouchSize / 2,
                minTouchSize,
                minTouchSize
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains
        })
        .on('pointerover', () => closeBtn.setScale(1.2))
        .on('pointerout', () => closeBtn.setScale(1))
        .on('pointerdown', () => this.close());
        this.popup.add(closeBtn);
    }
    
    /**
     * Create level slider
     * @private
     */
    _createLevelSlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager;
        const sliderWidth = sm.scaleValue(150);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        
        let yCursor = popupY + bannerHeight + gap1;
        
        // Level slider row
        const levelLabelX = popupX + sm.scaleValue(30);
        const levelLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.scene.registry && this.scene.registry.get && this.scene.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.scene.mode || 'basic', uiScale);
        const levelLabel = this.scene.add.text(
            levelLabelX, levelLabelY,
            `Level: ${this.levelValue}`,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`,
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.popup.add(levelLabel);
        
        const levelSliderX = levelLabelX + levelLabel.displayWidth + gap;
        const levelSliderY = levelLabelY;
        
        // Create slider track
        const isMobileDevice = this.scene.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const levelSlider = this.scene.add.graphics();
        levelSlider.fillStyle(0x444444, 1);
        levelSlider.fillRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        
        const levelT = (this.levelValue - 1) / 2;
        const fillWidth = sliderWidth * levelT;
        if (fillWidth > 0) {
            levelSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            levelSlider.fillRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
        levelSlider.lineStyle(2, 0xffffff, 0.3);
        levelSlider.strokeRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.popup.add(levelSlider);
        
        // Create slider handle
        const levelSliderHandle = this._createSliderHandle(levelSliderX, levelSliderY, sliderWidth, 'level');
        this.popup.add(levelSliderHandle);
        
        // Setup interactions
        this._setupLevelSliderInteractions(levelSlider, levelSliderHandle, levelLabel, levelSliderX, levelSliderY, sliderWidth);
        
        return { levelSliderHandle, levelLabel };
    }
    
    /**
     * Create temperature slider
     * @private
     */
    _createTemperatureSlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager;
        const sliderWidth = sm.scaleValue(150);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        const gap2 = sm.scaleValue(this.scene.isMobile ? 50 : 30);
        
        let yCursor = popupY + bannerHeight + gap1 + sliderRowHeight + gap2;
        
        const tempLabelX = popupX + sm.scaleValue(30);
        const tempLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.scene.registry && this.scene.registry.get && this.scene.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.scene.mode || 'basic', uiScale);
        const tempLabel = this.scene.add.text(
            tempLabelX, tempLabelY,
            `Randomness: `,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`,
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.popup.add(tempLabel);
        
        const tempSliderX = tempLabelX + tempLabel.displayWidth + gap;
        const tempSliderY = tempLabelY;
        
        const isMobileDevice = this.scene.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const tempSlider = this.scene.add.graphics();
        tempSlider.fillStyle(0x444444, 1);
        tempSlider.fillRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        
        const tempT = (this.temperature - 0.1) / 1.4;
        const tempFillWidth = sliderWidth * tempT;
        if (tempFillWidth > 0) {
            tempSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            tempSlider.fillRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, tempFillWidth, sliderTrackHeight);
        }
        tempSlider.lineStyle(2, 0xffffff, 0.3);
        tempSlider.strokeRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.popup.add(tempSlider);
        
        const tempSliderHandle = this._createSliderHandle(tempSliderX, tempSliderY, sliderWidth, 'temperature');
        this.popup.add(tempSliderHandle);
        
        this._setupTemperatureSliderInteractions(tempSlider, tempSliderHandle, tempLabel, tempSliderX, tempSliderY, sliderWidth);
        
        return { tempSliderHandle, tempLabel };
    }
    
    /**
     * Create a slider handle
     * @private
     */
    _createSliderHandle(sliderX, sliderY, sliderWidth, type) {
        const sm = this.scalingManager;
        const isMobileDevice = this.scene.isMobile;
        
        let t;
        if (type === 'level') {
            t = (this.levelValue - 1) / 2;
        } else {
            t = (this.temperature - 0.1) / 1.4;
        }
        
        const sliderMinX = sliderX + sm.scaleValue(5);
        const sliderMaxX = sliderX + sliderWidth - sm.scaleValue(5);
        const handleX = Phaser.Math.Linear(sliderMinX, sliderMaxX, t);
        
        const handleSize = isMobileDevice ? sm.scaleValue(24) : sm.scaleValue(20);
        
        const textureKey = `${type}SliderHandle`;
        if (!this.scene.textures.exists(textureKey)) {
            const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
            graphics.fillStyle(BASIC_COLORS_HEX.ACCENT, 1);
            graphics.fillCircle(handleSize/2, handleSize/2, handleSize/2);
            graphics.lineStyle(2, 0xffffff, 1);
            graphics.strokeCircle(handleSize/2, handleSize/2, handleSize/2);
            graphics.generateTexture(textureKey, handleSize, handleSize);
            graphics.destroy();
        }
        
        const handle = this.scene.add.sprite(handleX, sliderY, textureKey);
        handle.setDepth(3);
        
        const hitArea = isMobileDevice ? 44 : 60;
        handle.setInteractive({ 
            hitArea: new Phaser.Geom.Circle(handleSize/2, handleSize/2, hitArea/2), 
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            useHandCursor: true
        });
        
        handle.on('pointerover', () => {
            handle.setScale(1.2);
            handle.setTint(0xffff00);
        });
        
        handle.on('pointerout', () => {
            if (!handle.getData('isDragging')) {
                handle.setScale(1);
                handle.clearTint();
            }
        });
        
        return handle;
    }
    
    /**
     * Setup level slider interactions
     * @private
     */
    _setupLevelSliderInteractions(levelSlider, levelSliderHandle, levelLabel, sliderX, sliderY, sliderWidth) {
        const levelSliderMinX = sliderX + 5;
        const levelSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.scene.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        levelSliderHandle.setData('minX', levelSliderMinX);
        levelSliderHandle.setData('maxX', levelSliderMaxX);
        levelSliderHandle.setData('type', 'level');
        levelSliderHandle.setData('sliderTrack', levelSlider);
        levelSliderHandle.setData('sliderX', sliderX);
        levelSliderHandle.setData('sliderWidth', sliderWidth);
        levelSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        levelSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                const clampedX = Phaser.Math.Clamp(pointer.x, levelSliderMinX, levelSliderMaxX);
                levelSliderHandle.x = clampedX;
                const newLevel = Math.round(Phaser.Math.Linear(1, 3, (clampedX - levelSliderMinX) / (levelSliderMaxX - levelSliderMinX)));
                
                this._updateSliderFill(levelSliderHandle);
                
                if (newLevel !== this.levelValue) {
                    this.levelValue = newLevel;
                    levelLabel.setText(`Level: ${this.levelValue}`);
                    this.onLevelChange(this.levelValue);
                }
                
                if (isMobileDevice) {
                    levelSliderHandle.emit('pointerdown', pointer);
                    this.scene.input.emit('dragstart', pointer, levelSliderHandle);
                }
            });
    }
    
    /**
     * Setup temperature slider interactions
     * @private
     */
    _setupTemperatureSliderInteractions(tempSlider, tempSliderHandle, tempLabel, sliderX, sliderY, sliderWidth) {
        const tempSliderMinX = sliderX + 5;
        const tempSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.scene.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        tempSliderHandle.setData('minX', tempSliderMinX);
        tempSliderHandle.setData('maxX', tempSliderMaxX);
        tempSliderHandle.setData('type', 'temperature');
        tempSliderHandle.setData('sliderTrack', tempSlider);
        tempSliderHandle.setData('sliderX', sliderX);
        tempSliderHandle.setData('sliderWidth', sliderWidth);
        tempSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        tempSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                const clampedX = Phaser.Math.Clamp(pointer.x, tempSliderMinX, tempSliderMaxX);
                tempSliderHandle.x = clampedX;
                const newTemp = Phaser.Math.Linear(0.1, 1.5, (clampedX - tempSliderMinX) / (tempSliderMaxX - tempSliderMinX));
                
                this._updateSliderFill(tempSliderHandle);
                
                if (Math.abs(newTemp - this.temperature) > 0.01) {
                    this.temperature = newTemp;
                    tempLabel.setText(`Randomness: `);
                }
                
                if (isMobileDevice) {
                    tempSliderHandle.emit('pointerdown', pointer);
                    this.scene.input.emit('dragstart', pointer, tempSliderHandle);
                }
            });
    }
    
    /**
     * Update slider fill
     * @private
     */
    _updateSliderFill(handle) {
        const sliderTrack = handle.getData('sliderTrack');
        if (!sliderTrack) return;
        
        const minX = handle.getData('minX');
        const maxX = handle.getData('maxX');
        const sliderX = handle.getData('sliderX');
        const sliderY = handle.y;
        const sliderTrackHeight = handle.getData('sliderTrackHeight') || 
            (this.scene.isMobile ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12));
        
        sliderTrack.clear();
        sliderTrack.fillStyle(0x444444, 1);
        sliderTrack.fillRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
        
        const fillWidth = handle.x - sliderX;
        if (fillWidth > 0) {
            sliderTrack.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            sliderTrack.fillRect(sliderX, sliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
        
        sliderTrack.lineStyle(2, 0xffffff, 0.3);
        sliderTrack.strokeRoundedRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
    }
    
    /**
     * Create buttons
     * @private
     */
    _createButtons(popupX, popupY, popupWidth, popupHeight) {
        const bottomMargin = 40;
        const buttonHeight = this.scalingManager.buttonHeight();
        const confirmBtnY = popupY + popupHeight - bottomMargin - buttonHeight/2;
        
        const confirmBtn = ButtonFactory.createButton(
            this.scene,
            'APPLY',
            () => this.close(),
            this.scene.cameras.main.centerX,
            confirmBtnY
        );
        this.popup.add(confirmBtn);
    }
    
    /**
     * Setup slider drag functionality
     * @private
     */
    _setupSliderDrag(levelSliderHandle, levelLabel, tempSliderHandle, tempLabel) {
        const setupSliderDrag = (handle, sliderType, label) => {
            if (!handle) return;
            
            this.scene.input.setDraggable(handle);
            handle.setData('isDragging', false);
            
            handle.on('drag', (pointer, dragX, dragY) => {
                const minX = handle.getData('minX');
                const maxX = handle.getData('maxX');
                const newX = Phaser.Math.Clamp(dragX, minX, maxX);
                handle.x = newX;
                
                if (sliderType === 'level') {
                    const newLevel = Math.round(Phaser.Math.Linear(1, 3, (newX - minX) / (maxX - minX)));
                    if (newLevel !== this.levelValue) {
                        this.levelValue = newLevel;
                        label.setText(`Level: ${this.levelValue}`);
                        this.onLevelChange(this.levelValue);
                    }
                } else if (sliderType === 'temperature') {
                    const newTemp = Phaser.Math.Linear(0.1, 1.5, (newX - minX) / (maxX - minX));
                    if (Math.abs(newTemp - this.temperature) > 0.01) {
                        this.temperature = newTemp;
                        label.setText(`Randomness: `);
                    }
                }
                
                this._updateSliderFill(handle);
            });
            
            handle.on('dragstart', function(pointer) {
                this.setData('isDragging', true);
                this.setScale(1.2);
                this.setTint(0xffff00);
                this.scene.input.setDefaultCursor('grabbing');
            });
            
            handle.on('dragend', function(pointer) {
                this.setData('isDragging', false);
                this.setScale(1);
                this.clearTint();
                this.scene.input.setDefaultCursor('default');
            });
        };
        
        setupSliderDrag(levelSliderHandle, 'level', levelLabel);
        setupSliderDrag(tempSliderHandle, 'temperature', tempLabel);
        
        this._sliderCleanup = () => {
            if (levelSliderHandle) levelSliderHandle.removeAllListeners();
            if (tempSliderHandle) tempSliderHandle.removeAllListeners();
        };
    }
    
    /**
     * Animate popup in
     * @private
     */
    _animateIn() {
        this.popup.setScale(0.8);
        this.scene.tweens.add({
            targets: this.popup,
            scale: 1,
            duration: 200,
            ease: 'Back.Out'
        });
    }
}
