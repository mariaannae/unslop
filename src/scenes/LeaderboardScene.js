import { DESIGN, COLORS_HEX, COLORS_TEXT, THEME } from "../config/design.js";
import { getTopScores, cleanupOldScores } from "../config/firebase.js";
import { createBackground } from "../backgrounds/createBackground.js";
import { getTextStyle } from "../config/textStyles.js";
import { detectDeviceType } from "../config/dimensions.js";
import { BaseScene } from "./BaseScene.js";

export default class LeaderboardScene extends BaseScene {
    constructor() {
        super({ key: 'LeaderboardScene' });
        this.scores = [];
        this.leaderboardEntries = [];
        this.isLoading = false;
        this.scrollContainer = null;
        this.scrollY = 0;
        this.maxScrollY = 0;
        this.isDragging = false;
        this.lastPointerY = 0;
        this.userResponse = null;
    }

    init(data) {
        this.levelValue = data.levelValue || 1;
        this.score = data.score || 0;
        this.userResponse = data.userResponse || null;
    }

    async create() {
        // IMPORTANT: Call parent create() first to get all BaseScene functionality
        super.create();

        window._leaderboardScene = this;
        console.log("Camera size:", this.sys.game.canvas.width, this.cameras.main.height);
        console.log("Window size:", window.innerWidth, window.innerHeight);
        try {

            console.log("[LeaderboardScene] Step 1: Creating background");
            createBackground(this, THEME.background, this.levelValue);

            console.log("[LeaderboardScene] Step 2: Creating title");
            this.createTitle();

            console.log("[LeaderboardScene] Step 3: Showing loading indicator");
            this.showLoadingIndicator();

            console.log("[LeaderboardScene] Step 4: Loading scores");
            await this.loadScores();

            console.log("[LeaderboardScene] Step 5: Hiding loading indicator and displaying scores");
            this.hideLoadingIndicator();
            this.displayScores();

            // Create the button at a fixed position from the bottom
            const button = this.createBackButton();
        } catch (error) {
            console.error("[LeaderboardScene] ERROR during create:", error);
            this.hideLoadingIndicator();
            this.showErrorMessage("Error loading leaderboard. Please check your connection and try again.");
        }
    }

