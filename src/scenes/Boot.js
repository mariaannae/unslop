import { waitForAuth } from "../config/firebase.js";

export default class Boot extends Phaser.Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
        //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

     
        const fontStyle = document.createElement("style");
        fontStyle.innerHTML = `
            @font-face {
                font-family: 'barcade3d';
                src: url('assets/fonts/barcade3d.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
            }
    

            
        `;

        document.head.appendChild(fontStyle);

        
        WebFont.load({
            google: {
                families: [
                    'Nunito:400,500,700,900',
                    'Fredoka'  // Load all weights at once
                ]
            },
            active: () => {
                this.fontsReady = true;
                console.log("Fonts loaded successfully");
            }
        });
    }

    async create ()
    {
        console.log("Waiting for fonts to fully load...");

        // ✅ Check if all fonts are ready
        document.fonts.ready.then(() => {
            console.log("Google Fonts fully loaded, starting Preloader...");
            this.scene.start("Preloader"); // ✅ Now safe to start Preloader
        }).catch(err => {
            console.error("Error loading fonts:", err);
            this.scene.start("Preloader"); // Start anyway if there's an error
        });

        // ✅ Check if Firebase auth is ready
        try {
            const userId = await waitForAuth();
            console.log("Auth complete, userId:", userId);
            this.scene.start('Preloader');
        } catch (error) {
            console.error("Auth failed:", error);
            // Still proceed to preloader
            this.scene.start('Preloader');
        };
    

    }
}
