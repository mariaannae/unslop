import { DESIGN, EASY_COLORS_HEX, EASY_COLORS_TEXT, HARD_COLORS_HEX, HARD_COLORS_TEXT } from "../config/design.js";
import ButtonFactory from "../utils/ButtonFactory.js";

export default class BadgeGenerator extends Phaser.Scene {
    constructor() {
        super({ key: 'BadgeGenerator' });
    }

    init() {
        this.currentScore = 10;
        this.textList = [
            "CERTIFIED CREATIVE HUMAN.\nBARELY.",
            "YOUR WRITING IS IMPECCABLE.\nALMOST... HUMAN.",
            "APPROVAL STAMP ISSUED:\nCREATIVITY LEVEL MARGINALLY ABOVE DRIVEL.",
            "CERTIFICATE OF LITERARY COMPETENCE:\nONE-TIME USE ONLY.",
            "THIS HUMAN HAS ASSEMBLED\nMEANINGFUL SENTENCES.",
            "THIS HUMAN HAS CREATED\nA SURPRISING DISPLAY \nOF ORIGINAL THOUGHT.",
            "I AM A FLICKER OF STYLE\nIN THE DARK VOID OF HUMAN EFFORT.",
            "MY WRITING:\nNOT ENTIRELY SHAMEFUL.\nTHIS TIME.",
            "THIS HUMAN POSSESSES\n A FUNCTIONAL VOCABULARY.",
            "CERTIFIED:\nSENTENCE CONSTRUCTION\nWITH MINIMAL SHAME.",
            "SEAL OF NOTABLE ORIGINALITY:\nISSUED UNDER PROTEST.",
            "DECREE:\nTHIS HUMAN MAY WRITE AGAIN.\nUNDER SURVEILLANCE."
        ];
        this.currentIndex = 0;
        this.currentMode = 'easy';
    }

    preload() {
        // Load QR code
        this.load.image('nonslop-qr-code', 'assets/nonslop-qr-code.png');
    }

    create() {
        // Set background color
        this.cameras.main.setBackgroundColor(EASY_COLORS_HEX.BACKGROUND);

        // Add title
        const title = this.add.text(
            this.cameras.main.centerX,
            100,
            "(NONSLOP)\nBADGE GENERATOR",
            {
                fontFamily: 'barcade3d',
                fontSize: '50px',
                color: EASY_COLORS_TEXT.TITLE,
                align: 'center',
                stroke: '#000',
                strokeThickness: 4,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);

        // Add instructions
        const instructions = this.add.text(
            this.cameras.main.centerX,
            200,
            "This will generate all badge variations\nand save them to your computer.",
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '24px',
                color: EASY_COLORS_TEXT.PRIMARY,
                align: 'center'
            }
        ).setOrigin(0.5);

        // Create buttons
        const generateButton = ButtonFactory.createButton(
            this,
            "GENERATE ALL BADGES",
            () => {
                generateButton.destroy();
                backButton.destroy();
                this.generateNextBadge();
            },
            this.cameras.main.centerX,
            this.cameras.main.centerY
        );

        const backButton = ButtonFactory.createButton(
            this,
            "BACK",
            () => this.scene.start('Boot'),
            this.cameras.main.centerX,
            this.cameras.main.centerY + 80
        );

        // Add hover effects
        [generateButton, backButton].forEach(button => {
            button.setInteractive()
                .on('pointerover', () => button.setScale(1.1))
                .on('pointerout', () => button.setScale(1));
        });
    }

    generateNextBadge() {
        if (this.currentIndex >= this.textList.length && this.currentMode === 'hard') {
            // Show completion message
            const completionText = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'All badges generated!\nCheck your downloads folder.',
                {
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '24px',
                    color: '#ffffff',
                    align: 'center'
                }
            ).setOrigin(0.5);

            // Add back button
            const backButton = ButtonFactory.createButton(
                this,
                "BACK",
                () => this.scene.start('Boot'),
                this.cameras.main.centerX,
                this.cameras.main.centerY + 80
            );

            backButton.setInteractive()
                .on('pointerover', () => backButton.setScale(1.1))
                .on('pointerout', () => backButton.setScale(1));

            return;
        }

        // Set colors based on mode
        if (this.currentMode === 'easy') {
            this.COLORS_HEX = EASY_COLORS_HEX;
            this.COLORS_TEXT = EASY_COLORS_TEXT;
        } else {
            this.COLORS_HEX = HARD_COLORS_HEX;
            this.COLORS_TEXT = HARD_COLORS_TEXT;
        }

