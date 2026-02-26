/**
 * Scene Transition Manager for smooth transitions between scenes
 * Provides methods for creating fade transitions and other visual effects
 * Enhanced with arcade-style transition effects
 */
export default class SceneTransitionManager {
    /**
     * Ensure the 'ball' texture exists for particle transitions.
     * @param {Phaser.Scene} scene
     */
    static ensureBallTexture(scene) {
        if (!scene.textures.exists('ball')) {
            const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(16, 16, 16);
            graphics.generateTexture('ball', 32, 32);
            graphics.destroy();
        }
    }
    /**
     * Transition context types for appropriate effect selection
     */
    static CONTEXT = {
        NORMAL: 'normal',          // Standard scene changes
        LEVEL_UP: 'level_up',      // Progressing to higher level
        ACHIEVEMENT: 'achievement', // After earning achievement
        LOW_SCORE: 'low_score',    // After poor performance
        HIGH_SCORE: 'high_score'   // After great performance
    };
    /**
     * Select the appropriate transition based on context
     * @param {Phaser.Scene} fromScene - The current scene
     * @param {string} toSceneKey - Key of the scene to transition to
     * @param {object} sceneData - Data to pass to the next scene
     * @param {string} context - Transition context (use CONTEXT enum)
     * @param {object} options - Additional options for the transition
     */
    static transition(fromScene, toSceneKey, sceneData = {}, context = 'normal', options = {}) {
        console.log(`⭐ Selecting transition for context: ${context}`);
        
        // Default options
        const defaultOptions = {
            duration: 800,
            color: '#000000'
        };
        
        // Merge with provided options
        const transitionOptions = {...defaultOptions, ...options};
        
        // Select transition based on context
        switch (context) {
            case this.CONTEXT.LEVEL_UP:
                return this.radialTransition(fromScene, toSceneKey, sceneData, 
                    transitionOptions.duration, transitionOptions.color);
                
            case this.CONTEXT.ACHIEVEMENT:
                return this.glitchTransition(fromScene, toSceneKey, sceneData, 
                    transitionOptions.duration, transitionOptions.color);
                
            case this.CONTEXT.LOW_SCORE:
                return this.pixelDissolveTransition(fromScene, toSceneKey, sceneData, 
                    transitionOptions.duration, transitionOptions.color, 'dissolve');
                
            case this.CONTEXT.HIGH_SCORE:
                return this.diagonalWipeTransition(fromScene, toSceneKey, sceneData, 
                    transitionOptions.duration, transitionOptions.color);
                
            default:
                // Choose random transition for variety
                const transitions = [
                    this.fadeTransition,
                    this.diagonalWipeTransition,
                    this.radialTransition,
                    this.pixelDissolveTransition
                ];
                const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
                return randomTransition.call(this, fromScene, toSceneKey, sceneData, 
                    transitionOptions.duration, transitionOptions.color);
        }
    }

