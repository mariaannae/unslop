import { COLORS_HEX, COLORS_TEXT, OUTLINE_WIDTH, BUTTON_OUTLINE_WIDTH, CORNER_RADIUS, BUTTON_CORNER_RADIUS} from "../config/design_hard.js";
import { getUserEnvironmentInfo,saveInteraction } from "../config/firebase.js";

const loadWebLLM = async () => {
    const WebLLM = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm');
    return WebLLM;
};

export default class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
        this.progressBar = null;
        this.playButtons = null;
        this.progress = 0; // Track progress state
        this.llmLoaded = false;
        this.loadingText = null;
        this.stopWords = [];
        this.outputTextBox = null;
        this.errorText = null;
    }

    init() {
        this.cameras.main.setBackgroundColor(COLORS_TEXT.BACKGROUND); // Set background color
    }

    preload() {
        this.load.setPath('assets');


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

        createOutputTextBox(text) {
            this.uiBoxWidth = this.cameras.main.width * (5 / 6);
            const outputBoxWidth = this.uiBoxWidth;
            const lineHeight = 24;
            const numLines = 17;
            const padding = 30;
            const outputBoxHeight = numLines * lineHeight + padding * 2;
            
           
            const outputBoxY = this.errorText.y + outputBoxHeight/2 + 70;// - outputBoxHeight - 10;
        
            // ✅ Remove existing box if it exists (prevents duplicate rendering)
            if (this.outputTextBox) {
                this.outputTextBox.destroy();
            }
        
            // ✅ Create new output box with rounded corners
            this.outputTextBox = this.add.graphics();
            this.outputTextBox.fillStyle(COLORS_HEX.BACKGROUND, 1);
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
                text,
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
            this.outputTextBox.setDepth(100);
            this.outputText.setDepth(101);
        }


    async create() {
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const margin = 100;
        this.createBackgroundEffect();

        //window.addEventListener("resize", () => this.resizeUI());

        saveInteraction("creating preloader", "preloader");


        //const titleSize = Math.max(this.cameras.main.width * 0.1, 80); // Dynamic font size (10% of screen width, min 80px)
        const titleSize = 120;

        const titleText = this.add.text(screenWidth / 2, screenHeight*.15, "(NON-SLOP)", { 
            fontFamily: 'barcade3d',
            fontSize: `${titleSize}px`, 
            color: COLORS_TEXT.YELLOW
        });
        
        titleText.setOrigin(0.5, 0);
        titleText.x = -600; // Start off-screen
        
        // ✅ Adjust slide speed based on screen width
        let targetX = this.cameras.main.centerX;
        let slideSpeed = 25;//Math.max(this.cameras.main.width * 0.02, 15); // Adjust speed dynamically
        
        // ✅ Smooth Slide-in Effect
        this.time.addEvent({
            delay: 16,
            callback: () => {
                if (titleText.x < targetX) {
                    titleText.x += slideSpeed;
                } else {
                    titleText.x = targetX;
                    this.tweens.add({
                        targets: titleText,
                        x: { from: targetX, to: targetX - 20 },
                        duration: 180,
                        yoyo: true,
                        ease: "Quad.Out"
                    });
                }
            },
            loop: true
        });
        




        // // === Flash Effect (Refined) ===
        // this.tweens.add({
        //     targets: titleText,
        //     alpha: { from: 0, to: 1 },
        //     duration: 200,
        //     ease: 'Sine.InOut',
        //     repeat: 1,
        //     yoyo: true,
        //     onComplete: () => {
        //         titleText.setAlpha(1);
        //     }
        // });
        
        //const loadingFontSize = Math.max(this.cameras.main.width * 0.02, 20); // 2% of width, min 20px
        const loadingFontSize = 22; // 2% of width, min 20px
        this.loadingText = this.add.text(screenWidth / 2, titleText.y + titleText.height + margin, "Loading LLM...", {
            fontFamily: 'Nunito',
            fontSize: `${loadingFontSize}px`,
            fontWeight: "500",
            fill: COLORS_TEXT.WHITE
        });
        
        this.loadingText.setOrigin(0.5, 0);


        // === Create Progress Bar ===

        this.progressBar = this.add.graphics();
        this.progressBarOutline = this.add.graphics();
        

        const progressBarWidth = Phaser.Math.Clamp(screenWidth * 0.5, 300, 600);
        const progressBarLeftX = (screenWidth/ 2) - (progressBarWidth / 2);

        const progressBarY = this.loadingText.y + this.loadingText.height + this.cameras.main.width*.02; // Position below loading text
        


        //this.drawProgressBarOutline(progressBarX, progressBarY, this.progressBarLeftX);
        this.drawProgressBar(this.progress, progressBarLeftX, progressBarY, progressBarWidth);


        const offset = 150;
        // === WebGPU Support Check ===
        if (!navigator.gpu) {
            this.errorText = this.add.text(screenWidth / 2, margin + 50 + offset, "WebGPU is required but not enabled/supported.", {
                fontFamily: 'Nunito',
                fontSize: "50px",
                fontWeight: "500",
                fill: "#ff0000"
            });
            this.errorText.setOrigin(0.5, 0);
            console.error("WebGPU is required but not enabled/supported.");
            //return;

            
            const { os, browser, userAgent } = getUserEnvironmentInfo();
            if (browser === 'Safari') {
                const text = "Safari does not natively support WebGPU. We recommend using Chrome for the best experience. You may be able to enable WebGPU for Safari as follows:\n\n1. Go to 'Safari' > 'Preferences'.\n2. Click on the 'Advanced' tab.\n3. Check the box next to 'Show Develop menu in menu bar'.\n4. Close the Preferences window.\n5. Click on 'Develop' in the menu bar.\n6. Click on 'Feature Flags'.\n7. Check the box next to 'WebGPU'.\n\nAfter enabling WebGPU, please reload the page.";
                this.createOutputTextBox(text)
            }
            else {
                const text = "Your browser does not support WebGPU, or WebGPU is not enabled. Please enable WebGPU if possible, or try another browser. We recommend using Chrome for the best experience.";
                this.createOutputTextBox(text);
            }
            saveInteraction("WebGPU load failure", "preloader");
            return;
        }

    

        try {
            // Load WebLLM dynamically
            const WebLLM = await loadWebLLM();
            const { CreateMLCEngine } = await loadWebLLM();

            const model_id = "Qwen2.5-0.5B-Instruct-q0f32-MLC";

            const appConfig = {
                model_list: [
                    {
                        model: "https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q0f32-MLC",
                        model_id: model_id,
                        model_lib: WebLLM.modelLibURLPrefix +
                                   WebLLM.modelVersion + 
                                   "/Qwen2-0.5B-Instruct-q0f32-ctx4k_cs1k-webgpu.wasm",
                        overrides: {
                            context_window_size: 4096,
                        },
                    },
                ],
                runtime: "webgpu"
            };

            // === Simulated Progress Bar Update ===
            let progressInterval = setInterval(() => {
                if (this.progress < .9) { 
                    this.progress += Phaser.Math.Clamp(Phaser.Math.Between(.5, .15), 0, .90 - this.progress); // Prevent overflow
                    this.drawProgressBar(this.progress, progressBarLeftX, progressBarY, progressBarWidth);
                }
            }, 300);

            // Initialize WebLLM Engine
            const llmEngine = await CreateMLCEngine(model_id, {
                appConfig: appConfig,
                logLevel: "INFO",
            });

            clearInterval(progressInterval); // Stop progress updates
            this.progress = 1; // Set to full once LLM is loaded
            this.drawProgressBar(this.progress, progressBarLeftX, progressBarY, progressBarWidth);

            console.log("WebLLM Engine initialized with WebGPU.");
            this.llmLoaded = true; // Mark LLM as loaded
            this.loadingText.setText("Done loading. Choose your game.");
            this.checkIfReady(llmEngine); // Check if everything is ready


        } catch (error) {
            console.error("Failed to initialize WebLLM:", error);
            const errorText = this.add.text(screenWidth / 2, margin + 70 + offset, "Failed to initialize WebLLM", {
                fontFamily: 'Nunito',
                fontSize: "50px",
                fontWeight: "500",
                fill: COLORS_TEXT.ERROR,
            });
            errorText.setOrigin(0.5, 0);
            const errormsg = "Failed to initialize WebLLM:" + error;
            saveInteraction(errormsg, "preloader");
        }
    }

    

    // === Check if Both Progress and LLM are Done ===
    checkIfReady(llmEngine) {
        const screenWidth = this.cameras.main.width;
        const margin = 100;
        const offset = 220;
        if (this.progress >= 1 && this.llmLoaded) {
            saveInteraction("LLM successfully loaded", "preloader");
            // Show Play Button Only When Both Are Ready
            this.showPlayButtons(screenWidth / 2, margin + offset * 1.4 + 100, llmEngine);
        }
    }





    drawProgressBar(progress, progressBarLeftX, y, width) {
        const barHeight = 30;

        if (!this.progressBarOutline) {
            this.progressBarOutline = this.add.graphics();
            //this.progressbarY = y;
            //this.progressBarWidth = width;
        } else {
            this.progressBarOutline.clear();
        }
    
        this.progressBarOutline.lineStyle(BUTTON_OUTLINE_WIDTH, COLORS_HEX.YELLOW, 1);
    
        // ✅ Store the correct left-edge position
        
    
        this.progressBarOutline.strokeRoundedRect(
            progressBarLeftX, // ✅ Use stored left-edge position
            y,
            width,
            barHeight,
            10
        );
    
        if (!this.progressBar) {
            this.progressBar = this.add.graphics();
        } else {
            this.progressBar.clear();
        }
          
        this.progressBar.fillStyle(COLORS_HEX.TURQUOISE, 1); // ✅ Use correct color
    
        // ✅ Fix width scaling: Ensure fill fully extends when at 100%
        const fillWidth = Phaser.Math.Clamp(width * progress, 1, width); // ✅ Ensure width matches the outline
    

        this.progressBar.fillRoundedRect(
            progressBarLeftX, // ✅ Keep fill aligned with the left edge of the outline
            y, // ✅ Ensure fill is aligned with the outline (not too high)
            fillWidth, // ✅ Fix width scaling issue
            barHeight, // ✅ Ensure height matches the outline
            10
        );
       
        
    }
    
    

    showPlayButtons(x, y, llmEngine) {
        if (this.playButton) return; // Prevent duplicate buttons


        const buttonWidth = Phaser.Math.Clamp(this.cameras.main.width * 0.1, this.cameras.main.width * 0.07, 220); // 10% of screen width
        const buttonHeight = buttonWidth * 0.4; // Maintain aspect ratio
        const buttonSpacing = buttonWidth*.1;

        // === Create Function to Generate Buttons ===
        const createButton = (label, offsetX, onClick) => {
            // ✅ Dynamically Adjust Button Size
            //const buttonWidth = Phaser.Math.Clamp(this.cameras.main.width * 0.1, this.cameras.main.width * 0.07, 220); // 10% of screen width
            //const buttonHeight = buttonWidth * 0.4; // Maintain aspect ratio
        
            // ✅ Dynamically Adjust Outline Thickness
            const outlineThickness = Phaser.Math.Clamp(buttonWidth * 0.02, 1, 6);
        
            // ✅ Adjust Button Font Size
            const fontSize = `${Math.max(buttonWidth * 0.15, 22)}px`;
        
            // ✅ Dynamically Position Buttons
            const centerX = this.cameras.main.centerX;
            const centerY = this.loadingText.y + this.loadingText.height + this.cameras.main.width*.14; // Position below progress bar
            const x = centerX + offsetX;
            const y = centerY;
            
        
            // === Create White Outline (Bolder) ===
            const buttonOutline = this.add.graphics();
            buttonOutline.lineStyle(outlineThickness, 0xffffff, 1);
            buttonOutline.strokeRoundedRect(
                -buttonWidth / 2 - outlineThickness / 2, 
                -buttonHeight / 2 - outlineThickness / 2, 
                buttonWidth + outlineThickness, 
                buttonHeight + outlineThickness, 
                BUTTON_CORNER_RADIUS + 2
            );
        
            // === Create Button Background (Base Color - Darker) ===
            const buttonBackground = this.add.graphics();
            buttonBackground.fillStyle(COLORS_HEX.BUTTONFILL, 1);
            buttonBackground.fillRoundedRect(
                -buttonWidth / 2, -buttonHeight / 2, 
                buttonWidth, buttonHeight, BUTTON_CORNER_RADIUS
            );
        
            // === Simulated Gradient Overlay (Lighter Top) ===
            const gradientOverlay = this.add.graphics();
            gradientOverlay.fillStyle(COLORS_HEX.BUTTONOVERLAY, 0.6);
            gradientOverlay.fillRoundedRect(
                -buttonWidth / 2, -buttonHeight / 2, 
                buttonWidth, buttonHeight / 2, BUTTON_CORNER_RADIUS
            );
        
            // === Create Highlight Effect ===
            const buttonHighlight = this.add.graphics();
            buttonHighlight.fillStyle(0xffffff, 0.3);
            buttonHighlight.fillRoundedRect(
                -buttonWidth / 2 + 5, 
                -buttonHeight / 2 + 2, 
                buttonWidth - 10, 
                buttonHeight / 3, 
                BUTTON_CORNER_RADIUS
            );
        
            // === Create Button Text ===
            const buttonText = this.add.text(0, 0, `${label}`, { 
                fontFamily: 'Fredoka',
                fontSize: fontSize,
                color: COLORS_TEXT.WHITE
            }).setOrigin(0.5, 0.5);
        
            // === Group Button Elements ===
            const buttonContainer = this.add.container(x, y, [buttonOutline, buttonBackground, gradientOverlay, buttonHighlight, buttonText]);
            buttonContainer.setSize(buttonWidth, buttonHeight);
            buttonContainer.setAlpha(0); // Start invisible
        
            // === Fade-in Animation ===
            this.tweens.add({
                targets: buttonContainer,
                alpha: 1,
                duration: 500,
                ease: 'Sine.InOut'
            });
        
            // === Make Button Interactive ===
            buttonContainer.setInteractive({ useHandCursor: true });
        
            // === Hover Effect (Subtle Scale Up) ===
            buttonContainer.on('pointerover', () => {
                this.tweens.add({
                    targets: buttonContainer,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 150,
                    ease: 'Quad.Out'
                });
            });
        
            buttonContainer.on('pointerout', () => {
                this.tweens.add({
                    targets: buttonContainer,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 150,
                    ease: 'Quad.Out'
                });
            });
        
            // === Click Animation ===
            buttonContainer.on('pointerdown', () => {
                buttonContainer.y += 3;
                buttonText.y += 2;
                buttonContainer.x += 3;
                buttonText.x += 2;
        
                this.time.delayedCall(150, () => {
                    buttonContainer.y -= 3;
                    buttonText.y -= 2;
                    buttonContainer.x -= 3;
                    buttonText.x -= 2;
                    onClick();
                });
            });
        
            return buttonContainer;
        };
        
    
        // === Create Two Buttons ===
        const easyButton = createButton("EASY", -buttonWidth - buttonSpacing / 2, () => this.startGame(llmEngine, "easy"));
        const hardButton = createButton("HARD", buttonWidth + buttonSpacing / 2, () => this.startGame(llmEngine, "hard"));
    
        this.playButtons = [easyButton, hardButton];
    }
    
    // === Start Game Function (Handles Difficulty) ===
    startGame(llmEngine, difficulty) {
        console.log(`Starting GameSceneHard in ${difficulty} mode...`);
        if (difficulty === "easy") {
            this.scene.start('GameSceneEasy', { llmEngine });
        }
        else if (difficulty === "hard") {
            this.scene.start('GameSceneHard', { llmEngine });
        }
    }
    
}
//onComplete: () => this.scene.start('GameSceneHard', llmEngine)