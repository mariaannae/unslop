# Native App & Mobile Web Guide (iOS, Android, iPad) for NONSLOP Phaser Game

This guide explains how to make your static Phaser.js game (no npm, no build step) work on iPhone, Android, and iPad, both as a mobile website and as a native app.

---

## 1. Mobile Web Compatibility

Your game is already mobile-friendly:
- Responsive scaling and viewport meta tag are present.
- Touch input is supported by Phaser.
- Test your game in Safari (iPhone/iPad) and Chrome (Android) to ensure UI elements are large enough for touch.

**Tips:**
- Make sure all buttons are at least 44x44px for touch.
- Test audio on iOS (requires user interaction to start).
- Add a `manifest.json` and icons for "Add to Home Screen" (PWA install).

---

## 2. Add PWA Support (Optional but Recommended)

To let users install your game from the browser:

1. **Create a `manifest.json` in your project root:**
    ```json
    {
      "name": "NONSLOP",
      "short_name": "NONSLOP",
      "start_url": "index.html",
      "display": "standalone",
      "background_color": "#13091e",
      "theme_color": "#13091e",
      "icons": [
        {
          "src": "icon-192.png",
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": "icon-512.png",
          "sizes": "512x512",
          "type": "image/png"
        }
      ]
    }
    ```
2. **Reference it in `index.html`:**
    ```html
    <link rel="manifest" href="manifest.json">
    ```
3. **Add icons** (`icon-192.png`, `icon-512.png`) to your project root.

4. **(Optional) Add a service worker** for offline support.

---

## 3. Wrapping as a Native App (No npm, Static Files Only)

### **A. Using PhoneGap Build (Cloud Service, No npm)**
> Note: PhoneGap Build is deprecated, but similar cloud wrappers may exist. See PWABuilder below for a modern approach.

1. Zip your project files (`index.html`, `phaser.js`, `src/`, `assets/`, etc.).
2. Go to a service like [PWABuilder](https://www.pwabuilder.com/) or search for "web to app" cloud wrappers.
3. Upload your zip or enter your hosted URL.
4. Follow the instructions to generate iOS/Android app packages.

### **B. Using Cordova Locally (Requires Command Line, No npm for your game)**
1. Install Cordova CLI (requires Node.js, but not for your game code):
    ```sh
    npm install -g cordova
    ```
2. Create a Cordova project:
    ```sh
    cordova create nonslop
    cd nonslop
    ```
3. Replace the contents of the `www` folder with your game files (`index.html`, `phaser.js`, `src/`, `assets/`, etc.).
4. Add platforms:
    ```sh
    cordova platform add ios
    cordova platform add android
    ```
5. Build and run:
    ```sh
    cordova build ios
    cordova build android
    ```
6. Open the generated project in Xcode (iOS) or Android Studio (Android) to test and submit to app stores.

---

## 4. iOS/iPad/Android App Store Notes

- **iOS/iPad:** You need a Mac and an Apple Developer account to submit to the App Store.
- **Android:** You need an Android Developer account to submit to Google Play.
- Add app icons and splash screens as required by each platform.
- Test on real devices for UI scaling, touch, and audio.

---

## 5. Troubleshooting & Tips

- **Audio on iOS:** Must be triggered by user gesture (e.g., tap to start).
- **Fullscreen:** Use `<meta name="apple-mobile-web-app-capable" content="yes">` in `index.html` for iOS fullscreen.
- **Testing:** Always test on real devices for UI scaling and touch accuracy.

---

## 6. References

- [PWABuilder](https://www.pwabuilder.com/)
- [Cordova Docs](https://cordova.apache.org/docs/en/latest/guide/cli/)
- [Apple App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Guidelines](https://support.google.com/googleplay/android-developer/answer/113469#zippy=%2Capp-content)

---

**This guide is tailored for static web games (no npm, no build step). You can deploy as a mobile website, a PWA, or wrap as a native app for iOS/Android using cloud or local tools.**
