/**
 * BadgeGenerator - Dynamically generates badge images in the browser using Canvas API
 * This replaces the pre-generated badges with real-time badge creation using user text
 */

import { EASY_COLORS_HEX, EASY_COLORS_TEXT, HARD_COLORS_HEX, HARD_COLORS_TEXT } from '../config/design.js';

export class BadgeGenerator {
    // Badge text options - same as original generator
    static badgeTexts = [
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

    /**
     * Generate a dynamic badge texture with user's text
     * @param {Phaser.Scene} scene - The Phaser scene instance
     * @param {string} userText - The user's written text to display on badge
     * @param {string} mode - Game mode ('easy' or 'hard')
     * @param {number} score - The score to display (0-15)
     * @returns {string} The texture key for the generated badge
     */
    static async generate(scene, userText, mode, score) {
        console.log('[BadgeGenerator] Starting badge generation', { userText, mode, score });
        
        // Ensure barcade3d font is loaded before drawing
        try {
            await document.fonts.load('68px barcade3d');
            console.log('[BadgeGenerator] barcade3d font loaded successfully');
        } catch (error) {
            console.warn('[BadgeGenerator] Failed to load barcade3d font, will use fallback:', error);
        }
        
        // Badge constraints - width and height both scale
        const BASE_WIDTH = 600;
        const MAX_WIDTH = 1000;
        const BASE_HEIGHT = 550;
        const MAX_HEIGHT = 1200;
        const padding = 24;
        
        // Calculate required width and height for text
        let currentWidth = BASE_WIDTH;
        let currentHeight = BASE_HEIGHT;
        let finalUserText = userText;
        
        // Initial available height for user text (based on BASE_HEIGHT layout)
        let availableTextHeight = 92; // Starting with 2 lines * 46px
        let textFits = false;
        
        // Phase 1: Try progressively wider badges until text fits or we hit max width
        while (!textFits && currentWidth <= MAX_WIDTH) {
            const availableTextWidth = currentWidth - (padding * 4);
            const result = this.measureTextFit(userText, availableTextWidth, availableTextHeight);
            
            if (result.fits) {
                textFits = true;
                finalUserText = result.text;
            } else {
                currentWidth += 100; // Increase width by 100px increments
            }
        }
        
        // Phase 2: If text still doesn't fit at max width, try increasing height
        if (!textFits && currentHeight < MAX_HEIGHT) {
            currentWidth = MAX_WIDTH; // Lock width at maximum
            
            // Increase height and available text space
            while (!textFits && currentHeight <= MAX_HEIGHT) {
                // Calculate how much extra space we have for text
                const extraHeight = currentHeight - BASE_HEIGHT;
                availableTextHeight = 92 + extraHeight; // Original 92px plus extra space
                
                const availableTextWidth = currentWidth - (padding * 4);
                const result = this.measureTextFit(userText, availableTextWidth, availableTextHeight);
                
                if (result.fits) {
                    textFits = true;
                    finalUserText = result.text;
                } else {
                    currentHeight += 50; // Increase height by 50px increments
                }
            }
        }
        
        // Force truncation only if still doesn't fit at max width AND max height
        if (!textFits) {
            currentWidth = MAX_WIDTH;
            currentHeight = MAX_HEIGHT;
            const availableTextWidth = currentWidth - (padding * 4);
            const extraHeight = currentHeight - BASE_HEIGHT;
            availableTextHeight = 92 + extraHeight;
            finalUserText = this.truncateText(userText, availableTextWidth, availableTextHeight);
        }
        
        // Create canvas texture with calculated dimensions
        const textureKey = 'dynamicBadge_' + Date.now(); // Unique key
        console.log('[BadgeGenerator] Creating canvas:', { width: currentWidth, height: currentHeight });
        
        const canvas = scene.textures.createCanvas(textureKey, currentWidth, currentHeight);
        const ctx = canvas.getContext();
        
        if (!ctx) {
            console.error('[BadgeGenerator] Failed to get canvas context');
            return null;
        }
        
        // Get colors based on mode
        const colorsHex = mode === 'easy' ? EASY_COLORS_HEX : HARD_COLORS_HEX;
        const colorsText = mode === 'easy' ? EASY_COLORS_TEXT : HARD_COLORS_TEXT;
        
        console.log('[BadgeGenerator] Colors:', { colorsHex, colorsText });
        
        // Set background
        const bgColor = `#${colorsHex.BACKGROUND.toString(16).padStart(6, '0')}`;
        console.log('[BadgeGenerator] Drawing background:', bgColor);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, currentWidth, currentHeight);
        
        // Draw badge outline
        const outlineColor = `#${colorsHex.BOX_OUTLINE.toString(16).padStart(6, '0')}`;
        console.log('[BadgeGenerator] Drawing outline:', outlineColor);
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 5;
        ctx.strokeRect(padding, padding, currentWidth - padding * 2, currentHeight - padding * 2);
        
        // Draw title - use barcade3d font to match game style
        console.log('[BadgeGenerator] Drawing title with barcade3d font');
        
        // Check if font is actually ready
        const fontReady = document.fonts.check('68px barcade3d');
        console.log('[BadgeGenerator] Font ready check:', fontReady);
        
        ctx.fillStyle = colorsText.TITLE;
        // Increased font size from 58px to 68px
        ctx.font = '68px barcade3d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Verify the font was applied
        console.log('[BadgeGenerator] Canvas font set to:', ctx.font);
        
        ctx.fillText('(NONSLOP)', currentWidth / 2, 85);
        
        // Draw score - larger font with more spacing from title
        console.log('[BadgeGenerator] Drawing score:', score);
        ctx.fillStyle = colorsText.PRIMARY;
        ctx.font = '42px monospace, "IBM Plex Mono"';
        ctx.fillText(`SCORE: ${score}/15`, currentWidth / 2, 165); // Moved from 150 to 165
        
        // Select and draw random badge text (like original badges)
        const randomBadgeText = this.badgeTexts[Math.floor(Math.random() * this.badgeTexts.length)];
        console.log('[BadgeGenerator] Drawing random badge text:', randomBadgeText);
        let yPosition = 220; // Moved down from 200 for more space
        
        // Draw badge text - larger font with proper wrapping
        ctx.fillStyle = '#ffffff';
        ctx.font = '28px monospace, "IBM Plex Mono"';
        const badgeLines = randomBadgeText.split('\n');
        
        // Wrap each line if it's too long
        badgeLines.forEach(line => {
            // Check if line needs wrapping
            const maxLineWidth = currentWidth - (padding * 4);
            const lineMetrics = ctx.measureText(line);
            
            if (lineMetrics.width > maxLineWidth) {
                // Wrap this line
                const words = line.split(' ');
                let wrappedLine = '';
                
                words.forEach((word, index) => {
                    const testLine = wrappedLine + word + ' ';
                    const testMetrics = ctx.measureText(testLine);
                    
                    if (testMetrics.width > maxLineWidth && wrappedLine !== '') {
                        // Draw current line and start new one
                        ctx.fillText(wrappedLine.trim(), currentWidth / 2, yPosition);
                        yPosition += 40;
                        wrappedLine = word + ' ';
                    } else {
                        wrappedLine = testLine;
                    }
                });
                
                // Draw remaining text
                if (wrappedLine.trim() !== '') {
                    ctx.fillText(wrappedLine.trim(), currentWidth / 2, yPosition);
                    yPosition += 40;
                }
            } else {
                // Line fits, draw it normally
                ctx.fillText(line, currentWidth / 2, yPosition);
                yPosition += 40;
            }
        });
        
        // Add separator line with more spacing
        console.log('[BadgeGenerator] Drawing separator at y:', yPosition);
        yPosition += 25;
        ctx.strokeStyle = colorsText.PRIMARY;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(padding + 40, yPosition);
        ctx.lineTo(currentWidth - padding - 40, yPosition);
        ctx.stroke();
        yPosition += 30;
        
        // Draw user's text directly (removed "YOUR RESPONSE:" label to save space)
        console.log('[BadgeGenerator] Drawing user text:', finalUserText.substring(0, 50) + '...');
        console.log('[BadgeGenerator] Text color:', colorsText.PRIMARY);
        console.log('[BadgeGenerator] Text position y:', yPosition);
        console.log('[BadgeGenerator] Max width for text:', currentWidth - padding * 4);
        
        const userTextHeight = this.drawWrappedText(
            ctx,
            finalUserText,
            currentWidth / 2,
            yPosition,
            currentWidth - padding * 4, // Max width with padding
            colorsText.PRIMARY,
            true, // Return the height
            '38px' // Increased font size
        );
        console.log('[BadgeGenerator] User text height:', userTextHeight);
        console.log('[BadgeGenerator] Text drawing complete');
        
        // Refresh the canvas to apply all drawings
        console.log('[BadgeGenerator] Refreshing canvas');
        canvas.refresh();
        
        console.log('[BadgeGenerator] Badge generation complete, texture key:', textureKey);
        return textureKey;
    }
    
