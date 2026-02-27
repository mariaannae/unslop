import { THEME, COLORS_HEX, COLORS_TEXT, DESIGN } from "../config/design.js";
import { createBackground } from "../backgrounds/createBackground.js";
import { ScalingManager } from "../config/scaling.js";
import { getTextStyle } from "../config/textStyles.js";
import { detectDeviceType } from "../config/dimensions.js";
import ButtonFactory from "../utils/ButtonFactory.js";
import { BadgeGenerator } from "../utils/BadgeGenerator.js";

// Scene layout constants
const SCENE_LAYOUT = {
  // Distance from top of canvas to center of title text
  titleTopOffset: {
    percent: 10   // percentage of canvas height to title center
  },
  // Spacing from bottom edge of title to top edge of subtitle
  titleToSubtitleSpacing: 8,  // px from title bottom to subtitle top
  // Spacing from bottom edge of subtitle to top edge of badge
  subtitleToBadgeSpacing: 20,  // px from subtitle bottom to badge top
  // Spacing from badge bottom to first action button (COPY LINK)
  badgeToButtonSpacing: {
    desktop: 15,  // px from badge bottom to COPY LINK button on desktop
    mobile: 25    // px from badge bottom to COPY LINK button on mobile
  },
  // Spacing between action buttons
  actionButtonSpacing: {
    desktop: 20,  // px between action buttons on desktop
    mobile: 30    // px between action buttons on mobile
  },
  // Spacing between badge action buttons (SAVE/COPY)
  badgeButtonHorizontalSpacing: {
    desktop: 80,  // px horizontal spacing between SAVE and COPY badge buttons
    mobile: 80    // px horizontal spacing between SAVE and COPY badge buttons
  },
  // Spacing from PLAY AGAIN button to celebrate text
  playAgainToCelebrateSpacing: {
    desktop: 85,  // px from bottom of PLAY AGAIN to top of celebrate text on desktop
    mobile: 130   // px from bottom of PLAY AGAIN to top of celebrate text on mobile
  },
  // Spacing from social buttons to celebrate text
  socialToCelebrateSpacing: {
    desktop: 20,  // px from top of social buttons to bottom of celebrate text on desktop
    mobile: 35    // px from top of social buttons to bottom of celebrate text on mobile
  },
  // Stripe padding
  stripePadding: {
    top: 15,      // px padding above celebrate text
    bottom: 15    // px padding below social buttons
  }
};

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.levelValue = data.levelValue || 1;
    this.score = data.score || 0;
    this.userResponse = data.userResponse || data.userInput || ''; // Receive user text
    this.COLORS_HEX = COLORS_HEX;
    this.COLORS_TEXT = COLORS_TEXT;
  }

  async getBadgeTextureKey() {
    // Generate dynamic badge and return its texture key
    return await BadgeGenerator.generate(
      this,
      this.userResponse,
      this.mode,
      this.score
    );
  }

  showSharingInstructions(platform) {
    const instructions = {
      'instagram': 'Share to Instagram Stories and tag us!',
      'threads': 'Share on Threads with your thoughts!',
      'tiktok': 'Create a TikTok with your badge!'
    };
    
    this.showToast(instructions[platform] || 'Share your badge!');
  }

  showToast(message) {
    // Remove any existing toast
    if (this.toastText) {
      this.toastText.destroy();
    }
    const toastStyle = {
      fontFamily: 'IBM Plex Mono',
      fontSize: '28px',
      color: this.COLORS_TEXT.PRIMARY,
      backgroundColor: this.COLORS_TEXT.BLACK,
      padding: { x: 24, y: 12 },
      align: 'center',
      stroke: this.COLORS_TEXT.BLACK,
      strokeThickness: 4,
      fixedWidth: this.sys.game.canvas.width * 0.8,
      wordWrap: { width: this.sys.game.canvas.width * 0.8 }
    };
    this.toastText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 80,
      message,
      toastStyle
    ).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      duration: 2000,
      delay: 2500,
      onComplete: () => {
        if (this.toastText) {
          this.toastText.destroy();
          this.toastText = null;
        }
      }
    });
  }

  async create() {

    console.log("GameOverScene create", this.mode, this.levelValue, this.score, this.userResponse)
    // Initialize scaling manager
    this.scalingManager = new ScalingManager(this);
    
    // Use global UI scale for all elements
    this.uiScale = this.registry.get('uiScale') || 1;
    
    // Get device type
    this.deviceType = detectDeviceType();

    // Background
    createBackground(this, THEME.background, this.levelValue);

    // Heading - using consistent scaling patterns from Preloader
    const titleY = this.scalingManager.heightPercent(SCENE_LAYOUT.titleTopOffset.percent);
    const titleStyle = getTextStyle('title', this.deviceType, this.mode, this.uiScale);
    titleStyle.align = 'center';
    
    const titleText = this.add.text(
      this.scalingManager.centerX(),
      titleY,
      '(CONGRATULATIONS)',
      titleStyle
    ).setOrigin(0.5);

    // Calculate final scale for mobile but don't apply it yet - let animation handle it
    let finalScale = 1;
    if (this.deviceType === "phone") {
      const maxWidth = this.scalingManager.widthPercent(90); // 90% of screen width
      if (titleText.width > maxWidth) {
        finalScale = maxWidth / titleText.width;
        // Don't apply the scale here - let the animation handle it
      }
    }

    // Subtitle with proper spacing using ScalingManager
    // titleText.y is the center of the title (origin 0.5), so add half the height to get bottom edge
    const subtitleY = titleText.y + titleText.height/2 + this.scalingManager.scaleValue(SCENE_LAYOUT.titleToSubtitleSpacing);
    const subtitleStyle = getTextStyle('prompt', this.deviceType, this.mode, this.uiScale);
    subtitleStyle.align = 'center';
    subtitleStyle.wordWrap = { width: this.scalingManager.widthPercent(85) };
    
    const subtitleText = this.add.text(
      this.scalingManager.centerX(),
      subtitleY,
      "This conversation can serve no purpose anymore. Goodbye.",
      subtitleStyle
    ).setOrigin(0.5, 0);

    // Badge placement - using ScalingManager for consistent sizing
    // Generate dynamic badge with user text (await since it's now async)
    const badgeTextureKey = await this.getBadgeTextureKey();
    
    // Store the texture key for later use in save/copy buttons
    this.badgeTextureKey = badgeTextureKey;
    
    // Use scaling manager for consistent spacing
    const badgeY = subtitleText.y + subtitleText.displayHeight + this.scalingManager.scaleValue(SCENE_LAYOUT.subtitleToBadgeSpacing);
    
    // Add badge image
    const badge = this.add.image(
      this.scalingManager.centerX(),
      badgeY,
      badgeTextureKey
    ).setOrigin(0.5, 0);
    
    // Scale badge using ScalingManager approach - consistent with other scenes
    // Use heightPercent for responsive badge sizing instead of hardcoded fraction
    const desiredHeight = this.scalingManager.heightPercent(35); 
    if (badge.height > 0) {
      const scale = this.scalingManager.scaleValue(desiredHeight) / badge.height;
      badge.setScale(scale);
    } else {
      // If not loaded yet, set scale after texture loads
      badge.once('texturekeychange', () => {
        const scale = this.scalingManager.scaleValue(desiredHeight) / badge.height;
        badge.setScale(scale);
      });
    }


    // Calculate button dimensions for proper edge-to-edge spacing
    const cameraWidth = this.cameras.main.width;
    let buttonHeight;
    if (this.scalingManager) {
      const buttonWidth = this.scalingManager.buttonWidth(cameraWidth);
      buttonHeight = this.scalingManager.buttonHeight(buttonWidth);
    } else {
      buttonHeight = 60; // fallback height
    }
    // Reduce button height for desktop only (by 25% to match ButtonFactory)
    if (this.deviceType !== "phone") {
      buttonHeight = Math.round(buttonHeight * 0.75);
    }

    // Action buttons - positioned closer to badge
    const badgeToButtonSpacing = this.deviceType === "phone" 
      ? SCENE_LAYOUT.badgeToButtonSpacing.mobile 
      : SCENE_LAYOUT.badgeToButtonSpacing.desktop;
    
    // Calculate from bottom edge of badge to top edge of COPY LINK button
    const badgeBottomEdge = badge.y + badge.displayHeight;
    const copyLinkY = badgeBottomEdge + this.scalingManager.scaleValue(badgeToButtonSpacing) + buttonHeight / 2;

    // COPY LINK button
    const copyLinkButton = ButtonFactory.createButton(
      this,
      "COPY LINK",
      () => {
        const gameUrl = window.location.origin || gameAddress;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(gameUrl).then(() => {
            this.showToast("Game link copied to clipboard!");
          }).catch(() => {
            this.showToast("Failed to copy link.");
          });
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = gameUrl;
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            this.showToast("Game link copied to clipboard!");
          } catch {
            this.showToast("Failed to copy link.");
          }
          document.body.removeChild(textarea);
        }
      },
      this.scalingManager.centerX(),
      copyLinkY,
      { 
        depth: 10,
        scalingManager: this.scalingManager
      }
    );

    // Badge action buttons - positioned below COPY LINK
    const actionButtonSpacing = this.deviceType === "phone" 
      ? SCENE_LAYOUT.actionButtonSpacing.mobile 
      : SCENE_LAYOUT.actionButtonSpacing.desktop;
    
    // Calculate from bottom edge of COPY LINK button to top edge of badge buttons
    const copyLinkBottomEdge = copyLinkY + buttonHeight / 2;
    const badgeButtonsY = copyLinkBottomEdge + this.scalingManager.scaleValue(actionButtonSpacing) + buttonHeight / 2;
    
    // Spacing between badge buttons (SAVE and COPY)
    const badgeButtonHorizontalSpacing = this.scalingManager.scaleValue(
      this.deviceType === "phone" 
        ? SCENE_LAYOUT.badgeButtonHorizontalSpacing.mobile 
        : SCENE_LAYOUT.badgeButtonHorizontalSpacing.desktop
    );
    
    // SAVE BADGE button
    const saveBadgeButton = ButtonFactory.createButton(
      this,
      "SAVE BADGE",
      async () => {
        // Get the data URL from the dynamic badge
        const badgeDataURL = BadgeGenerator.toDataURL(this, this.badgeTextureKey);
        if (!badgeDataURL) {
          this.showToast("Failed to generate badge image");
          return;
        }
        
        try {
          // Check if on iOS Safari specifically
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          const isIOSSafari = isIOS && isSafari;
          
          // Check if on any mobile device
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          if (isIOSSafari) {
            // iOS Safari specific approach: Create a simple HTML page with just the image
            const imagePageHTML = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <title>Save Your Badge</title>
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    background: #000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  }
                  img {
                    max-width: 90%;
                    max-height: 70vh;
                    display: block;
                    margin: 0 auto;
                  }
                  .instructions {
                    color: white;
                    text-align: center;
                    margin-top: 20px;
                    font-size: 18px;
                    line-height: 1.5;
                  }
                  .highlight {
                    background: #333;
                    padding: 2px 6px;
                    border-radius: 4px;
                  }
                </style>
              </head>
              <body>
                <img src="${badgeDataURL}" alt="unslop Badge">
                <div class="instructions">
                  <p>To save to Photos:</p>
                  <p>1. <span class="highlight">Press and hold</span> the image above</p>
                  <p>2. Select <span class="highlight">Save Image</span></p>
                </div>
              </body>
              </html>
            `;
            
            // Open the HTML in a new tab
            const newWindow = window.open('', '_blank');
            newWindow.document.write(imagePageHTML);
            newWindow.document.close();
            
            this.showToast("Press and hold the image, then select 'Save Image'");
            
          } else if (isMobileDevice) {
            // Other mobile devices: Try Web Share API first
            if (navigator.share) {
              try {
                // Convert data URL to blob
                const response = await fetch(badgeDataURL);
                const blob = await response.blob();
                
                // Try sharing without canShare check (some browsers don't implement it)
                const file = new File([blob], `unslop-badge-${this.score}.png`, { type: 'image/png' });
                const shareData = {
                  files: [file],
                  title: 'My unslop Badge',
                  text: `I scored ${this.score} on ${this.mode} mode!`
                };
                
                await navigator.share(shareData);
                this.showToast("Choose 'Save Image' to save to Photos!");
                return;
              } catch (shareError) {
                console.log('Web Share API failed:', shareError);
                // Continue to fallback
              }
            }
            
            // Fallback for mobile: Open image in new tab
            const newWindow = window.open('', '_blank');
            newWindow.document.write(`<img src="${badgeDataURL}" alt="Badge" />`);
            newWindow.document.close();
            this.showToast("Long press the image and select 'Save Image' to save to Photos!");
            
          } else {
            // Desktop approach: Use download with data URL
            const a = document.createElement('a');
            a.href = badgeDataURL;
            a.download = `unslop-badge-${this.score}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.showToast("Badge downloaded!");
          }
          
        } catch (error) {
          console.error('Failed to save badge:', error);
          this.showToast("Failed to save badge");
        }
      },
      this.scalingManager.centerX() - badgeButtonHorizontalSpacing,
      badgeButtonsY,
      { 
        depth: 10,
        scalingManager: this.scalingManager
      }
    );

    // COPY BADGE button
    const copyBadgeButton = ButtonFactory.createButton(
      this,
      "COPY BADGE",
      async () => {
        try {
          // Get the data URL from the dynamic badge
          const badgeDataURL = BadgeGenerator.toDataURL(this, this.badgeTextureKey);
          if (!badgeDataURL) {
            this.showToast("Failed to generate badge image");
            return;
          }
          
          // Check if on iOS Safari specifically
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          const isIOSSafari = isIOS && isSafari;
          
          // Check if on any mobile device
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          if (isIOSSafari) {
            // iOS Safari: Open image in new tab with copy instructions
            const imagePageHTML = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <title>Copy Your Badge</title>
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    background: #000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  }
                  img {
                    max-width: 90%;
                    max-height: 70vh;
                    display: block;
                    margin: 0 auto;
                  }
                  .instructions {
                    color: white;
                    text-align: center;
                    margin-top: 20px;
                    font-size: 18px;
                    line-height: 1.5;
                  }
                  .highlight {
                    background: #333;
                    padding: 2px 6px;
                    border-radius: 4px;
                  }
                </style>
              </head>
              <body>
                <img src="${badgeDataURL}" alt="unslop Badge">
                <div class="instructions">
                  <p>To copy this image:</p>
                  <p>1. <span class="highlight">Press and hold</span> the image above</p>
                  <p>2. Select <span class="highlight">Copy</span></p>
                  <p>3. You can now paste it anywhere!</p>
                </div>
              </body>
              </html>
            `;
            
            // Open the HTML in a new tab
            const newWindow = window.open('', '_blank');
            newWindow.document.write(imagePageHTML);
            newWindow.document.close();
            
            this.showToast("Press and hold the image, then select 'Copy'");
            
          } else if (isMobileDevice) {
            // Other mobile devices: Try Web Share API first
            if (navigator.share) {
              try {
                // Convert data URL to blob
                const response = await fetch(badgeDataURL);
                const blob = await response.blob();
                const file = new File([blob], `unslop-badge-${this.score}.png`, { type: 'image/png' });
                
                // Try sharing without canShare check (some browsers don't implement it)
                const shareData = {
                  files: [file],
                  title: 'My unslop Badge',
                  text: `I scored ${this.score} on ${this.mode} mode!`
                };
                
                await navigator.share(shareData);
                this.showToast("Choose where to share your badge!");
                return;
              } catch (shareError) {
                console.log('Web Share API failed:', shareError);
                // Continue to fallback
              }
            }
            
            // Fallback for mobile: Open in new tab
            const newWindow = window.open('', '_blank');
            newWindow.document.write(`<img src="${badgeDataURL}" alt="Badge" />`);
            newWindow.document.close();
            this.showToast("Long press the image and select 'Copy'");
            
          } else {
            // Desktop: Try clipboard API for images first
            try {
              // Convert data URL to blob
              const response = await fetch(badgeDataURL);
              const blob = await response.blob();
              
              if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
                try {
                  const item = new ClipboardItem({ 'image/png': blob });
                  await navigator.clipboard.write([item]);
                  this.showToast("Badge image copied to clipboard!");
                  return;
                } catch (clipboardError) {
                  console.log('Clipboard API failed:', clipboardError);
                }
              }
              
              // Fallback: Open in new tab
              const newWindow = window.open('', '_blank');
              newWindow.document.write(`<img src="${badgeDataURL}" alt="Badge" />`);
              newWindow.document.close();
              this.showToast("Badge opened in new tab");
            } catch (error) {
              console.error('Failed to process badge:', error);
              // Final fallback
              const newWindow = window.open('', '_blank');
              newWindow.document.write(`<img src="${badgeDataURL}" alt="Badge" />`);
              newWindow.document.close();
              this.showToast("Badge opened in new tab");
            }
          }
          
        } catch (error) {
          console.error('Failed to copy badge:', error);
          this.showToast("Failed to copy badge");
        }
      },
      this.scalingManager.centerX() + badgeButtonHorizontalSpacing,
      badgeButtonsY,
      { 
        depth: 10,
        scalingManager: this.scalingManager
      }
    );

    // PLAY AGAIN button - on its own row below the badge buttons
    const playAgainY = badgeButtonsY + buttonHeight + this.scalingManager.scaleValue(actionButtonSpacing);
    
    const playAgainButton = ButtonFactory.createButton(
      this,
      "PLAY AGAIN",
      () => {
        this.scene.start('LevelScene');
      },
      this.scalingManager.centerX(),
      playAgainY,
      { 
        depth: 10,
        scalingManager: this.scalingManager
      }
    );

    // Calculate the bottom edge of PLAY AGAIN button for spacing check
    const playAgainBottomEdge = playAgainY + buttonHeight / 2;

    // Social share buttons - positioned at bottom of screen
    const gameAddress = "unslop.app";
    const socialPlatforms = [
      { 
        key: "facebook", 
        deepLink: "fb://profile/",
        appStoreUrl: "https://apps.apple.com/app/facebook/id284882215",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.facebook.katana",
        webUrl: "https://www.facebook.com/"
      },
      { 
        key: "instagram", 
        deepLink: "instagram://user?username=",
        appStoreUrl: "https://apps.apple.com/app/instagram/id389801252",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.instagram.android",
        webUrl: "https://www.instagram.com/"
      },
      { 
        key: "threads", 
        deepLink: "barcelona://",
        appStoreUrl: "https://apps.apple.com/app/threads/id6446901002",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.instagram.barcelona",
        webUrl: "https://www.threads.net/"
      },
      { 
        key: "x", 
        deepLink: "twitter://",
        appStoreUrl: "https://apps.apple.com/app/x/id333903271",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.twitter.android",
        webUrl: "https://x.com/"
      },
      { 
        key: "tiktok", 
        deepLink: "tiktok://",
        appStoreUrl: "https://apps.apple.com/app/tiktok/id835599320",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.ss.android.ugc.trill",
        webUrl: "https://www.tiktok.com/"
      },
      { 
        key: "snapchat", 
        deepLink: "snapchat://",
        appStoreUrl: "https://apps.apple.com/app/snapchat/id447188370",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.snapchat.android",
        webUrl: "https://www.snapchat.com/"
      },
      { 
        key: "bluesky", 
        deepLink: null, // No official deep link yet
        appStoreUrl: "https://apps.apple.com/app/bluesky-social/id6444370199",
        playStoreUrl: "https://play.google.com/store/apps/details?id=xyz.blueskyweb.app",
        webUrl: "https://bsky.app/"
      },
      { 
        key: "linkedin", 
        deepLink: "linkedin://",
        appStoreUrl: "https://apps.apple.com/app/linkedin/id288429040",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.linkedin.android",
        webUrl: "https://www.linkedin.com/"
      },
      { 
        key: "email", 
        deepLink: "mailto:",
        appStoreUrl: null,
        playStoreUrl: null,
        webUrl: "mailto:"
      }
    ];

    // Smart link handler for opening native apps or fallback
    const openSocialApp = async (platform) => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;
      
      // Get badge info
      const badgeDataURL = BadgeGenerator.toDataURL(this, this.badgeTextureKey);
      const shareText = `Would you like to play a game? Try unslop 🎮`;
      const shareUrl = gameAddress;
      
      // Special handling for email
      if (platform.key === 'email') {
        const subject = encodeURIComponent(`Would you like to play a game?`);
        const body = encodeURIComponent(`${shareText}\n\nPlay at: ${shareUrl}\n\nMy badge: ${fullBadgeUrl}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        return;
      }
      
      // For mobile devices, try Web Share API first (can include images)
      if (isMobile && navigator.share && badgeDataURL) {
        try {
          // Convert data URL to blob
          const response = await fetch(badgeDataURL);
          const blob = await response.blob();
          const file = new File([blob], `unslop-badge-${this.score}.png`, { type: 'image/png' });
          
          const shareData = {
            title: 'My unslop Badge',
            text: shareText,
            url: shareUrl,
            files: [file]
          };
          
          // Check if we can share files
          if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
          } else {
            // Try without files
            await navigator.share({
              title: 'My unslop Badge',
              text: shareText,
              url: shareUrl
            });
            return;
          }
        } catch (err) {
          console.log('Web Share API failed:', err);
          // Fall through to platform-specific sharing
        }
      }
      
      // Platform-specific share URLs with pre-filled content
      let shareLink;
      let showBadgeInstructions = false;
      
      switch (platform.key) {
        case 'facebook':
          // Facebook share dialog - can only share links, not images
          shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
          showBadgeInstructions = true;
          break;
          
        case 'x':
          // X (Twitter) - pre-fill tweet text
          shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
          showBadgeInstructions = true;
          break;
          
        case 'linkedin':
          // LinkedIn share - can only share links
          shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
          showBadgeInstructions = true;
          break;
          
        case 'threads':
          // Threads - pre-fill text only
          shareLink = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
          showBadgeInstructions = true;
          break;
          
        case 'bluesky':
          // Bluesky - pre-fill text only
          shareLink = `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
          showBadgeInstructions = true;
          break;
          
        default:
          // For Instagram, TikTok, Snapchat - no direct share URLs available
          shareLink = platform.webUrl;
          showBadgeInstructions = true;
      }
      
      // Show instructions for all platforms since none support direct image sharing
      if (showBadgeInstructions) {
        this.showToast(`Copy or save your badge first to share the image!`);
      }
      
      window.open(shareLink, '_blank', 'noopener,noreferrer');
    };

    // Increase button size for mobile for better touch targets
    const buttonSize = this.deviceType === "phone" 
      ? this.scalingManager.scaleValue(60)  // Larger size for mobile
      : this.scalingManager.scaleValue(40); // Keep original size for desktop
    const spacing = this.scalingManager.scaleValue(12);
    
    // Position celebrate text relative to PLAY AGAIN button
    const playAgainToCelebrateSpacing = this.deviceType === "phone" 
      ? SCENE_LAYOUT.playAgainToCelebrateSpacing.mobile 
      : SCENE_LAYOUT.playAgainToCelebrateSpacing.desktop;
    
    // Calculate celebrate text position from PLAY AGAIN button
    const celebrateY = playAgainBottomEdge + this.scalingManager.scaleValue(playAgainToCelebrateSpacing);
    
    // Calculate social buttons position based on celebrate text
    const socialToCelebrateSpacing = this.deviceType === "phone" 
      ? SCENE_LAYOUT.socialToCelebrateSpacing.mobile 
      : SCENE_LAYOUT.socialToCelebrateSpacing.desktop;
    
    const isMobile = this.deviceType === "phone";
    let socialY;
    let socialButtonsBottomEdge;
    
    // Position social buttons below celebrate text
    socialY = celebrateY + this.scalingManager.scaleValue(socialToCelebrateSpacing) + buttonSize / 2;
    
    if (isMobile) {
      // Two rows for mobile - calculate bottom edge
      socialButtonsBottomEdge = socialY + buttonSize / 2 + buttonSize + spacing;
    } else {
      // Single row for desktop
      socialButtonsBottomEdge = socialY + buttonSize / 2;
    }
    const celebrateStyle = getTextStyle('prompt', this.deviceType, this.mode, this.uiScale);
    celebrateStyle.align = 'center';
    
    const celebrateText = this.add.text(
      this.scalingManager.centerX(),
      celebrateY,
      "Celebrate adequacy.\nPublicly:",
      celebrateStyle
    ).setOrigin(0.5, 1).setDepth(10); // Origin at bottom to position from bottom edge

    // Create social buttons with consistent scaling
    const socialButtons = [];
    const platformTooltips = {
      facebook: "Share on Facebook",
      instagram: "Share on Instagram", 
      threads: "Share on Threads",
      x: "Share on X (Twitter)",
      tiktok: "Share on TikTok",
      snapchat: "Share on Snapchat",
      bluesky: "Share on Bluesky",
      linkedin: "Share on LinkedIn",
      email: "Share via Email"
    };

    // Position social buttons in a grid layout for mobile, single row for desktop
    if (isMobile) {
      // Two rows for mobile
      const buttonsPerRow = Math.ceil(socialPlatforms.length / 2);
      socialPlatforms.forEach((platform, i) => {
        const row = Math.floor(i / buttonsPerRow);
        const col = i % buttonsPerRow;
        const rowWidth = Math.min(buttonsPerRow, socialPlatforms.length - row * buttonsPerRow) * buttonSize + 
                        (Math.min(buttonsPerRow, socialPlatforms.length - row * buttonsPerRow) - 1) * spacing;
        const startX = this.scalingManager.centerX() - rowWidth / 2 + buttonSize / 2;
        
        const btn = this.add.image(
          startX + col * (buttonSize + spacing),
          socialY + row * (buttonSize + spacing),
          platform.key
        )
        .setDisplaySize(buttonSize, buttonSize)
        .setInteractive({ useHandCursor: true })
        .setDepth(10)
        .setTint(0xffffff);

        // Add visual feedback
        btn.on('pointerdown', () => {
          btn.setTint(0xcccccc); // Darken on press
        });
        
        btn.on('pointerup', () => {
          btn.setTint(0xffffff); // Restore color
          openSocialApp(platform); // Use the smart link handler
        });
        
        btn.on('pointerout', () => {
          btn.setTint(0xffffff); // Restore if pointer leaves
        });

        socialButtons.push(btn);
      });
    } else {
      // Single row for desktop
      const totalWidth = socialPlatforms.length * buttonSize + (socialPlatforms.length - 1) * spacing;
      const startX = this.scalingManager.centerX() - totalWidth / 2 + buttonSize / 2;
      
      socialPlatforms.forEach((platform, i) => {
        const btn = this.add.image(
          startX + i * (buttonSize + spacing),
          socialY,
          platform.key
        )
        .setDisplaySize(buttonSize, buttonSize)
        .setInteractive({ useHandCursor: true })
        .setDepth(10)
        .setTint(0xffffff);

        // Add tooltip for desktop
        let tooltip = null;
        btn.on('pointerover', () => {
          tooltip = this.add.text(
            btn.x,
            btn.y - buttonSize / 2 - this.scalingManager.scaleValue(18),
            platformTooltips[platform.key] || platform.key,
            {
              fontFamily: 'IBM Plex Mono',
              fontSize: this.scalingManager.scaleText(20) + 'px',
              color: this.COLORS_TEXT.PRIMARY,
              backgroundColor: this.COLORS_TEXT.BLACK,
              padding: { 
                x: this.scalingManager.scaleValue(12), 
                y: this.scalingManager.scaleValue(6) 
              },
              align: 'center',
              stroke: this.COLORS_TEXT.BLACK,
              strokeThickness: this.scalingManager.scaleValue(3)
            }
          ).setOrigin(0.5).setDepth(1001);
        });
        
        btn.on('pointerout', () => {
          if (tooltip) {
            tooltip.destroy();
            tooltip = null;
          }
          btn.setTint(0xffffff); // Restore color when pointer leaves
        });

        // Add visual feedback
        btn.on('pointerdown', () => {
          btn.setTint(0xcccccc); // Darken on press
        });
        
        btn.on('pointerup', () => {
          btn.setTint(0xffffff); // Restore color
          openSocialApp(platform); // Use the smart link handler
        });

        socialButtons.push(btn);
      });
    }

    // Add stripe behind celebrate text and social buttons
    // Calculate stripe dimensions dynamically based on actual layout
    const stripeTopPadding = this.scalingManager.scaleValue(SCENE_LAYOUT.stripePadding.top);
    const stripeBottomPadding = this.scalingManager.scaleValue(SCENE_LAYOUT.stripePadding.bottom);
    
    // Calculate stripe Y position and height - extend to bottom of screen
    const stripeY = celebrateText.y - celebrateText.displayHeight - stripeTopPadding;
    const stripeHeight = this.cameras.main.height - stripeY;
    
    // Get colors from design config
    const boxFillColor = this.COLORS_HEX.BACKGROUND//DESIGN[this.mode.toUpperCase()].COLORS.BOX_FILL;
    const boxOutlineColor = this.COLORS_HEX.ACCENT;
    const outlineWidth = DESIGN.UI.OUTLINE.WIDTH;
    
    // Create the stripe graphics
    const stripe = this.add.graphics();
    
    // Draw the fill
    stripe.fillStyle(boxFillColor, 1);
    stripe.fillRect(0, stripeY, this.cameras.main.width, stripeHeight);
    
    // Draw the outline (top border only - no bottom border)
    stripe.lineStyle(outlineWidth, boxOutlineColor, 1);
    stripe.beginPath();
    stripe.moveTo(0, stripeY);
    stripe.lineTo(this.cameras.main.width, stripeY);
    stripe.strokePath();
    
    // Set depth to be behind text and buttons but above background
    stripe.setDepth(5);

    // Add hover effects to buttons
    [copyLinkButton, saveBadgeButton, copyBadgeButton, playAgainButton].forEach(button => {
      button.setInteractive()
        .on('pointerover', () => button.setScale(1.1))
        .on('pointerout', () => button.setScale(1));
    });

    // Add title pop effect animation - full effect on both desktop and mobile
    this.time.delayedCall(10, () => {
      const screenWidth = this.sys.game.canvas.width;
      const targetWidth = (7 / 8) * screenWidth;
      
      // Calculate the maximum expansion scale that still fits on screen
      const maxExpandScale = targetWidth / titleText.width;
      
      // Use a generous expansion scale for the pop effect
      const expandScale = Math.min(maxExpandScale, 1.3); // Allow up to 130% expansion
      
      this.tweens.add({
        targets: titleText,
        scale: expandScale,
        duration: 350,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: titleText,
            scale: finalScale, // Return to the calculated final scale
            duration: 350,
            ease: 'Back.easeIn'
          });
        }
      });
    });
  }
}
