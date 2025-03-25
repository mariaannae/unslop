//import Phaser from 'phaser';

import GameSceneHard from "./scenes/GameSceneHard.js";
import Boot from "./scenes/Boot.js";
import Preloader from "./scenes/Preloader.js";
import GameSceneEasy from "./scenes/GameSceneEasy.js";
import FeedbackScene from "./scenes/FeedbackScene.js";






const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: [Boot, Preloader, GameSceneHard, GameSceneEasy, FeedbackScene],
    physics: { default: 'arcade', arcade: { debug: false } },

    // Increase rendering resolution
    scale: {
        mode: Phaser.Scale.FIT, // Scales to fit the screen
        autoCenter: Phaser.Scale.CENTER_BOTH, // Centers the game in the window
        width: 1200, // Increase base width
        height: 900  // Increase base height
    },

    render: {
        pixelArt: false,  // Set to true if you want a pixelated effect
        antialias: true,  // Smooths edges of text and graphics
    }
};


const game = new Phaser.Game(config);


// window.onload = function () {
//     const config = {
//         type: Phaser.AUTO,
//         scene: [Boot, Preloader, GameSceneHard],
//         scale: {
//             mode: Phaser.Scale.RESIZE, // ✅ Automatically resizes
//             autoCenter: Phaser.Scale.CENTER_BOTH
//         },
//         physics: {
//             default: 'arcade',
//             arcade: {
//                 debug: false,
//                 fps: 60
//             }
//         },
//         render: {
//             pixelArt: false,
//             antialias: true
//         }
//     };

//     game = new Phaser.Game(config); // ✅ Initialize only after the window loads
// };