    /**
     * Measure if text fits within given dimensions
     * @private
     * @returns {object} { fits: boolean, text: string }
     */
    static measureTextFit(text, maxWidth, maxHeight) {
        // Create a temporary canvas to measure text
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        ctx.font = '34px monospace, "IBM Plex Mono"'; // Match increased font size
        
        const lineHeight = 46; // Match increased line height
        const maxLines = Math.floor(maxHeight / lineHeight);
        
        const words = text.split(' ');
        let line = '';
        let lineCount = 0;
        let fitsCompletely = true;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                lineCount++;
                if (lineCount >= maxLines) {
                    fitsCompletely = false;
                    break;
                }
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        
        // Account for the last line
        if (line.trim() !== '') {
            lineCount++;
        }
        
        return {
            fits: fitsCompletely && lineCount <= maxLines,
            text: text
        };
    }
    
    /**
     * Truncate text to fit within dimensions, adding "..."
     * @private
     * @returns {string} Truncated text with ellipsis
     */
    static truncateText(text, maxWidth, maxHeight) {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        ctx.font = '34px monospace, "IBM Plex Mono"'; // Match increased font size
        
        const lineHeight = 46; // Match increased line height
        const maxLines = Math.floor(maxHeight / lineHeight);
        
        const words = text.split(' ');
        let result = [];
        let currentLine = '';
        let lineCount = 0;
        
        for (let i = 0; i < words.length && lineCount < maxLines; i++) {
            const testLine = currentLine + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                result.push(currentLine.trim());
                currentLine = words[i] + ' ';
                lineCount++;
            } else {
                currentLine = testLine;
            }
        }
        
