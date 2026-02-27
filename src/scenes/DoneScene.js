import { DESIGN, THEME } from "../config/design.js";
import { saveInteraction, isHighScore } from "../config/firebase.js";
import SceneTransitionManager from "../utils/SceneTransitionManager.js";
import { createBackground } from "../backgrounds/createBackground.js";
import { getTextStyle, getBoxStyle } from "../config/textStyles.js";
import { detectDeviceType } from "../config/dimensions.js";
import { BaseScene } from "./BaseScene.js";

export default class DoneScene extends BaseScene {
    constructor() {
        super({ key: 'DoneScene' });
        this.mode = null;
        this.userInput = '';
    }

    onFeedbackClick() {
        this.scene.start('FeedbackScene', {mode: this.mode});
    }
    
    showLeaderboard() {
        this.scene.start('LeaderboardScene', {
            mode: this.mode,
            levelValue: this.levelValue,
            previousScene: 'DoneScene',
            score: this.totalScore,
            userResponse: this.userInput
        });
    }

    // Pixel-perfect output text box for stacked layout, matching prompt box exactly
    createOutputTextBox() {
        const outputBoxWidth = this.uiBoxWidth;
        const padding = this.scalingManager.scaleValue(30);

        // Use stored input box position
        const inputBoxBottom = this.inputBoxY + this.inputBoxHeight;
        // Increased vertical margin from 30 to 50 to prevent text overflow
        const verticalMargin = this.scalingManager.scaleValue(30);
        const outputBoxY = inputBoxBottom + verticalMargin;

        // Get style
        const deviceType = detectDeviceType();
        const style = getTextStyle('prompt', deviceType, this.mode || 'basic', this.uiScale || 1);
        const boxStyle = this.getPromptBoxStyle();
        // DEBUG: Log box style for output
        console.log("[Output BoxStyle]", JSON.stringify(boxStyle));

        // Cap height for buttons
        const canvasHeight = this.cameras.main.height;
        const buttonMargin = this.scalingManager.scaleValue(30);
        const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) ||
                         (typeof window !== 'undefined' && window.innerWidth <= 900);
        const scaledButtonSpacing = isMobile ?
            this.scalingManager.scaleValue(80) :
            this.scalingManager.scaleValue(30);
        const buttonHeight = this.scalingManager.buttonHeight();
        const buttonSpacing = this.scalingManager.scaleValue(20);

        const reservedBottomSpace =
            scaledButtonSpacing +
            buttonHeight +
            buttonSpacing +
            buttonHeight +
            buttonMargin;

        // Calculate max height
        const maxOutputBoxHeight = canvasHeight - outputBoxY - reservedBottomSpace;
        
        // Create text object first to measure content
        const textObj = this.add.text(0, 0, this.evaluation || "", {
            ...style,
            wordWrap: { width: outputBoxWidth - padding * 2 },
            align: 'left',
            lineSpacing: 5
        }).setOrigin(0, 0);

        // Use content height or max height
        const outputBoxHeight = Math.min(textObj.height + padding * 2, maxOutputBoxHeight);

        // Create container for the box
        const container = this.add.container(
            this.cameras.main.centerX - outputBoxWidth / 2,
            outputBoxY
        );

        // Create background fill (no outline yet)
        const bg = this.add.graphics();
        bg.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        bg.fillRoundedRect(0, 0, outputBoxWidth, outputBoxHeight, boxStyle.cornerRadius);
        
        // Create separate outline graphics to ensure it's always on top
        const outline = this.add.graphics();
        outline.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
        outline.strokeRoundedRect(0, 0, outputBoxWidth, outputBoxHeight, boxStyle.cornerRadius);
        
        // Add to container - background, text, then outline on top
        container.add(bg);
        container.add(textObj);
        container.add(outline);  // Add outline last so it's on top
        
        container.setDepth(9);

        // Position text with padding
        textObj.setPosition(padding, padding);

        // Create mask for overflow - apply to text ONLY, inset slightly to prevent overlap with border
        const maskInset = Math.ceil(boxStyle.outlineWidth / 2);
        const maskShape = this.add.graphics().fillRect(
            this.cameras.main.centerX - outputBoxWidth / 2 + maskInset,
            outputBoxY + maskInset,
            outputBoxWidth - maskInset * 2,
            outputBoxHeight - maskInset * 2
        );
        const mask = maskShape.createGeometryMask();
        textObj.setMask(mask);  // Apply mask to text only, not the entire container

        // Store references
        this.outputText = textObj;
        this.outputTextBox = bg;
        this.outputTextMask = maskShape;

        // Store output box position and height for button placement
        this.outputBoxY = outputBoxY;
        this.outputBoxHeight = outputBoxHeight;

        // Create the box structure for scrolling (same as column version)
        this._outputBox = {
            container: container,
            width: outputBoxWidth,
            height: outputBoxHeight,
            padding: { top: padding, bottom: padding, left: padding, right: padding },
            textObj: textObj
        };