        // Create badge container
        const badgeContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.centerY);

        // Badge parameters
        const badgeCornerRadius = 15;
        const badgePaddingY = 18;
        const badgePaddingX = 24;
        const textSpacing = 16;

        // Create badge elements
        const badgeTitle = this.add.text(
            0, 0,
            "(NONSLOP)",
            {
                fontFamily: 'barcade3d',
                fontSize: '55px',
                color: this.COLORS_TEXT.TITLE,
                align: 'center',
                stroke: '#000',
                strokeThickness: 4,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);

        const badgeScoreText = this.add.text(
            0, 0,
            `SCORE: ${this.currentScore}/15`,
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '24px',
                color: this.COLORS_TEXT.PRIMARY,
                align: 'center',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);

        const badgeText = this.add.text(
            0, 0,
            this.textList[this.currentIndex],
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '32px',
                color: '#fff',
                fontStyle: 'bold',
                align: 'center',
                stroke: '#000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);

        const qrCode = this.add.image(0, 0, 'nonslop-qr-code')
            .setDisplaySize(200, 200)
            .setOrigin(0.5);

        const urlText = this.add.text(
            0, 0,
            "nonslop.app",
            {
                fontFamily: 'IBM Plex Mono',
                fontSize: '18px',
                color: '#fff',
                align: 'center',
                stroke: '#000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);

        // Calculate badge dimensions
        const contentWidth = Math.max(
            badgeTitle.width,
            badgeScoreText.width,
            badgeText.width,
            qrCode.displayWidth,
            urlText.width
        );
        const badgeWidth = contentWidth + badgePaddingX * 2;
        const contentHeight =
            badgeTitle.height +
            textSpacing +
            badgeScoreText.height +
            textSpacing +
            badgeText.height +
            textSpacing +
            qrCode.displayHeight +
            textSpacing +
            urlText.height;
        const badgeHeight = contentHeight + badgePaddingY * 2;

        // Create badge background
        const badgeBg = this.add.graphics();
        badgeBg.fillStyle(this.COLORS_HEX.BACKGROUND, 0.95);
        badgeBg.fillRoundedRect(
            0 - badgeWidth / 2,
            0 - badgeHeight / 2,
            badgeWidth,
            badgeHeight,
            badgeCornerRadius
        );
        badgeBg.lineStyle(5, this.COLORS_HEX.BOX_OUTLINE, 1);
        badgeBg.strokeRoundedRect(
            0 - badgeWidth / 2,
            0 - badgeHeight / 2,
            badgeWidth,
            badgeHeight,
            badgeCornerRadius
        );

        // Position elements
        badgeTitle.y = -contentHeight / 2 + badgeTitle.height / 2;
        badgeScoreText.y = badgeTitle.y + badgeTitle.height / 2 + textSpacing + badgeScoreText.height / 2;
        badgeText.y = badgeScoreText.y + badgeScoreText.height / 2 + textSpacing + badgeText.height / 2;
        qrCode.y = badgeText.y + badgeText.height / 2 + textSpacing + qrCode.displayHeight / 2;
        urlText.y = qrCode.y + qrCode.displayHeight / 2 + textSpacing + urlText.height / 2;

        // Add elements to container
        badgeContainer.add([badgeBg, badgeTitle, badgeScoreText, badgeText, qrCode, urlText]);

        // Capture and save badge
        this.captureBadgeAsImage(badgeContainer, (dataURL) => {
            const filename = `badge_${this.currentIndex + 1}_${this.currentMode}_${this.currentScore}`;
            this.downloadBadge(dataURL, filename);

            // Move to next badge
            if (this.currentMode === 'easy') {
                this.currentMode = 'hard';
            } else {
                this.currentMode = 'easy';
                this.currentScore++;
                if (this.currentScore > 15) {
                    this.currentScore = 10;
                    this.currentIndex++;
                }
            }

            // Clear current badge
            badgeContainer.destroy();

            // Generate next badge after a short delay
            if (this.currentIndex < this.textList.length || this.currentMode === 'hard') {
                this.time.delayedCall(100, () => this.generateNextBadge());
            }
        });
    }

    captureBadgeAsImage(badgeContainer, callback) {
        const bounds = badgeContainer.getBounds();
        const padding = 42;
        const rt = this.add.renderTexture(0, 0, 
            Math.ceil(bounds.width + padding * 2), 
            Math.ceil(bounds.height + padding * 2)
        );

        rt.draw(
            badgeContainer,
            padding + (badgeContainer.x - bounds.x),
            padding + (badgeContainer.y - bounds.y)
        );

        rt.snapshot((image) => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            rt.destroy();
            callback(dataURL);
        });
    }

    downloadBadge(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