        // Handle the last line
        if (lineCount < maxLines && currentLine.trim() !== '') {
            result.push(currentLine.trim());
        } else if (lineCount >= maxLines) {
            // Truncate last line and add ellipsis
            const lastLine = result[result.length - 1] || currentLine.trim();
            const ellipsis = '...';
            
            // Keep removing words until "..." fits
            let truncatedLine = lastLine;
            while (ctx.measureText(truncatedLine + ellipsis).width > maxWidth && truncatedLine.length > 0) {
                const words = truncatedLine.split(' ');
                words.pop();
                truncatedLine = words.join(' ');
            }
            
            if (result.length > 0) {
                result[result.length - 1] = truncatedLine + ellipsis;
            } else {
                result.push(truncatedLine + ellipsis);
            }
        }
        
        return result.join(' ');
    }
    
    /**
     * Draw text with automatic word wrapping
     * @private
     * @param {boolean} returnHeight - If true, returns the total height of the drawn text
     * @param {string} fontSize - Font size to use (e.g., '34px')
     */
    static drawWrappedText(ctx, text, x, y, maxWidth, color, returnHeight = false, fontSize = '34px') {
        ctx.fillStyle = color;
        ctx.font = `${fontSize} monospace, "IBM Plex Mono"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Split text into words
        const words = text.split(' ');
        let line = '';
        let lineY = y;
        const lineHeight = 46; // Increased from 38 to 46 to match larger font
        // No hardcoded maxLines - text will be drawn as needed (already truncated by measureTextFit/truncateText)
        let lineCount = 0;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && i > 0) {
                // Line is too long, draw it and start new line
                ctx.fillText(line.trim(), x, lineY);
                line = words[i] + ' ';
                lineY += lineHeight;
                lineCount++;
            } else {
                line = testLine;
            }
        }
        
        // Draw the last line
        if (line.trim() !== '') {
            ctx.fillText(line.trim(), x, lineY);
            lineCount++;
        }
        
        // Return height if requested
        if (returnHeight) {
            return lineCount * lineHeight;
        }
    }
    
    
    /**
     * Convert a canvas texture to a data URL for downloading
     * @param {Phaser.Scene} scene - The Phaser scene instance
     * @param {string} textureKey - The texture key to convert
     * @returns {string} Data URL of the badge image
     */
    static toDataURL(scene, textureKey) {
        try {
            const canvas = scene.textures.get(textureKey).getSourceImage();
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Error converting badge to data URL:', error);
            return null;
        }
    }
}
