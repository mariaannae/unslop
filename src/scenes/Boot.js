import { waitForAuth } from "../config/firebase.js";
import registryManager from "../services/RegistryManager.js";

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
                    'Fredoka',  // Load all weights at once,
                    'VT323',
                    'IBM Plex Mono'
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
        // Initialize the registry manager
        registryManager.init(this.registry);
        console.log("Registry Manager initialized in Boot scene");
        
        console.log("Waiting for all fonts (Google + barcade3d) and Firebase auth to fully load...");

        try {
            // Wait for both Google fonts and barcade3d to load, and Firebase auth
            await Promise.all([
                document.fonts.ready,
                document.fonts.load('1em barcade3d'),
                waitForAuth()
            ]);
            console.log("All fonts and Firebase auth loaded, starting Preloader...");
            // Set a flag in the registry to indicate fonts were successfully loaded
            this.registry.set('fontsLoaded', true);
            this.scene.start("Preloader");
        } catch (error) {
            console.error("Error loading fonts or auth:", error);
            // Set a flag to indicate there was an issue with font loading
            this.registry.set('fontsLoaded', false);
            
            // Try one more time to load the barcade3d font with a timeout
            try {
                const fontLoadPromise = document.fonts.load('1em barcade3d');
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Font load timeout')), 2000)
                );
                
                await Promise.race([fontLoadPromise, timeoutPromise]);
                console.log("barcade3d font loaded on second attempt");
                this.registry.set('fontsLoaded', true);
            } catch (fontError) {
                console.warn("Second attempt to load barcade3d font failed:", fontError);
                // Keep fontsLoaded as false
            }
            
            // Still proceed to preloader
            this.scene.start("Preloader");
        }
    }
}
