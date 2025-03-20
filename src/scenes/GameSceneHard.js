import { COLORS_HEX, COLORS_TEXT, OUTLINE_WIDTH, BUTTON_OUTLINE_WIDTH, CORNER_RADIUS, BUTTON_CORNER_RADIUS, buttonHeight, buttonSpacing, buttonWidth} from "../config/design_hard.js";


export default class GameSceneHard extends Phaser.Scene {
    constructor() {
        super({ key: 'GameSceneHard' });
        this.llmEngine = null;
        this.userInput = '';
        this.inputText = null; 
        this.levelValue = 1;
        this.baseFontSize = 22;
        this.failCounter = 0;
        this.autocompleteText = null; 
        
    }

    // Method to create the fails counter
    createFailsCounter() {
        // Use the imported constants instead of local variables
        const failBoxWidth = 120; // Match button width
        
        // Get input box dimensions and position
        const inputBoxWidth = this.uiBoxWidth;
        const inputBoxX = this.cameras.main.centerX - inputBoxWidth / 2; // Left edge of input box
        
        // Position: below input box, same distance from left as DONE button is from right
        const boxX = inputBoxX + failBoxWidth/2 + buttonSpacing;
        const boxY = this.doneButton.y; // Same Y position as buttons
        
        // Create container
        const counterContainer = this.add.container(boxX, boxY);
        
        // Background with red fill
        const counterBackground = this.add.graphics();
        counterBackground.fillStyle(0xff0000, 1); // Red background
        counterBackground.fillRoundedRect(
            -failBoxWidth / 2, -buttonHeight / 2, 
            failBoxWidth, buttonHeight, 
            BUTTON_CORNER_RADIUS
        );
        
        // Border
        const counterOutline = this.add.graphics();
        counterOutline.lineStyle(BUTTON_OUTLINE_WIDTH, 0xffffff, 1);
        counterOutline.strokeRoundedRect(
            -failBoxWidth / 2, -buttonHeight / 2, 
            failBoxWidth, buttonHeight, 
            BUTTON_CORNER_RADIUS
        );
        
        // // Gradient Overlay (Lighter Top) like the buttons
        // const gradientOverlay = this.add.graphics();
        // gradientOverlay.fillStyle(0xff3333, 0.7); // Lighter red
        // gradientOverlay.fillRoundedRect(
        //     -failBoxWidth / 2, -buttonHeight / 2, 
        //     failBoxWidth, buttonHeight / 2, 
        //     BUTTON_CORNER_RADIUS
        // );
        
        // // Highlight Effect (Shiny Reflection) like the buttons
        // const buttonHighlight = this.add.graphics();
        // buttonHighlight.fillStyle(0xffffff, 0.4);
        // buttonHighlight.fillRoundedRect(
        //     -failBoxWidth / 2 + 5, -buttonHeight / 2 + 2, 
        //     failBoxWidth - 10, buttonHeight / 3, 
        //     BUTTON_CORNER_RADIUS
        // );
        
        // Text display
        this.failsText = this.add.text(0, 0, `FAILS: ${this.failCounter}`, {
            foFamily: 'Fredoka',
            fontSize: '22px',
            fontWeight: "700",
            color: COLORS_TEXT.WHITE,
            align: 'center'
        }).setOrigin(0.5, 0.5);
        
        // Add all elements to container in proper order
        //counterContainer.add([counterBackground, gradientOverlay, buttonHighlight, counterOutline, this.failsText]);
        counterContainer.add([counterBackground, counterOutline, this.failsText]);
        
        // Add to scene
        this.add.existing(counterContainer);
        this.failsCounter = counterContainer;
    }

    // Add this method to update the counter
    updateFailsCounter() {
        if (this.failsText) {
            this.failsText.setText(`FAILS: ${this.failCounter}`);this.tweens.add({
                targets: this.failsCounter,
                scaleX: { from: 1, to: 1.2 },
                scaleY: { from: 1, to: 1.2 },
                duration: 150,
                yoyo: true,
                ease: 'Cubic.Out',
                onComplete: () => {
                    // Shake effect after the flash
                    this.tweens.add({
                        targets: this.failsCounter,
                        x: { from: this.failsCounter.x - 5, to: this.failsCounter.x + 5 },
                        duration: 50,
                        yoyo: true,
                        repeat: 3,
                        ease: 'Sine.InOut'
                    });
                }
            });
            
            // Also flash the text to a brighter color
            if (this.failsText) {
                const originalColor = this.failsText.style.color;
                this.failsText.setColor('#FFFFFF');
                
                this.time.delayedCall(300, () => {
                    this.failsText.setColor(originalColor);
                });
            }
        }
    }

