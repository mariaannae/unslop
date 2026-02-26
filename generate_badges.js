const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

// Color configurations from design.js
const EASY_COLORS = {
    BACKGROUND: 0x001620,
    BOX_OUTLINE: 0x9e0e77,
    TEXT: {
        TITLE: '#fbf056',
        PRIMARY: '#ebfff7'
    }
};

const HARD_COLORS = {
    BACKGROUND: 0x200025,
    BOX_OUTLINE: 0x00e5ff,
    TEXT: {
        TITLE: '#fbf056',
        PRIMARY: '#ebfff7'
    }
};

// Badge text options 
const textList = [
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

async function generateBadge(text, mode) {
    const colors = mode === 'easy' ? EASY_COLORS : HARD_COLORS;
    
    // Create canvas
    const canvas = createCanvas(800, 1000);
    const ctx = canvas.getContext('2d');

    // Set background
    ctx.fillStyle = `#${colors.BACKGROUND.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw badge outline
    const padding = 32;
    ctx.strokeStyle = `#${colors.BOX_OUTLINE.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 5;
    ctx.strokeRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);

    // Draw title
    ctx.fillStyle = colors.TEXT.TITLE;
    ctx.font = '55px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('(NONSLOP)', canvas.width / 2, 100);

    // Draw score
    ctx.fillStyle = colors.TEXT.PRIMARY;
    ctx.font = '24px monospace';
    ctx.fillText('SCORE: 15/15', canvas.width / 2, 150);

    // Draw badge text
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    const lines = text.split('\n');
    let y = 250;
    for (const line of lines) {
        ctx.fillText(line, canvas.width / 2, y);
        y += 40;
    }

    // Load and draw QR code
    try {
        const qrCode = await loadImage(path.join(__dirname, 'assets', 'nonslop-qr-code.png'));
        const qrSize = 200;
        ctx.drawImage(
            qrCode,
            (canvas.width - qrSize) / 2,
            y + 40,
            qrSize,
            qrSize
        );

        // Draw URL
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px monospace';
        ctx.fillText(
            'https://mariaannae.github.io/nonslop/',
            canvas.width / 2,
            y + qrSize + 80
        );
    } catch (err) {
        console.error('Error loading QR code:', err);
    }

    return canvas;
}

async function generateAllBadges() {
    // Ensure badges directory exists
    const badgesDir = path.join(__dirname, 'assets', 'badges');
    try {
        await fs.mkdir(badgesDir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }

    // Generate badges for each text and mode combination
    for (let i = 0; i < textList.length; i++) {
        const text = textList[i];
        for (const mode of ['easy', 'hard']) {
            const canvas = await generateBadge(text, mode);
            const filename = `badge_${i + 1}_${mode}.png`;
            const out = fs.createWriteStream(path.join(badgesDir, filename));
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            console.log(`Generated ${filename}`);
        }
    }
}

generateAllBadges().catch(console.error);