    createBackgroundEffect() {
        let width = this.sys.game.canvas.width;
        let height = this.cameras.main.height;
        
        let gradientTextureKey = 'gradientLeaderboardBackground';
    
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

    // Get title text style using centralized text styles
    getTitleTextStyle() {
        const deviceType = detectDeviceType();
        const uiScale = this.scalingManager?.uiScale || 1;
        return getTextStyle('menuTitle', deviceType, this.mode || 'basic', uiScale);
    }

    createTitle() {
        // Create a title for the leaderboard using centralized text styles
        const titleStyle = this.getTitleTextStyle();

        this.add.text(
            this.scalingManager.centerX(),
            this.scalingManager.heightPercent(7), // 7% from top
            '(LEADERBOARD)',
            titleStyle
        ).setOrigin(0.5);
    }

    createButton(label, callback, centerX, centerY, options = {}) {
        // Ensure scalingManager is passed for responsive sizing
        return ButtonFactory.createButton(
            this,
            label,
            callback,
            centerX,
            centerY,
            { ...options, scalingManager: this.scalingManager }
        );
    }

    showLoadingIndicator() {
        this.isLoading = true;
        const deviceType = detectDeviceType();
        const textStyle = getTextStyle('prompt', deviceType, this.mode, this.scalingManager.scale);
        
        this.loadingText = this.add.text(
            this.scalingManager.centerX(),
            this.scalingManager.centerY(),
            'Loading scores...',
            {
                ...textStyle,
                color: '#ffffff'
            }
        ).setOrigin(0.5);

        // Add a spinning animation
        this.tweens.add({
            targets: this.loadingText,
            rotation: Math.PI * 2,
            duration: 2000,
            repeat: -1
        });
    }

    hideLoadingIndicator() {
        this.isLoading = false;
        if (this.loadingText) {
            this.tweens.killTweensOf(this.loadingText);
            this.loadingText.destroy();
        }
    }

    async loadScores() {
        try {
            console.log("[LeaderboardScene] [loadScores] Fetching top scores");
            this.scores = await getTopScores(null, 20);
            console.log("[LeaderboardScene] [loadScores] Loaded scores:", this.scores);
        } catch (error) {
            console.error("[LeaderboardScene] [loadScores] ERROR:", error);
            this.scores = [];
            this.showErrorMessage("Failed to load scores. Please try again.");
        }
    }

    clearScoreDisplay() {
        // Remove all existing score entries
        if (this.leaderboardEntries) {
            this.leaderboardEntries.forEach(entry => {
                if (entry.container) {
                    entry.container.destroy();
                }
            });
            this.leaderboardEntries = [];
        }

        // Remove table header if it exists
        if (this.tableHeader) {
            this.tableHeader.destroy();
        }

        // Remove no scores message if it exists
        if (this.noScoresText) {
            this.noScoresText.destroy();
        }

        // Clean up mask if it exists
        if (this.scrollMask) {
            this.scrollMask.destroy();
            this.scrollMask = null;
        }

        // Remove scroll container if it exists
        if (this.scrollContainer) {
            this.scrollContainer.destroy();
            this.scrollContainer = null;
        }

        // Remove scroll indicators if they exist
        if (this.scrollThumb) {
            this.scrollThumb.destroy();
            this.scrollThumb = null;
        }

        // Reset scroll variables
        this.scrollY = 0;
        this.maxScrollY = 0;
        this.isDragging = false;
    }

    displayScores() {
        this.clearScoreDisplay();
        
        // Calculate the position of the done button and ensure we stop before it
        const doneButtonY = this.scalingManager.heightPercent(92);
        const buttonHeight = this.scalingManager.scaleValue(64);
        const minSpaceAboveButton = this.scalingManager.scaleValue(20);
        
        // The scores list should end at this Y position
        const maxEndY = doneButtonY - (buttonHeight / 2) - minSpaceAboveButton;
        
        const startY = this.scalingManager.heightPercent(21);
        const headerHeight = this.scalingManager.scaleValue(35);
        
        // Fixed spacing for consistent layout
        const spacing = this.scalingManager.scaleValue(35);
        const width = this.sys.game.canvas.width * 0.8;
        
        // Create table header (fixed position)
        this.createTableHeader(startY, width, headerHeight);
        
        if (this.scores.length === 0) {
            const deviceType = detectDeviceType();
            const textStyle = getTextStyle('prompt', deviceType, this.mode, this.scalingManager.scale);
            
            this.noScoresText = this.add.text(
                this.scalingManager.centerX(),
                startY + this.scalingManager.scaleValue(80),
                'No scores yet. Be the first!',
                {
                    ...textStyle,
                    color: '#ffffff'
                }
            ).setOrigin(0.5);
            return;
        }
        
        // Pass the maximum end Y position to constrain the scroll area
        this.createScrollableScoreList(startY, headerHeight, spacing, width, maxEndY);
    }

    createTableHeader(y, width, boxHeight = 35) {
        const padding = 20;

        // Create a rounded rectangle for the header background
        const headerGraphics = this.add.graphics();
        headerGraphics.fillStyle(this.COLORS_HEX.ACCENT, 0.7);
        headerGraphics.fillRoundedRect(
            this.cameras.main.centerX - width / 2,
            y,
            width,
            boxHeight,
            8
        );
        headerGraphics.lineStyle(2, 0xffffff, 0.8);
        headerGraphics.strokeRoundedRect(
            this.cameras.main.centerX - width / 2,
            y,
            width,
            boxHeight,
            8
        );

        // Create column headers
        const deviceType = detectDeviceType();
        const baseHeaderStyle = getTextStyle('settings', deviceType, this.mode, this.scalingManager.scale);
        const headerStyle = {
            ...baseHeaderStyle,
            color: '#ffffff',
            fontStyle: 'bold'
        };

        const rankText = this.add.text(
            this.cameras.main.centerX - width / 2 + padding + 10,
            y + boxHeight / 2,
            'RANK',
            headerStyle
        ).setOrigin(0, 0.5);

        const nameText = this.add.text(
            this.cameras.main.centerX - width / 2 + padding + 80,
            y + boxHeight / 2,
            'NAME',
            headerStyle
        ).setOrigin(0, 0.5);

        const levelText = this.add.text(
            this.cameras.main.centerX - 50,
            y + boxHeight / 2,
            'LEVEL',
            headerStyle
        ).setOrigin(0, 0.5);

        const scoreText = this.add.text(
            this.cameras.main.centerX + 50,
            y + boxHeight / 2,
            'SCORE',
            headerStyle
        ).setOrigin(0, 0.5);

        const dateText = this.add.text(
            this.cameras.main.centerX + width / 2 - padding - 10,
            y + boxHeight / 2,
            'DATE',
            headerStyle
        ).setOrigin(1, 0.5);

        // Store the header elements in a container
        this.tableHeader = this.add.container(0, 0, [
            headerGraphics,
            rankText,
            nameText,
            levelText,
            scoreText,
            dateText
        ]);
    }

    createScoreEntry(rank, score, y, width, medalColor, boxHeight = 30) {
        const padding = 20;
        
        // Create container to hold all the elements
        const container = this.add.container(0, y);
        
        // Create row background
        const rowBg = this.add.graphics();
        rowBg.fillStyle(this.COLORS_HEX.BOX_FILL, 0.3);
        rowBg.fillRoundedRect(
            this.cameras.main.centerX - width / 2,
            0,
            width,
            boxHeight,
            8
        );
        
        // Add subtle glow effect for top ranks
        if (rank <= 3) {
            rowBg.lineStyle(2, medalColor, 0.8);
            rowBg.strokeRoundedRect(
                this.cameras.main.centerX - width / 2,
                0,
                width,
                boxHeight,
                8
            );
        }
        
        container.add(rowBg);
        
        // Format date
        const date = new Date(score.timestamp);
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        
        // Get text styles for score entries
        const deviceType = detectDeviceType();
        const entryStyle = getTextStyle('settings', deviceType, this.mode, this.scalingManager.scale);
        const smallEntryStyle = getTextStyle('tooltip', deviceType, this.mode, this.scalingManager.scale);
        
        // Add rank with medal
        const rankText = this.add.text(
            this.cameras.main.centerX - width / 2 + padding + 10,
            boxHeight / 2,
            `${rank}`,
            {
                ...entryStyle,
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5);
        container.add(rankText);
        
        // Add medal icon for top 3 (smaller)
        if (rank <= 3) {
            const medalIcon = this.add.graphics();
            medalIcon.fillStyle(medalColor, 1);
            const medalRadius = 6 * this.scalingManager.scale;
            medalIcon.fillCircle(
                this.cameras.main.centerX - width / 2 + padding + 30, 
                boxHeight / 2,
                medalRadius
            );
            medalIcon.lineStyle(1, 0xffffff, 0.8);
            medalIcon.strokeCircle(
                this.cameras.main.centerX - width / 2 + padding + 30,
                boxHeight / 2,
                medalRadius
            );
            container.add(medalIcon);
        }
        
        // Add username
        const nameText = this.add.text(
            this.cameras.main.centerX - width / 2 + padding + 80,
            boxHeight / 2,
            score.username || "Anonymous Player",
            {
                ...entryStyle,
                color: '#ffffff'
            }
        ).setOrigin(0, 0.5);
        container.add(nameText);
        
        // Add level with special styling
        const levelValue = score.level || 1;
        const levelColor = this.getLevelColor(levelValue);
        const levelText = this.add.text(
            this.cameras.main.centerX - 50,
            boxHeight / 2,
            `${levelValue}`,
            {
                ...entryStyle,
                color: levelColor,
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5);
        container.add(levelText);
        
        // Add score
        const scoreText = this.add.text(
            this.cameras.main.centerX + 50,
            boxHeight / 2,
            `${score.score}`,
            {
                ...entryStyle,
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0, 0.5);
        container.add(scoreText);
        
        // Add date
        const dateText = this.add.text(
            this.cameras.main.centerX + width / 2 - padding - 10,
            boxHeight / 2,
            formattedDate,
            {
                ...smallEntryStyle,
                color: '#cccccc'
            }
        ).setOrigin(1, 0.5);
        container.add(dateText);
        
        // Create invisible hit area for interaction - must be positioned at centerX to overlap with visible elements
        const hitArea = this.add.rectangle(
            this.cameras.main.centerX,
            boxHeight / 2,
            width,
            boxHeight,
            0x000000,
            0
        ).setOrigin(0.5, 0.5);
        
        container.add(hitArea);
        
        // Make hit area interactive
        // Store initial pointer position to detect if this is a click or drag
        let pointerDownY = null;
        
        hitArea.setInteractive()
        .on('pointerover', () => {
            rowBg.clear();
            rowBg.fillStyle(this.COLORS_HEX.BOX_FILL, 0.6);
            rowBg.fillRoundedRect(
                this.cameras.main.centerX - width / 2,
                0,
                width,
                boxHeight,
                8
            );
            if (rank <= 3) {
                rowBg.lineStyle(2, medalColor, 1);
                rowBg.strokeRoundedRect(
                    this.cameras.main.centerX - width / 2,
                    0,
                    width,
                    boxHeight,
                    8
                );
            }
        })
        .on('pointerout', () => {
            rowBg.clear();
            rowBg.fillStyle(this.COLORS_HEX.BOX_FILL, 0.3);
            rowBg.fillRoundedRect(
                this.cameras.main.centerX - width / 2,
                0,
                width,
                boxHeight,
                8
            );
            if (rank <= 3) {
                rowBg.lineStyle(2, medalColor, 0.8);
                rowBg.strokeRoundedRect(
                    this.cameras.main.centerX - width / 2,
                    0,
                    width,
                    boxHeight,
                    8
                );
            }
        })
        .on('pointerdown', (pointer) => {
            pointerDownY = pointer.y;
        })
        .on('pointerup', (pointer) => {
            // Only show details if this was a click, not a drag
            // Allow small movement tolerance (5 pixels)
            if (pointerDownY !== null && Math.abs(pointer.y - pointerDownY) < 5) {
                this.showScoreDetails(score);
            }
            pointerDownY = null;
        });
        
        return container;
    }

    showScoreDetails(score) {
        // Create a modal popup with more score details
        if (this.detailsModal) {
            this.detailsModal.destroy();
        }
        
        const width = this.sys.game.canvas.width * 0.7;
        // Start with a minimum height - will adjust based on content
        let minHeight = this.cameras.main.height * 0.6;
        const x = this.cameras.main.centerX - width / 2;
        // Position from top with margin instead of centering to avoid overflow
        const topMargin = this.scalingManager.scaleValue(40);
        const y = topMargin;
        
        // Container for all modal elements
        this.detailsModal = this.add.container(0, 0);
        this.detailsModal.setDepth(10000); // Ensure modal appears above everything including DONE button
        
        // Add dark overlay
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000, 0.7
        ).setOrigin(0);
        
        // We'll create the background after measuring content
        let modalBg;
        
        // Add title
        const deviceType = detectDeviceType();
        const modalTitleStyle = getTextStyle('prompt', deviceType, this.mode, this.scalingManager.scale);
        
        const titleText = this.add.text(
            this.scalingManager.centerX(),
            y + 30 * this.scalingManager.scale,
            'Score Details',
            {
                ...modalTitleStyle,
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // Format date
        const date = new Date(score.timestamp);
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        console.log("Score: ", score);
        // Create score details content
        const details = [
            { label: "Player:", value: score.username || "Anonymous Player" },
            { label: "Score:", value: score.score },
            { label: "Level:", value: score.level || 1, customColor: this.getLevelColor(score.level || 1) },
            { label: "Prompt:", value: score.prompt || "No prompt available", isLongText: true },
            { label: "Input Text:", value: score.inputText || "No input text available", isLongText: true }
        ];
        
        // Calculate available width for text wrapping
        const textWrapWidth = width - 270; // Space for the value text considering margins
        
        const detailsContainer = this.add.container(0, 0);
        let currentY = y + 100;
        
        const detailTextStyle = getTextStyle('settings', deviceType, this.mode, this.scalingManager.scale);
        
        details.forEach((detail) => {
            // Configure text style with word wrap for value text
            const textStyle = {
                ...detailTextStyle,
                color: detail.customColor || '#ffffff',
                fontStyle: 'bold',
                wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
            };
            
            // Create value text first to measure its height
            const valueText = this.add.text(
                x + 220,
                0, // Temporary y-position, will adjust based on alignment
                detail.value.toString(),
                textStyle
            ).setOrigin(0, 0); // Top-left aligned
            
            // Determine if this will be a multi-line text based on width vs available space
            const isMultiLine = valueText.width > textWrapWidth || detail.isLongText;
            
            // Calculate label Y position based on whether value is multi-line
            const labelY = isMultiLine ? currentY : currentY;
            
            // Create label text
            const labelText = this.add.text(
                x + 50 * this.scalingManager.scale,
                labelY,
                detail.label,
                {
                    ...detailTextStyle,
                    color: '#cccccc'
                }
            ).setOrigin(0, 0); // Top-left aligned to match valueText
            
            // Position value text at the same y as the label (top-aligned)
            valueText.setY(labelY);
            
            detailsContainer.add([labelText, valueText]);
            
            // For both regular and long text fields, spacing is determined by:
            // 1. The height of the value text (to accommodate wrapping)
            // 2. A consistent padding between rows (40px for all fields)
            
            // Get the actual height of the value text (minimum 20px)
            const textHeight = Math.max(valueText.height, 20);
            
            // For all fields, use the text height plus standard spacing
            currentY += textHeight + 20; // 20px consistent padding between all rows
        });
        
        // Calculate the actual height needed based on content
        // Add extra space for the title at the top and close button at the bottom
        const contentHeight = currentY - y;  // currentY now contains the bottom of the content
        const totalHeight = Math.max(minHeight, contentHeight + 120); // 80px for title + bottom padding
        
        // Create modal background with the calculated height
        modalBg = this.add.graphics();
        modalBg.fillStyle(this.COLORS_HEX.BACKGROUND, 0.95);
        modalBg.fillRoundedRect(x, y, width, totalHeight, 16);
        modalBg.lineStyle(3, this.COLORS_HEX.ACCENT, 1);
        modalBg.strokeRoundedRect(x, y, width, totalHeight, 16);
        
        // Add close button at the bottom of the modal
        const closeButton = this.createButton(
            "CLOSE",
            () => {
                this.tweens.add({
                    targets: this.detailsModal,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => this.detailsModal.destroy()
                });
            },
            this.scalingManager.centerX(),
            y + totalHeight - 40 * this.scalingManager.scale // Position from the bottom of the new calculated height
        );
        
        // Add elements to modal container
        this.detailsModal.add([
            overlay,
            modalBg,
            titleText,
            detailsContainer,
            closeButton
        ]);
        
        // Animation for modal appearance
        this.detailsModal.setScale(0.8);
        this.detailsModal.setAlpha(0);
        this.tweens.add({
            targets: this.detailsModal,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.Out'
        });
        
        // Make overlay interactive to close on click outside
        overlay.setInteractive()
            .on('pointerdown', () => {
                this.tweens.add({
                    targets: this.detailsModal,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        if (this.detailsModal) {
                            this.detailsModal.destroy();
                        }
                    }
                });
            });
    }


    
    showTooltip(text, x, y) {
        // Remove existing tooltip if any
        if (this.tooltip) {
            this.tooltip.destroy();
        }
        
        // Create background for tooltip
        const tooltipBg = this.add.graphics();
        tooltipBg.fillStyle(0x000000, 0.8);
        
        // Create text
        const deviceType = detectDeviceType();
        const tooltipStyle = getTextStyle('tooltip', deviceType, this.mode, this.scalingManager.scale);
        
        const tooltipText = this.add.text(0, 0, text, {
            ...tooltipStyle,
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // Size the background based on text
        const padding = 8;
        const width = tooltipText.width + padding * 2;
        const height = tooltipText.height + padding * 2;
        
        // Draw the rounded rectangle for the tooltip
        tooltipBg.fillRoundedRect(-width/2, -height/2, width, height, 6);
        
        // Create container for tooltip
        this.tooltip = this.add.container(x, y - 30, [tooltipBg, tooltipText]);
        this.tooltip.setDepth(1000); // Ensure it's on top
        
        // Animate tooltip appearance
        this.tooltip.setScale(0.8);
        this.tooltip.setAlpha(0);
        this.tweens.add({
            targets: this.tooltip,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: 'Back.Out'
        });
    }
    
    async performCleanup() {
        // Show confirmation dialog
        this.showConfirmationDialog();
    }
    
    showConfirmationDialog() {
        // Create confirmation dialog
        if (this.confirmDialog) {
            this.confirmDialog.destroy();
        }
        
        // Create container for the dialog
        this.confirmDialog = this.add.container(0, 0);
        this.confirmDialog.setDepth(1000);
        
        // Add dark overlay
        const overlay = this.add.rectangle(
            0, 0,
            this.sys.game.canvas.width,
            this.cameras.main.height,
            0x000000, 0.7
        ).setOrigin(0);
        
        // Add dialog background with proper scaling
        const dialogWidth = this.scalingManager.scaleValue(400);
        const dialogHeight = this.scalingManager.scaleValue(200);
        const x = this.cameras.main.centerX - dialogWidth / 2;
        const y = this.cameras.main.centerY - dialogHeight / 2;
        
        const dialogBg = this.add.graphics();
        dialogBg.fillStyle(this.COLORS_HEX.BACKGROUND, 0.95);
        dialogBg.fillRoundedRect(x, y, dialogWidth, dialogHeight, this.scalingManager.scaleValue(16));
        dialogBg.lineStyle(this.scalingManager.scaleValue(3), this.COLORS_HEX.ACCENT, 1);
        dialogBg.strokeRoundedRect(x, y, dialogWidth, dialogHeight, this.scalingManager.scaleValue(16));
        
        // Add title and message
        const deviceType = detectDeviceType();
        const dialogTitleStyle = getTextStyle('prompt', deviceType, this.mode, this.scalingManager.scale);
        const dialogMessageStyle = getTextStyle('settings', deviceType, this.mode, this.scalingManager.scale);
        
        const titleText = this.add.text(
            this.scalingManager.centerX(),
            y + this.scalingManager.scaleValue(40),
            'Confirm Cleanup',
            {
                ...dialogTitleStyle,
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        const messageText = this.add.text(
            this.scalingManager.centerX(),
            y + this.scalingManager.scaleValue(80),
            'This will permanently delete scores that are\nnot in the top 20. Continue?',
            {
                ...dialogMessageStyle,
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5);
        
        // Add buttons
        const cancelButton = this.createButton(
            "CANCEL",
            () => {
                this.tweens.add({
                    targets: this.confirmDialog,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => this.confirmDialog.destroy()
                });
            },
            this.scalingManager.centerX() - this.scalingManager.scaleValue(80),
            y + dialogHeight - this.scalingManager.scaleValue(40)
        );
        
        const confirmButton = this.createButton(
            "CONFIRM",
            async () => {
                // Close dialog
                this.confirmDialog.destroy();
                
                // Show loading indicator
                this.showLoadingIndicator();
                
                try {
                    // Call cleanup function
                    await cleanupOldScores(null, 20);
                    
                    // Reload scores after cleanup
                    await this.loadScores();
                    
                    // Hide loading and show success message
                    this.hideLoadingIndicator();
                    this.showSuccessMessage("Scores cleaned up successfully!");
                    
                    // Refresh display
                    this.displayScores();
                } catch (error) {
                    console.error("Error during cleanup:", error);
                    this.hideLoadingIndicator();
                    this.showErrorMessage("Failed to clean up scores");
                }
            },
            this.scalingManager.centerX() + this.scalingManager.scaleValue(80),
            y + dialogHeight - this.scalingManager.scaleValue(40)
        );
        
        // Make overlay interactive to close on click outside
        overlay.setInteractive()
            .on('pointerdown', () => {
                this.tweens.add({
                    targets: this.confirmDialog,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        if (this.confirmDialog) {
                            this.confirmDialog.destroy();
                        }
                    }
                });
            });
        
        // Add all elements to the container
        this.confirmDialog.add([
            overlay,
            dialogBg,
            titleText,
            messageText,
            cancelButton,
            confirmButton
        ]);
        
        // Animation for dialog appearance
        this.confirmDialog.setScale(0.8);
        this.confirmDialog.setAlpha(0);
        this.tweens.add({
            targets: this.confirmDialog,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.Out'
        });
    }
    
    showSuccessMessage(message) {
        this.showNotification(message, 0x33FF33);
    }
    
    showErrorMessage(message) {
        this.showNotification(message, 0xFF3333);
    }
    
    showNotification(message, color) {
        // Create notification toast
        const padding = this.scalingManager.scaleValue(20);
        const deviceType = detectDeviceType();
        const toastStyle = getTextStyle('settings', deviceType, this.mode, this.scalingManager.scale);
        
        const toastText = this.add.text(
            this.scalingManager.centerX(),
            this.scalingManager.centerY(),
            message,
            {
                ...toastStyle,
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        const width = toastText.width + padding * 2;
        const height = toastText.height + padding * 2;
        
        const toastBg = this.add.graphics();
        toastBg.fillStyle(color, 0.9);
        toastBg.fillRoundedRect(
            this.scalingManager.centerX() - width / 2,
            this.scalingManager.centerY() - height / 2,
            width,
            height,
            this.scalingManager.scaleValue(10)
        );
        
        const toast = this.add.container(0, 0, [toastBg, toastText]);
        toast.setDepth(1000);
        
        // Animate toast
        toast.setAlpha(0);
        toast.setY(this.scalingManager.centerY() + this.scalingManager.scaleValue(50));
        
        this.tweens.add({
            targets: toast,
            alpha: 1,
            y: this.scalingManager.centerY(),
            duration: 300,
            ease: 'Back.Out',
            onComplete: () => {
                // Auto-hide after 2 seconds
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: toast,
                        alpha: 0,
                        y: this.scalingManager.centerY() - this.scalingManager.scaleValue(50),
                        duration: 300,
                        ease: 'Back.In',
                        onComplete: () => toast.destroy()
                    });
                });
            }
        });
    }
    
    createBackButton() {
        // Use scaling manager for responsive positioning
        const bottomMargin = this.scalingManager.scaleValue(20);
        const buttonHeight = this.scalingManager.scaleValue(64); // Estimated button height
        
        // Calculate position based on camera height, not fixed values
        const buttonX = this.scalingManager.centerX();
        
        // Ensure the button is visible by using a percentage of screen height
        // instead of fixed pixels from bottom
        const buttonY = this.scalingManager.heightPercent(92); // Position at 92% of screen height
        
        // Add extra logging for debugging
        console.log("[LeaderboardScene] Device type:", detectDeviceType());
        console.log("[LeaderboardScene] Screen dimensions:", this.cameras.main.width, "x", this.cameras.main.height);
        console.log("[LeaderboardScene] Scaling factor:", this.scalingManager.scale);

        const button = this.createButton(
            "DONE",
            () => this.goBack(),
            buttonX,
            buttonY
        );

        // Ensure button is above everything
        button.setDepth(9999);
        
        // Debug: log button position and visibility
        console.log("[LeaderboardScene] DONE button position:", button.x, button.y, "canvas height:", this.cameras.main.height);

        return button;
    }

    // Helper method to get color based on level
    getLevelColor(level) {
        switch(Number(level)) {
            case 1:
                return '#42f5a1'; // Light green
            case 2:
                return '#42c5f5'; // Light blue
            case 3:
                return '#f542c5'; // Pink
            default:
                return '#ffffff'; // White
        }
    }
    
    createScrollableScoreList(startY, headerHeight, spacing, width, maxEndY) {
        // Calculate scroll area dimensions
        const scrollAreaY = startY + headerHeight + this.scalingManager.scaleValue(10); // Add padding after header
        const scrollAreaHeight = maxEndY - scrollAreaY;
        
        // Calculate total content height
        const totalContentHeight = this.scores.length * spacing;
        
        // Create scroll container positioned at the scroll area
        this.scrollContainer = this.add.container(0, scrollAreaY);
        this.scrollContainer.setDepth(100); // Ensure score entries are above scroll area
        
        // Create a mask to clip the scroll area
        const maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(
            this.scalingManager.centerX() - width / 2 - 10, // Slightly wider for smooth edges
            scrollAreaY,
            width + 20,
            scrollAreaHeight
        );
        
        // Create a geometry mask from the shape
        const mask = maskShape.createGeometryMask();
        
        // Apply mask to scroll container
        this.scrollContainer.setMask(mask);
        
        // Create invisible scroll area for input handling
        const scrollArea = this.add.rectangle(
            this.scalingManager.centerX(),
            scrollAreaY + scrollAreaHeight / 2,
            width,
            scrollAreaHeight,
            0x000000,
            0
        );
        scrollArea.setInteractive();
        
        // Add scroll event handlers
        this.setupScrollHandlers(scrollArea, scrollAreaHeight, totalContentHeight);
        
        // Create score entries - position them relative to container
        this.scores.forEach((score, index) => {
            const y = spacing * index; // Position relative to container
            
            // Calculate medal color
            let medalColor;
            if (index === 0) medalColor = 0xFFD700;      // Gold
            else if (index === 1) medalColor = 0xC0C0C0;  // Silver
            else if (index === 2) medalColor = 0xCD7F32;  // Bronze
            else medalColor = 0x444444;                   // Dark gray
            
            // Create score entry
            const container = this.createScoreEntry(
                index + 1, 
                score, 
                y, 
                width, 
                medalColor, 
                spacing - this.scalingManager.scaleValue(5)
            );
            
            // Add to scroll container
            this.scrollContainer.add(container);
            
            // Add entry animation
            container.setAlpha(0);
            this.tweens.add({
                targets: container,
                alpha: 1,
                duration: 200,
                delay: index * 50,
                ease: 'Power1'
            });
            
            this.leaderboardEntries.push({ score, container });
        });
        
        // Store the initial Y position for scrolling calculations
        this.scrollContainer.setData('baseY', scrollAreaY); // Container starts at scrollAreaY
        this.scrollContainer.setData('scrollAreaY', scrollAreaY);
        
        // Set up scroll bounds
        this.maxScrollY = Math.max(0, totalContentHeight - scrollAreaHeight);
        
        // Add scroll indicators if content overflows
        if (this.maxScrollY > 0) {
            this.createScrollIndicators(startY, headerHeight, width, scrollAreaHeight);
        }
        
        // Store mask for cleanup
        this.scrollMask = mask;
    }
    
    setupScrollHandlers(scrollArea, scrollAreaHeight, totalContentHeight) {
        // Mouse wheel scrolling
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (this.maxScrollY > 0) {
                const scrollSpeed = this.scalingManager.scaleValue(30);
                this.scrollY = Phaser.Math.Clamp(
                    this.scrollY + (deltaY > 0 ? scrollSpeed : -scrollSpeed),
                    0,
                    this.maxScrollY
                );
                this.updateScrollPosition();
            }
        });
        
        // Touch/drag scrolling
        scrollArea.on('pointerdown', (pointer) => {
            this.isDragging = true;
            this.lastPointerY = pointer.y;
        });
        
        this.input.on('pointermove', (pointer) => {
            if (this.isDragging && this.maxScrollY > 0) {
                const deltaY = this.lastPointerY - pointer.y;
                this.scrollY = Phaser.Math.Clamp(
                    this.scrollY + deltaY,
                    0,
                    this.maxScrollY
                );
                this.updateScrollPosition();
                this.lastPointerY = pointer.y;
            }
        });
        
        this.input.on('pointerup', () => {
            this.isDragging = false;
        });
        
        // Handle pointer leaving the game area
        this.input.on('pointerupoutside', () => {
            this.isDragging = false;
        });
    }
    
    updateScrollPosition() {
        if (this.scrollContainer) {
            // Store base Y for reference on first call
            if (!this.scrollContainer.getData('baseY')) {
                this.scrollContainer.setData('baseY', this.scrollContainer.y);
            }
            
            // Update scroll position
            const baseY = this.scrollContainer.getData('baseY');
            this.scrollContainer.setY(baseY - this.scrollY);
            
            // Update scroll indicator
            this.updateScrollIndicator();
        }
    }
    
    createScrollIndicators(startY, headerHeight, width, scrollAreaHeight) {
        const indicatorWidth = this.scalingManager.scaleValue(4);
        const indicatorX = this.scalingManager.centerX() + width / 2 + this.scalingManager.scaleValue(10);
        
        // Adjust track Y to match the actual scroll area
        const scrollAreaY = startY + headerHeight + this.scalingManager.scaleValue(10);
        
        // Scroll track
        const scrollTrack = this.add.graphics();
        scrollTrack.fillStyle(0x444444, 0.3);
        scrollTrack.fillRoundedRect(
            indicatorX - indicatorWidth / 2,
            scrollAreaY,
            indicatorWidth,
            scrollAreaHeight,
            indicatorWidth / 2
        );
        
        // Scroll thumb
        const thumbHeight = Math.max(
            this.scalingManager.scaleValue(20),
            (scrollAreaHeight / (scrollAreaHeight + this.maxScrollY)) * scrollAreaHeight
        );
        
        this.scrollThumb = this.add.graphics();
        this.scrollThumb.fillStyle(0xffffff, 0.6);
        this.scrollThumb.fillRoundedRect(
            indicatorX - indicatorWidth / 2,
            scrollAreaY,
            indicatorWidth,
            thumbHeight,
            indicatorWidth / 2
        );
        
        // Store scroll indicator data
        this.scrollIndicatorData = {
            trackY: scrollAreaY,
            trackHeight: scrollAreaHeight,
            thumbHeight: thumbHeight,
            indicatorX: indicatorX,
            indicatorWidth: indicatorWidth
        };
    }
    
    updateScrollIndicator() {
        if (this.scrollThumb && this.scrollIndicatorData && this.maxScrollY > 0) {
            const { trackY, trackHeight, thumbHeight, indicatorX, indicatorWidth } = this.scrollIndicatorData;
            const scrollProgress = this.scrollY / this.maxScrollY;
            const thumbY = trackY + scrollProgress * (trackHeight - thumbHeight);
            
            this.scrollThumb.clear();
            this.scrollThumb.fillStyle(0xffffff, 0.6);
            this.scrollThumb.fillRoundedRect(
                indicatorX - indicatorWidth / 2,
                thumbY,
                indicatorWidth,
                thumbHeight,
                indicatorWidth / 2
            );
        }
    }

    goBack() {
        // Prepare reset data for game scene, preserving level but resetting progress
        const resetData = {
            progressPercentage: 50, // Reset to initial value
            levelValue: this.levelValue, // Preserve current level
            wordCount: 0,
            originalWordCount: 0,
            aiWordCount: 0,
            totalWordCount: 0,
            requiresReset: true // Flag to indicate this is a reset from LeaderboardScene
        };
        
        if (this.levelValue >= 4){
            this.scene.start('GameOverScene', { ...resetData, mode: this.mode, levelValue: this.levelValue, score: this.score, userResponse: this.userResponse } );
        }
        else {
            // Use unified BaseGameScene with mode parameter
            this.scene.start('BaseGameScene', { ...resetData, mode: this.mode });
        }
    }
}