    createBackgroundEffect() {
        let width = this.cameras.main.width;
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
            grd.addColorStop(0, "#13091e");
            grd.addColorStop(1, "#3a1f5d");
    
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
    
    

    createButton(label, callback, centerX, centerY) {

    
        // ✅ Ensure input box exists before positioning the button
        if (!this.inputTextBorder) {
            console.warn("Input text border not found! Skipping button creation.");
            return;
        }
    

    
        // ✅ Create button container
        const buttonContainer = this.add.container(centerX, centerY);
    
        // === Button Background ===
        const buttonBackground = this.add.graphics();
        buttonBackground.fillStyle(COLORS_HEX.BUTTONFILL, 1);
        buttonBackground.fillRoundedRect(
            -buttonWidth / 2, -buttonHeight / 2, 
            buttonWidth, buttonHeight, BUTTON_CORNER_RADIUS
        );
    
        // === Button Outline ===
        const buttonOutline = this.add.graphics();
        buttonOutline.lineStyle(BUTTON_OUTLINE_WIDTH, 0xffffff, 1);
        buttonOutline.strokeRoundedRect(
            -buttonWidth / 2, -buttonHeight / 2, 
            buttonWidth, buttonHeight, BUTTON_CORNER_RADIUS
        );
    
        // === Gradient Overlay (Lighter Top) ===
        const gradientOverlay = this.add.graphics();
        gradientOverlay.fillStyle(COLORS_HEX.BUTTONOVERLAY, 0.7);
        gradientOverlay.fillRoundedRect(
            -buttonWidth / 2, -buttonHeight / 2, 
            buttonWidth, buttonHeight / 2, BUTTON_CORNER_RADIUS
        );
    
        // === Highlight Effect (Shiny Reflection) ===
        const buttonHighlight = this.add.graphics();
        buttonHighlight.fillStyle(0xffffff, 0.4);
        buttonHighlight.fillRoundedRect(
            -buttonWidth / 2 + 5, -buttonHeight / 2 + 2, 
            buttonWidth - 10, buttonHeight / 3, BUTTON_CORNER_RADIUS
        );

        // === Button Text ===
        const buttonText = this.add.text(0, 0, label, {
            fontFamily: 'Fredoka',
            fontSize: '22px',
            fontWeight: "700",
            color: COLORS_TEXT.WHITE,
            align: 'center'
        }).setOrigin(0.5, 0.5);
    
        // ✅ Ensure button is interactive
        buttonContainer.setSize(buttonWidth, buttonHeight);
        buttonContainer.setInteractive();
        buttonContainer.on("pointerdown", () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: "Quad.Out"
            });
    
            this.time.delayedCall(100, callback);
        });

        
    
        // ✅ Add to scene
        buttonContainer.add([buttonOutline, buttonBackground, gradientOverlay, buttonHighlight, buttonText]);
        this.add.existing(buttonContainer);
    
        return buttonContainer;
    }
    
    
  
    onDoneButtonClick() {
        console.log("Done button clicked! Evaluating text...");
        
        if (typeof this.createOutputTextBox !== "function") {
            console.error("Error: createOutputTextBox() is not defined.");
            return;
        }

    
        // ✅ Ensure Output Box Exists BEFORE Calling LLM
        if (!this.outputTextBox) {
            this.createOutputTextBox();
        }
    
        // ✅ Update the text to "Evaluating..." before making the request
        this.outputText.setText("Evaluating...");
    
        // ✅ Call LLM Function (evaluateText)
        this.evaluateText(this.userInput);

        // ✅ Select a new prompt before evaluation
        //this.updatePromptBasedOnLevel();
    }


    onResetRuttonClick() {
        console.log("Reset button clicked! Clearing text...");
        
        if (typeof this.clearInputTextBox !== "function") {
            console.error("Error: clearInputTextBox() is not defined."); 
            return;
        }   

        this.clearInputTextBox();
        this.updateOutputText("Press 'DONE' to see how you did.");

        // ✅ Select a new prompt before evaluation
        this.updatePromptBasedOnLevel();
    }
    
    onDoneButtonClick() {
        console.log("Done button clicked! Evaluating text...");
        
        if (typeof this.createOutputTextBox !== "function") {
            console.error("Error: createOutputTextBox() is not defined.");
            return;
        }

    
        // ✅ Ensure Output Box Exists BEFORE Calling LLM
        if (!this.outputTextBox) {
            this.createOutputTextBox();
        }
    
        // ✅ Update the text to "Evaluating..." before making the request
        this.outputText.setText("Evaluating...");
    
        // ✅ Call LLM Function (evaluateText)
        this.evaluateText(this.userInput);

    }
    
    
    async evaluateText(userInput) {


        console.log("Evaluating user input:", userInput);
    
        if (!this.llmEngine) {
            console.error("LLM engine is not initialized.");
            this.updateOutputText("Error: LLM not available.");
            return;
        }

        // ✅ Show "Evaluating..." While Waiting for Response
        this.updateOutputText("Evaluating...");
    
        // ✅ Ensure currentPrompt is set (fallback to generic)
        const promptForEvaluation = this.currentPrompt || "No specific prompt was provided.";
    
        // **Updated Chat Prompt Format**
        // **Updated Chat Prompt Format**
    const messages = [
        {
            "role": "system",
            "content": "You are an expert writing evaluator. Your job is to assess user-generated text based on three key criteria:\n" +
                       "1. Relevance: How well the text stays on topic for the given prompt.\n" +
                       "2. Grammar: How grammatically correct the text is, with specific examples if errors exist.\n" +
                       "3. Coherence: How logically structured and understandable the text is.\n\n" +
                       "First, provide a **one-word summary** of the overall quality of the response (e.g., Excellent, Good, Needs Improvement, Poor).\n" +
                       "Then, provide numeric scores (1-5) for each category. Each score must be **clearly labeled**, followed by a **very short** (5-7 words max) explanation on the same line.\n" +
                       "If the grammar score is below 5, include **examples of specific grammar mistakes** from the text. Show the incorrect phrase, followed by the correct version."
        },
        {
            "role": "user",
            "content": `User was given the prompt: "${promptForEvaluation}"  
                        Here is their response: "${userInput}"  
                        
                        Evaluate the response based on:  
                        - Relevance to the given prompt.  
                        - Grammar correctness.  
                        - Coherence and logical flow.  
                        
                        Provide output in this strict format:  
                        
                        Overall Rating: [One-word summary]  
                        Relevance Score: X/5 - [Short reason]  
                        Grammar Score: X/5 - [Short reason]  
                        Coherence Score: X/5 - [Short reason]  
                        
                        If Grammar Score < 5, list grammar mistakes in this format:  
                        - Incorrect: "[Exact incorrect phrase]" → Correct: "[Corrected version]"  
                        
                        Only return the labeled scores and grammar corrections if applicable. Do not include explanations beyond the given format. Be sure to give at least one specific example if there are grammar errors. You can even just quote it.`
        }
    ];


        //try {
            // Make the API call to OpenAI
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
            console.log(responseData)
        
            let aiResponse = responseData.content.trim();
            console.log("AI Evaluation:", aiResponse);
    
            // ✅ Ensure text is visible
            this.updateOutputText(aiResponse);
            this.outputTextBox.setAlpha(1);
            this.outputText.setAlpha(1);
    
        // } catch (error) {
        //     console.error("Error in LLM evaluation:", error);
        //     this.updateOutputText("Failed to generate evaluation.");
        // }
    }

    


    updateOutputText(responseText) {
        if (!this.outputTextBox) {
            this.createOutputTextBox();
        }
    
        // ✅ Update the text content
        this.outputText.setText(responseText);
    
        const textHeight = this.outputText.height + 40;
        const minHeight = 100;
        const maxHeight = this.cameras.main.height * 0.4;
        const newHeight = Phaser.Math.Clamp(textHeight, minHeight, maxHeight);
    
        // ✅ Ensure the box is positioned correctly
        const outputBoxY = Math.min(
            this.doneButton.y + this.doneButton.displayHeight / 2 + 40 + newHeight / 2,
            this.cameras.main.height - 40
        );
    
        // ✅ Make sure output box is visible
        this.outputTextBox.setAlpha(1);
        this.outputText.setAlpha(1);
    
        // ✅ Clear and redraw the output text box with the new size
        this.outputTextBox.clear();
        this.outputTextBox.fillStyle(COLORS_HEX.BLUE_BACKGROUND, 1);
        this.outputTextBox.fillRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2,
            outputBoxY - newHeight / 2,
            this.uiBoxWidth,
            newHeight,
            CORNER_RADIUS
        );
        this.outputTextBox.lineStyle(OUTLINE_WIDTH, COLORS_HEX.BLUE, 1);
        this.outputTextBox.strokeRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2,
            outputBoxY - newHeight / 2,
            this.cameras.main.width * 5 / 6,
            newHeight,
            CORNER_RADIUS
        );
    
        // ✅ Adjust the text position
        this.outputText.y = outputBoxY - newHeight / 2 + 20;
    
        // ✅ Ensure text is drawn above other UI elements
        this.outputText.setDepth(10);
        this.outputTextBox.setDepth(9);

        //this.ensureEverythingFits(outputBoxY + newHeight / 2);
    }
    
    
    
    
    createOutputTextBox() {
        if (this.outputTextBox) return;
    
        const outputBoxWidth = this.uiBoxWidth;
        const lineHeight = 24;
        const numLines = 4;
        const padding = 30;
        const outputBoxHeight = numLines * lineHeight + padding * 2;
        
    
        let outputBoxY = this.doneButton 
            ? this.doneButton.y + this.doneButton.displayHeight / 2 + 40 + outputBoxHeight / 2
            : this.cameras.main.height - outputBoxHeight - 40;
    
        // ✅ Remove existing box if it exists (prevents duplicate rendering)
        if (this.outputTextBox) {
            this.outputTextBox.destroy();
        }
    
        // ✅ Create new output box with rounded corners
        this.outputTextBox = this.add.graphics();
        this.outputTextBox.fillStyle(COLORS_HEX.BLUE_BACKGROUND, 1);
        this.outputTextBox.fillRoundedRect(
            this.cameras.main.centerX - outputBoxWidth / 2,
            outputBoxY - outputBoxHeight / 2,
            outputBoxWidth,
            outputBoxHeight,
            CORNER_RADIUS
        );
        this.outputTextBox.lineStyle(OUTLINE_WIDTH, COLORS_HEX.BLUE, 1);
        this.outputTextBox.strokeRoundedRect(
            this.cameras.main.centerX - outputBoxWidth / 2,
            outputBoxY - outputBoxHeight / 2,
            outputBoxWidth,
            outputBoxHeight,
            CORNER_RADIUS
        );
        this.add.existing(this.outputTextBox); // Ensure it is added to the scene
    
        // ✅ Remove existing text if it exists (prevents duplicates)
        if (this.outputText) {
            this.outputText.destroy();
        }
    
        // ✅ Create output text inside the box
        this.outputText = this.add.text(
            this.cameras.main.centerX - outputBoxWidth / 2 + padding,
            outputBoxY - outputBoxHeight / 2 + padding,
            "Press 'DONE' to see how you did.",
            {
                fontFamily: 'Nunito',
                fontSize: `${lineHeight}px`,
                fill: '#ffffff',
                wordWrap: { width: outputBoxWidth - padding * 2 },
                align: 'left',
                lineSpacing: 5
            }
        ).setOrigin(0, 0);
    
        // ✅ Slide-in Animation
        this.tweens.add({
            targets: [this.outputTextBox, this.outputText],
            alpha: 1,
            duration: 500,
            ease: 'Sine.InOut'
        });
        // ✅ Force Phaser to recognize this object
        this.add.existing(this.outputTextBox);
    }
    
    
    addButtonParticles(button) {
        const particles = this.add.particles(button.x, button.y, 'particle', {
          speed: 50,
          scale: { start: 0.2, end: 0 },
          blendMode: 'ADD',
          lifespan: 1000,
          frequency: 200,
          tint: 0xff9955
        });
        particles.setDepth(button.depth - 1);
        return particles;
      }
    
    

    createMenuBar() {
        const menuBarHeight = 100;
        const padding = 50;
        const rightMargin = 40;
        const gap = 20;
        const shiftLeft = 30; // Shift elements left for better fit
    
        // === Create Menu Bar Background ===
        this.menuBar = this.add.graphics();
        this.menuBar.fillStyle(COLORS_HEX.BACKGROUND, 1);
        this.menuBar.fillRect(0, 0, this.cameras.main.width, menuBarHeight);
    
        // === Add Bottom Border ===
        const menuBarBorder = this.add.graphics();
        menuBarBorder.fillStyle(COLORS_HEX.MIDPURPLE, 1);
        menuBarBorder.fillRect(0, menuBarHeight - OUTLINE_WIDTH, this.cameras.main.width, OUTLINE_WIDTH);
    
        // === Add Title ("(UNSLOP)") to the Left ===
        const titleText = this.add.text(
            padding, menuBarHeight / 2, 
            "(UNSLOP)", 
            { fontFamily: 'barcade3d', fontSize: '50px', color: COLORS_TEXT.YELLOW }
        ).setOrigin(0, 0.5);
    
        // === Level Slider (Centered) ===
        this.levelValue = 1;
        const levelLabelX = this.cameras.main.centerX - 120; // Shift left slightly for spacing
        const levelLabel = this.add.text(
            levelLabelX, menuBarHeight / 2, 
            `Prompt Level: ${this.levelValue}`, 
            { fontFamily: 'Nunito', fontSize: '20px', fill: '#ffffff' }
        ).setOrigin(0, 0.5);
    
        const levelSliderWidth = 120;
        const levelSliderX = levelLabelX + levelLabel.displayWidth + gap;
        const levelSliderY = menuBarHeight / 2;
    
        // Slider Bar
        const levelSlider = this.add.graphics();
        levelSlider.fillStyle(0xffffff, 1);
        levelSlider.fillRect(levelSliderX, levelSliderY - 5, levelSliderWidth, 10);
    
        // Slider Handle
        this.levelSliderHandle = this.add.rectangle(levelSliderX, levelSliderY, 10, 20, 0xffaa00).setInteractive();
        this.input.setDraggable(this.levelSliderHandle);
    
        // Prevent Slider from Hitting Right Edge
        const levelSliderMinX = levelSliderX;
        const levelSliderMaxX = levelSliderMinX + levelSliderWidth - 5;
    
        this.input.on('drag', (pointer, gameObject, dragX) => {
            if (gameObject === this.levelSliderHandle) {
                gameObject.x = Phaser.Math.Clamp(dragX, levelSliderMinX, levelSliderMaxX);
                const newLevel = Math.round(Phaser.Math.Linear(1, 3, (gameObject.x - levelSliderMinX) / (levelSliderMaxX - levelSliderMinX)));
    
                if (newLevel !== this.levelValue) {
                    this.levelValue = newLevel;
                    levelLabel.setText(`Prompt Level: ${this.levelValue}`);
                    this.updatePromptBasedOnLevel();
                }
            }
        });
    
        // === Top K Slider (Repositioned to the Right) ===
        const topKLabelX = this.cameras.main.width - padding - rightMargin - 180 - shiftLeft; // Shifted slightly left
        const topKLabelY = menuBarHeight / 2;
        this.topKValue = 1; // Default value
    
        const topKLabel = this.add.text(
            topKLabelX, topKLabelY, 
            `Top K: ${this.topKValue}`,
            { fontFamily: 'Nunito', fontSize: '20px', fill: '#ffffff' }
        ).setOrigin(0, 0.5);
    
        const sliderWidth = 120;
        const sliderX = topKLabelX + topKLabel.displayWidth + gap;
        const sliderY = menuBarHeight / 2;
        const slider = this.add.graphics();
        slider.fillStyle(0xffffff, 1);
        slider.fillRect(sliderX, sliderY - 5, sliderWidth, 10);
    
        this.sliderHandle = this.add.rectangle(sliderX, sliderY, 10, 20, 0xffaa00).setInteractive();
        this.input.setDraggable(this.sliderHandle);
    
        // Prevent Top K Slider from Hitting Right Edge
        const sliderMinX = sliderX;
        const sliderMaxX = sliderMinX + sliderWidth - 5;
    
        this.input.on('drag', (pointer, gameObject, dragX) => {
            if (gameObject === this.sliderHandle) {
                gameObject.x = Phaser.Math.Clamp(dragX, sliderMinX, sliderMaxX);
                const newTopK = Math.round(Phaser.Math.Linear(1, 5, (gameObject.x - sliderMinX) / (sliderMaxX - sliderMinX)));
    
                if (newTopK !== this.topKValue) {
                    this.topKValue = newTopK;
                    topKLabel.setText(`Top K: ${this.topKValue}`,);
                }
            }
        });
    
        // === Slide-in Animation for Menu Bar ===
        this.tweens.add({
            targets: [this.menuBar, menuBarBorder, titleText, levelLabel, levelSlider, this.levelSliderHandle, topKLabel, slider, this.sliderHandle],
            alpha: 1,
            duration: 800,
            ease: 'Quad.Out'
        });

        this.menuBarHeight = menuBarHeight;
        this.add.existing(this.menuBar);

        this.menuBar.setPosition(0, 0);
  
        // Add a slight shadow to the menu bar for depth
        const menuBarShadow = this.add.graphics();
        menuBarShadow.fillStyle(0x000000, 0.3);
        menuBarShadow.fillRect(0, menuBarHeight, this.cameras.main.width, 10);
        menuBarShadow.setDepth(this.menuBar.depth - 1);
    }
    


    createPromptTextBox() {
        this.promptBoxY = 240;
    
        this.uiBoxWidth = this.cameras.main.width * (5 / 6);
        const padding = 20;
    
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
    
        // ✅ Default text to calculate initial size
        const defaultText = "Your prompt will appear here...";
        this.promptText = this.add.text(
            this.cameras.main.centerX, 
            0, // Y will be adjusted later
            defaultText,
            {
                fontFamily: "Nunito",
                fontSize: "22px",
                color: COLORS_TEXT.WHITE,
                wordWrap: { width: this.uiBoxWidth - padding * 2 },
                align: "center"
            }
        ).setOrigin(0.5, 0);
    
        // ✅ Ensure text box height dynamically adjusts
        const textHeight = this.promptText.height + padding * 2;
    
        // ✅ Create the Prompt Background Box
        this.promptTextBox.fillStyle(COLORS_HEX.BLUE_BACKGROUND, 1);
        this.promptTextBox.fillRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2, 
            this.promptBoxY,
            this.uiBoxWidth,
            textHeight,
            CORNER_RADIUS
        );
    
        // ✅ Add Outline to Match Output Box
        this.promptTextBox.lineStyle(OUTLINE_WIDTH, COLORS_HEX.MIDPURPLE, 1);
        this.promptTextBox.strokeRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2, 
            this.promptBoxY,
            this.uiBoxWidth,
            textHeight,
            CORNER_RADIUS
        );
    
        // ✅ Position the Text inside the Box
        this.promptText.setY(this.promptBoxY + padding);





    
        // ✅ Ensure Prompt Box Appears Above Other UI Elements
        this.promptTextBox.setDepth(12);
        this.promptText.setDepth(13);
    
    
        this.updatePromptBasedOnLevel();
    }
    
    
    adjustPromptBoxSize() {
        if (!this.promptTextBox || !this.promptText) {
            console.warn("Prompt box or text not initialized.");
            return;
        }
    
        const padding = 20;
        const promptBoxWidth = this.uiBoxWidth
        const promptBoxHeight = this.promptText.height + padding * 2; // ✅ Adjust height dynamically
    

    
        // ✅ Redraw the Box with the Updated Height
        this.promptTextBox.clear();
        this.promptTextBox.fillStyle(COLORS_HEX.BACKGROUND, 1);
        this.promptTextBox.fillRoundedRect(
            this.cameras.main.centerX - promptBoxWidth / 2, 
            this.promptBoxY,
            promptBoxWidth,
            promptBoxHeight,
            BUTTON_CORNER_RADIUS
        );
    
        this.promptTextBox.lineStyle(BUTTON_OUTLINE_WIDTH, COLORS_HEX.WHITE, 1);
        this.promptTextBox.strokeRoundedRect(
            this.cameras.main.centerX - promptBoxWidth / 2, 
            this.promptBoxY,
            promptBoxWidth,
            promptBoxHeight,
            BUTTON_CORNER_RADIUS
        );
    
        // ✅ Reposition Text
        this.promptText.setY(this.promptBoxY + padding);
    }
    

    updatePromptBasedOnLevel() {
        const promptLevels = {
            1: [
                "What do you want to have for dinner today?", 
                "Why do polar bears not eat penguins?",
                "What is the difference between a chair and a stool?",
                "Write a two-line poem that rhymes.",
                "Write a haiku.",
                ],
            2: [
                "What did young you want to do when you grew up?",
                "Who was Thomas Edison?",
                "Describe what you see around you right now.",
                "Who is your favorite musical artist and why? ",
                "Write a coherent sentence where three consecutive words start with the same letter."
                ],
            3: [
                "Who was your first love and what happened between you?",
                "What is an interest rate?",
                "Describe your living room.",
                "Write a very short story about a woman and her pet lion."
            ],
        };
    
        // ✅ Select a Prompt Based on the Level
        const selectedPrompts = promptLevels[this.levelValue] || promptLevels[1];
        const randomIndex = Math.floor(Math.random() * selectedPrompts.length);
        this.currentPrompt = selectedPrompts[randomIndex];
    
        // Skip recreating the prompt if we haven't initialized the box yet
        if (!this.promptTextBox) {
            return;
        }
    
        // ✅ Remove Old Prompt Text Before Updating
        if (this.promptText) {
            this.promptText.destroy();
        }
    
        // ✅ Create and Display New Prompt Text
        this.promptText = this.add.text(
            this.cameras.main.centerX, 
            this.promptBoxY + 20, // ✅ Keep inside the box
            this.currentPrompt,
            {
                fontFamily: "Nunito",
                fontSize: "22px",
                color: COLORS_TEXT.WHITE,
                wordWrap: { width: this.uiBoxWidth - 40 },
                align: "center"
            }
        ).setOrigin(0.5, 0);
    
        // ✅ Adjust the Box Height Based on Text
        const padding = 20;
        const newHeight = this.promptText.height + padding * 2;
    
        this.promptTextBox.clear();
        this.promptTextBox.fillStyle(COLORS_HEX.BLUE_BACKGROUND, 1);
        this.promptTextBox.fillRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2, 
            this.promptBoxY,
            this.uiBoxWidth,
            newHeight,
            CORNER_RADIUS
        );
    
        this.promptTextBox.lineStyle(OUTLINE_WIDTH, COLORS_HEX.BLUE, 1);
        this.promptTextBox.strokeRoundedRect(
            this.cameras.main.centerX - this.uiBoxWidth / 2, 
            this.promptBoxY,
            this.uiBoxWidth,
            newHeight,
            CORNER_RADIUS
        );
    
        // ✅ Ensure Prompt Box and Text Are Layered Properly
        this.promptTextBox.setDepth(12);
        this.promptText.setDepth(13);
    }
    
    
    // Updated checkAndExplodeWord method with improved positioning
    checkAndExplodeWord() {
        console.log("check and explode word");
        if (!this.aiSuggestedWords || this.aiSuggestedWords.length === 0) {
            return;
        }
        
        let words = this.userInput.trim().split(" ");
        let lastWord = words[words.length - 1];

        if (this.aiSuggestedWords.includes(lastWord)) {
            console.log(`Exploding word: ${lastWord}`);
            
            // Calculate a better position for the explosion
            let wordX = this.inputText.x + this.inputText.displayWidth - 20;
            let wordY = this.inputText.y + this.inputText.displayHeight - 20;
            
            // Trigger explosion effect
            this.createExplosionEffect(lastWord, wordX, wordY);
            
            // Shake screen
            this.shakeScreen();
            
            // Remove last word from input
            this.userInput = words.slice(0, -1).join(" ") + " ";
            this.updateCursor();

            // Increment fail counter
            this.failCounter++;
            this.updateFailsCounter();
        }
    }

    
   // Fix for the createInputTextBox method
   createInputTextBox() {
    const textBoxWidth = this.uiBoxWidth;
    const textBoxHeight = 240;
    const padding = 30; // margin in text box
    
    // Ensure prompt is updated before rendering
    this.updatePromptBasedOnLevel();
    
    // Display the prompt above the input box
    if (this.promptText) {
        this.promptText.destroy();
    }
    
    this.promptText = this.add.text(
        this.cameras.main.centerX,
        this.cameras.main.centerY - textBoxHeight / 2 - 25,
        this.currentPrompt || "Loading prompt...",
        {
            fontFamily: 'Nunito',
            fontSize: `${this.baseFontSize}px`,
            fontStyle: 'italic',
            fill: COLORS_TEXT.WHITE,
            wordWrap: { width: textBoxWidth - 30 },
            align: 'center'
        }
    ).setOrigin(0.5, 1);
    
    // Ensure text box exists and has rounded corners
    if (this.inputTextBorder) {
        this.inputTextBorder.destroy();
    }
    this.inputTextBorder = this.add.graphics();
    this.inputTextBorder.fillStyle(0xffffff, 1);
    this.inputTextBorder.fillRoundedRect(
        this.cameras.main.centerX - textBoxWidth / 2,
        this.cameras.main.centerY - textBoxHeight / 2,
        textBoxWidth,
        textBoxHeight,
        CORNER_RADIUS
    );
    this.inputTextBorder.lineStyle(OUTLINE_WIDTH, COLORS_HEX.MIDPURPLE, 1);
    this.inputTextBorder.strokeRoundedRect(
        this.cameras.main.centerX - textBoxWidth / 2,
        this.cameras.main.centerY - textBoxHeight / 2,
        textBoxWidth,
        textBoxHeight,
        CORNER_RADIUS
    );
    
    this.add.existing(this.inputTextBorder);
    
    // Clear existing text objects
    if (this.inputText) {
        this.inputText.destroy();
    }
    if (this.autocompleteText) {
        this.autocompleteText.destroy();
    }
    
    this.userInput = "";
    this.cursorVisible = true;
    
    // Create the main input text (black)
    this.inputText = this.add.text(
        this.cameras.main.centerX - textBoxWidth / 2 + padding,
        this.cameras.main.centerY - textBoxHeight / 2 + padding,
        "_",
        {
            fontFamily: "Nunito",
            fontSize: "20px",
            fill: "#000",
            wordWrap: { width: textBoxWidth - padding * 2 },
            align: "left"
        }
    ).setOrigin(0, 0);
    
    // Create the autocomplete text (red)
    this.autocompleteText = this.add.text(
        this.cameras.main.centerX - textBoxWidth / 2 + padding,
        this.cameras.main.centerY - textBoxHeight / 2 + padding,
        "",
        {
            fontFamily: "Nunito",
            fontSize: "20px",
            fill: "#ff0000", // Red color
            wordWrap: { width: textBoxWidth - padding * 2 },
            align: "left"
        }
    ).setOrigin(0, 0);
    
    // Set very high depth for both text objects to ensure visibility
    this.inputText.setDepth(25);
    this.autocompleteText.setDepth(25);
    
    // Force visibility
    this.inputText.setVisible(true);
    this.autocompleteText.setVisible(true);
    
    // Keyboard event handler
    this.input.keyboard.removeAllListeners('keydown'); // Prevent duplicate handlers
    this.input.keyboard.on("keydown", (event) => {
        this.inputActive = true;

        if(this.activeTimeout) {
            clearTimeout(this.activeTimeout);
        }

        // Set timeout to revert to inactive state after 3 seconds
        this.activeTimeout = setTimeout(() => {
            this.inputActive = false;
        }, 3000);

        if (event.key === " ") {
            if (!this.userInput.trim()) return;
            this.userInput += " ";
            // Check for AI-suggested word match
            this.checkAndExplodeWord();
            this.generateAISuggestions(this.userInput.trim());
        } else if (event.key === "Tab") {
            // Accept autocomplete suggestion
            event.preventDefault(); // Prevent default tab behavior
            const autocomplete = this.generateAutocomplete();
            if (autocomplete) {
                this.userInput += autocomplete;
                
                // If the autocomplete ended a word, add a space
                if (!this.userInput.endsWith(" ")) {
                    this.userInput += " ";
                }
                
                this.generateAISuggestions(this.userInput.trim());
            }
        } else if (event.key.length === 1) {
            this.userInput += event.key;
        } else if (event.key === "Backspace") {
            this.userInput = this.userInput.slice(0, -1);
        } else if (event.key === "Enter") {
            this.userInput += "\n";
            // Check for AI-suggested word match
            this.checkAndExplodeWord();
            this.generateAISuggestions(this.userInput.trim());
        }
        
        this.updateCursor();
    });
    
    // Cursor blinking timer
    if (this.cursorTimer) {
        this.cursorTimer.remove();
    }
    this.cursorTimer = this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
            this.cursorVisible = !this.cursorVisible;
            
            // If active, blink faster
            if (this.inputActive) {
                setTimeout(() => {
                    if (this.inputActive) {
                        this.cursorVisible = !this.cursorVisible;
                        this.updateCursor();
                    }
                }, 250); // Half-cycle for faster blink
            }
            
            this.updateCursor();
        }
    });

    // Initialize with cursor and autocomplete
    this.updateCursor();

    // Make the input box interactive
    this.inputTextBorder.setInteractive(
        new Phaser.Geom.Rectangle(
            this.cameras.main.centerX - this.uiBoxWidth / 2,
            this.cameras.main.centerY - 240 / 2,
            this.uiBoxWidth,
            240
        ),
        Phaser.Geom.Rectangle.Contains
    );

    // Add click/tap effect
    this.inputTextBorder.on('pointerdown', (pointer) => {
        // Create ripple effect at click position
        this.createInputBoxClickEffect(pointer.x, pointer.y);
    });
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

    // New method to create the click effect
    createInputBoxClickEffect(x, y) {
        // Create a circle at click position
        const ripple = this.add.circle(x, y, 5, COLORS_HEX.YELLOW, 0.7);
        ripple.setDepth(20); // Above input box
        
        // Animate the ripple
        this.tweens.add({
            targets: ripple,
            radius: 80,
            alpha: 0,
            duration: 800,
            ease: 'Quad.Out',
            onComplete: () => {
                ripple.destroy();
            }
        });
        
        // Add a quick flash to the border
        const textBoxWidth = this.uiBoxWidth;
        const textBoxHeight = 240;
        const cornerRadius = CORNER_RADIUS;
        
        // Create flash effect
        const flash = this.add.graphics();
        flash.lineStyle(OUTLINE_WIDTH + 2, 0xffffff, 0.8);
        flash.strokeRoundedRect(
            this.cameras.main.centerX - textBoxWidth / 2,
            this.cameras.main.centerY - textBoxHeight / 2,
            textBoxWidth, 
            textBoxHeight,
            cornerRadius
        );
        flash.setDepth(this.inputTextBorder.depth + 1);
        
        // Animate the flash
        this.tweens.add({
            targets: flash,
            alpha: { from: 0.8, to: 0 },
            duration: 500, 
            ease: 'Cubic.Out',
            onComplete: () => {
                flash.destroy();
            }
        });
    }

    generateAutocomplete() {
        if (!this.aiSuggestedWords || this.aiSuggestedWords.length === 0) {
            return "";
        }
        
        // If last character is space or enter, show first suggestion
        const lastChar = this.userInput.slice(-1);
        if (lastChar === " " || lastChar === "\n") {
            return this.aiSuggestedWords[0];
        }
        
        // If user is typing a word, try to autocomplete it
        const words = this.userInput.split(" ");
        const currentWord = words[words.length - 1].toLowerCase();
        
        // If current word is empty, don't autocomplete
        if (!currentWord) {
            return "";
        }
        
        // Find a matching word from suggestions
        for (const suggestion of this.aiSuggestedWords) {
            if (suggestion.toLowerCase().startsWith(currentWord)) {
                // Return only the part that would complete the word
                return suggestion.slice(currentWord.length);
            }
        }
        
        return "";
    }
    
    
    // === Helper Function to Update Text with Blinking Cursor ===
    updateCursor() {
        if (!this.inputText || !this.autocompleteText) return;
        
        // Generate autocomplete suggestion
        let autocomplete = this.generateAutocomplete();
        
        // Update the main input text with cursor
        if (this.inputActive) {
            // Active state - block cursor
            this.inputText.setText(this.userInput + (this.cursorVisible ? "_" : " "));
        } else {
            // Default state - underscore cursor
            this.inputText.setText(this.userInput + (this.cursorVisible ? "_" : ""));
        }
        
        // Force a proper re-render of the text
        this.inputText.updateText();
        
        // Use the raw text width without the cursor for more accurate positioning
        const rawTextWidth = this.inputText.width - (this.cursorVisible ? 10 : 0);
        
        // Position autocomplete text immediately after input text content (not including cursor)
        this.autocompleteText.setPosition(
            this.inputText.x + rawTextWidth,
            this.inputText.y
        );
        
        // Update the autocomplete text
        this.autocompleteText.setText(autocomplete || "");
        
        // Force redraw of autocomplete text
        this.autocompleteText.updateText();
        
        // Ensure both text objects are visible and at the correct depth
        this.inputText.setVisible(true).setDepth(25);
        this.autocompleteText.setVisible(true).setDepth(25);
    }
     

   

    showSuggestions(words) {
        // Clear any existing word objects
        if (this.currentWordObjects) {
            this.currentWordObjects.forEach(wordObj => wordObj.destroy());
        }
        this.currentWordObjects = [];
        
        // Get words (limit to topK value)
        // Make sure words is an array before proceeding
        words = Array.isArray(words) ? words.slice(0, this.topKValue) : [];
        if (words.length === 0) return;
        
        // POSITIONING: Move suggestions closer to the prompt box
        const startY = this.promptBoxY - 60; // Position between menu and prompt box
        
        // Calculate total width needed
        const baseSpacing = 20;
        let totalWidth = 0;
        let wordObjects = words.map(word => {
            let tempText = this.add.text(0, 0, word, { fontSize: "22px", fontFamily: "Nunito" }).setVisible(false);
            let boxWidth = tempText.width + 20;
            tempText.destroy();
            totalWidth += boxWidth + baseSpacing;
            return { word, width: boxWidth };
        });
        
        totalWidth -= baseSpacing; // Remove last spacing
        const startX = this.cameras.main.centerX - totalWidth / 2;
        let currentX = startX;
        
        // Create word container
        const wordContainer = this.add.container(0, startY);
        
        // Add each word with dynamic styling
        wordObjects.forEach(({ word, width }, index) => {
            // Create colored box with simple color (no conversion)
            let wordBox = this.add.graphics();
            wordBox.fillStyle(COLORS_HEX.PERIWINKLE, 1);
            wordBox.fillRoundedRect(-width / 2, -20, width, 40, 10);
            
            // Add border
            let wordOutline = this.add.graphics();
            wordOutline.lineStyle(BUTTON_OUTLINE_WIDTH, 0xffffff, 1);
            wordOutline.strokeRoundedRect(-width / 2, -20, width, 40, 10);
            
            // Text
            let wordText = this.add.text(0, 0, word, {
                fontFamily: "Nunito",
                fontSize: "24px",
                fill: "#ffffff",
                align: "center"
            }).setOrigin(0.5, 0.5);
            
            // Create container for this word
            let wordItem = this.add.container(currentX + width / 2, 0, [wordBox, wordOutline, wordText]);
            
            // Add to main container
            wordContainer.add(wordItem);
            this.currentWordObjects.push(wordItem);
            currentX += width + baseSpacing;
            
            // DYNAMIC ANIMATION: Staggered bounce-in effect
            wordItem.setScale(0, 0); // Start tiny
            this.tweens.add({
                targets: wordItem,
                scaleX: 1,
                scaleY: 1,
                duration: 110,
                delay: index * 50, // Stagger each word
                ease: 'Back.out(1.7)', // Bouncy overshoot effect
                onComplete: () => {
                    // Add subtle hover effect
                    this.tweens.add({
                        targets: wordItem,
                        y: { from: 0, to: -3 },
                        duration: 1200 + (index * 200), // Slightly different timing per word
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.InOut'
                    });
                }
            });
        });
        
        // Add the container to the scene
        this.add.existing(wordContainer);
        wordContainer.setDepth(15);
    }
    


    // Improved createExplosionEffect to ensure it's visible above the text box
    createExplosionEffect(word, x, y) {
        // Create the explosion text with higher depth to appear above input box
        const explosion = this.add.text(x, y, word, {
            fontFamily: 'Nunito',
            fontSize: '20px', 
            fill: '#ff0000', 
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Set a very high depth to ensure it's on top of everything
        explosion.setDepth(100);
        
        // Make the explosion animation more dramatic
        this.tweens.add({
            targets: explosion,
            scale: { from: 1, to: 4 }, // How big is the explosion?
            alpha: { from: 1, to: 0 }, // Start fully visible and fade out
            angle: { from: 0, to: 360 }, // Rotation
            y: { from: y, to: y - 50 }, // Move upward for visibility
            duration: 900,
            ease: 'Back.easeOut',
            onComplete: () => explosion.destroy()
        });
    }
 
    shakeScreen() {
        this.cameras.main.shake(250, 0.02); // Shakes for 250ms with intensity 0.02
    }    

    init(data) {
        if (!data.llmEngine) {
            console.error("Error: No llmEngine received in GameSceneHard.");
        } else {
            console.log("llmEngine successfully received in GameSceneHard.");
        }
        this.llmEngine = data.llmEngine || null;
    }

    createBackgroundPattern() {
        // Create pattern texture
        const pattern = this.textures.createCanvas('patternCanvas', 100, 100);
        const ctx = pattern.getContext();
        
        // Draw pattern (dots, stars, or any subtle pattern)
        ctx.fillStyle = '#2c1155';
        ctx.fillRect(0, 0, 100, 100);
        
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = '#4b237a';
          ctx.beginPath();
          ctx.arc(Math.random() * 100, Math.random() * 100, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        pattern.refresh();
        
        // Add pattern as background
        const bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'patternCanvas')
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

    // Method to ensure all text elements are properly visible
    ensureTextVisibility() {
        if (this.inputText) {
            this.inputText.setVisible(true);
            this.inputText.setDepth(20);
        }
        if (this.autocompleteText) {
            this.autocompleteText.setVisible(true);
            this.autocompleteText.setDepth(20);
        }
    }

      
    // Add this to your create() method after creating all elements
    ensureProperLayering() {
        // Make sure prompt box is visible with proper depth
        if (this.promptTextBox) {
            this.promptTextBox.setDepth(5);
        }
        if (this.promptText) {
            this.promptText.setDepth(6);
        }
        
        // Make sure output box is visible with proper depth
        if (this.outputTextBox) {
            this.outputTextBox.setDepth(5);
        }
        if (this.outputText) {
            this.outputText.setDepth(6);
        }
        
        // Ensure fails counter doesn't overlap with other elements
        if (this.failsCounter) {
            this.failsCounter.setDepth(7);
        }
        
        // Input box should be above everything
        if (this.inputTextBorder) {
            this.inputTextBorder.setDepth(8);
        }
        if (this.inputText) {
            this.inputText.setDepth(9);
        }
        
        // Buttons should be on top
        if (this.doneButton) {
            this.doneButton.setDepth(10);
        }
        if (this.resetButton) {
            this.resetButton.setDepth(10);
        }
    }

    // Helper method to debug text visibility issues (can be removed in production)
    debugTextVisibility() {
        console.log("Debug Text Visibility:");
        if (this.inputText) {
            console.log(`Input Text - visible: ${this.inputText.visible}, depth: ${this.inputText.depth}, text: "${this.inputText.text}"`);
        } else {
            console.log("Input Text not created");
        }
        
        if (this.autocompleteText) {
            console.log(`Autocomplete Text - visible: ${this.autocompleteText.visible}, depth: ${this.autocompleteText.depth}, text: "${this.autocompleteText.text}"`);
        } else {
            console.log("Autocomplete Text not created");
        }
    }

    async create() {
        //this.add.image(400, 300, 'background'); // Example background
        //this.cameras.main.setBackgroundColor('#13091e');
        this.cameras.main.scrollY = 0; // ✅ Ensures the camera starts at the top

        this.createBackgroundEffect();
        //this.createBackgroundPattern();

        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const margin = 100;
        const titleSize = '120px';
        const numerictitleSize = parseInt(titleSize);
        const offset = numerictitleSize + margin;

        
        this.createMenuBar();
        if (!this.promptTextBox) {  // ✅ Prevent duplicate calls
            this.createPromptTextBox();
        }
        
        
        // Create a white rectangle as the input box
        this.createInputTextBox();
        this.updatePromptBasedOnLevel();


        // ✅ Manually track input box position
        const inputBoxX = this.cameras.main.centerX;
        const inputBoxY = this.cameras.main.centerY;
        const inputBoxWidth = this.cameras.main.width * (5 / 6);
        const inputBoxHeight = 240;
    
        // ✅ Correct positioning relative to the input box
        const buttonCenterX = inputBoxX + inputBoxWidth / 2 - buttonWidth - 20;
        const buttonCenterY = inputBoxY + inputBoxHeight / 2 + buttonSpacing;


        this.doneButton = this.createButton("DONE", () => this.onDoneButtonClick(), buttonCenterX, buttonCenterY);
        this.resetButton = this.createButton("RESET", () => this.onResetRuttonClick(), buttonCenterX - 120, buttonCenterY);

        this.createFailsCounter();

        this.createOutputTextBox(); //

        this.inputActive = false;


        // Ensure all elements are properly visible
        this.ensureProperLayering();
        this.ensureTextVisibility(); // Add this new call
        this.updateCursor()

        // Debug text visibility after a short delay (to let everything initialize)
        this.time.delayedCall(500, () => {
            this.debugTextVisibility();
        });

    }


    
    handleUserInput() {
        if (!this.llmEngine || !this.userInput.trim()) {
            console.error('LLM not loaded yet or input is empty');
            return;
        }
    
        const text = this.userInput.trim();
        const lastWord = text.split(' ').pop();
    
        // Ensure the system recognizes last word and processes it correctly
        if (this.currentWordObjects) {
            const wordTexts = this.currentWordObjects.map(obj => obj.list[1].text);
            if (wordTexts.includes(lastWord)) {
                const wordX = this.inputText.x + this.inputText.displayWidth - 20;
                const wordY = this.inputText.y + this.inputText.displayHeight - 20;
                this.createExplosionEffect(lastWord, wordX, wordY);
                this.shakeScreen();
    
                this.userInput = this.userInput.split(' ').slice(0, -2).join(' ') + ' ';
                this.inputText.setText(this.userInput || '_');
                return;
            }
        }
    
        // ✅ Generate AI suggestions
        this.generateAISuggestions(text);
    }
    
    async generateAISuggestions(userInput) {
        if (!userInput.trim()) {
            console.warn("Skipping AI suggestion generation: Empty input.");
            return; // ✅ Prevents function from running on empty input
        }
    
        console.log("Generating AI suggestions for:", userInput);
    
        try {
            const reply = await this.llmEngine.completions.create({
                prompt: userInput,
                echo: false,
                n: 1,
                max_tokens: 1,
                logprobs: true,
                top_logprobs: this.topKValue,
            });
    
            if (!reply.choices || reply.choices.length === 0 || !reply.choices[0].logprobs) {
                console.warn("AI response is missing expected properties.");
                return;
            }
    
            let options = reply.choices[0].logprobs.content[0].top_logprobs;
            let suggestedWords = options.map(choice => choice.token.trim());
    
            console.log("AI Suggested Words:", suggestedWords);

            this.aiSuggestedWords = suggestedWords;
    
            this.showSuggestions(suggestedWords);
        } catch (error) {
            console.error("Error generating text:", error);
        }
    }
    
    
    
    
    
}

