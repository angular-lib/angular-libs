# @angular-libs/web

A modern, lightweight Angular utility library that wraps native Browser and Hardware Web APIs reactively using **Angular Signals** and standalone **Directives**.

## 🚀 Features

- ⚡ **Angular Signals First**: Modern reactive wrappers built natively around Angular Signals.
- 🧹 **Automatic Cleanup**: Powered by Angular's `DestroyRef` to automatically remove event listeners when components unmount.
- 🧩 **Standalone Directives**: Ready-to-use Angular directives for common UI interactions (Outside Clicks, Drag & Drop Files).
- 📱 **Hardware & Web APIs**: Access Device Battery, Geolocation, Web Bluetooth, NFC, Motion, Resize Observer, File System Access, and more.
- 📦 **Tree-shakeable**: Import only the signals and directives you need.

---

## 📦 Installation

```bash
npm install @angular-libs/web
```

---

## 💡 Quick Examples

### 🖱️ Click Outside Directive (`alClickOutside`)

Dismiss dropdowns, context menus, or modals when users click outside the host element.

```typescript
import { Component, signal } from '@angular/core';
import { AlClickOutsideDirective } from '@angular-libs/web';

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [AlClickOutsideDirective],
  template: `
    <button #toggleBtn (click)="isOpen.set(!isOpen())">Toggle Menu</button>

    @if (isOpen()) {
      <div 
        class="dropdown-menu"
        alClickOutside 
        [alClickOutsideIgnore]="[toggleBtn]" 
        (alClickOutside)="isOpen.set(false)"
      >
        <p>Dropdown Content</p>
      </div>
    }
  `,
})
export class DropdownComponent {
  readonly isOpen = signal(false);
}
```

---

### 📁 Drag & Drop File Directive (`alFileDrop`)

Enable file drop zones with reactive hover states, size validation, and file extension filtering.

```typescript
import { Component } from '@angular/core';
import { AlFileDropDirective, FileRejection } from '@angular-libs/web';

@Component({
  selector: 'app-uploader',
  standalone: true,
  imports: [AlFileDropDirective],
  template: `
    <div
      alFileDrop
      [accept]="'.png,.jpg,.pdf'"
      [maxFileSize]="5_000_000"
      (filesDropped)="onFiles($event)"
      (fileRejected)="onRejected($event)"
      #fileDrop="alFileDrop"
      class="drop-zone"
      [class.active]="fileDrop.isOver()"
    >
      @if (fileDrop.isOver()) {
        <p>Drop files now!</p>
      } @else {
        <p>Drag files here...</p>
      }
    </div>
  `,
})
export class UploaderComponent {
  onFiles(files: File[]) {
    console.log('Accepted files:', files);
  }

  onRejected(rejections: FileRejection[]) {
    console.warn('Rejected files:', rejections);
  }
}
```

---

### 📂 File System Access API (`fileSystemSignal`)

Read, edit, and write files on the client's local disk directly using native browser handles.

```typescript
import { Component } from '@angular/core';
import { fileSystemSignal } from '@angular-libs/web';

@Component({
  selector: 'app-editor',
  standalone: true,
  template: `
    <button (click)="openFile()">Open File</button>
    <button (click)="saveFile()">Save File</button>
    <p>File content: {{ fs.state().content }}</p>
  `,
})
export class EditorComponent {
  readonly fs = fileSystemSignal();

  async openFile() {
    await this.fs.open({ readAsText: true });
  }

  async saveFile() {
    await this.fs.save('Updated file text content');
  }
}
```

---

### 📐 Resize Observer Signal (`resizeObserverSignal`)

Monitor element size changes reactively with signals.

```typescript
import { Component, ElementRef, viewChild } from '@angular/core';
import { resizeObserverSignal } from '@angular-libs/web';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div #container class="card">
      <p>Width: {{ cardSize().width }}px</p>
      <p>Height: {{ cardSize().height }}px</p>
    </div>
  `,
})
export class CardComponent {
  readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  readonly cardSize = resizeObserverSignal(this.container);
}
```

---

### 🔋 Battery Status Signal (`batterySignal`)

Monitor battery level, charging state, and discharge times reactively.

```typescript
import { Component } from '@angular/core';
import { batterySignal } from '@angular-libs/web';

@Component({
  selector: 'app-battery-indicator',
  standalone: true,
  template: `
    @let battery = batteryState();
    <p>Battery Level: {{ battery.level * 100 }}%</p>
    <p>Charging: {{ battery.charging ? 'Yes' : 'No' }}</p>
  `,
})
export class BatteryIndicatorComponent {
  readonly batteryState = batterySignal();
}
```

---

## 🛠 Complete Feature Overview

### 🧩 Directives

| Directive | Export Name | Selector | Description |
| :--- | :--- | :--- | :--- |
| `AlClickOutsideDirective` | `alClickOutside` | `[alClickOutside]` | Detects clicks outside the host element with element/selector ignore list support. |
| `AlFileDropDirective` | `alFileDrop` | `[alFileDrop]` | Drag-and-drop file target with reactive signal hover state, size filter, and accept filter. |

---

### 📡 Reactive API Signals

| Signal API | Function Name | Description |
| :--- | :--- | :--- |
| 🏃 **Accelerometer** | `accelerometerSignal()` | Tracks physical x, y, and z motion forces. |
| 💡 **Ambient Light** | `ambientLightSignal()` | Measures ambient light lux levels in real time. |
| 🔋 **Battery** | `batterySignal()` | Real-time battery percentage, charging state, and discharge timers. |
| ⚡ **Bluetooth** | `bluetoothSignal()` | BLE device scanning, pairing, and connection management. |
| 📋 **Clipboard** | `clipboardSignal()` | Read and write text to the system clipboard reactively. |
| 📱 **Device Orientation** | `deviceOrientationSignal()` | Physical device pitch, roll, and compass heading angles. |
| 📂 **File System Access** | `fileSystemSignal()` | Native local file picking, reading, editing, and saving. |
| 📍 **Geolocation** | `geolocationSignal()` | GPS coordinates, heading, altitude, and speed tracking. |
| 🔄 **Gyroscope** | `gyroscopeSignal()` | Angular velocity along x, y, and z axes. |
| 💤 **Idle Detection** | `idleSignal()` | Detect user inactivity and screen lock states. |
| ⌨️ **Keyboard State** | `keyboardStateSignal()` | Track active keyboard physical layout and press status. |
| 🎥 **Media Devices** | `mediaDevicesSignal()` | Enumerate connected cameras, microphones, and audio output devices. |
| 📶 **Network Status** | `networkSignal()` | Connection status (`online`/`offline`), effective connection type, and bandwidth estimates. |
| 📡 **NFC** | `nfcSignal()` | Read and write NDEF payloads to nearby NFC tags. |
| ⏱️ **Performance** | `performanceSignal()` | Page load timing benchmarks, memory usage, and navigation metrics. |
| 🔑 **Permissions** | `permissionSignal()` | Query permissions (geolocation, camera, notifications) reactively. |
| 📺 **Picture-in-Picture** | `pictureInPictureSignal()` | Manage video Picture-in-Picture window states. |
| 📐 **Resize Observer** | `resizeObserverSignal()` | Observe target element dimensions and content box changes. |
| 📱 **Screen Orientation** | `screenOrientationSignal()` | Screen orientation type (`portrait-primary`, `landscape`, etc.) and lock controls. |
| 📳 **Vibration** | `vibrateSignal()` | Trigger tactile vibration patterns on supported mobile devices. |

---

## 📄 License

[MIT](LICENSE) © Angular-Libs
