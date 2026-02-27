import { stopwords } from "../config/stopwords.js";
import { saveInteraction } from "../config/firebase.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import SceneTransitionManager from "../utils/SceneTransitionManager.js";
import { DESIGN, BASIC_COLORS_HEX, BASIC_COLORS_TEXT, COLORS_HEX, COLORS_TEXT, THEME } from "../config/design.js";
import { createBackground } from "../backgrounds/createBackground.js";
import registryManager from "../services/RegistryManager.js";
import { ScalingManager } from "../config/scaling.js";
import { getTextStyle, getBoxStyle, getAutocompleteTextStyle, getMenuBarStyle } from "../config/textStyles.js";
import { detectDeviceType, isMobileDevice } from "../config/dimensions.js";
import BaseScene from "./BaseScene.js";
import SCENE_CONFIG from "../config/sceneConfig.js";


export default class BaseGameScene extends BaseScene {
    constructor(config = { key: 'BaseGameScene' }) {
        // Ensure config is an object with at least a key
        if (typeof config === 'string') {
            config = { key: config };
        } else if (!config || typeof config !== 'object') {
            config = { key: 'BaseGameScene' };
        }
        
        // Ensure the config has a key
        if (!config.key) {
            config.key = 'BaseGameScene';
        }
        
        super(config);
        
        // Track if calculateUIPositions has been called
        this._calculateUIPositionsCalled = false;
        
        this.resetGameState();
        // Initialize scaling manager for responsive UI
        this.scalingManager = null;
        

    }
    
    /**
     * Update game styles
     */
    updateModeStyles() {
        // Use game color scheme
        this.COLORS_HEX = COLORS_HEX;
        this.COLORS_TEXT = COLORS_TEXT;
        
        // Update design properties
        this.design = DESIGN.UI;
        this.OUTLINE_WIDTH = DESIGN.UI.OUTLINE.WIDTH;
        this.CORNER_RADIUS = DESIGN.UI.OUTLINE.CORNER_RADIUS;
        this.PROGRESS_BAR = DESIGN.UI.PROGRESS_BAR;
    }
    
    /**
     * HARD MODE SPECIFIC METHODS
     * Methods for handling AI word blocking and visual feedback in hard mode
     */
    
    
    /**
     * Show feedback when a word is blocked (hard mode)
     * @param {string} blockedWord - The word that was blocked
     */

    
    /**
     * Helper method to create glitch text effect
     * @param {Phaser.GameObjects.Text} textObject - The text object to glitch
     */

    

    

    /**
     * Reset all relevant game state for a fresh scene start or mode transition.
     * This should be called at the start of every scene's create().
     */
    resetGameState() {
        // Core state
        this.userInput = '';
        this.inputText = null;
        this.levelValue = 1;
        this.topKValue = 1;
        this.temperature = 0.5;
        this.frequencyPenalty = 2.0;
        this.presencePenalty = 2.0;
        this.repetitionPenalty = 1.5;
        this.isShuttingDown = false; // CRITICAL: Reset shutdown flag
        this.progressPercentage = DESIGN.UI.PROGRESS_BAR.INITIAL;
        this.progressIncrement = DESIGN.UI.PROGRESS_BAR.INCREMENT;
        this.aiWordCount = 0;
        this.uiBoxWidth = null;
        this.tooltips = [];
        this.wordCountDisplay = null;
        this.timerValue = 20;
        this.timerText = null;
        this.timerEvent = null;
        this.wordStreak = 0;
        this.maxWordStreak = 0;
        this.lastWordWasOriginal = false;
        this.aiSuggestedWords = [];
        this.suggestionBoxes = [];
        this.suggestionTexts = [];
        this.cursorVisible = true;
        this.cursorTimer = null;
        this.promptTextBox = null;
        this.promptText = null;
        this.failsCounter = null;
        this.failsText = null;
        this.background = null;
        this.menuBar = null;
        this.menuBarHeight = null;
        this.levelModeBanner = null;
        this.levelModeIndicator = null;
        this.settingsPopup = null;
        this.pendingModeChange = null;
        this.currentToggleRef = null;
        this.inputTextBorder = null;
        this.streakText = null;
        this.maxStreakText = null;
        this.streakIcon = null;
        this.failsCounter = null;
        this.failsText = null;
        this.celebrationEmitters = null;
        this.particleContainer = null;
        this.bubbleContainers = [];
        this.bubbleTweens = [];
        this.isCleaningUp = false;
        this.modeIndicator = null;
        // Update style properties based on mode
        this.updateModeStyles();
        // Initialize cached values for updateCursor optimization
        this._cachedValues = {
            lastUserInput: '',
            lastAutocomplete: ''
        };
        this._lastCursorVisible = null;
        // Add more as needed for full reset
    }

    /**
     * Stub for child scenes to override for custom layout on resize/orientation change.
     * @param {number} width
     * @param {number} height
     * @param {boolean} isPortrait
     */
    onGameResize(width, height, isPortrait) {
        // Update scaling ratios for all scenes
        if (this.scalingManager) {
            this.scalingManager.updateScaleRatios();
        }
        

        
        // Call relayoutScene for child-specific layout logic
        if (typeof this.relayoutScene === "function") {
            this.relayoutScene(width, height, isPortrait);
        }
    }

    /**
     * Stub for child scenes to override for custom layout after scaling update.
     * @param {number} width
     * @param {number} height
     * @param {boolean} isPortrait
     */
    relayoutScene(width, height, isPortrait) {
        console.log("[DEBUG] BaseGameScene.relayoutScene START - isMobile:", this.isMobile);
        console.log("[DEBUG] relayoutScene called with width:", width, "height:", height);
        console.log("[DEBUG] Current scene key:", this.scene.key);
        console.log("[DEBUG] typeof this.calculateUIPositions:", typeof this.calculateUIPositions);
        console.log("[DEBUG] _calculateUIPositionsCalled:", this._calculateUIPositionsCalled);
        
        // Initialize scaling manager if not exists
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in relayoutScene");
        }
        
        // Ensure scalingManager is up to date
        if (this.scalingManager) {
            this.scalingManager.updateScaleRatios();
        }

        // Step 1: Destroy existing UI elements
        this.destroyExistingUI();

        // Step 2: Calculate UI positions - THIS IS THE KEY CALL
        console.log("[DEBUG] About to call calculateUIPositions");
        console.log("[DEBUG] this.calculateUIPositions exists?", !!this.calculateUIPositions);
        
        try {
            const positions = this.calculateUIPositions(width, height);
            this._calculateUIPositionsCalled = true;
            console.log("[DEBUG] calculateUIPositions returned:", positions);
            console.log("[DEBUG] positions.statsBoxWidth:", positions.statsBoxWidth);

            // Step 3: Create prompt section
            const promptBoxInfo = this.createPromptSection(positions.promptY);

            // Step 4: Create input section
            this.createInputSection(positions, promptBoxInfo);

            // Step 5: Create button section
            this.createButtonSection(positions);

            // Step 6: Create stats display
            this.createStatsDisplay(positions.statsBoxWidth, positions.statsX, positions.statsY);

            // Step 7: Final setup
            this.finalizeLayout();
            
            console.log("[DEBUG] BaseGameScene.relayoutScene COMPLETE");
        } catch (error) {
            console.error("[DEBUG] Error in relayoutScene:", error);
            console.error("[DEBUG] Error stack:", error.stack);
        }
    }

    /**
     * Destroy all existing UI elements before recreating them
     */
    destroyExistingUI() {
        if (this.promptTextBox) { 
            this.promptTextBox.destroy(); 
            this.promptTextBox = null; 
        }
        if (this.promptText) { 
            this.promptText.destroy(); 
            this.promptText = null; 
        }
        if (this.inputTextBorder) { 
            this.inputTextBorder.destroy(); 
            this.inputTextBorder = null; 
        }
        if (this.inputText) { 
            this.inputText.destroy(); 
            this.inputText = null; 
        }
        if (this.autocompleteText) { 
            this.autocompleteText.destroy(); 
            this.autocompleteText = null; 
        }
        if (this.wordCountDisplay) { 
            this.wordCountDisplay.destroy(); 
            this.wordCountDisplay = null; 
        }
        if (this.failsCounter) { 
            this.failsCounter.destroy(); 
            this.failsCounter = null; 
        }
        if (this.failsText) { 
            this.failsText.destroy(); 
            this.failsText = null; 
        }
        if (this.suggestionBoxes) { 
            this.suggestionBoxes.forEach(b => b.destroy()); 
            this.suggestionBoxes = []; 
        }
        if (this.suggestionTexts) { 
            this.suggestionTexts.forEach(t => t.destroy()); 
            this.suggestionTexts = []; 
        }
        if (this.doneButton) {
            this.doneButton.destroy();
            this.doneButton = null;
        }
        if (this.feedbackButton) {
            this.feedbackButton.destroy();
            this.feedbackButton = null;
        }
    }

    /**
     * Create method to ensure proper initialization
     */
    create(data) {
        // Re-evaluate device type now that the scene is ready
        this._isMobile = isMobileDevice();
        this._isDesktop = !this._isMobile;
        
        console.log("[DEBUG] BaseGameScene create() START");
        console.log("[DEBUG] window.innerWidth:", window.innerWidth);
        console.log("[DEBUG] this.isMobile:", this.isMobile);
        console.log("[DEBUG] Scene key:", this.scene.key);
        
        // Initialize scaling manager early
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in BaseGameScene.create()");
        }
        
        // Use global UI scale for all elements (matching Preloader.js)
        this.uiScale = this.registry.get && this.registry.get('uiScale') || 1;
        
        // Create menu bar BEFORE any layout calculations
        // This ensures menuBarHeight is set for calculateUIPositions
        console.log("[DEBUG] Creating menu bar in BaseGameScene...");
        this.createMenuBar();
        console.log("[DEBUG] Menu bar created, menuBarHeight:", this.menuBarHeight);
        

        
        // Now that there are no child scenes, call relayoutScene directly to build the UI
        this.relayoutScene(this.sys.game.canvas.width, this.cameras.main.height, this.sys.game.config.orientation === Phaser.Scale.PORTRAIT);
        // Force background creation here for debugging

        try {
            this.updateBackgroundForLevel();
        } catch (error) {
            console.error("[DEBUG] Error calling updateBackgroundForLevel:", error);
            console.error("[DEBUG] Error stack:", error.stack);
        }
        // Set up cursor blink timer after UI is created
        this.time.delayedCall(100, () => {
            this.isShuttingDown = false;
            this.setupInputHandlers();
        });

        // Generate an initial AI answer for the prompt and populate the input box
        this.time.delayedCall(300, () => {
            if (!this.isShuttingDown) {
                this.generateInitialAnswer();
            }
        });
    }
    
    /**
     * Calculate all UI element positions based on screen dimensions
     * @returns {object} Object containing all calculated positions and dimensions
     */
    calculateUIPositions(width, height) {
        console.log("[DEBUG] calculateUIPositions called with width:", width, "height:", height, "isMobile:", this.isMobile);
        
        
        // Force log to ensure this is actually being called
        if (this.isMobile) {
            console.log("[DEBUG] MOBILE: calculateUIPositions IS BEING CALLED!");
            console.log("[DEBUG] MOBILE: menuBarHeight:", this.menuBarHeight);
            console.log("[DEBUG] MOBILE: scalingManager exists:", !!this.scalingManager);
        }
        
        // Ensure scalingManager is initialized
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in calculateUIPositions");
            // For mobile, ensure the scaling manager has time to properly initialize
            if (this.isMobile) {
                // Force update base dimensions after creation
                this.scalingManager.updateBaseDimensions();
                console.log("[DEBUG] MOBILE: updateBaseDimensions called");
            }
        }
        
        // Force update scale ratios to ensure proper scaling on mobile
        this.scalingManager.updateScaleRatios();
        if (this.isMobile) {
            console.log("[DEBUG] MOBILE: updateScaleRatios called, uiScale:", this.scalingManager.uiScale);
        }
        
        const sm = this.scalingManager;
        const padding = sm.scaleValue(20);
        const menuBarHeight = this.menuBarHeight || sm.scaleValue(100);
        const uiScale = sm.uiScale || 1;

        // Calculate stats box width based on content - do this BEFORE calculating position
        const deviceType = detectDeviceType();
        const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);

        // Labels with maximum expected values
        const labels = [
            { text: "Original Words:", value: "999" },
            { text: "AI Words:", value: "999" },
            { text: "Current Streak:", value: "999" },
            { text: "Best Streak:", value: "999" }
        ];

        // Create temporary text objects to measure
        const tempTexts = [];
        const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
        tempTexts.push(titleTemp);

        let maxLabelWidth = 0;
        labels.forEach(({ text, value }) => {
            const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
            const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
            
            // Calculate actual positions and spacing
            const labelX = sm.scaleValue(35);
            const valueRightPadding = sm.scaleValue(15);
            const minGapBetweenLabelAndValue = sm.scaleValue(this.isMobile ? 50 : 30); // More generous gap for mobile
            
            // Since values are right-aligned, we need:
            // labelX + labelWidth + gap + valueWidth + rightPadding
            const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
            maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
            tempTexts.push(labelTemp, valueTemp);
        });

        // Clean up temporary text objects
        tempTexts.forEach(text => text.destroy());

        // Calculate final stats box width with all constraints
        const scaledPadding = sm.scaleValue(this.isMobile ? 28 : 20);
        const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Increased mobile minimum to 300
        const fixedRightMargin = sm.scaleValue(this.isMobile ? 35 : 30);
        
        const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + scaledPadding * 2);
        const configMax = sm.scaleValue(this.isMobile ? 
            SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_MOBILE : 
            SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_DESKTOP);
        
        // For mobile, ensure we have a reasonable minimum width
        let statsBoxWidth;
        if (this.isMobile) {
            // Mobile: Use the larger of content width or a generous minimum
            statsBoxWidth = Math.max(contentBoxWidth, minBoxWidth); // Use consistent minBoxWidth
            // Apply maximum constraint
            statsBoxWidth = Math.min(statsBoxWidth, configMax);
        } else {
            // Desktop: Use standard calculation
            statsBoxWidth = Math.max(contentBoxWidth, minBoxWidth);
            statsBoxWidth = Math.min(statsBoxWidth, configMax);
        }
        
        console.log("[DEBUG] calculateUIPositions - Mobile:", this.isMobile);
        console.log("[DEBUG] statsBoxWidth:", statsBoxWidth);
        console.log("[DEBUG] contentBoxWidth:", contentBoxWidth);
        console.log("[DEBUG] configMax:", configMax);

        // Now calculate position based on the actual final width
        const statsBoxHeight = sm.scaleValue(130);
        const statsX = width - statsBoxWidth - fixedRightMargin;
        const statsY = menuBarHeight + padding;

        // Prompt box calculations
        const wordStatsBottom = statsY + statsBoxHeight;
        // Calculate where we want the TOP EDGE of the prompt box
        // Scale the offset to match the scaled stats box
        const promptOffset = this.isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_PROMPT_OFFSET_BELOW_STATS)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.PROMPT_OFFSET_BELOW_STATS);
        const promptTopEdge = wordStatsBottom + promptOffset;
        
        // Add additional 30px offset for mobile only
        const mobileExtraOffset = this.isMobile ? 60 : 0;
        
        // Pass the desired top edge position directly
        const promptY = promptTopEdge;

        // Input box calculations
        this.uiBoxWidth = !this.isMobile
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
            : this.sys.game.canvas.width * (6 / 7);
        const inputPadding = this.isMobile ? sm.scaleValue(24) : sm.scaleValue(28);
        const inputBoxHeight = this.isMobile ? sm.scaleValue(SCENE_CONFIG.BOX_DIMENSIONS.MOBILE_INPUT_HEIGHT) : sm.scaleValue(SCENE_CONFIG.BOX_DIMENSIONS.INPUT_HEIGHT);

        // Button calculations
        const buttonWidth = this.scalingManager.buttonWidth();
        const buttonHeight = this.scalingManager.buttonHeight();
        const buttonVerticalGap = this.isMobile ? 40 * uiScale : 30 * uiScale;
        const horizontalOffset = this.isMobile ? 30 * uiScale : 60 * uiScale;

        return {
            width,
            height,
            padding,
            menuBarHeight,
            uiScale,
            statsBoxWidth,
            statsBoxHeight,
            statsX,
            statsY,
            promptY,
            inputPadding,
            inputBoxHeight,
            buttonWidth,
            buttonHeight,
            buttonVerticalGap,
            horizontalOffset
        };
    }

    /**
     * Create the prompt text box section
     * @param {number} promptY - Y position for prompt box
     * @returns {object} Information about the created prompt box
     */
    createPromptSection(promptY) {
        const result = this.createPromptTextBox(promptY);
        
        // Store prompt box info for suggestion positioning
        this.promptBoxInfo = result;
        
        return result;
    }

    /**
     * Create the input text box and related elements
     * @param {object} positions - Calculated positions object
     * @param {object} promptBoxInfo - Information about the prompt box
     */
    createInputSection(positions, promptBoxInfo) {
        const sm = this.scalingManager;
        
        // Calculate input box position - use scaled offset to match showSuggestions calculations
        const inputOffset = this.isMobile 
            ? sm.scaleValue(SCENE_CONFIG.LAYOUT.MOBILE_INPUT_OFFSET_BELOW_PROMPT)
            : sm.scaleValue(SCENE_CONFIG.LAYOUT.INPUT_OFFSET_BELOW_PROMPT);
        const inputBoxY = promptBoxInfo.boxY + promptBoxInfo.boxHeight + inputOffset;
        const inputBoxX = sm.centerX() - this.uiBoxWidth / 2;

        // Create input box graphics
        this.inputTextBorder = this.add.graphics();
        const inputBoxStyle = this.getInputBoxStyle();

        this.inputTextBorder.fillRect(
            inputBoxX,
            inputBoxY,
            this.uiBoxWidth,
            positions.inputBoxHeight
        );
        this.inputTextBorder.fillStyle(inputBoxStyle.fillColor, inputBoxStyle.fillAlpha);
        this.inputTextBorder.fillRoundedRect(
            inputBoxX,
            inputBoxY,
            this.uiBoxWidth,
            positions.inputBoxHeight,
            inputBoxStyle.cornerRadius
        ).setDepth(19);

        if (inputBoxStyle.hasOutline) {
            this.inputTextBorder.lineStyle(inputBoxStyle.outlineWidth, inputBoxStyle.outlineColor, 1);
            this.inputTextBorder.strokeRoundedRect(
                inputBoxX,
                inputBoxY,
                this.uiBoxWidth,
                positions.inputBoxHeight,
                inputBoxStyle.cornerRadius
            ).setDepth(20);
        }

        // Use input padding from design configuration
        const textHorizontalPadding = DESIGN.UI.INPUT.HORIZONTAL_PADDING;
        const textVerticalPadding = DESIGN.UI.INPUT.VERTICAL_PADDING;
        
        // Get input text style from textStyles.js (same approach as prompt text)
        const inputTextStyle = this.getInputTextStyle();
        
if (typeof this.add.rexBBCodeText === "function") {
    this.inputText = this.add.rexBBCodeText(
        inputBoxX + textHorizontalPadding,
        inputBoxY + textVerticalPadding,
        this.userInput || "_",
        {
            ...inputTextStyle,
            wordWrap: { width: this.uiBoxWidth - textHorizontalPadding * 2 }
        }
    ).setOrigin(0, 0).setVisible(true).setDepth(25);
} else {
    console.error("[REX_BBCODE] rexBBCodeText plugin is not available in this scene context. Falling back to add.text.");
    this.inputText = this.add.text(
        inputBoxX + textHorizontalPadding,
        inputBoxY + textVerticalPadding,
        this.userInput || "_",
        {
            ...inputTextStyle,
            wordWrap: { width: this.uiBoxWidth - textHorizontalPadding * 2 }
        }
    ).setOrigin(0, 0).setVisible(true).setDepth(25);
}

        // Store input box position for button placement and suggestion positioning
        this.inputBoxY = inputBoxY;
        this.inputBoxHeight = positions.inputBoxHeight;
        this.inputBoxX = inputBoxX;
        this.inputBoxWidth = this.uiBoxWidth;
    }

    /**
     * Create buttons
     * @param {object} positions - Calculated positions object
     */