        // Fade-in animation
        container.setAlpha(0);
        this.tweens.add({
            targets: container,
            alpha: 1,
            duration: 500,
            ease: 'Sine.InOut'
        });
    }

    // Column version of input box (explicit rect)
    createInputTextBoxAtRect({ x, y, width, height }) {
      const deviceType = detectDeviceType();
      const style = getTextStyle('prompt', deviceType, this.mode || 'basic', this.uiScale || 1);
      const boxStyle = this.getPromptBoxStyle(); // Use proper theme-based style
      // DEBUG: Log box style for input (columns mode)
      console.log("[Input BoxStyle]", JSON.stringify(boxStyle));
      const padding = this.scalingManager?.scaleValue(30) ?? 30;

      const displayText = "Prompt: " + this.prompt + "\n" + "Response: " + this.userInput;

      // Text first (for wrap) - use style as-is
      const innerW = Math.max(0, width - padding * 2);
      const textObj = this.add.text(0, 0, displayText, { 
        ...style, 
        wordWrap: { width: innerW, useAdvancedWrap: true }
      })
        .setOrigin(0, 0);

      // Container
      const container = this.add.container(x, y);
      const bg = this.add.graphics();
      container.add(bg);
      container.add(textObj);

      // Draw rounded box + outline EXACTLY like top box - no conditional check
      bg.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
      bg.fillRoundedRect(0, 0, width, height, boxStyle.cornerRadius);
      bg.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
      bg.strokeRoundedRect(0, 0, width, height, boxStyle.cornerRadius);

      // Position text inside padding and add mask clip
      textObj.setPosition(padding, padding);
      const maskShape = this.add.graphics().fillRect(x + 0, y + 0, width, height);
      const mask = maskShape.createGeometryMask();
      container.setMask(mask);

      // Add fade-in effect for loading
      container.setAlpha(0);
      this.tweens.add({
        targets: container,
        alpha: 1,
        duration: 500,
        ease: 'Sine.InOut'
      });

      // Store state for scrolling
      this._inputBox = {
        container, width, height,
        padding: { top: padding, bottom: padding, left: padding, right: padding },
        textObj
      };
    }

    // Column version of output box (explicit rect)
    createOutputTextBoxAtRect({ x, y, width, height }) {
      const deviceType = detectDeviceType();
      const style = getTextStyle('prompt', deviceType, this.mode || 'basic', this.uiScale || 1);
      const boxStyle = this.getPromptBoxStyle(); // Use proper theme-based style
      // DEBUG: Log box style for output (columns mode)
      console.log("[Output BoxStyle]", JSON.stringify(boxStyle));
      const padding = this.scalingManager?.scaleValue(30) ?? 30;

      const innerW = Math.max(0, width - padding * 2);
      const textObj = this.add.text(0, 0, this.evaluation || "", { 
        ...style, 
        wordWrap: { width: innerW, useAdvancedWrap: true }
      })
        .setOrigin(0, 0);

      const container = this.add.container(x, y);
      const bg = this.add.graphics();
      container.add(bg);
      container.add(textObj);

      // Draw rounded box fill (no outline yet)
      bg.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
      bg.fillRoundedRect(0, 0, width, height, boxStyle.cornerRadius);
      
      // Create separate outline graphics to ensure it's always on top
      const outline = this.add.graphics();
      outline.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
      outline.strokeRoundedRect(0, 0, width, height, boxStyle.cornerRadius);

      // Add to container - background, text, then outline on top
      container.add(outline);  // Add outline last so it's on top

      textObj.setPosition(padding, padding);
      
      // Create mask inset by half the outline width to prevent text from overlapping border - apply to text only
      const maskInset = Math.ceil(boxStyle.outlineWidth / 2);
      const maskShape = this.add.graphics().fillRect(
        x + maskInset, 
        y + maskInset, 
        width - maskInset * 2, 
        height - maskInset * 2
      );
      const mask = maskShape.createGeometryMask();
      textObj.setMask(mask);  // Apply mask to text only, not the entire container

      // Add fade-in effect for loading
      container.setAlpha(0);
      this.tweens.add({
        targets: container,
        alpha: 1,
        duration: 500,
        delay: 200, // Slight delay so output appears after input
        ease: 'Sine.InOut'
      });

      this._outputBox = {
        container, width, height,
        padding: { top: padding, bottom: padding, left: padding, right: padding },
        textObj
      };
    }




    
    addButtonClickEffects() {
        // Apply to all buttons
        console.log("Adding button click effects");
        
        // Define the click handler function - separate from the button setup
        const addClickEffect = (button, callback) => {
            if (!button) return;
            // Attach click to the hitRect (first child of the button container)
            const hitRect = button.list && button.list[0] && button.list[0].setInteractive ? button.list[0] : null;
            if (!hitRect) return;

            // Remove any previous click handlers
            hitRect.off('pointerdown');
            hitRect.on('pointerdown', (pointer) => {
                console.log("Button clicked:", button.name || "unnamed button");

                // Create the particle effect
                // Use green for "NEXT"/"DONE", red for "feedback"
                const label = button.list?.find(obj => obj.text)?.text?.toUpperCase?.() || "";
                const color = (label === "NEXT" || label === "DONE") ? 0x43ea5e : (label.includes("FEEDBACK") ? 0xff1744 : undefined);

                // Simulate button press animation
                this.tweens.add({
                    targets: button,
                    scaleX: 0.95,
                    scaleY: 0.95,
                    duration: 100,
                    yoyo: true,
                    ease: "Quad.Out",
                    onComplete: () => {
                        // Call the provided callback
                        if (typeof callback === 'function') {
                            callback();
                        }
                    }
                });
            });
        };
        
        // Apply to each button with its own callback
        addClickEffect(this.doneButton, () => this.onDoneButtonClick());
        addClickEffect(this.feedbackButton, () => this.onFeedbackClick());
    }
      

    createBackgroundEffect() {
        let width = this.sys.game.canvas.width;
        let height = this.cameras.main.height;
        
        let gradientTextureKey = 'gradientBackground';
    
        if (!this.textures.exists(gradientTextureKey)) {
            let gradientCanvas = this.textures.createCanvas(gradientTextureKey, width, height);
            let ctx = gradientCanvas.getContext();
    
            if (!ctx) {
                console.error("Failed to get canvas context for background effect.");
                return;
            }
    
            let grd = ctx.createLinearGradient(0, 0, width, height);
            grd.addColorStop(0, '#' + this.COLORS_HEX.BACKGROUND.toString(16).padStart(6, '0'));
            grd.addColorStop(1, '#' + this.COLORS_HEX.BACKGROUND_MID.toString(16).padStart(6, '0'));
    
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, width, height);
            gradientCanvas.refresh();
        }
    
        this.background = this.add.image(0, 0, gradientTextureKey)
            .setOrigin(0)
            .setDisplaySize(width, height)
            .setDepth(-1);
    
        this.tweens.add({
            targets: this.background,
            alpha: { from: 0.8, to: 1 },
            duration: 4000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });
    }    

    testUsernameScene() {
        // Direct test function to go to username scene
        console.log("TEST: Directly starting UsernameScene with test data");
        
        // Create minimal test data
        const testScoreData = {
            score: 100,
            mode: this.mode || 'easy',
            level: this.levelValue || 1,
            prompt: "Test prompt",
            inputText: "Test input"
        };
        
        this.scene.start('UsernameScene', {
            mode: this.mode || 'easy',
            scoreData: testScoreData,
            levelValue: this.levelValue || 1,
            userResponse: this.userInput || ''
        });
    }
    
    async onDoneButtonClick() {
        // (Removed redundant isTransitioning guard; handled by SceneTransitionManager)

        // Save the user input before clearing it
        const userInputCopy = this.userInput;
        
        // Create proper interaction object (not just a string)
        const interaction = {
            userInput: userInputCopy,
            mode: this.mode,
            levelValue: this.levelValue,
            score: this.totalScore,
            prompt: this.prompt
        };
        saveInteraction(interaction, 'userSubmissions');
        
        // Log user input before clearing
        console.log("User input before clearing:", userInputCopy);
        
        // Clean up resources before transitioning
        this.clearInputTextBox();
        if (this.cursorTimer) {
            this.cursorTimer.remove();
            this.cursorTimer = null;
        }
        
        if (this.activeTimeout) {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = null;
        }
        console.log("Initial levelvalue: ", this.levelValue);
        
        // Store the original level value before updating it
        const originalLevelValue = this.levelValue;
        
        // Determine transition context based on score
        let transitionContext = SceneTransitionManager.CONTEXT.NORMAL;
        let transitionColor = this.mode === "hard" ? '#400045' : '#003450';
        
        if (this.totalScore >= 10) {
            this.levelValue = Math.min(this.levelValue + 1, );
            transitionContext = SceneTransitionManager.CONTEXT.LEVEL_UP;
            transitionColor = this.mode === "hard" ? '#600065' : '#004565'; // Brighter colors for success
        } else if (this.totalScore <= 5) {
            transitionContext = SceneTransitionManager.CONTEXT.LOW_SCORE;
            transitionColor = this.mode === "hard" ? '#200025' : '#001620'; // Darker colors for low score
        } 
        
        // Prepare reset data for game scene, preserving level and topK
        console.log("level_value", this.levelValue);
        const resetData = {
            progressPercentage: 50, // Reset to initial value
            levelValue: this.levelValue, // Preserve current level
            topKValue: this.topKValue, // Preserve current topK
            wordCount: 0,
            originalWordCount: 0,
            aiWordCount: 0,
            totalWordCount: 0,
            requiresReset: true // Flag to indicate this is a reset from DoneScene
        };
        
        // Check if this is a high score
        const scoreData = {
            score: this.totalScore,
            mode: this.mode,
            level: originalLevelValue, // Use the original level value, not the updated one
            temperature: this.temperature,
            failCount: this.failCount,
            totalWordCount: this.totalWordCount,
            originalWordCount: this.originalWordCount || (this.totalWordCount - this.failCount),
            prompt: this.prompt,
            response: userInputCopy,  // Use the saved copy, not this.userInput which is now cleared
            inputText: userInputCopy  // Use the saved copy, not this.userInput which is now cleared
        };
        
        // Debug log to verify the data
        console.log("scoreData before high score check:", JSON.stringify(scoreData, null, 2));
        
        try {
            // Add loading indicator while checking
            const outlineColorString = '#' + this.COLORS_HEX.BOX_OUTLINE.toString(16).padStart(6, '0');
            const loadingText = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'Checking scores...',
                {
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '32px',
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
            ).setOrigin(0.5).setDepth(1000);
            
            console.log("About to check if high score:", this.totalScore, this.mode);

            // LOG: Before isHighScore
            console.log("[DEBUG] Before isHighScore");
            const isHighScoreResult = await isHighScore(this.totalScore, this.mode, originalLevelValue);
            // LOG: After isHighScore
            console.log("[DEBUG] After isHighScore, result:", isHighScoreResult);

            // Remove loading text
            loadingText.destroy();
            console.log("scoredata: ", scoreData);
            console.log("Is high score result:", isHighScoreResult);
            
            // LOG: Before prepareTransition
            console.log("[DEBUG] Before prepareTransition");
            await SceneTransitionManager.prepareTransition(this);
            // LOG: After prepareTransition
            console.log("[DEBUG] After prepareTransition");

            if (isHighScoreResult) {
                // It's a high score! Go to the username entry scene with a cool radial transition
                console.log("High score achieved! Going to username entry");
                console.log("Passing to UsernameScene - Mode:", this.mode, "Level:", originalLevelValue);
                
                // Use the radial transition for high scores - it creates an expanding circle effect
                SceneTransitionManager.radialTransition(this, 'UsernameScene', {
                    mode: this.mode,
                    scoreData: scoreData,
                    levelValue: this.levelValue // Pass updated levelValue
                }, 800, transitionColor, true); // true = expanding circle
            } else {
                // Not a high score, go to the leaderboard with a transition
                console.log("Not a high score, going to leaderboard");
                
                // LOG: Before transition to LeaderboardScene
                console.log("[DEBUG] Before SceneTransitionManager.transition to LeaderboardScene");
                // Use a transition based on score context
                SceneTransitionManager.transition(this, 'LeaderboardScene', 
                    {
                        mode: this.mode,
                        levelValue: this.levelValue, // Pass updated levelValue
                        temperature: this.temperature,
                        score: this.totalScore,
                        userResponse: userInputCopy // Pass user's text for badge generation
                    },
                    transitionContext,
                    {
                        duration: 700,
                        color: transitionColor
                    }
                );
                // LOG: After transition to LeaderboardScene
                console.log("[DEBUG] After SceneTransitionManager.transition to LeaderboardScene");
            }
        } catch (error) {
            console.error("Error checking high score:", error);

            // Display stacktrace on screen
            const stackText = error && error.stack ? error.stack : (error && error.toString ? error.toString() : "Unknown error");
            const padding = 20;
            const maxWidth = this.sys.game.canvas.width - padding * 2;
            const errorDisplay = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                stackText,
                {
                    fontFamily: "Courier Prime, monospace",
                    fontSize: "16px",
                    color: "#FF0000",
                    backgroundColor: "#000000",
                    wordWrap: { width: maxWidth },
                    align: "left",
                    padding: { x: 12, y: 12 }
                }
            ).setOrigin(0.5, 0.5).setDepth(2000);

            // Optionally, allow user to tap/click to dismiss the error and return to main menu
            errorDisplay.setInteractive();
            errorDisplay.on('pointerdown', () => {
                errorDisplay.destroy();
                // Optionally, transition to BaseGameScene after dismiss
                SceneTransitionManager.glitchTransition(this, 'BaseGameScene', { ...resetData, mode: this.mode }, 600, '#ff0000', 5);
            });
        }
    }

    // Pixel-perfect input text box for stacked layout, matching prompt box exactly
    createInputTextBox(y) {
        const textBoxWidth = this.uiBoxWidth;
        const padding = this.scalingManager.scaleValue(30);
        const minHeight = this.scalingManager.scaleValue(60);

        // Clean up previous
        if (this.inputText) this.inputText.destroy();
        if (this.inputTextBorder) this.inputTextBorder.destroy();

        // Get style
        const deviceType = detectDeviceType();
        const style = getTextStyle('prompt', deviceType, this.mode || 'basic', this.uiScale || 1);
        const boxStyle = this.getPromptBoxStyle();
        // DEBUG: Log box style for input
        console.log("[Input BoxStyle]", JSON.stringify(boxStyle));

        const displayText = "Prompt: " + this.prompt + "\n" + "Response: " + this.userInput;
        this.cursorVisible = true;
        this.inputText = this.add.text(0, 0, displayText, {
            ...style,
            wordWrap: { width: textBoxWidth - padding * 2 },
            align: "left"
        }).setOrigin(0, 0).setAlpha(1).setVisible(true).setDepth(101);

        this.inputText.updateText();

        const dynamicHeight = Math.max(this.inputText.height + padding * 2, minHeight);
        const boxX = this.cameras.main.centerX - textBoxWidth / 2;
        const boxY = (typeof y === "number") ? y : (this.cameras.main.centerY - dynamicHeight / 2);

        this.inputBoxY = boxY;
        this.inputBoxHeight = dynamicHeight;

        // Draw box at absolute coordinates, just like prompt box
        this.inputTextBorder = this.add.graphics();
        this.inputTextBorder.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.inputTextBorder.fillRoundedRect(
            boxX,
            boxY,
            textBoxWidth,
            dynamicHeight,
            boxStyle.cornerRadius
        );
        this.inputTextBorder.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
        this.inputTextBorder.strokeRoundedRect(
            boxX,
            boxY,
            textBoxWidth,
            dynamicHeight,
            boxStyle.cornerRadius
        );
        this.inputTextBorder.setDepth(100).setVisible(true);

        // Position text inside the box with padding
        this.inputText.setPosition(boxX + padding, boxY + padding);

        // Mask to prevent overflow
        if (this.inputTextMask) this.inputTextMask.destroy();
        this.inputTextMask = this.add.graphics().fillRect(boxX, boxY, textBoxWidth, dynamicHeight);
        const mask = this.inputTextMask.createGeometryMask();
        this.inputText.setMask(mask);

        // Fade-in
        this.inputText.setAlpha(0);
        this.inputTextBorder.setAlpha(0);
        this.tweens.add({
            targets: [this.inputText, this.inputTextBorder],
            alpha: 1,
            duration: 500,
            ease: 'Sine.InOut'
        });
    }
    
    createPromptTextBox() {

        // Default Y for prompt box
        this.promptBoxY = this.scalingManager.scaleValue(130);
        console.log("Prompt box Y position:", this.promptBoxY);
        // Move up by 20px on desktop only
        const isMobileUA = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        const isNarrow   = (typeof window !== 'undefined' && window.innerWidth <= 900);
        if (!isMobileUA && !isNarrow && !this.totalscore >= 5) {
            this.promptBoxY -= 60;
        }
        console.log("Prompt box Y position:", this.promptBoxY);
    
        this.uiBoxWidth = this.sys.game.canvas.width * (5 / 6);
        const padding = this.scalingManager.scaleValue(30);
    
        // Clear existing prompt box graphics if it exists
        if (this.promptTextBox) {
            this.promptTextBox.clear();
        } else {
            this.promptTextBox = this.add.graphics();
        }
    
        // Clear existing prompt text if it exists
        if (this.promptText) {
            this.promptText.destroy();
        }

        // DEBUG: Log box style for prompt
        const boxStyle = this.getPromptBoxStyle();
        console.log("[Prompt BoxStyle]", JSON.stringify(boxStyle));

        const defaultText = `Unoriginal Words Attempted: ${this.failCount}\nAI Overlord's Assessment: ${this.aiScore}/15\nTotal Score: ${this.totalScore}/15`;

        // Get the appropriate text style for current device
        const deviceType = detectDeviceType();
        const promptTextStyle = getTextStyle('prompt', deviceType, this.mode || 'basic', this.uiScale || 1);

        // Position the text at the left side with the same padding as outputbox
        const textX = this.cameras.main.centerX - this.uiBoxWidth / 2 + padding;
        
        // Use the prompt style directly without forcing colors
        this.promptText = this.add.text(
            textX, 
            0, // Y will be adjusted later
            defaultText,
            {
                ...promptTextStyle,
                wordWrap: { width: this.uiBoxWidth - padding * 2 },
                align: "left",
                lineSpacing: 5
            }
        ).setOrigin(0, 0);
    
        // ✅ Ensure text box height dynamically adjusts
        const textHeight = this.promptText.height + padding * 2;
    
        // ✅ Create the Prompt Background Box using centralized styling
        // Use the already-declared boxStyle
        this.promptTextBox.fillStyle(boxStyle.fillColor, boxStyle.fillAlpha);
        this.promptTextBox.fillRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2, 
            this.promptBoxY,
            this.uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );
    
        // Draw outline normally, same as InstructionsScene
        this.promptTextBox.lineStyle(boxStyle.outlineWidth, boxStyle.outlineColor, 1);
        this.promptTextBox.strokeRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2, 
            this.promptBoxY,
            this.uiBoxWidth,
            textHeight,
            boxStyle.cornerRadius
        );
    
        // ✅ Position the Text inside the Box
        this.promptText.setY(this.promptBoxY + padding);
    
        // ✅ Ensure Prompt Box Appears Above Other UI Elements
        this.promptTextBox.setDepth(102);
        this.promptText.setDepth(103);
    }
    
    // Fixed clearInputTextBox method
    clearInputTextBox() {
        this.userInput = '';
        if (this.inputText) {
            this.inputText.setText('_');
        }
        if (this.autocompleteText) {
            this.autocompleteText.setText('');
        }
    }

    // Style methods - now using centralized textStyles.js module
    getPromptTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getTextStyle('prompt', deviceType, this.mode || 'basic', uiScale);
    }

    getPromptBoxStyle() {
        const uiScale = this.registry && this.registry.get && this.registry.get('uiScale') || 1;
        return getBoxStyle('prompt', this.mode || 'basic', uiScale);
    }
   
    // --- LAYOUT: compute two-column geometry (desktop only)
    layoutTwoColumns(topY) {
      const safe = this.safeAreaInsets ?? { left: 0, right: 0, bottom: 0 };
      const fullW = this.uiBoxWidth;
      const centerX = this.cameras.main.centerX;

      const gutter = this.scalingManager?.scaleValue(30) ?? 30;
      const colWidth = (fullW - gutter) / 2;

      // Fallback to stacked if too narrow
      if (colWidth < 400) return { mode: 'stacked' };

      const leftEdge = centerX - fullW / 2;
      const xLeft = leftEdge;
      const xRight = leftEdge + colWidth + gutter;

      // Equal heights that fit above the bottom buttons
      const bottomReserved = Math.max(120, this.scalingManager?.scaleValue(120) ?? 120) + (safe.bottom || 0);
      const colHeight = Math.floor(this.scale.height - bottomReserved - topY);

      return { mode: 'columns', xLeft, xRight, colWidth, topY, colHeight };
    }

    // --- BUTTONS: anchor to corners (safe-area aware) WITHOUT setOrigin ---
    placeBottomButtons() {
      const safe = this.safeAreaInsets ?? { left: 0, right: 0, bottom: 0 };
      
      // Use the same margin as the next button to ensure consistency
      const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || 
                       (typeof window !== 'undefined' && window.innerWidth <= 900);
      const buttonMargin = isMobile ? 
          this.scalingManager.scaleValue(20) : // Mobile: 20 scaled pixels
          this.scalingManager.scaleValue(30);  // Desktop: 30 scaled pixels

      // Get button dimensions using scalingManager for consistency
      const buttonWidth = this.scalingManager.buttonWidth();
      const buttonHeight = this.scalingManager.buttonHeight();

      // Buttons are likely anchored at their center (0.5, 0.5), so we need to account for half their dimensions
      // FEEDBACK: bottom-left with consistent margins (accounting for center anchor)
      if (this.feedbackButton) {
        const x = buttonMargin + (safe.left || 0) + buttonWidth / 2;
        const y = this.scale.height - buttonMargin - (safe.bottom || 0) - buttonHeight / 2;
        this.feedbackButton.setPosition(x, y);
      }

      // NEXT: bottom-right with consistent margins (accounting for center anchor)
      if (this.doneButton) {
        const x = this.scale.width - buttonMargin - (safe.right || 0) - buttonWidth / 2;
        const y = this.scale.height - buttonMargin - (safe.bottom || 0) - buttonHeight / 2;
        this.doneButton.setPosition(x, y);
      }
    }


    addScrollForBox(box) {
      const { container, width, height, padding, textObj } = box;

      // Transparent hit area inside the box container
      const hit = this.add.rectangle(0, 0, width, height, 0x000000, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: false });
      container.add(hit);

      // Track hover state explicitly (so we don't rely on pointerOver())
      hit._isOver = false;
      hit.on('pointerover', () => { hit._isOver = true; });
      hit.on('pointerout',  () => { hit._isOver = false; });

      // Measure content & scrolling
      // Increased from 22 to 35 to provide more bottom padding and prevent text from extending into rounded corners
      const scrollPad = 45;
      const contentH = textObj.getTextBounds?.().local?.height ?? textObj.height;
      const innerH   = height - (padding.top + padding.bottom) - scrollPad * 2;
      box.maxScroll  = Math.max(0, contentH - innerH);
      box.scrollY    = 0;
      box._baseTextY = padding.top + scrollPad;

      const setScroll = (y) => {
        box.scrollY = Phaser.Math.Clamp(y, 0, box.maxScroll);
        textObj.setY(box._baseTextY - box.scrollY);
        this.updateScrollIndicator(box);
      };

      // Wheel handler: (pointer, currentlyOver, dx, dy, dz, event)
      const onWheel = (_pointer, _over, dx, dy) => {
        if (!hit._isOver) return;          // only scroll when pointer is over this box
        if (box.maxScroll <= 0) return;    // no overflow, nothing to scroll
        setScroll(box.scrollY + dy * 0.6); // dampen wheel speed
      };
      this.input.on('wheel', onWheel);
      box._offWheel = () => this.input.off('wheel', onWheel);

      // Drag-to-scroll (works on desktop & touch)
      let dragStartY = null, startScroll = 0;
      hit.on('pointerdown', (p) => { dragStartY = p.worldY; startScroll = box.scrollY; });
      hit.on('pointermove', (p) => {
        if (!p.isDown || dragStartY == null) return;
        setScroll(startScroll + (p.worldY - dragStartY));
      });
      hit.on('pointerup',   () => { dragStartY = null; });
      hit.on('pointerupoutside', () => { dragStartY = null; });

      // Scroll indicator (only shows if overflow)
      box._indicator = this.makeScrollIndicator(container, width, height);
      this.updateScrollIndicator(box);

      // Clean up listener when scene shuts down (optional but good hygiene)
      this.events.once('shutdown', () => {
        box._offWheel && box._offWheel();
      });
    }


    makeScrollIndicator(parent, w, h) {
      const g = parent.scene.add.graphics();
      parent.add(g);
      g.setScrollFactor?.(0);
      return { g, w, h, visible: false };
    }

    updateScrollIndicator(box) {
      const ind = box._indicator;
      const needs = (box.maxScroll || 0) > 0;
      ind.visible = needs;
      ind.g.clear();
      if (!needs) return;

      const barW = 4;
      // Increased from 22 to 35 to match scrollPad and provide consistent spacing
      const pad = 45;
      const trackH = ind.h - pad * 2;
      const ratio = (box.scrollY / box.maxScroll) || 0;
      const barH = Math.max(24, trackH * 0.25);
      const barY = pad + (trackH - barH) * ratio;
      const x = ind.w - pad - barW;

      ind.g.fillStyle(0x000000, 0.18).fillRoundedRect(x, pad, barW, trackH, 4);
      ind.g.fillStyle(0xffffff, 0.9).fillRoundedRect(x, barY, barW, barH, 4);
    }


    init(data) {
        // Always reset transition flag on scene entry
        this.isTransitioning = false;

        if (!data.mode) {
            console.error("Error: No data received in DoneScene.");
        } else {
            console.log("Data successfully received in DoneScene.");
        }
        this.mode = data.mode || null;
        this.levelValue = data.levelValue || null;
        this.userInput = data.userInput || '';
        this.topKValue = data.topKValue || null;
        this.temperature = data.temperature || 0.2;
        this.evaluation = data.outputText || null;
        this.failCount = data.failCount || 0;
        this.totalWordCount = data.totalWordCount || 0;
        this.prompt = data.prompt;
        this.score = data.score || null;
        
        console.log("DoneScene initialized with mode:", this.mode, "levelValue:", this.levelValue, "topKValue:", this.topKValue, "temperature:", this.temperature, "score:", this.score);

        // Reset key scene elements to ensure proper initialization when returning from other scenes
        this.promptTextBox = null;
        this.promptText = null;
    }

    createBackgroundPattern() {
        const patternKey = 'patternCanvas';
        
        // ✅ Check if texture already exists and remove it before recreating
        if (this.textures.exists(patternKey)) {
            this.textures.remove(patternKey);
        }
        // Create pattern texture
        const pattern = this.textures.createCanvas(patternKey, 100, 100);
        const ctx = pattern.getContext();
        
        // Draw pattern (dots, stars, or any subtle pattern)
        ctx.fillStyle = '#' + this.COLORS_HEX.BACKGROUND.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 100, 100);
        
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = '#' + this.COLORS_HEX.BACKGROUND_MID.toString(16).padStart(6, '0');
          ctx.beginPath();
          ctx.arc(Math.random() * 100, Math.random() * 100, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        pattern.refresh();
        
        // Add pattern as background
        const bg = this.add.tileSprite(0, 0, this.sys.game.canvas.width, this.cameras.main.height, patternKey)
          .setOrigin(0)
          .setDepth(-2);
          
        // Add subtle movement
        this.tweens.add({
          targets: bg,
          tilePositionX: { from: 0, to: 100 },
          tilePositionY: { from: 0, to: 100 },
          duration: 20000,
          repeat: -1
        });
    }


    async create() {
      // IMPORTANT: Call parent create() first to get all BaseScene functionality
      super.create();
      
      this.cameras.main.scrollY = 0;

      createBackground(this, THEME.background, this.levelValue);

      // --- unchanged scoring logic ---
      let xOver5Digits = [];
      if (typeof this.evaluation === "string") {
        const regex = /\b(\d)\/5\b/g;
        let match;
        while ((match = regex.exec(this.evaluation)) !== null) xOver5Digits.push(match[1]);
      }
      const sumArray = (arr) => arr.reduce((acc, val) => acc + Number(val), 0);
      this.aiScore = sumArray(xOver5Digits);
      this.failCountScore = Math.min(this.failCount, 15);
      this.totalScore = this.aiScore - this.failCountScore;

      if (typeof this.userInput === "string" && this.userInput.trim() === "") {
        this.totalScore = 0;
      }

      // --- prompt first; we’ll lay out relative to it ---
      this.uiBoxWidth = this.sys.game.canvas.width * (5 / 6);
      this.createPromptTextBox();

      const promptPadding = this.scalingManager.scaleValue(30);
      const promptBottom  = this.promptBoxY + this.promptText.height + promptPadding * 2;
      const topY          = promptBottom + this.scalingManager.scaleValue(30);

      // --- responsive layout switch: columns on desktop, stacked on mobile ---
      const isMobileUA = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
      const isNarrow   = (typeof window !== 'undefined' && window.innerWidth <= 900);
      const isStacked  = isMobileUA || isNarrow;

      // We’ll keep references to whether we used columns or not
      let usedColumns = false;

      if (!isStacked) {
        // Try two-column layout; if too narrow, helper returns { mode: 'stacked' }
        const layout = this.layoutTwoColumns(topY);
        if (layout.mode === 'columns') {
          usedColumns = true;

          // Left: INPUT  |  Right: OUTPUT   (equal heights; never exceed canvas)
          this.createInputTextBoxAtRect({
            x: layout.xLeft,
            y: layout.topY,
            width:  layout.colWidth,
            height: layout.colHeight
          });
          this.createOutputTextBoxAtRect({
            x: layout.xRight,
            y: layout.topY,
            width:  layout.colWidth,
            height: layout.colHeight
          });

          // Independent scroll + indicator per column (only shows if overflow)
          if (this._inputBox)  this.addScrollForBox(this._inputBox);
          if (this._outputBox) this.addScrollForBox(this._outputBox);
        }
      }

      if (!usedColumns) {
        // --- original stacked behavior (mobile/small screens or fallback) ---
        const inputBoxY = topY;
        this.createInputTextBox(inputBoxY);

        // (optional) logs you had
        if (typeof this.inputBoxY !== "undefined" && typeof this.inputBoxHeight !== "undefined") {
          console.log("inputBoxY:", this.inputBoxY, "inputBoxHeight:", this.inputBoxHeight);
        } else {
          console.warn("inputBoxY or inputBoxHeight not defined before createOutputTextBox");
        }

        this.createOutputTextBox();

        // You can still enable per-box scroll/indicator in stacked mode if desired
        if (this._inputBox)  this.addScrollForBox(this._inputBox);
        if (this._outputBox) this.addScrollForBox(this._outputBox);
      }

      // --- Ensure visibility/layers (guard in case column creators use different refs) ---
      if (this.inputTextBorder) this.inputTextBorder.setDepth(100).setAlpha(1).setVisible(true);
      if (this.inputText)       this.inputText.setDepth(101).setAlpha(1).setVisible(true);

      // =======================
      // BUTTONS: corners anchor
      // =======================

      // Create NEXT / FEEDBACK at placeholder coords; we’ll re-anchor to corners.
      const buttonWidth = this.scalingManager.buttonWidth();
      const buttonHeight = this.scalingManager.buttonHeight();

      // Create NEXT (bottom-right)
      this.doneButton = this.createButton("NEXT", null, 0, 0, {
        depth: 102,
        name: 'doneButton'
      });
      this.doneButton.name = 'doneButton';
      this.doneButton.setInteractive()
        .on('pointerover', () => this.showTooltip("You thought you were finished?", this.doneButton.x, this.doneButton.y - buttonHeight))
        .on('pointerout',  () => this.hideTooltips());

      // Create FEEDBACK (bottom-left)
      this.feedbackButton = this.createButton(
        "FEEDBACK",
        () => this.onFeedbackClick(),
        0, 0 // placeholder; will be anchored below
      );
      this.feedbackButton.setInteractive()
        .on('pointerover', () => this.showTooltip('Share your feedback', this.feedbackButton.x, this.feedbackButton.y - buttonHeight))
        .on('pointerout',  () => this.hideTooltips());

      // === BUTTON PLACEMENT LOGIC ===
      // Place buttons relative to their boxes in both layouts
      // Asymmetrical placement: next button up, feedback button further left
      const nextButtonVerticalGap = this.scalingManager.scaleValue(30); // move up (was 50)
      const nextButtonHorizontalOffset = this.scalingManager.scaleValue(60);
      const feedbackButtonHorizontalOffset = this.scalingManager.scaleValue(90); // move further left
      const feedbackButtonVerticalGap = this.scalingManager.scaleValue(50);

      // Column layout: use _outputBox and _inputBox containers
      if (this._outputBox && this.doneButton) {
        // Place NEXT just below and near right edge of output box
        const out = this._outputBox;
        const buttonX = out.container.x + out.width - nextButtonHorizontalOffset - buttonWidth / 2;
        const buttonY = out.container.y + out.height + nextButtonVerticalGap + buttonHeight / 2;
        this.doneButton.setPosition(buttonX, buttonY);
      } else if (typeof this.outputBoxY === "number" && typeof this.outputBoxHeight === "number" && this.doneButton) {
        // Stacked layout fallback
        const buttonX = (this.cameras.main.centerX - this.uiBoxWidth / 2 + this.uiBoxWidth) - (buttonWidth / 2) - nextButtonHorizontalOffset;
        const buttonY = this.outputBoxY + this.outputBoxHeight + nextButtonVerticalGap + (buttonHeight / 2);
        this.doneButton.setPosition(buttonX, buttonY);
      }

      // Place FEEDBACK button at same left margin as in BaseGameScene.js, regardless of layout
      if (this.feedbackButton) {
        const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || 
                         (typeof window !== 'undefined' && window.innerWidth <= 900);
        const buttonMargin = this.scalingManager.scaleValue(isMobile ? 20 : 30);
        const safe = this.safeAreaInsets ?? { left: 0, right: 0, bottom: 0 };
        const feedbackX = buttonMargin + (safe.left || 0) + buttonWidth / 2;
        const feedbackY = this.scale.height - buttonMargin - (safe.bottom || 0) - buttonHeight / 2;
        this.feedbackButton.setPosition(feedbackX, feedbackY);
      }

      // On resize, re-anchor relative to boxes
      this.scale.on('resize', () => {
        if (this._outputBox && this.doneButton) {
          const out = this._outputBox;
          const buttonX = out.container.x + out.width - nextButtonHorizontalOffset - buttonWidth / 2;
          const buttonY = out.container.y + out.height + nextButtonVerticalGap + buttonHeight / 2;
          this.doneButton.setPosition(buttonX, buttonY);
        } else if (typeof this.outputBoxY === "number" && typeof this.outputBoxHeight === "number" && this.doneButton) {
          const buttonX = (this.cameras.main.centerX - this.uiBoxWidth / 2 + this.uiBoxWidth) - (buttonWidth / 2) - nextButtonHorizontalOffset;
          const buttonY = this.outputBoxY + this.outputBoxHeight + nextButtonVerticalGap + (buttonHeight / 2);
          this.doneButton.setPosition(buttonX, buttonY);
        }

        // Place FEEDBACK button at same left margin as in BaseGameScene.js, regardless of layout
        if (this.feedbackButton) {
          const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) || 
                           (typeof window !== 'undefined' && window.innerWidth <= 900);
          const buttonMargin = this.scalingManager.scaleValue(isMobile ? 20 : 30);
          const safe = this.safeAreaInsets ?? { left: 0, right: 0, bottom: 0 };
          const feedbackX = buttonMargin + (safe.left || 0) + buttonWidth / 2;
          const feedbackY = this.scale.height - buttonMargin - (safe.bottom || 0) - buttonHeight / 2;
          this.feedbackButton.setPosition(feedbackX, feedbackY);
        }
      });

      // --- keep your click FX and score effects as-is ---
      this.addButtonClickEffects();

      if (this.totalScore >= 10)      this.createScoreRewardEffect();
      else if (this.totalScore < 5)   this.createLowScoreWarning();
      else                            this.createMidScoreEffect();

      // Debug (optional)
      console.log("[DoneScene] Device type:", detectDeviceType?.());
      console.log("[DoneScene] Screen:", this.cameras.main.width, "x", this.cameras.main.height);
    }


    createLowScoreWarning() {
    if (this.totalScore < 5) {
      // Create red warning overlay
      const warningOverlay = this.add.rectangle(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        this.sys.game.canvas.width,
        this.cameras.main.height,
        0xFF0000, // Red
        0.2
      ).setDepth(200);
      
      // Flash warning
      this.tweens.add({
        targets: warningOverlay,
        alpha: { from: 0.2, to: 0 },
        duration: 200,
        repeat: 5,
        onComplete: () => warningOverlay.destroy()
      });
      
      // Create error messages that appear like terminal errors
      const errorMessages = [
        "ERROR: AI DETECTION TRIGGERED",
        "WARNING: HUMAN TEXT COEFFICIENT LOW",
        "SYSTEM FAILURE: CREATIVITY NOT FOUND",
        "CRITICAL: TOO PREDICTABLE"
      ];
      
      errorMessages.forEach((msg, index) => {
        const errorText = this.add.text(
          20,
          30 + (index * 40),
          "",
          {
            fontFamily: "Courier Prime",
            fontSize: "20px",
            color: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2,
            wordWrap: { width: this.sys.game.canvas.width - 40 }
          }
        ).setDepth(201);
        
        // Typewriter effect for error
        let currentChar = 0;
        
        this.time.addEvent({
          delay: 30,
          repeat: msg.length - 1,
          callback: () => {
            errorText.text += msg[currentChar];
            currentChar++;
            // Add glitch occasionally
            if (Phaser.Math.Between(0, 10) > 8) {
              const tempChar = msg[currentChar];
              errorText.text = errorText.text.slice(0, -1) + '@#%';
              this.time.delayedCall(50, () => {
                errorText.text = errorText.text.slice(0, -3) + (tempChar || '');
              });
            }
          },
          onComplete: () => {
            // Shake the text
            this.tweens.add({
              targets: errorText,
              x: "+=10",
              duration: 50,
              yoyo: true,
              repeat: 3
            });
          }
        });
        
        // Fade out after delay
        this.time.delayedCall(4000, () => {
          this.tweens.add({
            targets: errorText,
            alpha: 0,
            duration: 300,
            onComplete: () => errorText.destroy()
          });
        });
      });
      
      // Add screen corruption effect
      this.time.delayedCall(500, () => this.createScreenCorruptionEffect());
    }
  }
  
  createScreenCorruptionEffect() {
    const width = this.sys.game.canvas.width;
    const height = this.cameras.main.height;
    
    // Create screen distortion lines
    for (let i = 0; i < 10; i++) {
      const y = Phaser.Math.Between(0, height);
      const lineHeight = Phaser.Math.Between(2, 10);
      
      const line = this.add.rectangle(
        width / 2,
        y,
        width,
        lineHeight,
        0xFFFFFF,
        0.7
      ).setDepth(198);
      
      // Animate the glitch line
      this.tweens.add({
        targets: line,
        x: { from: -width/2, to: width*1.5 },
        duration: Phaser.Math.Between(200, 800),
        onComplete: () => line.destroy()
      });
    }
    
    // Create a few larger block corruptions
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const blockWidth = Phaser.Math.Between(20, 100);
      const blockHeight = Phaser.Math.Between(10, 30);
      
      const block = this.add.rectangle(
        x,
        y,
        blockWidth,
        blockHeight,
        0xFF0000,
        0.5
      ).setDepth(197);
      
      this.tweens.add({
        targets: block,
        alpha: 0,
        duration: Phaser.Math.Between(300, 1000),
        onComplete: () => block.destroy()
      });
    }
    
    // Schedule another round of corruption
    this.time.delayedCall(Phaser.Math.Between(300, 700), () => {
      if (Phaser.Math.Between(0, 10) > 5) {
        this.createScreenCorruptionEffect();
      }
    });
  }

  createScoreRewardEffect() {
    if (this.totalScore >= 10) {
      // Create the level up text with full content immediately
      const levelUpText = this.add.text(
        this.cameras.main.centerX,
        this.scalingManager.scaleValue(60),
        "NOT BAD, HUMAN",
        {
          fontFamily: "Courier Prime",
          fontSize: this.scalingManager.scaleValue(60) + "px",
          color: "#33FF33", // Terminal green
          stroke: "#000000",
          strokeThickness: 4,
          shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 5, fill: true }
        }
      ).setOrigin(0.5).setDepth(1001);
      
      // Add pulsing glow effect to the text
      const glowFX = levelUpText.postFX.addGlow(0xffffff, 0, 0, false, 0.1, 24);
      
      // Create a pulsing effect for the glow
      this.tweens.add({
        targets: glowFX,
        outerStrength: 4,
        yoyo: true,
        loop: -1,
        ease: 'sine.inout',
        duration: 1000
      });
      
      // Add a subtle scaling animation for the text
      this.tweens.add({
        targets: levelUpText,
        scale: { from: 1, to: 1.1 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout'
      });
      
      // Create a subtle background effect
      const glowBackground = this.add.rectangle(
        this.cameras.main.centerX,
        60,
        levelUpText.width + 100,
        levelUpText.height + 30,
        0x33FF33, // Terminal green
        0.1
      ).setDepth(200);
      
      // Add pulsing effect to the background
      this.tweens.add({
        targets: glowBackground,
        alpha: { from: 0.1, to: 0.2 },
        width: { from: levelUpText.width + 100, to: levelUpText.width + 120 },
        height: { from: levelUpText.height + 30, to: levelUpText.height + 40 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout'
      });
      
      // Remove only background effect after 5 seconds, keep text visible
      this.time.delayedCall(5000, () => {
        // Fade out only the background effect
        this.tweens.add({
          targets: glowBackground,
          alpha: 0,
          duration: 800,
          onComplete: () => {
            glowBackground.destroy();
          }
        });
        
        // Keep the text but stop its animations
        this.tweens.killTweensOf(levelUpText);
        // Reset scale to normal
        levelUpText.setScale(1);
      });
    }
  }
  
  createMidScoreEffect() {
    if (this.totalScore >= 5 && this.totalScore < 10) {
      // Create a mild amber overlay
      const warningOverlay = this.add.rectangle(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        this.sys.game.canvas.width,
        this.cameras.main.height,
        this.COLORS_HEX.WARNING, // Amber
        0.1
      ).setDepth(200);
      
      // Gentle flash warning
      this.tweens.add({
        targets: warningOverlay,
        alpha: { from: 0.1, to: 0 },
        duration: 300,
        repeat: 1,
        onComplete: () => warningOverlay.destroy()
      });
      
      // Create the text immediately with complete content
      const notQuiteText = this.add.text(
        this.cameras.main.centerX,
        this.scalingManager.scaleValue(60),
        "NOT QUITE",
        {
          fontFamily: "Courier Prime",
          fontSize: this.scalingManager.scaleValue(60) + "px",
          color: this.COLORS_HEX.WARNING,
          stroke: "#000000",
          strokeThickness: 3,
          shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 3, fill: true }
        }
      ).setOrigin(0.5).setDepth(1001);
      
      // Remember original position and text
      const originalX = notQuiteText.x;
      const originalY = notQuiteText.y;
      const fullText = "NOT QUITE";
      
      // Hide text initially - we'll show it with the typewriter effect
      notQuiteText.setText("");
      
      // Typewriter animation
      let currentChar = 0;
      
      const typewriterTimer = this.time.addEvent({
        delay: 80,
        repeat: fullText.length - 1,
        callback: () => {
          notQuiteText.text += fullText[currentChar];
          currentChar++;
        },
        callbackScope: this
      });
      
      // Calculate when typewriter will be complete
      const typewriterDuration = 80 * fullText.length;
      
      // Start flickering after typewriter completes
      this.time.delayedCall(typewriterDuration + 100, () => {
        let flickerCount = 0;
        const maxFlickers = 16; // More flickers for a longer effect
        
        // Create a realistic flicker sequence with randomness
        const createFlickerEffect = () => {
          if (flickerCount >= maxFlickers) {
            // End of flicker effect - ensure text is visible and in original position
            notQuiteText.setText(fullText);
            notQuiteText.setPosition(originalX, originalY);
            notQuiteText.setColor("#FFAA00"); // Reset to original color
            return;
          }
          
          flickerCount++;
          
          // Choose a random flicker effect for this cycle
          const effectType = Phaser.Math.Between(0, 7);
          
          switch (effectType) {
            case 0: // Completely off
              notQuiteText.setText("");
              break;
              
            case 1: // Partially garbled text
              let garbled = "";
              for (let i = 0; i < fullText.length; i++) {
                if (Math.random() > 0.3) {
                  garbled += fullText[i];
                } else {
                  garbled += " ";
                }
              }
              notQuiteText.setText(garbled);
              break;
              
            case 2: // Text with random position shift
              notQuiteText.setText(fullText);
              notQuiteText.setPosition(
                originalX + Phaser.Math.Between(-4, 4),
                originalY + Phaser.Math.Between(-2, 2)
              );
              break;
              
            case 3: // Text with color change
              notQuiteText.setText(fullText);
              notQuiteText.setColor("#FFFFFF"); // Flash to white
              break;
              
            case 4: // Normal text (brief stability in the flicker)
              notQuiteText.setText(fullText);
              notQuiteText.setPosition(originalX, originalY);
              notQuiteText.setColor("#FFAA00");
              break;
              
            case 5: // Corrupted text (with symbols)
              let corrupted = "";
              for (let i = 0; i < fullText.length; i++) {
                if (Math.random() > 0.2) {
                  corrupted += fullText[i];
                } else {
                  corrupted += ".#@*"[Math.floor(Math.random() * 4)];
                }
              }
              notQuiteText.setText(corrupted);
              break;
              
            case 6: // Doubled text (brief artifact)
              notQuiteText.setText(fullText);
              const ghostText = this.add.text(
                originalX + 2,
                originalY + 2,
                fullText,
                {
                  fontFamily: "IBM Plex Mono",
                  fontSize: "40px",
                  color: "#FFFFFF",
                  alpha: 0.4
                }
              ).setOrigin(0.5).setDepth(200);
              
              this.time.delayedCall(60, () => {
                ghostText.destroy();
              });
              break;
              
            case 7: // Dimmer text
              notQuiteText.setText(fullText);
              notQuiteText.setAlpha(0.5);
              break;
          }
          
          // Schedule next flicker with irregular timing
          const nextDelay = Phaser.Math.Between(30, 150);
          this.time.delayedCall(nextDelay, createFlickerEffect, [], this);
          
          // Occasionally reset back to normal between effects
          if (Math.random() > 0.7) {
            this.time.delayedCall(Phaser.Math.Between(10, 30), () => {
              notQuiteText.setText(fullText);
              notQuiteText.setPosition(originalX, originalY);
              notQuiteText.setColor("#FFAA00");
              notQuiteText.setAlpha(1);
            });
          }
        };
        
        // Start the flickering effect
        createFlickerEffect();
      });
    }
  }

  
  createMatrixRainEffect() {
    const drops = [];
    const fontSize = 14;
    const columns = Math.floor(this.sys.game.canvas.width / fontSize);
    
    // Create text objects for each column
    for (let i = 0; i < columns; i++) {
      // Random starting position
      const y = Phaser.Math.Between(-500, -50);
      const char = String.fromCharCode(Phaser.Math.Between(33, 126));
      
      const drop = this.add.text(
        i * fontSize, 
        y,
        char,
        {
          fontFamily: 'Courier Prime',
          fontSize: `${fontSize}px`,
          color: '#33FF33'
        }
      ).setDepth(198).setAlpha(0.8);
      
      drops.push({
        text: drop,
        speed: Phaser.Math.FloatBetween(3, 15),
        length: Phaser.Math.Between(5, 30)
      });
    }
    
    // Update function to animate drops
    this.matrixTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        drops.forEach(drop => {
          // Move drop down
          drop.text.y += drop.speed;
          
          // Change character randomly sometimes
          if (Phaser.Math.Between(0, 10) > 8) {
            drop.text.setText(String.fromCharCode(Phaser.Math.Between(33, 126)));
          }
          
          // Reset if off screen
          if (drop.text.y > this.cameras.main.height + 50) {
            drop.text.y = Phaser.Math.Between(-200, -50);
            drop.speed = Phaser.Math.FloatBetween(3, 15);
          }
        });
      },
      callbackScope: this
    });
    
    // Stop the effect after 3 seconds
    this.time.delayedCall(3000, () => {
      this.matrixTimer.remove();
      drops.forEach(drop => {
        this.tweens.add({
          targets: drop.text,
          alpha: 0,
          duration: 500,
          onComplete: () => drop.text.destroy()
        });
      });
    });
  }

}
