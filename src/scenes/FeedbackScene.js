import { COLORS_HEX, COLORS_TEXT, OUTLINE_WIDTH, BUTTON_OUTLINE_WIDTH, CORNER_RADIUS, BUTTON_CORNER_RADIUS, buttonHeight, buttonSpacing, buttonWidth} from "../config/design_hard.js";
import { stopwords } from "../config/stopwords.js";
import { db, currentUserId } from "../config/firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";


// Function to save interaction
async function saveInteraction(interaction) {
    try {
      const docRef = await addDoc(collection(db, "feedback"), {
        userId: currentUserId || "unknown",
        interaction});
      console.log("Firebase document written with ID: ", docRef.id);
    } catch (e) {
      console.error("Error adding document to Firebase: ", e);
    }
  }

export default class FeedbackScene extends Phaser.Scene {
    constructor() {
        super({ key: 'FeedbackScene' });
        this.mode = null;
        this.userInput = '';
        this.llmEngine = null;       
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
        console.log("Logging feedback...");
        
        const interaction = {
            timestamp: Date.now(),
            feedback: this.userInput
        }

        saveInteraction(interaction);
        if (this.mode === "easy") {
            this.scene.start('GameSceneEasy', { llmEngine: this.llmEngine });
        }
        else if (this.mode === "hard") {
            this.scene.start('GameSceneHard', { llmEngine: this.llmEngine });
        }
    }

    createInputTextBox() {    
        const textBoxWidth = this.uiBoxWidth;
        const textBoxHeight = 340;
        const padding = 20;
    
        // Input Text Border
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
        this.inputTextBorder.setDepth(100).setVisible(true);
    
        // Input Text
        if (this.inputText) {
            this.inputText.destroy();
        }
        this.userInput = "";
        this.cursorVisible = true;
    
        this.inputText = this.add.text(
            this.cameras.main.centerX - textBoxWidth / 2 + padding,
            this.cameras.main.centerY - textBoxHeight / 2 + padding,
            "_",
            {
                fontFamily: "Nunito",
                fontSize: "20px",
                fill: "#000000",
                wordWrap: { width: textBoxWidth - padding * 2 },
                align: "left"
            }
        )
        .setOrigin(0, 0)
        .setAlpha(1)
        .setVisible(true)
        .setDepth(101);  // highest depth clearly above input border
    
        this.inputText.updateText(); // Force redraw explicitly
    
        // Keyboard event handler (your existing logic...)
        this.input.keyboard.removeAllListeners('keydown');
        this.input.keyboard.on("keydown", (event) => {
            this.inputActive = true;
            if (this.activeTimeout) clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => { this.inputActive = false; }, 3000);
    
            if (event.key === "Backspace") {
                this.userInput = this.userInput.slice(0, -1);
            } else if (event.key === "Enter") {
                this.userInput += "\n";
            } else {
                this.userInput += event.key;
            }
            this.updateCursor();
        });
    
        // Cursor blinking timer
        if (this.cursorTimer) this.cursorTimer.remove();
        this.cursorTimer = this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                this.cursorVisible = !this.cursorVisible;
                this.updateCursor();
            }
        });
    
        // Final cursor update
        this.updateCursor();
    }
    

    createPromptTextBox() {
        this.promptBoxY = 110;
    
        this.uiBoxWidth = this.cameras.main.width * (5 / 6);
        const padding = 40;
    
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
        const defaultText = "Thank you for playing! Please use the below space to provide all your gripes and helpful ideas, and hit 'DONE' to return to your game. Be honest. We won't be mad, we promise...";
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

    // === Helper Function to Update Text with Blinking Cursor ===
    updateCursor() {
        if (!this.inputText) return;
        
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

        // Ensure both text objects are visible and at the correct depth
        this.inputText.setVisible(true)//.setDepth(101);
 
    }
   

    init(data) {
        if (!data.mode) {
            console.error("Error: No mode received in FeedbackScene.");
        } else {
            console.log("mode successfully received in FeedbackScene.");
        }
        this.mode = data.mode || null;
        if (!data.llmEngine) {
            console.error("Error: No llmEngine received in FeedbackScene.");
        } else {
            console.log("llmEngine successfully received in FeedbackScene.");
        }
        this.llmEngine = data.llmEngine || null;
        // Reset key scene elements to ensure proper initialization when returning from other scenes
        this.promptTextBox = null;
        this.promptText = null;

    }

    createBackgroundPattern() {

        // ✅ Check if texture already exists and remove it before recreating
        if (this.textures.exists(patternKey)) {
            this.textures.remove(patternKey);
        }
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



    async create() {
        this.cameras.main.scrollY = 0; 
        this.createBackgroundEffect();
    
        // Input Box Creation
        this.uiBoxWidth = this.cameras.main.width * (5 / 6);
        this.createInputTextBox();
        this.createPromptTextBox();
    
        // Ensure visibility and layering explicitly
        this.inputTextBorder.setDepth(100).setAlpha(1).setVisible(true);
        this.inputText.setDepth(101).setAlpha(1).setVisible(true);
    
        // Button positioning correctly relative to input box
        const inputBoxX = this.cameras.main.centerX;
        const inputBoxY = this.cameras.main.centerY;
        const buttonCenterX = inputBoxX + this.uiBoxWidth / 2 - buttonWidth - 20;
        const buttonCenterY = inputBoxY + 170 + buttonSpacing; // 170 = half height of input box (340/2)
    
        // Now create the button safely
        this.doneButton = this.createButton("DONE", () => this.onDoneButtonClick(), buttonCenterX, buttonCenterY);
        this.doneButton.setDepth(102); // always ensure button is visible
        this.inputActive = false;
    
        // Update cursor explicitly at end
        this.updateCursor();
    }
    

    
    
}