    /**
     * Create a more dramatic fade transition between scenes
     * @param {Phaser.Scene} fromScene - The current scene
     * @param {string} toSceneKey - Key of the scene to transition to
     * @param {object} sceneData - Data to pass to the next scene
     * @param {number} duration - Transition duration in milliseconds
     * @param {string} color - Fade color (hex string with #)
     */
    static fadeTransition(fromScene, toSceneKey, sceneData = {}, duration = 800, color = '#000000') {
        console.log("⭐ Starting scene transition from", fromScene.scene.key, "to", toSceneKey);

        // Don't allow transition if one is already in progress
        if (fromScene.isTransitioning) {
            console.log("Transition already in progress, aborting");
            return;
        }

        fromScene.isTransitioning = true;

        // Ensure isTransitioning is reset if the scene is shutdown or destroyed
        const resetTransitionFlag = () => {
            fromScene.isTransitioning = false;
            fromScene.events.off('shutdown', resetTransitionFlag);
            fromScene.events.off('destroy', resetTransitionFlag);
        };
        fromScene.events.on('shutdown', resetTransitionFlag);
        fromScene.events.on('destroy', resetTransitionFlag);

        // Create an overlay for the transition that covers everything
        const overlay = fromScene.add.rectangle(
            0, 0,
            fromScene.cameras.main.width,
            fromScene.cameras.main.height,
            Phaser.Display.Color.HexStringToColor(color).color
        ).setOrigin(0).setDepth(9999).setAlpha(0);

        // Add dramatic wipe effect - starts at full width but zero height
        const wipeEffect = fromScene.add.rectangle(
            0, 0,
            fromScene.cameras.main.width,
            0,
            0xffffff
        ).setOrigin(0).setDepth(9998).setAlpha(0.2);

        // First animate the wipe effect downward
        fromScene.tweens.add({
            targets: wipeEffect,
            height: fromScene.cameras.main.height,
            duration: duration / 3,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                // Then fade in the overlay
                fromScene.tweens.add({
                    targets: overlay,
                    alpha: 1,
                    duration: duration / 3,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        // Remove the wipe effect once overlay is visible
                        wipeEffect.destroy();

                        // Start the new scene (replaces old scene and passes data)
                        fromScene.scene.start(toSceneKey, sceneData);
                        resetTransitionFlag();
                        console.log("⭐ Transition complete");
                    }
                });
            }
        });

        // Failsafe: ensure isTransitioning is reset after a timeout
        fromScene.time.delayedCall(duration * 2, () => {
            if (fromScene.isTransitioning) {
                console.warn("Fade transition timeout fallback triggered, forcing immediate scene start");
                resetTransitionFlag();
                fromScene.scene.start(toSceneKey, sceneData);
            }
        });
    }
    
    /**
     * Take a snapshot of the current scene
     * This should be called before starting a transition
     * @param {Phaser.Scene} scene - The scene to snapshot
     */
    static takeSnapshot(scene) {
        return new Promise(resolve => {
            scene.game.renderer.snapshot((snapshot) => {
                // If a previous snapshot exists, destroy it
                if (scene.textures.exists('snapshot')) {
                    scene.textures.remove('snapshot');
                }
                scene.textures.addImage('snapshot', snapshot);
                resolve();
            });
        });
    }

    /**
     * Show a recovery overlay with a reload button if a transition fails.
     * @param {Phaser.Scene} scene - The scene to show the overlay on
     * @param {string} toSceneKey - Key of the scene to transition to (optional)
     * @param {object} sceneData - Data to pass to the next scene (optional)
     */
    static showRecoveryOverlay(scene, toSceneKey, sceneData) {
        // Prevent multiple overlays
        if (scene.recoveryOverlayShown) return;
        scene.recoveryOverlayShown = true;

        // Create a semi-transparent overlay
        const overlay = scene.add.rectangle(
            0, 0,
            scene.cameras.main.width,
            scene.cameras.main.height,
            0x000000,
            0.7
        ).setOrigin(0).setDepth(10000);

        // Add recovery text
        const text = scene.add.text(
            scene.cameras.main.width / 2,
            scene.cameras.main.height / 2 - 40,
            "It looks like the game is stuck.\nClick below to reload.",
            {
                font: "24px Nunito, Arial, sans-serif",
                fill: "#fff",
                align: "center",
                backgroundColor: "rgba(0,0,0,0.0)",
                padding: { x: 16, y: 12 }
            }
        ).setOrigin(0.5).setDepth(10001);

        // Add reload button
        const button = scene.add.rectangle(
            scene.cameras.main.width / 2,
            scene.cameras.main.height / 2 + 30,
            200, 50,
            0xffffff, 1
        ).setOrigin(0.5).setDepth(10001).setInteractive({ useHandCursor: true });

        const buttonText = scene.add.text(
            scene.cameras.main.width / 2,
            scene.cameras.main.height / 2 + 30,
            "Reload Scene",
            {
                font: "22px Nunito, Arial, sans-serif",
                fill: "#000",
                align: "center"
            }
        ).setOrigin(0.5).setDepth(10002);

        button.on("pointerdown", () => {
            // Remove overlay and reload scene
            overlay.destroy();
            text.destroy();
            button.destroy();
            buttonText.destroy();
            scene.recoveryOverlayShown = false;
            // Try to restart the scene or reload the page
            if (toSceneKey) {
                scene.scene.start(toSceneKey, sceneData || {});
            } else {
                window.location.reload();
            }
        });
    }
    
    /**
     * Prepare a scene for transition by taking a snapshot
     * and setting up transition properties
     * @param {Phaser.Scene} scene - The scene to prepare
     */
    static async prepareTransition(scene) {
        console.log("⭐ Preparing scene transition");
        await this.takeSnapshot(scene);
        
        // Small delay to ensure snapshot is created
        return new Promise(resolve => {
            scene.time.delayedCall(50, resolve);
        });
    }
    
    /**
     * Create a diagonal wipe transition between scenes
     * @param {Phaser.Scene} fromScene - The current scene
     * @param {string} toSceneKey - Key of the scene to transition to
     * @param {object} sceneData - Data to pass to the next scene
     * @param {number} duration - Transition duration in milliseconds
     * @param {string} color - Wipe color (hex string with #)
     * @param {number} angle - Angle of the wipe in degrees (default: 45)
     */
    static diagonalWipeTransition(fromScene, toSceneKey, sceneData = {}, duration = 800, color = '#000000', angle = 45) {
        console.log("⭐ Starting diagonal wipe transition from", fromScene.scene.key, "to", toSceneKey);

        // Ensure 'ball' texture exists for particles
        this.ensureBallTexture(fromScene);

        if (fromScene.isTransitioning) {
            console.log("Transition already in progress, aborting");
            return;
        }
        
        fromScene.isTransitioning = true;
        
        // Create an overlay for the final fade
        const overlay = fromScene.add.rectangle(
            0, 0, 
            fromScene.cameras.main.width,
            fromScene.cameras.main.height,
            Phaser.Display.Color.HexStringToColor(color).color
        ).setOrigin(0).setDepth(9999).setAlpha(0);
        
        // Convert angle to radians
        const radians = Phaser.Math.DegToRad(angle);
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        // Calculate diagonal length based on angle
        const width = fromScene.cameras.main.width;
        const height = fromScene.cameras.main.height;
        const diagonalLength = Math.abs(width * cos) + Math.abs(height * sin);
        
        // Create diagonal wipe shape
        const wipeGraphics = fromScene.add.graphics().setDepth(9998);
        
        // Create neon trail effect
        const trailColor = Phaser.Display.Color.HexStringToColor(color).color;
        const neonTrail = fromScene.add.graphics().setDepth(9997);
        
        // Starting position for the wipe
        let progress = -diagonalLength * 0.1; // Start outside screen
        
        // Create particle emitter for edge particles
        const particles = fromScene.add.particles(0, 0, 'ball', {
            lifespan: 300,
            speed: { min: 100, max: 200 },
            scale: { start: 0.1, end: 0 },
            emitting: false,
            blendMode: 'ADD',
            tint: trailColor
        }).setDepth(9996);
        
        // Animation timer for the diagonal wipe
        const wipeTimer = fromScene.time.addEvent({
            delay: 20,
            repeat: Math.ceil(duration * 0.6 / 20),
            callback: () => {
                // Clear previous frame
                wipeGraphics.clear();
                neonTrail.clear();

                // Update progress
                progress += diagonalLength / (duration * 0.6 / 20);

                // Calculate endpoints of the diagonal line
                const x1 = progress * cos < 0 ? 0 : Math.min(progress * cos, width);
                const y1 = progress * sin < 0 ? 0 : Math.min(progress * sin, height);
                const x2 = x1 - height * sin;
                const y2 = y1 + height * cos;

                // Draw main wipe
                wipeGraphics.fillStyle(trailColor, 0.9);
                wipeGraphics.beginPath();
                wipeGraphics.moveTo(0, 0);
                wipeGraphics.lineTo(x1, y1);
                wipeGraphics.lineTo(x2, y2);
                wipeGraphics.lineTo(0, height);
                wipeGraphics.closePath();
                wipeGraphics.fill();

                // Draw neon trail
                neonTrail.lineStyle(6, trailColor, 0.8);
                neonTrail.beginPath();
                neonTrail.moveTo(x1, y1);
                neonTrail.lineTo(x2, y2);
                neonTrail.strokePath();

                // Add glow
                neonTrail.lineStyle(12, trailColor, 0.3);
                neonTrail.beginPath();
                neonTrail.moveTo(x1, y1);
                neonTrail.lineTo(x2, y2);
                neonTrail.strokePath();

                // Position particle emitter along the line
                const emitX = x1 + (x2 - x1) * 0.5;
                const emitY = y1 + (y2 - y1) * 0.5;
                particles.emitParticleAt(emitX, emitY, 5);
            },
            callbackScope: fromScene,
            onComplete: () => {
                // Cleanup wipe graphics
                wipeGraphics.destroy();
                neonTrail.destroy();
                particles.destroy();

                // Fade in full overlay
                fromScene.tweens.add({
                    targets: overlay,
                    alpha: 1,
                    duration: duration * 0.4,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        // Start the new scene (replaces old scene and passes data)
                        fromScene.scene.start(toSceneKey, sceneData);
                        fromScene.isTransitioning = false;
                        console.log("⭐ Diagonal wipe transition complete");
                    }
                });
            }
        });

        // Failsafe: ensure isTransitioning is reset after a timeout
        fromScene.time.delayedCall(duration * 2, () => {
            if (fromScene.isTransitioning) {
                console.warn("Diagonal wipe transition timeout fallback triggered, forcing immediate scene start");
                fromScene.isTransitioning = false;
                fromScene.scene.start(toSceneKey, sceneData);
            }
        });
    }
    
    /**
     * Create a radial/circular transition between scenes
     * @param {Phaser.Scene} fromScene - The current scene
     * @param {string} toSceneKey - Key of the scene to transition to
     * @param {object} sceneData - Data to pass to the next scene
     * @param {number} duration - Transition duration in milliseconds
     * @param {string} color - Transition color (hex string with #)
     * @param {boolean} expand - If true, circle expands; if false, it contracts
     */
    static radialTransition(fromScene, toSceneKey, sceneData = {}, duration = 800, color = '#000000', expand = true) {
        console.log("⭐ Starting radial transition from", fromScene.scene.key, "to", toSceneKey);

        // Ensure 'ball' texture exists for particles
        this.ensureBallTexture(fromScene);

        if (fromScene.isTransitioning) {
            console.log("Transition already in progress, aborting");
            return;
        }

        fromScene.isTransitioning = true;

        // Ensure isTransitioning is reset if the scene is shutdown or destroyed
        const resetTransitionFlag = () => {
            fromScene.isTransitioning = false;
            fromScene.events.off('shutdown', resetTransitionFlag);
            fromScene.events.off('destroy', resetTransitionFlag);
        };
        fromScene.events.on('shutdown', resetTransitionFlag);
        fromScene.events.on('destroy', resetTransitionFlag);

        try {
            // Create an overlay for the final state
            const overlay = fromScene.add.rectangle(
                0, 0,
                fromScene.cameras.main.width,
                fromScene.cameras.main.height,
                Phaser.Display.Color.HexStringToColor(color).color
            ).setOrigin(0).setDepth(9999).setAlpha(expand ? 0 : 1);

            // Center coordinates
            const centerX = fromScene.cameras.main.width / 2;
            const centerY = fromScene.cameras.main.height / 2;

            // Calculate max radius needed to cover screen
            const maxRadius = Math.sqrt(
                Math.pow(Math.max(centerX, fromScene.cameras.main.width - centerX), 2) +
                Math.pow(Math.max(centerY, fromScene.cameras.main.height - centerY), 2)
            );

            // Create radial mask
            const maskGraphics = fromScene.add.graphics().setDepth(9998);

            // Initial radius
            const startRadius = expand ? 0 : maxRadius;
            const endRadius = expand ? maxRadius : 0;

            // Create particle emitters for the circle edge
            const circleParticles = fromScene.add.particles(centerX, centerY, 'ball', {
                lifespan: 300,
                speed: { min: 50, max: 100 },
                scale: { start: 0.1, end: 0 },
                emitting: false,
                blendMode: 'ADD',
                tint: Phaser.Display.Color.HexStringToColor(color).color
            }).setDepth(9997);

            // Animate the circle
            fromScene.tweens.add({
                targets: { radius: startRadius },
                radius: endRadius,
                duration: duration * 0.7,
                ease: 'Cubic.easeInOut',
                onUpdate: (tween, target) => {
                    // Clear previous frame
                    maskGraphics.clear();

                    // Draw circle mask
                    if (expand) {
                        // For expansion, fill outside the circle
                        maskGraphics.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
                        maskGraphics.fillRect(0, 0, fromScene.cameras.main.width, fromScene.cameras.main.height);
                        maskGraphics.fillStyle(0x000000, 0);
                        maskGraphics.setBlendMode(Phaser.BlendModes.ERASE);
                        maskGraphics.fillCircle(centerX, centerY, target.radius);
                        maskGraphics.setBlendMode(Phaser.BlendModes.NORMAL);
                    } else {
                        // For contraction, fill inside the circle
                        maskGraphics.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1);
                        maskGraphics.fillCircle(centerX, centerY, target.radius);
                    }

                    // Emit particles along the circle edge
                    if (fromScene.textures.exists('ball')) {
                        const particleCount = Math.ceil(target.radius / 20);
                        for (let i = 0; i < particleCount; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const x = centerX + Math.cos(angle) * target.radius;
                            const y = centerY + Math.sin(angle) * target.radius;
                            circleParticles.emitParticleAt(x, y, 1);
                        }
                    }
                },
                onComplete: () => {
                    // Clean up graphics
                    maskGraphics.destroy();
                    circleParticles.destroy();

                    if (expand) {
                        // If expanding, set overlay to full alpha
                        fromScene.tweens.add({
                            targets: overlay,
                            alpha: 1,
                            duration: duration * 0.3,
                            onComplete: completeTransition
                        });
                    } else {
                        completeTransition();
                    }

                    function completeTransition() {
                        // Start the new scene (replaces old scene and passes data)
                        fromScene.scene.start(toSceneKey, sceneData);
                        resetTransitionFlag();
                        console.log("⭐ Radial transition complete");
                    }
                }
            });

            // Fallback: ensure isTransitioning is reset after a timeout (failsafe)
            fromScene.time.delayedCall(duration * 2, () => {
                if (fromScene.isTransitioning) {
                    console.warn("Transition timeout fallback triggered, resetting isTransitioning");
                    resetTransitionFlag();
                    if (typeof this.showRecoveryOverlay === "function") {
                        this.showRecoveryOverlay(fromScene, toSceneKey, sceneData);
                    }
                }
            });
        } catch (err) {
            console.error("Error during radial transition:", err);
            resetTransitionFlag();
        }
    }
    
    /**
     * Create a pixel dissolve transition between scenes
     * @param {Phaser.Scene} fromScene - The current scene
     * @param {string} toSceneKey - Key of the scene to transition to
     * @param {object} sceneData - Data to pass to the next scene
     * @param {number} duration - Transition duration in milliseconds
     * @param {string} color - Transition color (hex string with #)
     * @param {string} pattern - Dissolve pattern: 'random', 'spiral', 'grid'
     */
    static pixelDissolveTransition(fromScene, toSceneKey, sceneData = {}, duration = 800, color = '#000000', pattern = 'random') {
        console.log("⭐ Starting pixel dissolve transition from", fromScene.scene.key, "to", toSceneKey);

        if (fromScene.isTransitioning) {
            console.log("Transition already in progress, aborting");
            return;
        }

        fromScene.isTransitioning = true;

        // Ensure isTransitioning is reset if the scene is shutdown or destroyed
        const resetTransitionFlag = () => {
            fromScene.isTransitioning = false;
            fromScene.events.off('shutdown', resetTransitionFlag);
            fromScene.events.off('destroy', resetTransitionFlag);
        };
        fromScene.events.on('shutdown', resetTransitionFlag);
        fromScene.events.on('destroy', resetTransitionFlag);

        try {
            // Create a base overlay
            const overlay = fromScene.add.rectangle(
                0, 0,
                fromScene.cameras.main.width,
                fromScene.cameras.main.height,
                Phaser.Display.Color.HexStringToColor(color).color
            ).setOrigin(0).setDepth(9999).setAlpha(0);

            // Create pixel blocks
            const blockSize = 20;
            const cols = Math.ceil(fromScene.cameras.main.width / blockSize);
            const rows = Math.ceil(fromScene.cameras.main.height / blockSize);
            const totalBlocks = cols * rows;

            const blocks = [];
            const pixelContainer = fromScene.add.container(0, 0).setDepth(9998);

            // Create all pixel blocks
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const block = fromScene.add.rectangle(
                        col * blockSize,
                        row * blockSize,
                        blockSize,
                        blockSize,
                        Phaser.Display.Color.HexStringToColor(color).color
                    ).setOrigin(0);

                    blocks.push({
                        block,
                        row,
                        col,
                        index: row * cols + col
                    });

                    pixelContainer.add(block);
                }
            }

            // Generate order of blocks to animate based on pattern
            let blockOrder;

            switch (pattern) {
                case 'spiral':
                    blockOrder = this.getSpiralOrder(blocks, rows, cols);
                    break;
                case 'grid':
                    blockOrder = blocks.sort((a, b) =>
                        Math.abs(a.row - rows/2) + Math.abs(a.col - cols/2) -
                        (Math.abs(b.row - rows/2) + Math.abs(b.col - cols/2))
                    );
                    break;
                default: // random
                    blockOrder = Phaser.Utils.Array.Shuffle([...blocks]);
            }

            // Timing for block appearances
            const blockDuration = duration * 0.7 / totalBlocks;

            // Animate blocks sequentially
            blockOrder.forEach((blockData, index) => {
                blockData.block.setAlpha(0);

                fromScene.tweens.add({
                    targets: blockData.block,
                    alpha: 1,
                    duration: Math.max(blockDuration * 3, 30), // Ensure minimum duration for stability
                    ease: 'Cubic.easeIn',
                    delay: index * (duration * 0.7 / totalBlocks),
                    onComplete: () => {
                        // When all blocks have appeared, transition to the next scene
                        if (index === blockOrder.length - 1) {
                            // Fade to full overlay
                            fromScene.tweens.add({
                                targets: overlay,
                                alpha: 1,
                                duration: duration * 0.3,
                                onComplete: () => {
                                    // Clean up all pixel blocks
                                    pixelContainer.destroy();

                                    // Start the new scene (replaces old scene and passes data)
                                    fromScene.scene.start(toSceneKey, sceneData);
                                    resetTransitionFlag();
                                    console.log("⭐ Pixel dissolve transition complete");
                                }
                            });
                        }
                    }
                });
            });

            // Failsafe: ensure isTransitioning is reset after a timeout
            fromScene.time.delayedCall(duration * 2, () => {
                if (fromScene.isTransitioning) {
                    console.warn("Pixel dissolve transition timeout fallback triggered, resetting isTransitioning");
                    resetTransitionFlag();
                    if (typeof this.showRecoveryOverlay === "function") {
                        this.showRecoveryOverlay(fromScene, toSceneKey, sceneData);
                    }
                }
            });
        } catch (err) {
            console.error("Error during pixel dissolve transition:", err);
            resetTransitionFlag();
        }
    }
    
    /**
     * Helper method to get spiral ordering of blocks
     */
    static getSpiralOrder(blocks, rows, cols) {
        const result = [];
        const visited = Array(rows).fill().map(() => Array(cols).fill(false));
        
        // Spiral directions: right, down, left, up
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        let direction = 0;
        
        let row = 0, col = 0;
        for (let i = 0; i < rows * cols; i++) {
            // Find the block at this position
            const block = blocks.find(b => b.row === row && b.col === col);
            if (block) result.push(block);
            
            visited[row][col] = true;
            
            // Calculate next position
            let nextRow = row + directions[direction][0];
            let nextCol = col + directions[direction][1];
            
            // Change direction if needed
            if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols || visited[nextRow][nextCol]) {
                direction = (direction + 1) % 4;
                nextRow = row + directions[direction][0];
                nextCol = col + directions[direction][1];
            }
            
            row = nextRow;
            col = nextCol;
        }
        
        return result;
    }
    
    /**
     * Create a glitch transition between scenes
     * @param {Phaser.Scene} fromScene - The current scene
     * @param {string} toSceneKey - Key of the scene to transition to
     * @param {object} sceneData - Data to pass to the next scene
     * @param {number} duration - Transition duration in milliseconds
     * @param {string} color - Transition color (hex string with #)
     * @param {number} intensity - Glitch intensity (1-10)
     */
    static glitchTransition(fromScene, toSceneKey, sceneData = {}, duration = 800, color = '#000000', intensity = 5) {
        console.log("⭐ Starting glitch transition from", fromScene.scene.key, "to", toSceneKey);
        
        if (fromScene.isTransitioning) {
            console.log("Transition already in progress, aborting");
            return;
        }
        
        fromScene.isTransitioning = true;
        
        // Take screenshot for glitch effect
        this.takeSnapshot(fromScene).then(() => {
            // Create base overlay
            const overlay = fromScene.add.rectangle(
                0, 0, 
                fromScene.cameras.main.width,
                fromScene.cameras.main.height,
                Phaser.Display.Color.HexStringToColor(color).color
            ).setOrigin(0).setDepth(9999).setAlpha(0);
            
            // Create glitch slices container
            const sliceContainer = fromScene.add.container(0, 0).setDepth(9998);
            
            // Glitch parameters
            const sliceHeight = 20;
            const slices = Math.ceil(fromScene.cameras.main.height / sliceHeight);
            const maxOffset = intensity * 10;
            const glitchDuration = duration * 0.7;
            
            // Create all slices from the snapshot
            for (let i = 0; i < slices; i++) {
                const y = i * sliceHeight;
                const slice = fromScene.add.image(
                    0, y, 'snapshot'
                ).setOrigin(0);
                
                // Set crop to only show this slice
                slice.setCrop(0, y, fromScene.cameras.main.width, sliceHeight);
                
                sliceContainer.add(slice);
            }
            
            // Handle glitch animation
            const glitchAnimation = () => {
                // Reset positions
                sliceContainer.getAll().forEach((slice, index) => {
                    slice.x = 0;
                    
                    // Random color shift on some slices
                    if (Math.random() < 0.3) {
                        const rgb = Phaser.Display.Color.HSLToColor(
                            Math.random(), 0.7, 0.5
                        ).color;
                        slice.setTint(rgb);
                    } else {
                        slice.clearTint();
                    }
                    
                    // Random horizontal offset
                    if (Math.random() < 0.4) {
                        const offset = Phaser.Math.Between(-maxOffset, maxOffset);
                        slice.x = offset;
                    }
                });
            };
            
            // Start glitch loop
            const glitchInterval = 100; // ms between glitches
            const glitchTimer = fromScene.time.addEvent({
                delay: glitchInterval,
                callback: glitchAnimation,
                callbackScope: fromScene,
                repeat: Math.floor(glitchDuration / glitchInterval)
            });
            
            // After glitch effect completes, fade to next scene
            fromScene.time.delayedCall(glitchDuration, () => {
                glitchTimer.remove();
                
                // Fade in overlay
                fromScene.tweens.add({
                    targets: overlay,
                    alpha: 1,
                    duration: duration * 0.3,
                    onComplete: () => {
                        // Clean up glitch container
                        sliceContainer.destroy();
                        
                        // Start the new scene (replaces old scene and passes data)
                        fromScene.scene.start(toSceneKey, sceneData);
                        fromScene.isTransitioning = false;
                        console.log("⭐ Glitch transition complete");
                    }
                });
            });
        });
    }
    
    /**
     * Perform a scene transition with snapshot effect
     * @param {Phaser.Scene} fromScene - Current scene
     * @param {string} toSceneKey - Key of target scene
     * @param {object} sceneData - Data to pass to new scene
     * @param {number} duration - Transition duration
     */
    static async transitionWithSnapshot(fromScene, toSceneKey, sceneData = {}, duration = 800) {
        await this.prepareTransition(fromScene);
        this.transition(fromScene, toSceneKey, sceneData, this.CONTEXT.NORMAL, { duration });
    }
}