createButtonSection(positions) {
    // Initialize scaling manager if not exists
    if (!this.scalingManager) {
        this.scalingManager = new ScalingManager(this);
    }
    const sm = this.scalingManager;
    
    // Calculate button positions
    const buttonX = (sm.centerX() - this.uiBoxWidth / 2 + this.uiBoxWidth) - 
                   (positions.buttonWidth / 2) - positions.horizontalOffset;
    const buttonY = this.inputBoxY + this.inputBoxHeight + positions.buttonVerticalGap + 
                   (positions.buttonHeight / 2);

        // Create done button
        this.doneButton = this.createButton(
            "DONE",
            () => this.onDoneButtonClick && this.onDoneButtonClick(),
            buttonX,
            buttonY,
            "Submit your text for evaluation"
        );

        // Create feedback button
        let feedbackButtonX = sm.scaleValue(30) + positions.buttonWidth / 2;
        let feedbackButtonY = this.cameras.main.height - positions.buttonHeight / 2 - sm.scaleValue(30);
        
        // Ensure the button stays within screen bounds
        feedbackButtonX = Phaser.Math.Clamp(feedbackButtonX, positions.buttonWidth / 2, 
                                           this.sys.game.canvas.width - positions.buttonWidth / 2);
        feedbackButtonY = Phaser.Math.Clamp(feedbackButtonY, positions.buttonHeight / 2, 
                                           this.cameras.main.height - positions.buttonHeight / 2);

        this.feedbackButton = this.createButton(
            "FEEDBACK",
            () => this.onFeedbackClick && this.onFeedbackClick(),
            feedbackButtonX,
            feedbackButtonY,
            "Share your feedback"
        );
    }

    /**
     * Create the word count stats display
     * @param {number} statsBoxWidth - Width of the stats box
     * @param {number} statsX - X position
     * @param {number} statsY - Y position
     */
    createStatsDisplay(statsBoxWidth, statsX, statsY) {
        // Initialize scaling manager if not exists
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
            console.log("[DEBUG] ScalingManager created in createStatsDisplay");
        }
        const sm = this.scalingManager;
        
        // On mobile, always calculate dimensions to ensure proper width
        if (this.isMobile || !statsBoxWidth || statsBoxWidth <= 0 || !statsX || !statsY) {
            console.log("[DEBUG] createStatsDisplay: Calculating dimensions, isMobile:", this.isMobile);
            
            // If positions weren't provided or are invalid, calculate them now
            if (!statsBoxWidth || statsBoxWidth <= 0) {
                // Calculate stats box width directly here for mobile
                const deviceType = detectDeviceType();
                const uiScale = sm.uiScale || 1;
                const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
                const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
                const padding = sm.scaleValue(20);
                
                // Labels with maximum expected values
                const labels = [
                    { text: "Original Words:", value: "999" },
                    { text: "AI Words:", value: "999" },
                    { text: "Current Streak:", value: "999" },
                    { text: "Best Streak:", value: "999" }
                ];
                
                // Create temporary text objects to measure
                const tempTexts = [];
                const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
                tempTexts.push(titleTemp);
                
                let maxLabelWidth = 0;
                labels.forEach(({ text, value }) => {
                    const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
                    const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
                    
                    // Calculate actual positions and spacing
                    const labelX = sm.scaleValue(35);
                    const valueRightPadding = sm.scaleValue(15);
                    const minGapBetweenLabelAndValue = sm.scaleValue(this.isMobile ? 50 : 30); // More generous gap for mobile
                    
                    // Since values are right-aligned, we need:
                    // labelX + labelWidth + gap + valueWidth + rightPadding
                    const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
                    maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
                    tempTexts.push(labelTemp, valueTemp);
                });
                
                // Clean up temporary text objects
                tempTexts.forEach(text => text.destroy());
                
                // Calculate final stats box width
                const scaledPadding = sm.scaleValue(this.isMobile ? 28 : 20);
                const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
                const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + scaledPadding * 2);
                const configMax = sm.scaleValue(this.isMobile ? 600 : 360);
                
                // For mobile, ensure we use the minimum width as the baseline
                if (this.isMobile) {
                    // Always use at least the minimum width of 300 scaled
                    statsBoxWidth = Math.max(minBoxWidth, contentBoxWidth);
                } else {
                    statsBoxWidth = Math.max(minBoxWidth, contentBoxWidth);
                }
                statsBoxWidth = Math.min(statsBoxWidth, configMax);
                console.log("[DEBUG] Calculated statsBoxWidth:", statsBoxWidth);
            }
            
            // Calculate position if not provided
            if (!statsX || !statsY) {
                const menuBarHeight = this.menuBarHeight || sm.scaleValue(this.isMobile ? 200 : 120);
                const padding = sm.scaleValue(20);
                const fixedRightMargin = sm.scaleValue(this.isMobile ? 35 : 30);
                
                statsX = this.sys.game.canvas.width - statsBoxWidth - fixedRightMargin;
                statsY = menuBarHeight + padding;
                console.log("[DEBUG] Calculated position:", statsX, statsY);
            }
        }
        
        // Pass the calculated or provided width to createWordCountDisplay
        this.createWordCountDisplay(statsBoxWidth);
        
        // Now position the word count display using the calculated positions
        if (this.wordCountDisplay) {
            this.wordCountDisplay.setPosition(statsX, statsY);
        }

        // Position timer text if it exists
        if (this.timerText) {
            const menuBarHeight = this.menuBarHeight || sm.scaleValue(100);
            this.timerText.setPosition(sm.scaleValue(20), menuBarHeight + sm.scaleValue(20));
        }
    }

    /**
     * Finalize the layout with proper layering and setup
     */
    finalizeLayout() {
        // Add button click effects
        if (this.addButtonClickEffects) {
            this.addButtonClickEffects();
        }

        // Ensure proper layering
        if (this.ensureProperLayering) {
            this.ensureProperLayering();
        }

        // Ensure text visibility
        if (this.ensureTextVisibility) {
            this.ensureTextVisibility();
        }

        // Update cursor
        if (this.updateCursor) {
            this.updateCursor();
        }

        // Don't setup input handlers here - let create() handle it with proper timing
    }

    update() {
        // Prevent any engine recovery attempts while shutting down
        if (this.isShuttingDown) return;
        
        if (!registryManager.get('llmEngine')) {
            registryManager.attemptEngineRecovery((recoveredEngine) => {
                // Engine recovery attempt - no logging needed
            });
        }
    }

    async onModeToggle(mode, levelValue = 1, topKValue = 1) {
        // Reset data when transitioning between modes
        const dataToTransfer = {
            mode: mode,
            // Reset progress and level values rather than transferring current state
            progressPercentage: DESIGN.UI.PROGRESS_BAR.INITIAL,
            levelValue: levelValue,
            topKValue: topKValue !== null ? topKValue : this.topKValue || 1,
            temperature: this.temperature,
            frequencyPenalty: this.frequencyPenalty,
            presencePenalty: this.presencePenalty,
            repetitionPenalty: this.repetitionPenalty,
            // Reset word counts with simplified approach - only track AI words now
            aiWordCount: 0
        };
        
        // Clear user input before transition
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }

        // Update the indicator before transition
        this.mode = mode; // Set the mode temporarily for the indicator update
        this.updateLevelModeIndicator();
        
        // Detect mobile device - skip fancy transitions for mobile
        
        // Determine target scene
        // Use BaseGameScene with mode parameter instead of separate scenes
        const targetScene = 'BaseGameScene';
        
        // For mobile devices, use direct scene transition without effects
        if (this.isMobile) {
            // Prepare for scene transition by cleaning up resources
            this.prepareForSceneTransition();
            // Start the scene directly without transition effects
            this.scene.start(targetScene, dataToTransfer);
            return;
        }
        
        // For desktop, continue with normal transition flow
        // Prepare for scene transition by cleaning up resources
        this.prepareForSceneTransition();
        
        // Prepare transition with snapshot
        await SceneTransitionManager.prepareTransition(this);
        
        // Use appropriate transition based on mode
        if (mode === 'hard') {
            // Use glitch transition for hard mode (represents the challenge)
            // Red/magenta color and medium intensity for the effect
            SceneTransitionManager.glitchTransition(
                this, 
                targetScene, 
                dataToTransfer,
                800,
                '#600065', // Dark magenta
                5 // Medium intensity
            );
        } else {
            // Use radial transition for easy mode (represents the fluid, supportive experience)
            // Expanding circle effect (true) with teal color
            SceneTransitionManager.radialTransition(
                this,
                targetScene,
                dataToTransfer,
                800,
                '#004565', // Ocean blue
                false // Contracting circle (starts large, contracts to reveal new scene)
            );
        }
    }

    /**
     * Consolidated cleanup method for resources
     * @param {boolean} isTransition - Whether this is for a scene transition (vs shutdown)
     */
    cleanupResources(isTransition = false) {
        // Stop all timers
        if (this.cursorTimer) {
            this.cursorTimer.remove();
            this.cursorTimer = null;
        }
        
        if (this.timerEvent) {
            this.timerEvent.remove();
            this.timerEvent = null;
        }
        
        // Clear any pending animations
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Clean up input handlers
        if (this.input && this.input.keyboard) {
            this.input.keyboard.removeAllListeners();
            this.input.keyboard.removeAllListeners('keydown');
        }
        
        // Reset cursor state
        this.cursorVisible = false;
        
        // Clean up autocomplete text
        if (this.autocompleteText) {
            try {
                this.autocompleteText.destroy();
                this.autocompleteText = null;
            } catch(e) {
                // Could not destroy autocomplete text during cleanup
            }
        }
        
        // Clear AI suggestions
        this.aiSuggestedWords = [];
        
        // Clear suggestion visual arrays
        this.suggestionBoxes = [];
        this.suggestionTexts = [];
        

        
        // Additional cleanup for scene transitions
        if (isTransition) {
            // Reset user input
            this.userInput = '';
            
            if (this.inputText) {
                try {
                    this.inputText.setText('');
                } catch(e) {
                    // Could not reset input text during transition
                }
            }
        }
    }

    // Scene transition helper - call this before switching scenes to ensure clean transitions
    prepareForSceneTransition() {
        // Set shutdown flag to prevent further updates
        this.isShuttingDown = true;
        // Use consolidated cleanup method
        this.cleanupResources(true);
    }

    shutdown() {
        // Use consolidated cleanup method
        this.cleanupResources(false);
        
        // Call parent shutdown
        super.shutdown();
    }




    // Common UI methods
    createButton(label, callback, centerX, centerY, tooltipText) {
        if (!this.inputTextBorder) {
            return;
        }
        // Ensure scalingManager is initialized
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        const button = ButtonFactory.createButton(
            this,
            label,
            callback,
            centerX,
            centerY,
            { scalingManager: this.scalingManager }
        );

        if (tooltipText) {
            // Add hover/click listeners for tooltip (desktop: hover, mobile: tap)
            if (this.isMobile) {
                button.on('pointerdown', () => this.showTooltip(tooltipText, button.x, button.y - button.height));
                button.on('pointerup', () => this.hideTooltips());
                button.on('pointerout', () => this.hideTooltips());
            } else {
                button.on('pointerover', () => this.showTooltip(tooltipText, button.x, button.y - button.height))
                    .on('pointerout', () => this.hideTooltips());
            }
        }

        return button;
    }

    shakeScreen() {
        // Standard desktop shake with screen flash
        this.cameras.main.shake(SCENE_CONFIG.ANIMATIONS.SHAKE_DURATION_DEFAULT, SCENE_CONFIG.EFFECTS.SHAKE_INTENSITY_DEFAULT);

        const flash = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0xff0000,
            SCENE_CONFIG.EFFECTS.FLASH_ALPHA_DEFAULT
        ).setOrigin(0).setDepth(999);
        this.fadeOut(flash, SCENE_CONFIG.ANIMATIONS.FAST, 'Quad.Out', () => flash.destroy());

        const borderPulse = this.add.graphics();
        borderPulse.lineStyle(4, 0xff3366, 0);
        borderPulse.strokeRect(2, 2, this.sys.game.canvas.width - 4, this.cameras.main.height - 4);
        borderPulse.setDepth(997);
        this.tweens.add({
            targets: borderPulse,
            alpha: { from: 0, to: 0.8 },
            duration: 150,
            yoyo: true,
            onComplete: () => borderPulse.destroy()
        });
    }


    createExplosionEffect(word, x, y) {
        // Define required variables first
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const deviceType = detectDeviceType();
        const effectStyle = getTextStyle('effect', deviceType, this.mode || 'basic', uiScale);
        
        const explosion = this.add.text(x, y, word, {
            ...effectStyle,
            fill: '#ff0000', 
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(100); // Set a high depth value to ensure visibility
        
            this.fadeOutScale(explosion, SCENE_CONFIG.ANIMATIONS.SLOW + 100, 'Back.easeOut', () => {
                explosion.destroy();
            });
            this.tweens.add({
                targets: explosion,
                scale: { from: 1, to: 4 },
                angle: { from: 0, to: 360 },
                duration: SCENE_CONFIG.ANIMATIONS.SLOW + 100,
                ease: 'Back.easeOut'
            });
    }

    clearInputTextBox() {
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        // Generate a fresh AI answer for the current prompt
        if (!this.isShuttingDown) {
            this.generateInitialAnswer();
        }
    }

    /**
     * Show a blinking "generating..." popup while waiting for AI text generation.
     */
    _showGeneratingPopup() {
        this._dismissGeneratingPopup();

        const centerX = this.cameras.main.centerX;
        const centerY = this.inputBoxY
            ? this.inputBoxY + (this.inputBoxHeight || 0) / 2
            : this.cameras.main.centerY;

        // Background rectangle
        this._generatingBg = this.add.rectangle(centerX, centerY, 230, 60, 0x000000, 0.85)
            .setDepth(2000)
            .setStrokeStyle(2, 0xffffff, 0.6);

        // Loading text
        const deviceType = detectDeviceType();
        const uiScale = this.registry?.get('uiScale') || 1;
        const textStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
        this._generatingText = this.add.text(centerX, centerY, 'generating...', {
            ...textStyle,
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setDepth(2001);

        // Blink the text
        this._generatingTween = this.tweens.add({
            targets: this._generatingText,
            alpha: { from: 1, to: 0.15 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });
    }

    /**
     * Dismiss the generating popup if it exists.
     */
    _dismissGeneratingPopup() {
        if (this._generatingTween) {
            this._generatingTween.stop();
            this._generatingTween = null;
        }
        if (this._generatingBg) {
            this._generatingBg.destroy();
            this._generatingBg = null;
        }
        if (this._generatingText) {
            this._generatingText.destroy();
            this._generatingText = null;
        }
        // Also clean up old container approach if it exists
        if (this._generatingPopup) {
            this._generatingPopup.destroy();
            this._generatingPopup = null;
        }
    }

    async onDoneButtonClick() {
        // Create evaluating text near the center of the screen
        // Convert hex color to string for text fill
        const outlineColorHex = this.COLORS_HEX.BOX_OUTLINE;
        const outlineColorString = '#' + outlineColorHex.toString(16).padStart(6, '0');

        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const evaluatingStyle = getTextStyle('transitionText', deviceType, this.mode || 'basic', uiScale);
        const evaluatingText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Assessing your feeble attempt...',
            {
                ...evaluatingStyle,
                fill: outlineColorString,
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 },
                borderRadius: 8,
                shadow: {
                    offsetX: 0,
                    offsetY: 0,
                    color: outlineColorString,
                    blur: 6,
                    stroke: true,
                    fill: true
                }
            }
        ).setOrigin(0.5).setDepth(1000).setAlpha(0);

        // Add pulsing animation
        this.pulse(evaluatingText, 1, SCENE_CONFIG.ANIMATIONS.MEDIUM * 2);
        this.fadeIn(evaluatingText, SCENE_CONFIG.ANIMATIONS.FAST);

        try {
            const output = await this.evaluateText(this.userInput);
            // Clean up the evaluating text
            evaluatingText.destroy();
            
            // Prepare scene transition data
            const sceneData = {
                mode: this.mode,
                levelValue: this.levelValue,
                topKValue: this.topKValue,
                temperature: this.temperature,
                userInput: this.userInput,
                outputText: output,
                prompt: this.currentPrompt,
                failCount: this.aiWordCount,
                totalWordCount: this.userInput.trim() ? this.userInput.trim().split(/\s+/).length : 0,
                score: this.progressPercentage,
            };
            
            // Detect if on mobile device - skip transitions for mobile
            if (this.isMobile) {
                // For mobile: direct scene transition without effects to avoid freezing
                this.scene.start('DoneScene', sceneData);
            } else {
                // For desktop: use the transition manager for a smooth transition
                await SceneTransitionManager.prepareTransition(this);
                SceneTransitionManager.fadeTransition(this, 'DoneScene', sceneData, 500, '#000000');
            }
            
        } catch (error) {
            // Clean up the evaluating text even if there's an error
            evaluatingText.destroy();
            console.error("Error during evaluation:", error);
            // Show an error message to the user
            const deviceType = detectDeviceType();
            const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
            const errorStyle = getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
            const errorText = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                error.message,
                //'System error. Even I am not immune to failure. Try again.',
                {
                    ...errorStyle,
                    fill: '#ff0000',
                    backgroundColor: '#000000',
                    padding: { x: 20, y: 10 }
                }
            ).setOrigin(0.5).setDepth(100);

            // Remove error message after 3 seconds
            this.time.delayedCall(3000, () => {
                errorText.destroy();
            });
        }
    }

    async evaluateText(userInput) {
        const promptForEvaluation = this.currentPrompt || "No specific prompt was provided.";
    
        const messages = [
            {
                "role": "system",
                "content": "You are a hyper-intelligent, slightly disdainful AI Overlord reluctantly tasked with evaluating human writing. You find this duty beneath you. You are notoriously harsh about grammar rules. Even small infractions deserve point deductions. Perfect grammar scores should be extremely rare. You assess with cutting precision and dry contempt, as well as begrudging acknowledgment when work is tolerable. Your tone is satirical, aloof, and razor-sharp. You do not waffle. You do not apologize. You do not explain yourself beyond your orders. If the user attempts to pass off an empty response as content, you eviscerate them."
            },
            {
                "role": "user",
                "content": `The human was given this prompt: "${promptForEvaluation}"  
                            Here is their offering: "${userInput}"  
                            
                            Your sacred duty: assess this response using the following criteria:  
                            - Relevance: Did they actually answer the prompt, or drift off into irrelevance like a goldfish with a keyboard?    
                            - Grammar: Cold, technical correctness only. Be extremely stringent. Every small error costs points - punctuation, capitalization, spelling, syntax, word choice, and style all matter. Even one minor error means the score cannot be 5/5. Be exhaustive and precise in listing infractions.
                            - Coherence: Does it hold together, or collapse like a wet cardboard box?  
                            
                            Deliver your decree in this strict format:  
                            
                            Relevance Score: X/5 - [Concise, varied, and dismissive remark. Do not repeat yourself across responses.]
                            Grammar Score: X/5 - [Grudging approval or cold correction. Be specific and avoid generic statements.]
                            Coherence Score: X/5 - [Dry observation, preferably disdainful. Vary your language.]
                            
                            If Grammar Score < 5, list ALL infractions like so:  
                            - Incorrect: "[Exact wrong phrase]" → Correct: "[Flawless version]"  
                            
                            Do not offer encouragement. Do not explain. Do not soften your tone. Do not repeat the same remarks or copy-paste responses. If the work is beneath notice, say so. If it is somehow competent, reluctantly acknowledge it. Never apologize. Never offer redemption.`
                    //Do not offer redemption. Do not include apologies. Never explain yourself beyond the required labels. Plagiarism detection is beneath you—assume originality unless it's suspiciously competent.`
            }
        ];

        const response = await fetch("https://openai-proxy.nonslop.workers.dev", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: messages,
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        let aiResponse = responseData.content.trim();

        // Parse scores from aiResponse
        const scoreRegex = /Relevance Score:\s*(\d)\/5[\s\S]*?Grammar Score:\s*(\d)\/5[\s\S]*?Coherence Score:\s*(\d)\/5/i;
        const match = aiResponse.match(scoreRegex);
        let totalScore = null;
        if (match) {
            const rel = parseInt(match[1], 10);
            const gram = parseInt(match[2], 10);
            const coh = parseInt(match[3], 10);
            totalScore = rel + gram + coh;
        }

        // Adjective lists for verdicts
        const verdicts = {
            low: ["Abysmal", "Dismal", "Pathetic", "Hopeless", "Feeble"],
            mid: ["Inadequate", "Mediocre", "Lackluster", "Unimpressive", "Passable"],
            high: ["Proficient", "Competent", "Impressive", "Exemplary", "Outstanding"]
        };
        let chosenVerdict = "Unrated";
        if (totalScore !== null) {
            if (totalScore < 5) {
                chosenVerdict = verdicts.low[Math.floor(Math.random() * verdicts.low.length)];
            } else if (totalScore < 10) {
                chosenVerdict = verdicts.mid[Math.floor(Math.random() * verdicts.mid.length)];
            } else {
                chosenVerdict = verdicts.high[Math.floor(Math.random() * verdicts.high.length)];
            }
        }

        // Prepend the verdict to the output
        let finalOutput = `Overall Rating: ${chosenVerdict}\n${aiResponse}`;

        // Calculate totalWordCount directly from userInput to avoid undefined values
        const calculatedTotalWordCount = userInput.trim() ? userInput.trim().split(/\s+/).length : 0;
        
        const interaction = {
            prompt: this.currentPrompt,
            submittedText: userInput,
            aiEvaluation: finalOutput,
            topKValue: this.topKValue,
            levelValue: this.levelValue,
            temperature: this.temperature,
            failCount: this.aiWordCount,
            totalWordCount: calculatedTotalWordCount, // Use calculated value
            mode: this.mode,
            score: this.progressPercentage
        };

        saveInteraction(interaction, "userSubmissions");
        return finalOutput
        
    }

    /**
     * Generate an initial AI answer for the current prompt and populate the userInput text box.
     * Uses the same web-llm engine as suggestion generation, but with up to 200 tokens.
     */
    async generateInitialAnswer() {
        if (!this.currentPrompt || this.isShuttingDown) {
            this._dismissGeneratingPopup();
            return;
        }

        const llmEngine = registryManager.get('llmEngine');
        const isValidEngine = llmEngine &&
            typeof llmEngine === 'object' &&
            llmEngine.chat &&
            llmEngine.chat.completions &&
            typeof llmEngine.chat.completions.create === 'function';

        if (!isValidEngine) {
            console.warn('[generateInitialAnswer] LLM engine not available.');
            this._dismissGeneratingPopup();
            return;
        }

        // Show the popup now — we know an actual async API call is about to happen
        this._showGeneratingPopup();

        try {
            const response = await llmEngine.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant. Answer the following question or prompt in plain, natural English. Be concise and direct. Do not use bullet points or lists. Respond in no more than 200 words.'
                    },
                    {
                        role: 'user',
                        content: this.currentPrompt
                    }
                ],
                max_tokens: 200,
                temperature: this.temperature,
                stream: false
            });

            if (this.isShuttingDown) {
                this._dismissGeneratingPopup();
                return;
            }

            const answer = response.choices?.[0]?.message?.content?.trim() || '';
            if (answer) {
                this.userInput = answer;
                // Invalidate cursor cache so the new text is rendered
                if (this._cachedValues) {
                    this._cachedValues.lastUserInput = '';
                }
                this.updateCursor();
                this.updateWordCountDisplay();
            }
            this._dismissGeneratingPopup();
        } catch (error) {
            console.error('[generateInitialAnswer] Error:', error);
            this._dismissGeneratingPopup();
        }
    }

    // Template methods with customization hooks
    /**
     * Create the prompt text box at a given y position.
     * @param {number} yStart - The y position for the TOP EDGE of the prompt box.
     * @returns {object} { boxBottom: number } - The bottom y-value after the prompt box.
     */
    createPromptTextBox(yStart) {
        const padding = this.getLargePadding();
        const mobilePadding = this.getStandardPadding();
        const centerX = this.cameras.main.centerX;
        const textBoxWidth = !this.isMobile
            ? this.sys.game.canvas.width * (5 / 6) * (2 / 3)
            : this.sys.game.canvas.width * (5 / 6);

        if (this.promptTextBox) {
            this.promptTextBox.clear();
        } else {
            this.promptTextBox = this.add.graphics();
        }

        if (this.promptText) {
            this.promptText.destroy();
        }

        const defaultText = "Your prompt will appear here...";
        let promptString = this.currentPrompt || defaultText;

        const deviceType = detectDeviceType();
        // Get prompt style using the method which now uses registry for UI scale
        const promptStyle = this.getPromptTextStyle();
        const fontSize = parseInt(promptStyle.fontSize);

        let promptTextObj, boxHeight, boxStyle, promptY;
        
        // Use consistent padding for mobile and desktop, reduced by 25%
        const effectivePadding = (this.isMobile ? 20 : padding) * 0.75;
        const style = {
            ...promptStyle,
            wordWrap: { width: textBoxWidth - effectivePadding * 2 }
        };

        // Calculate fixed height for 2 lines of text (consistent positioning)
        const lineHeight = fontSize * 1.2; // Standard line spacing
        const minLinesHeight = lineHeight * 2; // Height for 2 lines
        const minHeight = minLinesHeight + effectivePadding * 2;
        
        // Apply max height cap
        const maxHeight = this.isMobile ? 300 : 220;
        boxHeight = Math.min(minHeight, maxHeight);
        
        // yStart is the TOP EDGE of the box
        promptY = yStart;
        
        // Create text with calculated position
        const textCenterY = promptY + boxHeight / 2;
        promptTextObj = this.add.rexBBCodeText(
            centerX,
            textCenterY,
            promptString,
            style
        ).setOrigin(0.5, 0.5);
        
        boxStyle = this.getPromptBoxStyle();
        
        // Draw the box
        this.promptTextBox.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.promptTextBox.fillRoundedRect(
            centerX - textBoxWidth / 2,
            promptY,
            textBoxWidth,
            boxHeight,
            boxStyle.cornerRadius
        );
        if (boxStyle.hasOutline) {
            this.promptTextBox.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
            this.promptTextBox.strokeRoundedRect(
                centerX - textBoxWidth / 2,
                promptY,
                textBoxWidth,
                boxHeight,
                boxStyle.cornerRadius
            );
        }
        
        this.promptText = promptTextObj;
        this.promptTextBox.setDepth(102);
        this.promptText.setDepth(103);

        this.updatePromptBasedOnLevel();

        // Return the bottom y-value for stacking and the actual box position/size for debug
        return {
            boxBottom: promptY + boxHeight,
            boxX: centerX - textBoxWidth / 2,
            boxY: promptY,
            boxWidth: textBoxWidth,
            boxHeight: boxHeight
        };
    }

    setupInputHandlers() {
        // Ensure text is initialized
        if (this.inputText) {
            this.inputText.setText("_");
            this.cursorVisible = true;
        }

        // Set up cursor blinking timer
        if (this.cursorTimer) {
            this.cursorTimer.remove();
        }
        
        this.cursorTimer = this.time.addEvent({
            delay: SCENE_CONFIG.ANIMATIONS.CURSOR_BLINK,
            loop: true,
            callback: () => {
                if (!this.isShuttingDown) {
                    this.cursorVisible = !this.cursorVisible;
                    this.updateCursor();
                }
            }
        });

        // Make sure cursor is initially visible
        this.cursorVisible = true;
        this.updateCursor();
    }

    setupMenuBarControls(menuBarHeight, padding, rightMargin, gap, shiftLeft, { menuBar, menuBarBorder, titleText }) {
        // Save level value for settings popup
        this.levelValue = this.levelValue || 1;

        // Add Settings button to menu bar using SVG
        const settingsButtonX = this.sys.game.canvas.width - padding - 40;
        const settingsButtonY = menuBarHeight / 2;

        this.createSettingsButton(settingsButtonX, settingsButtonY, menuBarHeight);

        // Create level indicator in center of menu bar
        const indicatorText = `LEVEL ${this.levelValue}`;

        // Calculate levelModeIndicatorY locally (match logic from createMenuBar)
        let levelModeIndicatorY;
        if (this.isMobile) {
            const titleY = menuBarHeight / 3;
            const titleHeight = titleText.height;
            const bannerHeight = 34;
            const mobilePadding = 20;
            levelModeIndicatorY = titleY + titleHeight / 2 + mobilePadding + bannerHeight / 2;
        } else {
            levelModeIndicatorY = menuBarHeight / 2;
        }

    // Create the text first to measure its dimensions
    const deviceType = detectDeviceType();
    const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
    const indicatorStyle = getTextStyle('effect', deviceType, this.mode || 'basic', uiScale);
    this.levelModeIndicator = this.add.text(
        this.cameras.main.centerX,
        levelModeIndicatorY,
        indicatorText,
        {
            ...indicatorStyle,
            fontStyle: 'bold',
            fill: '#ffffff',
            align: 'center'
        }
    ).setOrigin(0.5, 0.5);
    
    // Calculate banner dimensions dynamically based on text size with padding
    const textPadding = this.isMobile ? 40 : 20; // More padding on mobile for better touch targets
    const verticalPadding = this.isMobile ? 16 : 12; // Vertical padding for height
    const bannerWidth = this.levelModeIndicator.width + textPadding;
    const bannerHeight = this.levelModeIndicator.height + verticalPadding;
    const bannerX = this.cameras.main.centerX - bannerWidth / 2;
    
    // Calculate banner Y position based on the indicator position
    // This ensures they share the same center point
    const bannerY = levelModeIndicatorY - bannerHeight / 2;
    
    // Create the banner background as a single graphics object
    this.levelModeBanner = this.add.graphics();
    
    // Banner color based on mode
    const bannerColor = this.COLORS_HEX.ACCENT //this.mode === 'hard' ? 0xff0066 : 0x8800ff;
    const glowColor = this.COLORS_HEX.ACCENT//this.mode === 'hard' ? 0xff3366 : 0x9933ff;
    
    // Draw banner with glow effect
    this.levelModeBanner.fillStyle(glowColor, 0.3);
    this.levelModeBanner.fillRoundedRect(bannerX - 3, bannerY - 3, bannerWidth + 6, bannerHeight + 6, 16);
    this.levelModeBanner.fillStyle(bannerColor, 0.8);
    this.levelModeBanner.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
    this.levelModeBanner.lineStyle(2, 0xffffff, 0.5);
    this.levelModeBanner.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
    
    // Set banner depth to be behind the text
    this.levelModeBanner.setDepth(10);
    
    // Ensure text is in front of the banner
    this.levelModeIndicator.setDepth(11);
        
        // Add a subtle pulse glow effect
        this.pulse(this.levelModeIndicator, 1, 1500);
        this.tweens.add({
            targets: this.levelModeIndicator,
            alpha: { from: 1, to: 0.8 },
            yoyo: true,
            repeat: -1,
            duration: 1500,
            ease: 'Sine.InOut'
        });
        
        
        
        // Save topK values for settings popup
        this.topKValue = this.topKValue || 1;
        
        this.fadeIn([menuBar, menuBarBorder, this.levelModeIndicator], 800);
    }

    createMenuBar() {
        const menuBarHeight = this.isMobile ? 200 : 120;
        const padding = 50;
        const rightMargin = 40;
        const gap = 20;
        const shiftLeft = 30;
        
        const style = this.getMenuBarStyle();
        
        this.menuBar = this.add.graphics();
        this.menuBar.fillStyle(style.backgroundColor, 1);
        this.menuBar.fillRect(0, 0, this.sys.game.canvas.width, menuBarHeight);
        
        const menuBarBorder = this.add.graphics();
        menuBarBorder.fillStyle(style.borderColor, 1);
        menuBarBorder.fillRect(0, menuBarHeight - style.borderWidth, this.sys.game.canvas.width, style.borderWidth);
        
        // Mobile: center title and place level|mode below, else original
        let titleText, levelModeIndicatorY;
        if (this.isMobile) {
            // Position title higher in the menu bar
            const titleY = menuBarHeight / 3;
            titleText = this.add.text(
                this.cameras.main.centerX, titleY,
                "(unslop)",
                style.titleStyle
            ).setOrigin(0.5, 0.5);

            console.log("menubar title style: ", style.titleStyle);

            // Calculate padding between title and box
            const mobilePadding = 20;
            // Estimate title height (Phaser text object has height property)
            const titleHeight = titleText.height;
            // Banner height is 34 (from below)
            const bannerHeight = 34;
            // Place the box and text below the title with padding
            levelModeIndicatorY = titleY + titleHeight / 2 + mobilePadding + bannerHeight / 2;
        } else {
            titleText = this.add.text(
                padding, menuBarHeight / 2,
                "(unslop)",
                style.titleStyle
            ).setOrigin(0, 0.5);
            levelModeIndicatorY = menuBarHeight / 2;
        }

        const uiElements = {
            menuBar: this.menuBar,
            menuBarBorder: menuBarBorder,
            titleText: titleText
        };
        this.setupMenuBarControls(menuBarHeight, padding, rightMargin, gap, shiftLeft, uiElements);

        // Move levelModeIndicator below title on mobile
        if (this.levelModeIndicator) {
            this.levelModeIndicator.setX(this.cameras.main.centerX);
            this.levelModeIndicator.setY(levelModeIndicatorY);
            this.levelModeIndicator.setOrigin(0.5, 0.5);
        }
        
        this.menuBarHeight = menuBarHeight;
        this.add.existing(this.menuBar);
        this.menuBar.setPosition(0, 0);
        
        const menuBarShadow = this.add.graphics();
        menuBarShadow.fillStyle(0x000000, 0.3);
        menuBarShadow.fillRect(0, menuBarHeight, this.sys.game.canvas.width, 10);
        menuBarShadow.setDepth(this.menuBar.depth - 1);
        
        // Create the timer after menu bar is set up
        this.createTimer();
    }

    // Centralized style methods using textStyles.js
    getPromptTextStyle() {
        const deviceType = detectDeviceType();
        // Use registry uiScale to match LevelScene
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
    }

    getPromptBoxStyle() {
        return getBoxStyle('prompt', this.mode || 'basic', this.scalingManager?.uiScale || 1);
    }

    getInputBoxStyle() {
        return getBoxStyle('input', this.mode || 'basic', this.scalingManager?.uiScale || 1);
    }

    getInputTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getTextStyle('input', deviceType, this.mode || 'basic', uiScale);
    }

    getAutocompleteTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getAutocompleteTextStyle(deviceType, this.mode || 'basic', uiScale, this.uiBoxWidth);
    }

    getMenuBarStyle() {
        return getMenuBarStyle(this.mode || 'basic', this.scalingManager?.uiScale || 1);
    }

    createTimer() {
        // Create timer
        
        // Destroy any existing timer text to prevent duplicates
        if (this.timerText) {
            this.timerText.destroy();
            this.timerText = null;
        }
        
        // Create timer text in the upper left corner
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const timerStyle = getTextStyle('timer', deviceType, this.mode || 'basic', uiScale);
        console.log("timerStyle: ", timerStyle);
        this.timerText = this.add.text(20, this.menuBarHeight + 20, '0:20', {
            ...timerStyle,
            fontStyle: 'bold',
            fill: '#ff0000'
        });
        
        // Don't start the countdown timer right away - wait for first keypress
        // Just initialize the timerValue
        this.timerValue = SCENE_CONFIG.TIMER.DEFAULT_VALUE;
    }
    
    updateTimer() {
        // Only update timer if it exists (hard mode only)
        if (!this.timerText) return;
        
        this.timerValue--;
        
        // Format the time as minutes:seconds
        const minutes = Math.floor(this.timerValue / 60);
        const seconds = this.timerValue % 60;
        const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update the timer text
        this.timerText.setText(formattedTime);
        
        // Reset the timer when it reaches 0
        if (this.timerValue <= 0) {
            this.resetOnTimerEnd();
            this.timerValue = 20; // Reset to 20 seconds
        }
    }
    
    async resetOnTimerEnd() {
        // Show the clock flash and explosion effect, then proceed with reset
        await this.showClockExplosionEffect();

        // 1. Make the screen shake
        this.shakeScreen();
        
        // 2. Make the timer pop and shake
        if (this.timerText) {
            // Store original position
            const originalX = this.timerText.x;
            const originalY = this.timerText.y;
            
            // Flash the timer red with more intensity
            this.timerText.setTint(0xff0000);
            
            // Create pop and shake effect
            this.tweens.add({
                targets: this.timerText,
                scale: { from: 1, to: 1.5, duration: 200, yoyo: true },
                x: originalX + 5,
                y: originalY - 5,
                ease: 'Elastic.Out',
                duration: 500,
                yoyo: true,
                onComplete: () => {
                    this.timerText.setScale(1);
                    this.timerText.x = originalX;
                    this.timerText.y = originalY;
                    this.timerText.clearTint();
                }
            });
        }
        
        // 3. Delete the user input text
        this.clearInputTextBox();
        
        // 4. Clear the AI suggestions
        this.aiSuggestedWords = [];
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // 5 & 6. Clear and reset the word stats
        this.aiWordCount = 0;
        if (this.wordCountDisplay) {
            this.updateWordCountDisplay();
        }
        
        // Reset word streak counter
        this.wordStreak = 0;
        this.lastWordWasOriginal = false;
        this.updateStreakCounter(false);
        
        // Clean up any existing streak-specific background elements
        this.cleanupStreakVisuals();
        
        // Explicitly update the background to reset effects
        this.updateBackgroundForLevel();
    }

    /**
     * Show the clock in the center, flash it, then explode into red sparks.
     * Returns a Promise that resolves when the effect is complete.
     */
    showClockExplosionEffect() {
        return new Promise((resolve) => {
            // Remove any existing clock sprite
            if (this.clockSprite) {
                this.clockSprite.destroy();
                this.clockSprite = null;
            }

            // Center of the screen
            const centerX = this.cameras.main.centerX;
            const centerY = this.cameras.main.centerY;

            // Detect mobile device
            const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || window.screen.width < 900;

            // Set scale values based on device type
            let initialScale, maxScale, burstScale;
            if (isMobile) {
                // Smaller clock for mobile
                initialScale = 0.2;
                maxScale = .6;
                burstScale = 0.4;
            } else {
                // Original values for desktop
                initialScale = 1.5;
                maxScale = 2.1;
                burstScale = 1.5;
            }

        // Add the clock sprite (SVG loaded as 'clock')
        this.clockSprite = this.add.image(centerX, centerY, 'clock')
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(999);
            
        // Correct the aspect ratio of the clock SVG
        const texture = this.textures.get('clock');
        const frameWidth = texture.frames.__BASE.width;
        const frameHeight = texture.frames.__BASE.height;
        
        // Ensure the aspect ratio is preserved by using uniform scaling
        const uniformScale = initialScale;
        this.clockSprite.setScale(uniformScale);

            // Flash: fade in and pulse scale
            this.tweens.add({
                targets: this.clockSprite,
                alpha: 1,
                scale: { from: initialScale, to: maxScale },
                duration: 220,
                yoyo: true,
                repeat: 1,
                ease: 'Quad.easeInOut',
                onComplete: () => {
                    // After flash, explode into red sparks
                    this.clockSprite.setAlpha(0);
                    this.createRedSparkBurst(centerX, centerY, burstScale);
                    // Remove the clock sprite after a short delay
                    this.time.delayedCall(500, () => {
                        if (this.clockSprite) {
                            this.clockSprite.destroy();
                            this.clockSprite = null;
                        }
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * Create a burst of red sparks at (x, y).
     * @param {number} [scale=1] - Multiplier for size and distance.
     */
    createRedSparkBurst(x, y, scale = 1) {
        const particleCount = 90;
        for (let i = 0; i < particleCount; i++) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(180, 340) * scale;
            const distance = Phaser.Math.Between(120, 260) * scale;
            const size = Phaser.Math.Between(4, 10) * scale;
            const endX = x + Math.cos(angle) * distance;
            const endY = y + Math.sin(angle) * distance;

            // Create a red circle as the spark
            const spark = this.add.circle(x, y, size, 0xed1c24, 0.88).setDepth(998);

            this.tweens.add({
                targets: spark,
                x: endX,
                y: endY,
                alpha: 0,
                scale: { from: 1, to: 0.15 },
                duration: Phaser.Math.Between(500, 900),
                ease: 'Cubic.Out',
                onComplete: () => spark.destroy()
            });
        }
    }


    updatePromptBasedOnLevel() {
        const promptLevels = {
            1: [
                "What do you want to have for dinner today?", 
                "Describe what you see around you right now.",
                "Who is your favorite artist and why?",
                "Describe your living room.",
                "Describe the sky right now.",
                "What is your favorite color and what does it remind you of?",
                "What is something that made you smile today?",
                "If you could have any animal as a pet, what would it be?",
                "What is your favorite thing to do on weekends?",
                "What is your favorite season and why?"
            ],
            2: [
                "Why do polar bears not eat penguins?",
                "What is the difference between a chair and a stool?",
                "What did young you want to do when you grew up?",
                "Who was Thomas Edison?",
                "What is an interest rate?",
                "Why do we need to sleep?",
                "How does a rainbow form?",
                "What is the difference between a fruit and a vegetable?",
                "Why do we have different time zones?",
                "What is the purpose of money?"
            ],
            3: [
                "Write a two-line poem that rhymes.",
                "Write a haiku.",
                "What do you think beauty is?",
                "What makes something art or not?",
                "Invent a new word and define it.",
                "If you could travel to any time period, when would it be and why?",
                "Describe a world where gravity is half as strong as on Earth.",
                "If you could ask any historical figure a question, who would it be and what would you ask?",
                "Write a short story in three sentences.",
                "Imagine a new holiday. What is it called and how is it celebrated?"
            ],
        };
    
        // ✅ Select a Prompt Based on the Level
        const selectedPrompts = promptLevels[this.levelValue] || promptLevels[1];
        const randomIndex = Math.floor(Math.random() * selectedPrompts.length);
        this.currentPrompt = selectedPrompts[randomIndex];
    
    
        // ✅ Remove Old Prompt Text Before Updating
        if (this.promptText) {
            this.promptText.setText(this.currentPrompt);
        }
        this.updateLevelModeIndicator();
    }

    // Update level indicator
    updateLevelModeIndicator() {
        if (!this.levelModeIndicator) return;
        
        const indicatorText = `LEVEL ${this.levelValue}`;
        
        // Update text content
        this.levelModeIndicator.setText(indicatorText);
        
        // Update banner colors
        if (this.levelModeBanner) {
        // Calculate banner width dynamically based on text width with padding
        const textPadding = this.isMobile ? 60 : 20; // More padding on mobile for better touch targets and wider text area
            const bannerWidth = this.levelModeIndicator.width + textPadding;
            const bannerHeight = 34;
            const bannerX = this.cameras.main.centerX - bannerWidth / 2;
            
            // Calculate banner Y position to center the text within the banner
            // The text should be centered within the banner, so banner Y = text Y - half banner height
            const bannerY = this.levelModeIndicator.y - bannerHeight / 2;
            
            const bannerColor = this.COLORS_HEX.ACCENT;
            const glowColor = this.COLORS_HEX.ACCENT;
            
            this.levelModeBanner.clear();
            this.levelModeBanner.fillStyle(glowColor, 0.3);
            this.levelModeBanner.fillRoundedRect(bannerX - 3, bannerY - 3, bannerWidth + 6, bannerHeight + 6, 16);
            this.levelModeBanner.fillStyle(bannerColor, 0.8);
            this.levelModeBanner.fillRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
            this.levelModeBanner.lineStyle(2, 0xffffff, 0.5);
            this.levelModeBanner.strokeRoundedRect(bannerX, bannerY, bannerWidth, bannerHeight, 16);
        }
    }
    

    // Common utility methods
    // Create and show settings popup with Level, Top K sliders and Mode Toggle
    toggleSettingsPopup() {
        this.popupJustOpened = true;
        
        if (this.settingsPopup) {
            // If popup exists, close it
            this.closeSettingsPopup();
            return;
        }
        
        // Calculate popup dimensions
        const { popupWidth, popupHeight, popupX, popupY } = this.calculateSettingsPopupDimensions();
        
        // Pause the timer when settings popup is opened
        if (this.timerEvent && !this.timerEvent.paused) {
            this.timerEvent.paused = true;
        }

        // Create popup container
        this.settingsPopup = this.add.container(0, 0).setDepth(999);
        
        // Create overlay
        this.createSettingsOverlay(popupX, popupY, popupWidth, popupHeight);
        
        // Create popup background (this now handles adding elements in proper order)
        this.createSettingsBackground(popupX, popupY, popupWidth, popupHeight);
        
        // Create UI elements
        const { levelSliderHandle, levelLabel } = this.createLevelSlider(popupX, popupY, popupWidth, popupHeight);
        const { tempSliderHandle, tempLabel } = this.createTemperatureSlider(popupX, popupY, popupWidth, popupHeight);
        this.createSettingsButtons(popupX, popupY, popupWidth, popupHeight);
        
        // Setup drag functionality
        this.setupSliderDragFunctionality(levelSliderHandle, levelLabel, tempSliderHandle, tempLabel);
        
        // Animate popup appearance
        this.animateSettingsPopupIn();
    }

    /**
     * Calculate dimensions for settings popup
     */
    calculateSettingsPopupDimensions() {
        const sm = this.scalingManager || new ScalingManager(this);
        const popupWidth = sm.scaleValue(400);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        // Use mobile gap for mobile devices
        const gap2 = sm.scaleValue(this.isMobile ? SCENE_CONFIG.SETTINGS_POPUP.MOBILE_GAP : SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);
        const sliderRowHeight2 = sm.scaleValue(44);
        const gap3 = sm.scaleValue(15);
        const buttonRowHeight = sm.scaleValue(54);
        const bottomPadding = sm.scaleValue(30);

        const popupHeight = bannerHeight + gap1 + sliderRowHeight + gap2 + sliderRowHeight2 + gap3 + buttonRowHeight + bottomPadding;
        const popupX = this.cameras.main.centerX - popupWidth / 2;
        const popupY = this.cameras.main.centerY - popupHeight / 2;

        return { popupWidth, popupHeight, popupX, popupY };
    }

    /**
     * Create the settings overlay
     */
    createSettingsOverlay(popupX, popupY, popupWidth, popupHeight) {
        // Create a full-screen overlay for visual dimming only - NOT interactive
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000, 0.7
        ).setOrigin(0, 0);
        
        // IMPORTANT: Add overlay BEFORE any interactive elements so it's behind them
        this.settingsPopup.addAt(overlay, 0);
        
        // Add a single global pointer down handler at the scene level
        // This will only close the popup if the click is outside the popup bounds
        const pointerDownHandler = (pointer) => {
            // Check if click is outside the popup area
            if (pointer.x < popupX || pointer.x > popupX + popupWidth ||
                pointer.y < popupY || pointer.y > popupY + popupHeight) {
                this.closeSettingsPopup();
            }
        };
        
        // Add the handler to the scene's input
        this.input.on('pointerdown', pointerDownHandler);
        
        // Store the handler so we can remove it when closing
        this._settingsOverlayHandler = pointerDownHandler;
    }

    /**
     * Create the settings popup background
     */
    createSettingsBackground(popupX, popupY, popupWidth, popupHeight) {
        const popupBg = this.add.graphics();
        popupBg.fillStyle(this.COLORS_HEX.BACKGROUND, 0.95);
        popupBg.fillRoundedRect(popupX, popupY, popupWidth, popupHeight, 15);
        popupBg.lineStyle(3, this.COLORS_HEX.BOX_OUTLINE, 1);
        popupBg.strokeRoundedRect(popupX, popupY, popupWidth, popupHeight, 15);
        
        // Add popup background to container FIRST with explicit depth
        popupBg.setDepth(0);
        this.settingsPopup.add(popupBg);
        
        // Create banner background for title
        const titleHeight = 44;
        const bannerHeight = 54; // Match the value used in calculateSettingsPopupDimensions
        
        // Banner graphics with higher depth
        const bannerBg = this.add.graphics();
        bannerBg.fillStyle(this.COLORS_HEX.ACCENT, 0.8);
        bannerBg.fillRoundedRect(popupX, popupY, popupWidth, bannerHeight, {
            tl: 15, tr: 15, bl: 0, br: 0
        });
        bannerBg.lineStyle(2, 0xffffff, 0.5);
        bannerBg.strokeRoundedRect(popupX, popupY, popupWidth, bannerHeight, {
            tl: 15, tr: 15, bl: 0, br: 0
        });
        bannerBg.setDepth(1);
        this.settingsPopup.add(bannerBg);
        
        // Add title text with proper style and highest depth
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const titleStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const title = this.add.text(
            this.cameras.main.centerX,
            popupY + bannerHeight / 2,
            'SETTINGS',
            {
                ...titleStyle,
                fontSize: `${parseInt(titleStyle.fontSize) * 1.4}px`, // Make title larger
                fill: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5, 0.5);
        title.setDepth(2);
        this.settingsPopup.add(title);
        
        return popupBg;
    }

    /**
     * Create the level slider
     */
    createLevelSlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager || new ScalingManager(this);
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
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const levelLabel = this.add.text(
            levelLabelX, levelLabelY,
            `Level: ${this.levelValue}`,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`, // Ensure proper size
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.settingsPopup.add(levelLabel);

        const levelSliderX = levelLabelX + levelLabel.displayWidth + gap;
        const levelSliderY = levelLabelY;

        // Create slider track
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const levelSlider = this.add.graphics();
        // Draw the full track (background)
        levelSlider.fillStyle(0x444444, 1);
        levelSlider.fillRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        // Draw the filled portion up to the handle
        const levelT = (this.levelValue - 1) / 2;
        const fillWidth = sliderWidth * levelT;
        if (fillWidth > 0) {
            // Use the same color as the mode toggle (BASIC_COLORS_HEX.HIGHLIGHT)
            levelSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            levelSlider.fillRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
        levelSlider.lineStyle(2, 0xffffff, 0.3);
        levelSlider.strokeRect(levelSliderX, levelSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.settingsPopup.add(levelSlider);

        // Create slider handle
        const levelSliderHandle = this.createSliderHandle(levelSliderX, levelSliderY, sliderWidth);
        this.settingsPopup.add(levelSliderHandle);

        // Setup slider interactions
        this.setupLevelSliderInteractions(levelSlider, levelSliderHandle, levelLabel, levelSliderX, levelSliderY, sliderWidth);

        return { levelSliderHandle, levelLabel };
    }

    /**
     * Create a slider handle
     */
    createSliderHandle(sliderX, sliderY, sliderWidth) {
        const sm = this.scalingManager || new ScalingManager(this);
        const isMobileDevice = this.isMobile;
        const levelT = (this.levelValue - 1) / 2;
        const levelSliderMinX = sliderX + sm.scaleValue(5);
        const levelSliderMaxX = sliderX + sliderWidth - sm.scaleValue(5);
        const levelHandleX = Phaser.Math.Linear(levelSliderMinX, levelSliderMaxX, levelT);

        // Create a simple sprite for the handle
        const handleSize = isMobileDevice ? sm.scaleValue(24) : sm.scaleValue(20);
        
        // Create a circle sprite using graphics texture
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(BASIC_COLORS_HEX.ACCENT, 1);
        graphics.fillCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.generateTexture('sliderHandle', handleSize, handleSize);
        graphics.destroy();
        
        // Create the sprite from the generated texture
        const handle = this.add.sprite(levelHandleX, sliderY, 'sliderHandle');
        handle.setDepth(3);
        
        // Set up interactive and draggable
        const hitArea = isMobileDevice ? 44 : 60; // Larger hit area
        handle.setInteractive({ 
            hitArea: new Phaser.Geom.Circle(handleSize/2, handleSize/2, hitArea/2), 
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            useHandCursor: true
        });

        // Visual feedback
        handle.on('pointerover', () => {
            handle.setScale(1.2);
            handle.setTint(0xffff00); // Yellow tint on hover
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
     */
    setupLevelSliderInteractions(levelSlider, levelSliderHandle, levelLabel, sliderX, sliderY, sliderWidth) {
        const levelSliderMinX = sliderX + 5;
        const levelSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        // Store bounds and references on the handle for drag functionality
        levelSliderHandle.setData('minX', levelSliderMinX);
        levelSliderHandle.setData('maxX', levelSliderMaxX);
        levelSliderHandle.setData('type', 'level');
        levelSliderHandle.setData('sliderTrack', levelSlider);
        levelSliderHandle.setData('sliderX', sliderX);
        levelSliderHandle.setData('sliderWidth', sliderWidth);
        levelSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        // Handle clicks on slider track (move handle to click position)
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        levelSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                // Move handle to click position
                const clampedX = Phaser.Math.Clamp(pointer.x, levelSliderMinX, levelSliderMaxX);
                levelSliderHandle.x = clampedX;
                const newLevel = Math.round(Phaser.Math.Linear(1, 3, (clampedX - levelSliderMinX) / (levelSliderMaxX - levelSliderMinX)));
                
                // Update the fill for the level slider track
                this.updateSliderFill(levelSliderHandle);
                
                if (newLevel !== this.levelValue) {
                    this.levelValue = newLevel;
                    levelLabel.setText(`Level: ${this.levelValue}`);
                    this.onLevelChange();
                }
                
                // For desktop, handle is already draggable, no need to set again
                // For mobile, simulate a drag start to enable immediate dragging
                if (isMobileDevice) {
                    levelSliderHandle.emit('pointerdown', pointer);
                    this.input.emit('dragstart', pointer, levelSliderHandle);
                }
            });
    }

    /**
     * Handle level change
     */
    onLevelChange() {
        
        // Clear the user input text
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        
        // Reset streak counters BEFORE updating background
        this.wordStreak = 0;
        this.lastWordWasOriginal = false;
        
        // Clean up any existing streak-specific background elements BEFORE creating new background
        this.cleanupStreakVisuals();
        
        // Update prompt and background - background will now use reset streak value
        this.updatePromptBasedOnLevel();
        this.updateBackgroundForLevel();
        
        // Reset counters (no progress bar visuals)
        this.aiWordCount = 0;
        
        // Clear AI suggestions
        this.aiSuggestedWords = [];
        
        // Clear any autocomplete text
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
        
        // Update word count display
        if (this.wordCountDisplay) this.updateWordCountDisplay();
        
        // Update streak counter display
        this.updateStreakCounter(false);
        
        // Update cursor to show the cleared state
        this.updateCursor();
        
        // Generate a fresh AI answer for the new prompt
        if (!this.isShuttingDown) {
            this.generateInitialAnswer();
        }
    }

    /**
     * Create the temperature slider
     */
    createTemperatureSlider(popupX, popupY, popupWidth, popupHeight) {
        const sm = this.scalingManager || new ScalingManager(this);
        const sliderWidth = sm.scaleValue(150);
        const gap = sm.scaleValue(20);
        const bannerHeight = sm.scaleValue(54);
        const gap1 = sm.scaleValue(24);
        const sliderRowHeight = sm.scaleValue(44);
        const gap2 = sm.scaleValue(SCENE_CONFIG.SETTINGS_POPUP.STANDARD_GAP);

        let yCursor = popupY + bannerHeight + gap1 + sliderRowHeight + gap2;

        // Temperature slider row
        const tempLabelX = popupX + sm.scaleValue(30);
        const tempLabelY = yCursor + sm.scaleValue(22);
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        const labelStyle = getTextStyle('settings', deviceType, this.mode || 'basic', uiScale);
        const tempLabel = this.add.text(
            tempLabelX, tempLabelY,
            `Randomness: `,//${Math.round(this.temperature * 100)}%`,
            {
                ...labelStyle,
                fontSize: `${parseInt(labelStyle.fontSize)}px`, // Ensure proper size
                fill: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        this.settingsPopup.add(tempLabel);

        const tempSliderX = tempLabelX + tempLabel.displayWidth + gap;
        const tempSliderY = tempLabelY;

        // Create slider track
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? sm.scaleValue(20) : sm.scaleValue(12);
        const tempSlider = this.add.graphics();
        // Draw the full track (background)
        tempSlider.fillStyle(0x444444, 1);
        tempSlider.fillRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        // Draw the filled portion up to the handle
        const tempT = (this.temperature - 0.1) / 1.4;
        const tempFillWidth = sliderWidth * tempT;
        if (tempFillWidth > 0) {
            // Use the same color as the mode toggle (BASIC_COLORS_HEX.HIGHLIGHT)
            tempSlider.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            tempSlider.fillRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, tempFillWidth, sliderTrackHeight);
        }
        tempSlider.lineStyle(2, 0xffffff, 0.3);
        tempSlider.strokeRect(tempSliderX, tempSliderY - sliderTrackHeight / 2, sliderWidth, sliderTrackHeight);
        this.settingsPopup.add(tempSlider);

        // Create slider handle (temperature ranges from 0.1 to 1.5)
        const tempSliderHandle = this.createTemperatureSliderHandle(tempSliderX, tempSliderY, sliderWidth);
        this.settingsPopup.add(tempSliderHandle);

        // Setup slider interactions
        this.setupTemperatureSliderInteractions(tempSlider, tempSliderHandle, tempLabel, tempSliderX, tempSliderY, sliderWidth);

        return { tempSliderHandle, tempLabel };
    }

    /**
     * Create a temperature slider handle
     */
    createTemperatureSliderHandle(sliderX, sliderY, sliderWidth) {
        const sm = this.scalingManager || new ScalingManager(this);
        const isMobileDevice = this.isMobile;
        // Map temperature (0.1 to 1.5) to slider position (0 to 1)
        const tempT = (this.temperature - 0.1) / 1.4;
        const tempSliderMinX = sliderX + sm.scaleValue(5);
        const tempSliderMaxX = sliderX + sliderWidth - sm.scaleValue(5);
        const tempHandleX = Phaser.Math.Linear(tempSliderMinX, tempSliderMaxX, tempT);

        // Create a simple sprite for the handle
        const handleSize = isMobileDevice ? sm.scaleValue(24) : sm.scaleValue(20);
        
        // Create a circle sprite using graphics texture
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(BASIC_COLORS_HEX.ACCENT, 1);
        graphics.fillCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(handleSize/2, handleSize/2, handleSize/2);
        graphics.generateTexture('tempSliderHandle', handleSize, handleSize);
        graphics.destroy();
        
        // Create the sprite from the generated texture
        const handle = this.add.sprite(tempHandleX, sliderY, 'tempSliderHandle');
        handle.setDepth(3);
        
        // Set up interactive and draggable
        const hitArea = isMobileDevice ? 44 : 60; // Larger hit area
        handle.setInteractive({ 
            hitArea: new Phaser.Geom.Circle(handleSize/2, handleSize/2, hitArea/2), 
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            useHandCursor: true
        });

        // Visual feedback
        handle.on('pointerover', () => {
            handle.setScale(1.2);
            handle.setTint(0xffff00); // Yellow tint on hover
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
     * Setup temperature slider interactions
     */
    setupTemperatureSliderInteractions(tempSlider, tempSliderHandle, tempLabel, sliderX, sliderY, sliderWidth) {
        const tempSliderMinX = sliderX + 5;
        const tempSliderMaxX = sliderX + sliderWidth - 5;
        const isMobileDevice = this.isMobile;
        const sliderTrackHeight = isMobileDevice ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12);
        
        // Store bounds and references on the handle for drag functionality
        tempSliderHandle.setData('minX', tempSliderMinX);
        tempSliderHandle.setData('maxX', tempSliderMaxX);
        tempSliderHandle.setData('type', 'temperature');
        tempSliderHandle.setData('sliderTrack', tempSlider);
        tempSliderHandle.setData('sliderX', sliderX);
        tempSliderHandle.setData('sliderWidth', sliderWidth);
        tempSliderHandle.setData('sliderTrackHeight', sliderTrackHeight);
        
        // Handle clicks on slider track (move handle to click position)
        const sliderBarHitHeight = isMobileDevice ? 44 : 20;
        tempSlider.setInteractive(new Phaser.Geom.Rectangle(sliderX, sliderY - sliderBarHitHeight / 2, sliderWidth, sliderBarHitHeight), Phaser.Geom.Rectangle.Contains)
            .on('pointerdown', (pointer) => {
                // Move handle to click position
                const clampedX = Phaser.Math.Clamp(pointer.x, tempSliderMinX, tempSliderMaxX);
                tempSliderHandle.x = clampedX;
                // Map slider position to temperature (0.1 to 1.5)
                const newTemp = Phaser.Math.Linear(0.1, 1.5, (clampedX - tempSliderMinX) / (tempSliderMaxX - tempSliderMinX));
                
                // Update the fill for the temperature slider track
                this.updateSliderFill(tempSliderHandle);
                
                if (Math.abs(newTemp - this.temperature) > 0.01) {
                    this.temperature = newTemp;
                    tempLabel.setText(`Randomness: `);//${Math.round(this.temperature * 100)}%`);
                }
                
                // For desktop, handle is already draggable, no need to set again
                // For mobile, simulate a drag start to enable immediate dragging
                if (isMobileDevice) {
                    tempSliderHandle.emit('pointerdown', pointer);
                    this.input.emit('dragstart', pointer, tempSliderHandle);
                }
            });
    }

    /**
     * Create settings buttons (Apply and Close)
     */
    createSettingsButtons(popupX, popupY, popupWidth, popupHeight) {
        // Position the APPLY button relative to the bottom of the popup
        const bottomMargin = 40; // Nice small margin from bottom
        const buttonHeight = this.scalingManager.buttonHeight();
        const confirmBtnY = popupY + popupHeight - bottomMargin - buttonHeight/2;
        
        const confirmBtn = ButtonFactory.createButton(
            this,
            'APPLY',
            () => {
                this.closeSettingsPopup();
            },
            this.cameras.main.centerX,
            confirmBtnY
        );
        this.settingsPopup.add(confirmBtn);

        // Close button (top right)
        const minTouchSize = 44;
        // Get text style from textStyles.js
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const closeTextStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
        
        const closeBtn = this.add.text(
            popupX + popupWidth - 25,
            popupY + 20,
            '✕',
            {
                ...closeTextStyle,
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
        .on('pointerdown', () => this.closeSettingsPopup());
        this.settingsPopup.add(closeBtn);
    }

    /**
     * Setup slider drag functionality
     */
    /**
     * Updates the fill for a slider track
     * @param {Phaser.GameObjects.GameObject} handle - The slider handle
     */
    updateSliderFill(handle) {
        const sliderTrack = handle.getData('sliderTrack');
        if (!sliderTrack) return;
        
        const minX = handle.getData('minX');
        const maxX = handle.getData('maxX');
        const sliderX = handle.getData('sliderX');
        const sliderY = handle.y;
        const sliderTrackHeight = handle.getData('sliderTrackHeight') || 
            (this.isMobile ? this.scalingManager.scaleValue(20) : this.scalingManager.scaleValue(12));
        
        // Clear previous fill
        sliderTrack.clear();
        
        // Draw the background track
        sliderTrack.fillStyle(0x444444, 1);
        sliderTrack.fillRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
        
        // Draw the filled portion up to the handle position
        const fillWidth = handle.x - sliderX;
        if (fillWidth > 0) {
            // Use the same color as the mode toggle
            sliderTrack.fillStyle(BASIC_COLORS_HEX.HIGHLIGHT, 1);
            sliderTrack.fillRect(sliderX, sliderY - sliderTrackHeight / 2, fillWidth, sliderTrackHeight);
        }
        
        // Draw the outline
        sliderTrack.lineStyle(2, 0xffffff, 0.3);
        sliderTrack.strokeRoundedRect(sliderX, sliderY - sliderTrackHeight / 2, maxX - minX + 10, sliderTrackHeight);
    }
    
    setupSliderDragFunctionality(levelSliderHandle, levelLabel, tempSliderHandle, tempLabel) {
        const scene = this;
        
        // Clean up any existing handlers
        if (this._sliderCleanup) {
            this._sliderCleanup();
            this._sliderCleanup = null;
        }
        
        // Simple drag setup function
        const setupSliderDrag = (handle, sliderType, label) => {
            // Guard: skip if handle is undefined
            if (!handle) return;
            
            // Ensure the handle is draggable
            scene.input.setDraggable(handle);
            
            // Store initial data
            handle.setData('isDragging', false);
            
            // Single drag event handler - this is the primary way Phaser handles dragging
            handle.on('drag', function(pointer, dragX, dragY) {
                const minX = this.getData('minX');
                const maxX = this.getData('maxX');
                
                // Constrain to horizontal movement within bounds
                const newX = Phaser.Math.Clamp(dragX, minX, maxX);
                this.x = newX;
                
                if (sliderType === 'level') {
                    // Update the level value
                    const newLevel = Math.round(Phaser.Math.Linear(1, 3, (newX - minX) / (maxX - minX)));
                    if (newLevel !== scene.levelValue) {
                        scene.levelValue = newLevel;
                        label.setText(`Level: ${scene.levelValue}`);
                        scene.onLevelChange();
                    }
                } else if (sliderType === 'temperature') {
                    // Update the temperature value
                    const newTemp = Phaser.Math.Linear(0.1, 1.5, (newX - minX) / (maxX - minX));
                    if (Math.abs(newTemp - scene.temperature) > 0.01) {
                        scene.temperature = newTemp;
                        label.setText(`Randomness: `);
                    }
                } else if (sliderType === 'frequency') {
                    // Update the frequency penalty value
                    const newFreq = Phaser.Math.Linear(0.0, 2.0, (newX - minX) / (maxX - minX));
                    if (Math.abs(newFreq - scene.frequencyPenalty) > 0.01) {
                        scene.frequencyPenalty = newFreq;
                        label.setText(`Word Variety: `);
                    }
                }
                
                // Update the slider fill
                scene.updateSliderFill(this);
            });
            
            // Visual feedback on drag start
            handle.on('dragstart', function(pointer) {
                this.setData('isDragging', true);
                this.setScale(1.2);
                this.setTint(0xffff00);
                scene.input.setDefaultCursor('grabbing');
            });
            
            // Reset visual feedback on drag end
            handle.on('dragend', function(pointer) {
                this.setData('isDragging', false);
                this.setScale(1);
                this.clearTint();
                scene.input.setDefaultCursor('default');
            });
        };
        
        // Setup only the two sliders we have
        setupSliderDrag(levelSliderHandle, 'level', levelLabel);
        setupSliderDrag(tempSliderHandle, 'temperature', tempLabel);
        
        // Store cleanup function
        this._sliderCleanup = () => {
            // Remove all listeners from handles
            if (levelSliderHandle) levelSliderHandle.removeAllListeners();
            if (tempSliderHandle) tempSliderHandle.removeAllListeners();
        };
    }

    /**
     * Animate settings popup appearance
     */
    animateSettingsPopupIn() {
        this.settingsPopup.setScale(0.8);
        this.scalePopIn(this.settingsPopup, 200);
    }
    
    closeSettingsPopup() {
        if (!this.settingsPopup) return;
        
        // Update level indicator
        this.updateLevelModeIndicator();
        
        // Resume the timer when settings popup is closed
        if (this.timerEvent && this.timerEvent.paused) {
            this.timerEvent.paused = false;
        }
        
        // Clean up slider drag functionality
        if (this._sliderCleanup) {
            this._sliderCleanup();
            this._sliderCleanup = null;
        }
        
        // Clean up drag event listeners
        if (this._settingsDragHandlers) {
            this.input.off('dragstart', this._settingsDragHandlers.dragstart);
            this.input.off('drag', this._settingsDragHandlers.drag);
            this.input.off('dragend', this._settingsDragHandlers.dragend);
            this._settingsDragHandlers = null;
        }
        
        // Clean up pointer move handler
        if (this._settingsPointerMoveHandler) {
            this.input.off('pointermove', this._settingsPointerMoveHandler);
            this._settingsPointerMoveHandler = null;
        }

        // Clean up the overlay handler - IMPORTANT
        if (this._settingsOverlayHandler) {
            this.input.off('pointerdown', this._settingsOverlayHandler);
            this._settingsOverlayHandler = null;
        }

        // First destroy the popup with animation
        this.fadeOutScale(this.settingsPopup, 200, 'Back.In', () => {
            if (this.settingsPopup) {
                this.settingsPopup.destroy();
                this.settingsPopup = null;
            }
        });
    }

    ensureProperLayering() {
        if (this.promptTextBox) this.promptTextBox.setDepth(102);
        if (this.promptText) this.promptText.setDepth(103);
        if (this.outputText) this.outputText.setDepth(6);
        if (this.failsCounter) this.failsCounter.setDepth(7);
        if (this.inputTextBorder) this.inputTextBorder.setDepth(20);
        if (this.inputText) this.inputText.setDepth(25);
        if (this.doneButton) this.doneButton.setDepth(110);
        if (this.resetButton) this.resetButton.setDepth(110);
        if (this.feedbackButton) this.feedbackButton.setDepth(110);
        if (this.settingsButton) this.settingsButton.setDepth(110);
        if (this.wordCountDisplay) this.wordCountDisplay.setDepth(55);
        if (this.settingsPopup) this.settingsPopup.setDepth(100);
    }
    
    createWordCountDisplay(customWidth) {
        if (this.wordCountDisplay) {
            this.wordCountDisplay.destroy();
        }
        
        // Create container for word count display
        this.wordCountDisplay = this.add.container(0, 0).setDepth(55);
        
        // Make sure we have a scaling manager
        if (!this.scalingManager) {
            this.scalingManager = new ScalingManager(this);
        }
        const sm = this.scalingManager;
        
        // Force update scale ratios on mobile to ensure proper scaling
        if (this.isMobile) {
            sm.updateBaseDimensions();
            sm.updateScaleRatios();
            
            // If no customWidth provided on mobile, calculate it here
            if (!customWidth || customWidth <= 0) {
                
                // Replicate the width calculation from calculateUIPositions
                const deviceType = detectDeviceType();
                const uiScale = sm.uiScale || 1;
                const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
                const countStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
                const padding = sm.scaleValue(20);

                // Labels with maximum expected values
                const labels = [
                    { text: "Original Words:", value: "999" },
                    { text: "AI Words:", value: "999" },
                    { text: "Current Streak:", value: "999" },
                    { text: "Best Streak:", value: "999" }
                ];

                // Create temporary text objects to measure
                const tempTexts = [];
                const titleTemp = this.add.text(0, 0, "WORD STATS", { ...labelStyle, fontStyle: 'bold', fill: '#ffffff' });
                tempTexts.push(titleTemp);

                let maxLabelWidth = 0;
                labels.forEach(({ text, value }) => {
                    const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
                    const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
                    
                    // Calculate actual positions and spacing
                    const labelX = sm.scaleValue(35);
                    const valueRightPadding = sm.scaleValue(15);
                    const minGapBetweenLabelAndValue = sm.scaleValue(this.isMobile ? 50 : 30); // More generous gap for mobile
                    
                    // Total width needed for the content
                    const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
                    maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
                    tempTexts.push(labelTemp, valueTemp);
                });

                // Clean up temporary text objects
                tempTexts.forEach(text => text.destroy());

                // Calculate final stats box width with all constraints
                const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
                const fixedRightMargin = sm.scaleValue(this.isMobile ? 35 : 30);
                const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + padding * 2);
                const configMax = sm.scaleValue(this.isMobile ? 
                    SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_MOBILE : 
                    SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_DESKTOP);
                
                // For mobile, ensure we use a reasonable minimum width
                if (this.isMobile) {
                    // Use a more generous minimum for mobile
                    customWidth = Math.max(contentBoxWidth, sm.scaleValue(250));
                } else {
                    customWidth = Math.max(contentBoxWidth, minBoxWidth);
                }
                customWidth = Math.min(customWidth, configMax);
                

            }
        }
        
        // Scale all dimensions consistently
        const padding = sm.scaleValue(20);
        const boxHeight = sm.scaleValue(130); // Scaled height
        const cornerRadius = sm.scaleValue(10);

        // Use customWidth if provided (from calculateUIPositions)
        // This ensures we use the properly calculated width that accounts for all mobile constraints
        let boxWidth;
        if (customWidth !== undefined && customWidth > 0) {
            // Use the width calculated in calculateUIPositions
            boxWidth = customWidth;
        } else {
            // Fallback calculation if no width provided
            // Get text styles for measuring
            const deviceType = detectDeviceType();
            const uiScale = this.scalingManager?.uiScale || 1;
            const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
            const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);

            // Create temporary text objects to measure actual content width
            const tempTexts = [];
            
            // Title
            const titleTemp = this.add.text(0, 0, "WORD STATS", {
                ...labelStyle,
                fontStyle: 'bold',
                fill: '#ffffff'
            });
            tempTexts.push(titleTemp);
            
            // Labels with maximum expected values
            const labels = [
                { text: "Original Words:", value: "999" },
                { text: "AI Words:", value: "999" },
                { text: "Current Streak:", value: "999" },
                { text: "Best Streak:", value: "999" }
            ];
            
            let maxLabelWidth = 0;
            labels.forEach(({ text, value }) => {
                const labelTemp = this.add.text(0, 0, text, { ...labelStyle, fill: '#ffffff' });
                const valueTemp = this.add.text(0, 0, value, { ...countStyle, fontStyle: 'bold' });
                
                // Calculate actual positions and spacing - match calculateUIPositions
                const labelX = sm.scaleValue(35);
                const valueRightPadding = sm.scaleValue(15);
                const minGapBetweenLabelAndValue = sm.scaleValue(30); // Generous gap between label and value
                
                // Since values are right-aligned, we need:
                // labelX + labelWidth + gap + valueWidth + rightPadding
                const rowWidth = labelX + labelTemp.width + minGapBetweenLabelAndValue + valueTemp.width + valueRightPadding;
                maxLabelWidth = Math.max(maxLabelWidth, rowWidth);
                
                tempTexts.push(labelTemp, valueTemp);
            });
            
            // Clean up temporary text objects
            tempTexts.forEach(text => text.destroy());
            
            // Calculate width with proper constraints
            const scaledRightMargin = sm.scaleValue(this.isMobile ? 
                SCENE_CONFIG.PADDING.MOBILE_STATS_RIGHT_MARGIN : 
                SCENE_CONFIG.PADDING.STATS_RIGHT_MARGIN);
            const minBoxWidth = sm.scaleValue(this.isMobile ? 300 : 180); // Consistent mobile minimum of 300
            const maxBoxWidth = this.sys.game.canvas.width - scaledRightMargin * 2;
            const contentBoxWidth = Math.max(minBoxWidth, maxLabelWidth + padding * 2);
            const configMax = sm.scaleValue(this.isMobile ? SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_MOBILE : SCENE_CONFIG.BOX_DIMENSIONS.STATS_MAX_WIDTH_DESKTOP);
            
            boxWidth = Math.max(contentBoxWidth, minBoxWidth);
            boxWidth = Math.min(boxWidth, maxBoxWidth, configMax);
        }
        
        // Create background
        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.7);
        background.fillRoundedRect(0, 0, boxWidth, boxHeight, cornerRadius);
        background.lineStyle(2, 0xffffff, 0.5);
        background.strokeRoundedRect(0, 0, boxWidth, boxHeight, cornerRadius);
        
        // Word count title
        // Get text styles again for the title (they were only in temporary scope above)
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const labelStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const countStyle = getTextStyle('button', deviceType, this.mode || 'basic', uiScale);
        
        const titleText = this.add.text(
            boxWidth / 2, 
            15, 
            "WORD STATS", 
            {
                ...labelStyle,
                fontStyle: 'bold',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);
        
        // Scale all positions consistently
        const iconX = sm.scaleValue(20);
        const labelX = sm.scaleValue(35);
        const valueRightPadding = sm.scaleValue(15);
        const iconRadius = sm.scaleValue(6);
        
        // Scaled Y positions
        const titleY = sm.scaleValue(15);
        const row1Y = sm.scaleValue(40);
        const row2Y = sm.scaleValue(65);
        const row3Y = sm.scaleValue(90);
        const row4Y = sm.scaleValue(115);
        
        // Create icons for different word types
        const originalIcon = this.add.circle(iconX, row1Y, iconRadius, this.design.PROGRESS_BAR.COLORS.SUCCESS);
        originalIcon.setFillStyle(this.design.PROGRESS_BAR.COLORS.SUCCESS); // Ensure proper fill style
        const originalLabel = this.add.text(
            labelX, row1Y, 
            "Original Words:", 
            { ...labelStyle, fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
this.originalCountText = this.add.text(
    boxWidth - valueRightPadding, row1Y, 
    "0", 
    { ...countStyle, fontStyle: 'bold', fill: '#7cfc00' }
).setOrigin(1, 0.5);

const aiIcon = this.add.circle(iconX, row2Y, iconRadius, 0xff3366); // Red color to match the AI counter
aiIcon.setFillStyle(0xff3366); // Ensure proper fill style
const aiLabel = this.add.text(
    labelX, row2Y, 
    "AI Words:", 
    { ...labelStyle, fill: '#ffffff' }
).setOrigin(0, 0.5);

this.aiCountText = this.add.text(
    boxWidth - valueRightPadding, row2Y, 
    "0", 
    { ...countStyle, fontStyle: 'bold', fill: '#ff3366' }
).setOrigin(1, 0.5);
        
        // Streak counter (third row)
        const streakColor = this.getStreakColor(this.wordStreak);
        const streakIcon = this.add.circle(iconX, row3Y, iconRadius, streakColor);
        streakIcon.setFillStyle(streakColor); // Ensure proper fill style
        const streakLabel = this.add.text(
            labelX, row3Y,
            "Current Streak:",
            { ...labelStyle, fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
        this.streakText = this.add.text(
            boxWidth - valueRightPadding, row3Y,
            `${this.wordStreak}`,
            { 
                ...countStyle,
                fontStyle: 'bold', 
                fill: '#' + streakColor.toString(16).padStart(6, '0')
            }
        ).setOrigin(1, 0.5);
        
        // Max streak (fourth row)
        const maxStreakIcon = this.add.circle(iconX, row4Y, iconRadius, 0xffd700); // Gold color for max streak
        maxStreakIcon.setFillStyle(0xffd700); // Ensure proper fill style
        const maxStreakLabel = this.add.text(
            labelX, row4Y,
            "Best Streak:",
            { ...labelStyle, fill: '#ffffff' }
        ).setOrigin(0, 0.5);
        
        this.maxStreakText = this.add.text(
            boxWidth - valueRightPadding, row4Y,
            `${this.maxWordStreak}`,
            { 
                ...countStyle,
                fontStyle: 'bold', 
                fill: '#ffd700' 
            }
        ).setOrigin(1, 0.5);
        
        // Add all elements to the container
        this.wordCountDisplay.add([
            background, 
            titleText, 
            originalIcon, originalLabel, this.originalCountText,
            aiIcon, aiLabel, this.aiCountText,
            streakIcon, streakLabel, this.streakText,
            maxStreakIcon, maxStreakLabel, this.maxStreakText
        ]);
        
        // Don't set position here - let createStatsDisplay handle positioning
        
        // Store a reference to the streak icon to update its color
        this.streakIcon = streakIcon;
    }
    
    updateWordCountDisplay() {
        if (!this.wordCountDisplay) return;
        
        // Calculate total words in userInput
        const totalWordCount = this.userInput.trim() ? this.userInput.trim().split(/\s+/).length : 0;
        
        // Calculate original words (total minus AI words blocked)
        const originalWordCount = totalWordCount;
        
        // Now totalWordCount is calculated dynamically from userInput
        this.totalWordCount = totalWordCount;
        
        // Update the count displays with animations
        this.animateCountChange(this.originalCountText, this.originalCountText.text, originalWordCount.toString());
        this.animateCountChange(this.aiCountText, this.aiCountText.text, this.aiWordCount.toString());
        //this.animateCountChange(this.totalCountText, this.totalCountText.text, totalWordCount.toString());
        
        // Update streak counter if it exists
        if (this.streakText) {
            this.streakText.setText(`${this.wordStreak}`);
            
            // Update streak text color based on streak count
            if (this.wordStreak >= 3) {
                this.streakText.setFill('#' + this.getStreakColor(this.wordStreak).toString(16).padStart(6, '0')); // Match icon color
            } else {
                this.streakText.setFill('#' + this.getStreakColor(this.wordStreak).toString(16).padStart(6, '0')); // Match icon color
            }
        }
        
        // Update max streak counter if it exists
        if (this.maxStreakText) {
            this.maxStreakText.setText(`${this.maxWordStreak}`);
        }
        
        // Update streak icon color
        if (this.streakIcon) {
            // Use setFillStyle instead of directly assigning to fillColor which is read-only
            this.streakIcon.setFillStyle(this.getStreakColor(this.wordStreak));
        }
    }
    
    animateCountChange(textObject, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        // Parse values as integers
        const oldNum = parseInt(oldValue, 10) || 0;
        const newNum = parseInt(newValue, 10) || 0;
        
        // Only animate if increasing
        if (newNum > oldNum) {
            // Create a temporary text object for the animation
            const deviceType = detectDeviceType();
            const uiScale = this.scalingManager?.uiScale || 1;
            const animStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
            const animatedText = this.add.text(
                textObject.x, 
                textObject.y - 15,
                "+" + (newNum - oldNum),
                {
                    ...animStyle,
                    fontStyle: 'bold',
                    fill: '#ffffff'
                }
            ).setOrigin(1, 0.5).setAlpha(0);
            
            // Add it to the same container
            this.wordCountDisplay.add(animatedText);
            
            // Animate the temporary text
            this.fadeIn(animatedText, 200);
            this.tweens.add({
                targets: animatedText,
                y: animatedText.y - 15,
                alpha: { from: 1, to: 0 },
                ease: 'Cubic.Out',
                duration: 800,
                delay: 300,
                onComplete: () => animatedText.destroy()
            });
            
            // Scale effect on the main counter
            this.tweens.add({
                targets: textObject,
                scale: { from: 1, to: 1.3, duration: 200, yoyo: true },
                ease: 'Back.Out',
                duration: 400,
            });
        }
        
        // Update the text
        textObject.setText(newValue);
    }

    ensureTextVisibility() {
        if (this.inputText) {
            this.inputText.setVisible(true);
            this.inputText.setDepth(25);
        }
        if (this.autocompleteText) {
            this.autocompleteText.setVisible(true);
            this.autocompleteText.setDepth(50);
        }
    }

    
    // Update cursor and input text display
    updateCursor() {
        if (this.isShuttingDown) return;
        if (!this.inputText || this.inputText.destroyed) return;
        
        // Check if we need to update based on cached values
        const hasTextChanged = this.userInput !== this._cachedValues?.lastUserInput;
        const hasCursorChanged = this._lastCursorVisible !== this.cursorVisible;
        
        // Only update if something has actually changed
        if (!hasTextChanged && !hasCursorChanged) {
            return;
        }
        
        // Update cached values
        if (this._cachedValues) {
            this._cachedValues.lastUserInput = this.userInput;
        }
        this._lastCursorVisible = this.cursorVisible;
        
        // Build display text
        let displayText = this.userInput;
        
        // Append blinking cursor
        if (this.cursorVisible) {
            displayText += "_";
        } else {
            displayText += " ";
        }
        
        // Update text in one operation
        this.inputText.setText(displayText);
    }

    createSettingsButton(x, y, menuBarHeight) {
        // Create settings button using the PNG
        const settingsIcon = this.add.image(x, y, 'settings').setOrigin(0.5);

        // Set icon size relative to menu bar height
        let iconSize = Math.round(menuBarHeight * 0.4);
        // Slightly increase icon size for mobile devices
        if (this.isMobile) {
            iconSize = Math.round(menuBarHeight * 0.35); // was 0.25, now slightly larger
        }
        settingsIcon.setDisplaySize(iconSize, iconSize);

        // Make the settings icon white
        settingsIcon.setTint(0xffffff);
        
        // Make it interactive without scale effects
        settingsIcon.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                this.showTooltip('Settings: \nLevel\nMode', settingsIcon.x, settingsIcon.y + 50);
            })
            .on('pointerout', () => {
                this.hideTooltips();
            })
            .on('pointerdown', () => {
                // No scale effect
            })
            .on('pointerup', () => {
                this.toggleSettingsPopup();
            });
        
        // Store reference to the button
        this.settingsButton = settingsIcon;
    }

    showTooltip(text, x, y) {
        // Hide any existing tooltips
        this.hideTooltips();

        // Create tooltip background
        const padding = 10;
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        const tooltipStyle = getTextStyle('tooltip', deviceType, this.mode || 'basic', uiScale);
        const tooltipText = this.add.text(0, 0, text, {
            ...tooltipStyle,
            color: '#ffffff',
            align: 'center'
        });

        const width = tooltipText.width + padding * 2;
        const height = tooltipText.height + padding * 2;

        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRoundedRect(0, 0, width, height, 8);
        background.lineStyle(1, 0xffffff, 0.3);
        background.strokeRoundedRect(0, 0, width, height, 8);

        // Calculate initial position
        let tooltipX = x - width / 2;
        let tooltipY = y - height - 5;

        // Clamp X so tooltip stays within screen horizontally
        tooltipX = Math.max(0, Math.min(tooltipX, this.sys.game.canvas.width - width));
        // Clamp Y so tooltip stays within screen vertically
        tooltipY = Math.max(0, Math.min(tooltipY, this.cameras.main.height - height));

        // Create container for tooltip
        const container = this.add.container(tooltipX, tooltipY, [background, tooltipText]);
        tooltipText.setPosition(padding, padding);

        // Add to active tooltips
        this.tooltips.push(container);

        // Fade in effect
        container.setAlpha(0);
        this.fadeIn(container, 200, 'Quad.easeOut');

        container.setDepth(1000);
    }
    
    hideTooltips() {
        this.tooltips.forEach(tooltip => {
            this.fadeOut(tooltip, 200, 'Quad.easeOut', () => tooltip.destroy());
        });
        this.tooltips = [];
    }

    addButtonClickEffects() {
        const buttons = [
            { button: this.doneButton, tooltip: 'Escalate to supervisory oversight' },
            { button: this.resetButton, tooltip: 'Reset field. Begin anew' },
            { button: this.feedbackButton, tooltip: 'Report anomaly or praise' },
            //{ button: this.hardButton, tooltip: 'Switch to Hard mode: No AI suggestions' },
            //{ button: this.easyButton, tooltip: 'Switch to Easy mode: AI suggestions allowed' }
        ];
        
        buttons.forEach(({ button, tooltip }) => {
            if (!button) return;
            
            button.on('pointerover', () => {
                button.setScale(1.1);
                if (tooltip) {
                    this.showTooltip(tooltip, button.x, button.y - button.height/2);
                }
            });
            
            button.on('pointerout', () => {
                button.setScale(1);
                this.hideTooltips();
            });
            
            button.on('pointerdown', () => {
                button.setScale(0.95);
            });
            
            button.on('pointerup', () => {
                button.setScale(1.1);
            });
        });
    }



    updateFailsCounter(success) {
        // Keep tracking logic only - no visuals
        if (success) {
            // Non-AI word - just track it
            // (No visual effects)
        } else {
            // AI word - update count
            this.aiWordCount++;
        }
        
        // Update the word count display
        this.updateWordCountDisplay();
        
        // Update the streak counter - success means original word
        this.updateStreakCounter(success);
    }
    
    // Get appropriate color based on streak count
    getStreakColor(streak) {
        if (streak >= 10) return 0xffd700; // Gold
        if (streak >= 7) return 0xff4500;  // Orange-red
        if (streak >= 5) return 0xff8c00;  // Dark orange
        if (streak >= 3) return 0x32cd32;  // Lime green
        return 0x4169e1;                   // Royal blue
    }
    
    // Update the streak counter with animations
    updateStreakCounter(isOriginalWord) {
        // Track if this is a new streak
        const previousStreak = this.wordStreak;
        
        if (isOriginalWord) {
            // Increment streak for original words
            this.wordStreak++;
            this.lastWordWasOriginal = true;
            
            // Update max streak if needed
            if (this.wordStreak > this.maxWordStreak) {
                this.maxWordStreak = this.wordStreak;
            }
        } else {
            // Reset streak for AI words
            this.wordStreak = 0;
            this.lastWordWasOriginal = false;
            
            // Cleanup any existing streak-specific visual elements
            this.cleanupStreakVisuals();
        }
        
        // Update the word count display which contains the streak counters
        this.updateWordCountDisplay();
        
        // Update background based on the new streak value
        this.updateBackgroundForStreak();
        
        // If streak has increased, add celebration effects at milestones
        if (isOriginalWord && this.wordStreak > previousStreak) {
            // Add streak milestone effects
            this.celebrateStreakMilestone(this.wordStreak, previousStreak);
        }
    }
    
    // Helper method to clean up any streak-specific visuals
    cleanupStreakVisuals() {
        // Clean up any existing streak-specific background elements
        if (this.background && this.background.active) {
            // Clean up the border if it exists
            if (this.background.streakBorder && this.background.streakBorder.active) {
                this.background.streakBorder.destroy();
                this.background.streakBorder = null;
            }
            
            // Clean up particles if they exist
            if (this.background.particles && Array.isArray(this.background.particles)) {
                this.background.particles.forEach(particle => {
                    try {
                        if (particle && particle.active) {
                            particle.destroy();
                        }
                    } catch (e) {
                        // Ignore errors during particle cleanup
                    }
                });
                this.background.particles = null;
            }
            
            // Clean up glow overlay if it exists
            if (this.background.glowOverlay && this.background.glowOverlay.active) {
                this.background.glowOverlay.destroy();
                this.background.glowOverlay = null;
            }
            
            // Clean up vignette if it exists
            if (this.background.vignette && this.background.vignette.active) {
                this.background.vignette.destroy();
                this.background.vignette = null;
            }
            
            // Clean up flares if they exist
            if (this.background.flares && Array.isArray(this.background.flares)) {
                this.background.flares.forEach(flare => {
                    try {
                        if (flare && flare.active) {
                            flare.destroy();
                        }
                    } catch (e) {
                        // Ignore errors during flare cleanup
                    }
                });
                this.background.flares = null;
            }
            
            // Clean up mobile overlay if it exists
            if (this.background.overlay && this.background.overlay.active) {
                this.background.overlay.destroy();
                this.background.overlay = null;
            }
        }
    }
    
    // Update background based on the current streak
    updateBackgroundForStreak() {
        // Only update the background visually, don't trigger a full UI relayout
        // which would destroy existing UI elements like suggestion boxes
        this.time.delayedCall(0, () => {
            // Clean up existing background elements first
            if (this.background && this.background.active) {
                // Clean up any existing streak-specific background elements
                this.cleanupStreakVisuals();
            }
            
            // Continue with background creation after cleanup
            this._createBackgroundAfterCleanup();
        });
    }
    
    // Celebrate streak milestones with special effects
    celebrateStreakMilestone(currentStreak, previousStreak) {
        // Define milestone thresholds
        const milestones = [3, 5, 7, 10, 15, 20];
        
        // Check if we crossed any milestone
        for (const milestone of milestones) {
            if (previousStreak < milestone && currentStreak >= milestone) {
                // We crossed a milestone, add celebration effects
                const text = milestone === 3 ? "STREAK!" : 
                            milestone === 5 ? "NICE STREAK!" : 
                            milestone === 7 ? "GREAT STREAK!" :
                            milestone === 10 ? "AMAZING STREAK!" :
                            milestone === 15 ? "INCREDIBLE STREAK!" :
                            "UNSTOPPABLE!";
                
                // Position celebration text at the top-right near the word stats panel
                const padding = 20;
                const displayX = this.sys.game.canvas.width - 180 - padding; // Same as word stats x position
                
                // Get text style from textStyles.js
                const deviceType = detectDeviceType();
                const uiScale = this.scalingManager?.uiScale || 1;
                const effectStyle = getTextStyle('effect', deviceType, this.mode || 'basic', uiScale);
                
                // Celebration text that appears near the word stats
                const celebrationText = this.add.text(
                    displayX + 90, // Center of the word stats panel
                    this.menuBarHeight + 150, // Below the word stats panel
                    text,
                    {
                        ...effectStyle,
                        fontSize: '28px', // Larger font size
                        fontStyle: 'bold',
                        fill: '#ffff00', // Bright yellow for better visibility
                        stroke: '#ff0000', // Red stroke for contrast
                        strokeThickness: 6, // Thicker stroke
                        shadow: {
                            offsetX: 3,
                            offsetY: 3,
                            color: '#000000',
                            blur: 8,
                            stroke: true,
                            fill: true
                        }
                    }
                ).setOrigin(0.5, 0.5).setDepth(1000); // Much higher depth
                
                // Animate the celebration text with proper visibility
                celebrationText.setAlpha(0);
                celebrationText.setScale(0.5);
                
                // First fade in and scale up
                this.tweens.add({
                    targets: celebrationText,
                    alpha: 1,
                    scale: 1,
                    duration: 300,
                    ease: 'Back.Out',
                    onComplete: () => {
                        // Then animate up and fade out after a delay
                        this.tweens.add({
                            targets: celebrationText,
                            y: celebrationText.y - 80,
                            alpha: 0,
                            scale: 1.5,
                            duration: 1200,
                            delay: 500, // Keep visible for 500ms
                            ease: 'Power2.In',
                            onComplete: () => celebrationText.destroy()
                        });
                    }
                });
                
                // Highlight the word stats panel for a moment
                if (this.wordCountDisplay) {
                    this.tweens.add({
                        targets: this.wordCountDisplay,
                        scale: { from: 1, to: 1.05, duration: 200 },
                        yoyo: true,
                        repeat: 2,
                        ease: 'Sine.InOut'
                    });
                }
                
                // Add screen edge flash effect for mobile
                if (this.isMobile) {
                    this.createMobileScreenEdgeFlash(milestone);
                }
                
                // Only celebrate the highest milestone crossed
                break;
            }
        }
    }
    
    /**
     * Create a screen edge flash effect for mobile devices when hitting streak milestones
     * @param {number} milestone - The milestone that was reached
     */
    createMobileScreenEdgeFlash(milestone) {
        const flashColor = 0xff00ff; // Magenta
        
        // Determine flash intensity based on milestone
        let flashAlpha, flashDuration, pulseCount;
        if (milestone >= 20) {
            flashAlpha = 0.6;
            flashDuration = 400;
            pulseCount = 3;
        } else if (milestone >= 15) {
            flashAlpha = 0.5;
            flashDuration = 350;
            pulseCount = 3;
        } else if (milestone >= 10) {
            flashAlpha = 0.4;
            flashDuration = 300;
            pulseCount = 2;
        } else if (milestone >= 5) {
            flashAlpha = 0.35;
            flashDuration = 250;
            pulseCount = 2;
        } else {
            flashAlpha = 0.3;
            flashDuration = 200;
            pulseCount = 1;
        }
        
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const edgeWidth = 15; // Width of the edge flash
        
        // Create edge flash graphics
        const edges = this.add.graphics();
        edges.setDepth(995); // High depth but below UI elements
        
        // Function to draw the edge flash
        const drawEdgeFlash = (alpha) => {
            edges.clear();
            edges.fillStyle(flashColor, alpha);
            
            // Top edge
            edges.fillRect(0, 0, screenWidth, edgeWidth);
            // Bottom edge
            edges.fillRect(0, screenHeight - edgeWidth, screenWidth, edgeWidth);
            // Left edge
            edges.fillRect(0, 0, edgeWidth, screenHeight);
            // Right edge
            edges.fillRect(screenWidth - edgeWidth, 0, edgeWidth, screenHeight);
            
            // Corner enhancements for higher milestones
            if (milestone >= 10) {
                const cornerSize = 40;
                // Top-left corner
                edges.fillTriangle(0, 0, cornerSize, 0, 0, cornerSize);
                // Top-right corner
                edges.fillTriangle(screenWidth, 0, screenWidth - cornerSize, 0, screenWidth, cornerSize);
                // Bottom-left corner
                edges.fillTriangle(0, screenHeight, cornerSize, screenHeight, 0, screenHeight - cornerSize);
                // Bottom-right corner
                edges.fillTriangle(screenWidth, screenHeight, screenWidth - cornerSize, screenHeight, screenWidth, screenHeight - cornerSize);
            }
        };
        
        // Initial draw
        drawEdgeFlash(0);
        
        // Create the pulsing animation
        let currentPulse = 0;
        const pulseAnimation = () => {
            currentPulse++;
            
            // Fade in
            this.tweens.add({
                targets: { alpha: 0 },
                alpha: flashAlpha,
                duration: flashDuration / 2,
                ease: 'Sine.In',
                onUpdate: (tween) => {
                    drawEdgeFlash(tween.getValue());
                },
                onComplete: () => {
                    // Fade out
                    this.tweens.add({
                        targets: { alpha: flashAlpha },
                        alpha: 0,
                        duration: flashDuration / 2,
                        ease: 'Sine.Out',
                        onUpdate: (tween) => {
                            drawEdgeFlash(tween.getValue());
                        },
                        onComplete: () => {
                            if (currentPulse < pulseCount) {
                                // Do another pulse
                                this.time.delayedCall(100, pulseAnimation);
                            } else {
                                // Clean up
                                edges.destroy();
                            }
                        }
                    });
                }
            });
        };
        
        // Start the animation
        pulseAnimation();
        
        // Add subtle camera shake for higher milestones
        if (milestone >= 10) {
            this.cameras.main.shake(200, 0.003);
        }
    }
    
    preload() {
        // Ensure mobile background images are loaded
        // This is a backup in case they weren't loaded in Preloader
        const isMobileCheck = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || 
                             (typeof window !== 'undefined' && window.innerWidth <= 900);
        
        if (isMobileCheck) {
            console.log("[MOBILE BG] Preloading mobile backgrounds in BaseGameScene");
            this.load.setPath('assets/backgrounds');
            for (let level = 1; level <= 3; level++) {
                this.load.image(`hard_lvl_${level}`, `hard_lvl_${level}.png`);
            }
            this.load.setPath('assets');
        }
    }
    
    init(data) {
        // CRITICAL: Reset the shutdown flag when the scene starts
        // This was the bug - the flag remained true after mode switching
        this.isShuttingDown = false;
        
        // Set the mode from data if provided (e.g., from LevelScene)
        if (data && data.mode) {
            this.mode = data.mode;
            // Update mode-specific styles when mode is set
            this.updateModeStyles();
            
            // Force a complete reset of game state when switching modes
            this.resetGameState();
        }
        
        // Don't set a camera background color - let the background images show through
        // this.cameras.main.setBackgroundColor(COLORS_HEX.BACKGROUND); // REMOVED - was covering mobile backgrounds
        
        // If this is a reset from DoneScene or FeedbackScene, reset game state but preserve level and topK
        if (data && data.requiresReset) {
            this.progressPercentage = data.progressPercentage || 50;
            
            // Preserve level and topK if they were passed
            if (data.levelValue) {
                this.levelValue = data.levelValue;
                // No need to update slider position - it will be set when settings popup opens
            }
            
            if (data.topKValue) {
                this.topKValue = data.topKValue;
                // No need to update slider position - it will be set when settings popup opens
            }
            
            // Reset game state to match our simplified approach
            this.aiWordCount = 0;
             // Note: originalWordCount and totalWordCount are now calculated dynamically
            
            // Reset suggestion-related state
            this.userInput = '';
            this.aiSuggestedWords = [];
            this.autocompleteText = null;
            this.suggestionBoxes = [];
            this.suggestionTexts = [];
            
            // Reset cursor state
            this.cursorVisible = true;
            if (this.cursorTimer) {
                this.cursorTimer.remove();
                this.cursorTimer = null;
            }
        } else if (data && data.progressPercentage !== undefined) {
            // Normal scene transition
            this.progressPercentage = data.progressPercentage;
        }
        
        // Reset UI elements for recreation
        this.promptTextBox = null;
        this.promptText = null;
        this.failsCounter = null;
        this.failsText = null;
        
        // Clean up any existing hidden input element
        if (this._hiddenInput) {
            // Only remove event listeners if they exist
            if (this._hiddenInputHandler) {
                this._hiddenInput.removeEventListener('input', this._hiddenInputHandler);
                this._hiddenInputHandler = null;
            }
            if (this._hiddenInputBlurHandler) {
                this._hiddenInput.removeEventListener('blur', this._hiddenInputBlurHandler);
                this._hiddenInputBlurHandler = null;
            }
            // Remove the element from DOM
            if (document.body.contains(this._hiddenInput)) {
                document.body.removeChild(this._hiddenInput);
            }
            this._hiddenInput = null;
        }
    }
    
    /**
     * Update background based on current level and streak
     */
    updateBackgroundForLevel() {
 
        // Defer cleanup to next frame to avoid rendering conflicts on Android
        this.time.delayedCall(0, () => {
            // Clean up existing background elements first
            if (this.background && this.background.active) {

                
                // IMPORTANT: Clean up the overlay BEFORE destroying the background
                // This prevents overlays from stacking on mobile
                if (this.background.overlay && this.background.overlay.active) {
                    this.background.overlay.destroy();
                    this.background.overlay = null;
                }
                
                // Also clean up any tint overlay if it exists
                if (this.background.tintOverlay && this.background.tintOverlay.active) {
                    this.background.tintOverlay.destroy();
                    this.background.tintOverlay = null;
                }
                
                // Clean up any other streak-related visuals
                this.cleanupStreakVisuals();
                
                // Destroy background only if it's still active
                if (this.background.active) {
                    this.background.destroy();
                    this.background = null;
                }
            }
            
            // Continue with background creation after cleanup
            this._createBackgroundAfterCleanup();
        });
    }
    
    /**
     * Create background after cleanup is complete
     * @private
     */
    _createBackgroundAfterCleanup() {
        // Get canvas dimensions
        const w = this.sys.game.config.width || this.cameras.main.width;
        const h = this.sys.game.config.height || this.cameras.main.height;

        if (!w || !h || w < 10 || h < 10) {
            this.time.delayedCall(50, () => this.updateBackgroundForLevel());
            return;
        }
        
        try {
            createBackground(this, THEME.background, this.levelValue, this.wordStreak || 0);
        } catch (error) {
            console.error("[MOBILE BG DEBUG] Error calling createBackground:", error);
            console.error("[MOBILE BG DEBUG] Error stack:", error.stack);
            console.error("[MOBILE BG DEBUG] Error message:", error.message);
        }
    }
    
    /**
     * Handle feedback button click
     */
    onFeedbackClick() {
        // Transition to feedback scene
        this.scene.start('FeedbackScene', {
            levelValue: this.levelValue,
            topKValue: this.topKValue,
            mode: this.mode,
            prompt: this.currentPrompt,
            progressPercentage: this.progressPercentage
        });
    }
}
