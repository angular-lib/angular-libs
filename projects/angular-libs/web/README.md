# @angular-libs/web

A powerful, light-weight utility library designed to wrap native, modern browser/hardware Web APIs cleanly and reactively using **Angular Signals** and Directives.

## 🚀 Key Features & Reactive Signals

The library exports multiple lightweight reactive custom signals and directives matching modern hardware and system-wide Web interfaces.

### 📁 1. File System Access (`fileSystemSignal`)
Access the sandboxed or native desktop file system to read, write, and select local storage documents directly from secure browser tabs.
* **Usage**:
  ```typescript
  import { fileSystemSignal } from '@angular-libs/web';

  const fs = fileSystemSignal();
  
  // Choose & load local text details
  await fs.open({ readAsText: true });
  console.log(fs.state().content);

  // Write changes back directly onto physical file handle
  await fs.save('Hello physical disk!');
  ```

### ⚡ 2. Web Bluetooth Peripheral Controller (`bluetoothSignal`)
Discover, pair, secure, and stream hardware indicators from standard adjacent Bluetooth Low Energy (BLE) transponders natively.
* **Usage**:
  ```typescript
  import { bluetoothSignal } from '@angular-libs/web';

  const bt = bluetoothSignal();

  // Requests scanning and pairing dialogue
  await bt.requestDevice({ acceptAllDevices: true });
  console.log('Connected:', bt.state().connected);
  ```

### 📡 3. Web NFC Tag Reader/Writer (`nfcSignal`)
Listen for nearby NFC tag alignment, read record formats, handle NDEF buffers, and queue written records.
* **Usage**:
  ```typescript
  import { nfcSignal } from '@angular-libs/web';

  const nfc = nfcSignal();

  // Start scanning
  await nfc.scan();

  // Write tag content payloads
  await nfc.write('Metadata payloads here');
  ```

---

## 🛠 Complete Implementation List

Every signal follows consistent, lightweight lifecycles with built-in `DestroyRef` automatic listener cleanups to prevent resource leaks:

*   🔋 **`batterySignal`**: Real-time battery level percentage, charging status metrics, and remaining drain time estimations.
*   💡 **`ambientLightSignal`**: Detect lux levels dynamically in the immediate proximity.
*   🏃 **`accelerometerSignal`**: Access local physical displacement x, y, and z forces.
*   🔄 **`gyroscopeSignal`**: Rotational velocities and tilt alignments.
*   📱 **`deviceOrientationSignal`**: Device gyroscope positioning variables (iOS/Safari motion permission layers included).
*   📂 **`fileSystemSignal`**: Create, read, and write permissions for local physical disk volumes.
*   📡 **`nfcSignal`**: Web NDEF NFC operations.
*   ⚡ **`bluetoothSignal`**: Web bluetooth communication protocols.

## Current Features
This library provides reactive wrappers (such as signals and directives) around native browser APIs:
- **Directives:**
  - File Drop (`file-drop.directive.ts`)
- **Signals:**
  - Accelerometer (`accelerometer.ts`)
  - Ambient Light (`ambient-light.ts`)
  - Battery Status (`battery.ts`)
  - Bluetooth (`bluetooth.ts`)
  - Clipboard (`clipboard.ts`)
  - Device Orientation (`device-orientation.ts`)
  - Geolocation (`geolocation.ts`)
  - Gyroscope (`gyroscope.ts`)
  - Idle Detection (`idle.ts`)
  - Keyboard State (`keyboard-state.ts`)
  - Media Devices (`media-devices.ts`)
  - Network Status (`network.ts`)
  - NFC (`nfc.ts`)
  - Performance (`performance.ts`)
  - Permission (`permission.ts`)
  - Picture-in-Picture (`picture-in-picture.ts`)
  - Screen Orientation (`screen-orientation.ts`)
  - Vibrate (`vibrate.ts`)

---

## 20 Feature Ideas for @angular-libs/web

1. **Web Share API (`injectShare` / `ShareDirective`)**
   - Easily share text, URLs, or files using the client's native system sharing dialog.

2. **Web Speech API - Speech Synthesis (`injectSpeechSynthesis`)**
   - Control text-to-speech dynamically with reactive signals for voice, speed, pitch, volume, and playback state (playing, paused, stopped).

3. **Web Speech API - Speech Recognition (`injectSpeechRecognition`)**
   - Convert spoken audio into real-time text streams using reactive signal outputs for transcribed words and recording state.

4. **EyeDropper API (`injectEyeDropper`)**
   - Sample colors directly from any pixel on the user's screen using the browser's native magnifier tool.

5. **Intersection Observer API (`injectIntersection` / `IntersectionDirective`)**
   - Track visibility and viewport intersection of HTML elements natively for lazy-loading or dynamic animations.

6. **Resize Observer API (`injectResize` / `ResizeDirective`)**
   - Reactive signal monitoring of element size alterations, perfect for container queries and custom responsive components.

7. **Mutation Observer API (`injectMutation` / `MutationDirective`)**
   - Listen to changes inside the DOM tree (child additions/removals, attribute manipulations) reactively.

8. **Page Visibility API (`injectPageVisibility`)**
   - Determine if the current browser tab is in the foreground or hidden/background to pause expensive operations.

9. **Gamepad API (`injectGamepad`)**
   - Map physical button presses and joystick movements from game controllers connected via USB or Bluetooth.

10. **Device Memory API (`injectDeviceMemory`)**
    - Retrieve client device memory (RAM) sizes to dynamically optimize memory usage and application workloads.

11. **Reactive Local / Session Storage (`injectLocalStorage` / `injectSessionStorage`)**
    - Angular signals synchronized bidirectionally with Web Storage API key-value stores.

12. **Screen Wake Lock API (`injectWakeLock`)**
    - Keep the active display from going to sleep or dimming during video player usage, slideshow presentations, or recipe views.

13. **Audio Context API (`injectAudioContext`)**
    - Utility signals for recording microphone audio, audio analysis data, or generating synthetic browser audio.

14. **IndexedDB API Wrapper (`injectIndexedDB`)**
    - Signal-based or Promise-based reactive transactions for reading and writing large, persistent data payloads locally.

15. **Broadcast Channel API (`injectBroadcastChannel`)**
    - Reactively communicate messages and status updates across different active browser tabs or windows under the same origin.

16. **Contact Picker API (`injectContactPicker`)**
    - Query and select contacts from the user's native address book on supported mobile/desktop browsers.

17. **WebOTP API (`injectWebOTP`)**
    - Read one-time passcodes from incoming SMS notifications to streamline authentication flows on supported devices.

18. **Network Quality API (`injectNetworkQuality`)**
    - Dive deeper into connection specs like download speeds (`downlink`), round-trip time (`rtt`), and battery/network data saving modes (`saveData`).

19. **Badge API (`injectBadge`)**
    - Read, update, or clear home screen / taskbar badge counts directly for Progressive Web Applications (PWAs).

20. **Virtual Keyboard API (`injectVirtualKeyboard`)**
    - Control and listen to virtual on-screen keyboard overlaps and visibility boundaries on touchscreen layouts.