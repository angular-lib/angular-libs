import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  accelerometerSignal,
  gyroscopeSignal,
  ambientLightSignal,
  batterySignal,
  deviceOrientationSignal,
  fileSystemSignal,
  bluetoothSignal,
  nfcSignal,
} from '../../../../angular-libs/web/src/public-api';

@Component({
  selector: 'app-web-demo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo-container">
      <h2>Web API & Signals Demo</h2>
      <p class="description">
        Explore modern hardware and environment Web APIs reactively integrated with Angular Signals.
      </p>

      <div class="grid">
        <!-- Battery Status API Card -->
        <div class="card">
          <div class="card-header">
            <h3>🔋 Battery Status</h3>
            <span class="badge" [class.badge-primary]="battery().supported" [class.badge-danger]="!battery().supported">
              {{ battery().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (battery().supported) {
            <div class="card-content">
              @if (battery().loading) {
                <div class="loading">Loading battery status...</div>
              } @else {
                <div class="battery-level-container">
                  <div class="battery-bar-outer">
                    <div
                      class="battery-bar-inner"
                      [style.width.%]="battery().level * 100"
                      [class.charging]="battery().charging"
                    ></div>
                  </div>
                  <span class="battery-percentage">{{ (battery().level * 100) | number:'1.0-0' }}%</span>
                </div>

                <div class="specs-grid">
                  <div class="spec-item">
                    <span class="label">Charging State:</span>
                    <span class="value">{{ battery().charging ? 'Charging ⚡' : 'Discharging' }}</span>
                  </div>
                  <div class="spec-item" *ngIf="battery().charging && battery().chargingTime !== Infinity">
                    <span class="label">Time to Full:</span>
                    <span class="value">{{ (battery().chargingTime / 60) | number:'1.0-0' }} mins</span>
                  </div>
                  <div class="spec-item" *ngIf="!battery().charging && battery().dischargingTime !== Infinity">
                    <span class="label">Time Remaining:</span>
                    <span class="value">{{ (battery().dischargingTime / 3600) | number:'1.1-1' }} hours</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="error-text">Battery Status API is not supported in this browser or environment.</p>
          }
        </div>

        <!-- Ambient Light Sensor Card -->
        <div class="card">
          <div class="card-header">
            <h3>💡 Ambient Light Sensor</h3>
            <span class="badge" [class.badge-primary]="light.state().supported" [class.badge-danger]="!light.state().supported">
              {{ light.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (light.state().supported) {
            <div class="card-content">
              <div class="btn-group">
                <button
                  class="btn"
                  [disabled]="light.state().active"
                  (click)="light.start()"
                >
                  Start Monitoring
                </button>
                <button
                  class="btn btn-secondary"
                  [disabled]="!light.state().active"
                  (click)="light.stop()"
                >
                  Stop
                </button>
              </div>

              <div class="metrics" *ngIf="light.state().active">
                <div class="metric-big">
                  <span class="metric-value">{{ light.state().illuminance ?? 0 }}</span>
                  <span class="metric-unit">lux</span>
                </div>
                <p class="ambient-description">
                  Current light category:
                  <strong>
                    @if ((light.state().illuminance ?? 0) < 10) { Pitch Black 🌑 }
                    @else if ((light.state().illuminance ?? 0) < 50) { Dim Room 🪵 }
                    @else if ((light.state().illuminance ?? 0) < 250) { Normal Indoors 🏠 }
                    @else if ((light.state().illuminance ?? 0) < 1000) { Bright Indoors/Office 🏢 }
                    @else { Direct Sunlight / Extremely Bright ☀️ }
                  </strong>
                </p>
              </div>

              <div class="placeholder-msg" *ngIf="!light.state().active && !light.state().error">
                Sensor is idle. Start monitoring to read lux levels.
              </div>

              <div class="error-msg" *ngIf="light.state().error">
                ⚠️ {{ light.state().error?.message }}
              </div>
            </div>
          } @else {
            <p class="error-text">Generic AmbientLightSensor API is not supported. Enabled via <code>#enable-generic-sensor-extra-classes</code> flag in Chromium browsers.</p>
          }
        </div>

        <!-- Accelerometer Sensor Card -->
        <div class="card">
          <div class="card-header">
            <h3>🏃 Accelerometer Sensor</h3>
            <span class="badge" [class.badge-primary]="acc.state().supported" [class.badge-danger]="!acc.state().supported">
              {{ acc.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (acc.state().supported) {
            <div class="card-content">
              <div class="btn-group">
                <button
                  class="btn"
                  [disabled]="acc.state().active"
                  (click)="acc.start()"
                >
                  Start Tracking
                </button>
                <button
                  class="btn btn-secondary"
                  [disabled]="!acc.state().active"
                  (click)="acc.stop()"
                >
                  Stop
                </button>
              </div>

              <div class="vector-readings" *ngIf="acc.state().active">
                <div class="reading-axis">
                  <span class="axis-label X">X</span>
                  <span class="axis-value">{{ acc.state().x !== null ? (acc.state().x | number:'1.2-2') : '---' }} m/s²</span>
                </div>
                <div class="reading-axis">
                  <span class="axis-label Y">Y</span>
                  <span class="axis-value">{{ acc.state().y !== null ? (acc.state().y | number:'1.2-2') : '---' }} m/s²</span>
                </div>
                <div class="reading-axis">
                  <span class="axis-label Z">Z</span>
                  <span class="axis-value">{{ acc.state().z !== null ? (acc.state().z | number:'1.2-2') : '---' }} m/s²</span>
                </div>
              </div>

              <div class="placeholder-msg" *ngIf="!acc.state().active && !acc.state().error">
                Sensor is idle. Start tracking to read acceleration coordinates.
              </div>

              <div class="error-msg" *ngIf="acc.state().error">
                ⚠️ {{ acc.state().error?.message }}
              </div>
            </div>
          } @else {
            <p class="error-text">Generic Accelerometer API is not supported in this browser. Works on modern mobile Chrome/Android.</p>
          }
        </div>

        <!-- Gyroscope Sensor Card -->
        <div class="card">
          <div class="card-header">
            <h3>🔄 Gyroscope Sensor</h3>
            <span class="badge" [class.badge-primary]="gyro.state().supported" [class.badge-danger]="!gyro.state().supported">
              {{ gyro.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (gyro.state().supported) {
            <div class="card-content">
              <div class="btn-group">
                <button
                  class="btn"
                  [disabled]="gyro.state().active"
                  (click)="gyro.start()"
                >
                  Start Tracking
                </button>
                <button
                  class="btn btn-secondary"
                  [disabled]="!gyro.state().active"
                  (click)="gyro.stop()"
                >
                  Stop
                </button>
              </div>

              <div class="vector-readings" *ngIf="gyro.state().active">
                <div class="reading-axis">
                  <span class="axis-label X">X (Pitch)</span>
                  <span class="axis-value">{{ gyro.state().x !== null ? (gyro.state().x | number:'1.2-3') : '---' }} rad/s</span>
                </div>
                <div class="reading-axis">
                  <span class="axis-label Y">Y (Roll)</span>
                  <span class="axis-value">{{ gyro.state().y !== null ? (gyro.state().y | number:'1.2-3') : '---' }} rad/s</span>
                </div>
                <div class="reading-axis">
                  <span class="axis-label Z">Z (Yaw)</span>
                  <span class="axis-value">{{ gyro.state().z !== null ? (gyro.state().z | number:'1.2-3') : '---' }} rad/s</span>
                </div>
              </div>

              <div class="placeholder-msg" *ngIf="!gyro.state().active && !gyro.state().error">
                Sensor is idle. Start tracking to read rotation/angular velocity rates.
              </div>

              <div class="error-msg" *ngIf="gyro.state().error">
                ⚠️ {{ gyro.state().error?.message }}
              </div>
            </div>
          } @else {
            <p class="error-text">Generic Gyroscope API is not supported. Enabled via chrome://flags inside Google Chrome.</p>
          }
        </div>

        <!-- Device Orientation Card -->
        <div class="card">
          <div class="card-header">
            <h3>📱 Device Orientation</h3>
            <span class="badge" [class.badge-primary]="orientation.state().supported" [class.badge-danger]="!orientation.state().supported">
              {{ orientation.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (orientation.state().supported) {
            <div class="card-content">
              <p class="help-text">Legacy high-compatibility mobile device positioning. Required for iOS device tilt compatibility.</p>
              
              <div class="btn-group">
                <button class="btn" (click)="onRequestPermission()">
                  Request iOS Permissions
                </button>
              </div>

              <div class="specs-grid">
                <div class="spec-item">
                  <span class="label">Absolute Coordinates:</span>
                  <span class="value">{{ orientation.state().absolute ? 'Yes (Earth-aligned)' : 'No' }}</span>
                </div>
                <div class="spec-item">
                  <span class="label">Alpha (z-axis):</span>
                  <span class="value">{{ orientation.state().alpha !== null ? (orientation.state().alpha | number:'1.1-1') + '°' : '---' }}</span>
                </div>
                <div class="spec-item">
                  <span class="label">Beta (x-axis):</span>
                  <span class="value">{{ orientation.state().beta !== null ? (orientation.state().beta | number:'1.1-1') + '°' : '---' }}</span>
                </div>
                <div class="spec-item">
                  <span class="label">Gamma (y-axis):</span>
                  <span class="value">{{ orientation.state().gamma !== null ? (orientation.state().gamma | number:'1.1-1') + '°' : '---' }}</span>
                </div>
              </div>
            </div>
          } @else {
            <p class="error-text">DeviceOrientation event is not available in the current context.</p>
          }
        </div>

        <!-- File System Access Card -->
        <div class="card">
          <div class="card-header">
            <h3>📂 File System Access</h3>
            <span class="badge" [class.badge-primary]="fs.state().supported" [class.badge-danger]="!fs.state().supported">
              {{ fs.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (fs.state().supported) {
            <div class="card-content">
              <p class="help-text">Directly open, read, edit and save local text files safely from the browser.</p>
              
              <div class="btn-group">
                <button class="btn" (click)="fs.open({ readAsText: true })" [disabled]="fs.state().loading">
                  Open File
                </button>
                <button class="btn btn-secondary" (click)="fs.clear()" [disabled]="!fs.state().fileHandle">
                  Clear
                </button>
              </div>

              @if (fs.state().file) {
                <div class="specs-grid" style="margin-bottom: 12px;">
                  <div class="spec-item">
                    <span class="label">File Name:</span>
                    <span class="value">{{ fs.state().file?.name }}</span>
                  </div>
                  <div class="spec-item">
                    <span class="label">Size:</span>
                    <span class="value">{{ fs.state().file?.size | number }} bytes</span>
                  </div>
                </div>

                <textarea #editor [value]="fs.state().content || ''" rows="6" 
                  style="width: 100%; border-radius: 6px; padding: 10px; border: 1px solid #cbd5e1; outline: none; resize: vertical; margin-bottom: 10px;"
                  placeholder="File content goes here..."></textarea>
                
                <button class="btn" (click)="fs.save(editor.value)" [disabled]="fs.state().loading">
                  Save Changes
                </button>
              } @else {
                <div class="placeholder-msg">
                  No file open. Click 'Open File' to begin.
                </div>
              }

              @if (fs.state().error) {
                <div class="error-msg">
                  ⚠️ {{ fs.state().error?.message }}
                </div>
              }
            </div>
          } @else {
            <p class="error-text">File System Access API is not supported in this browser (requires Chromium-based browser).</p>
          }
        </div>

        <!-- Bluetooth Scanning Card -->
        <div class="card">
          <div class="card-header">
            <h3>⚡ Bluetooth Scanner</h3>
            <span class="badge" [class.badge-primary]="bt.state().supported" [class.badge-danger]="!bt.state().supported">
              {{ bt.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (bt.state().supported) {
            <div class="card-content">
              <p class="help-text">Pair and connect to nearby Bluetooth peripherals using native Web Bluetooth.</p>

              <div class="btn-group">
                @if (!bt.state().connected) {
                  <button class="btn" (click)="onPairBluetooth()" [disabled]="bt.state().loading">
                    {{ bt.state().loading ? 'Connecting...' : 'Pair Device' }}
                  </button>
                } @else {
                  <button class="btn btn-secondary" (click)="onDisconnectBluetooth()">
                    Disconnect
                  </button>
                }
              </div>

              @if (bt.state().device) {
                <div class="specs-grid">
                  <div class="spec-item">
                    <span class="label">Device Name:</span>
                    <span class="value">{{ bt.state().device?.name || 'Unnamed Device' }}</span>
                  </div>
                  <div class="spec-item">
                    <span class="label">Device ID:</span>
                    <span class="value" style="font-size: 0.8rem;">{{ bt.state().device?.id }}</span>
                  </div>
                  <div class="spec-item">
                    <span class="label">Connected:</span>
                    <span class="value" [style.color]="bt.state().connected ? '#4caf50' : '#d32f2f'">
                      {{ bt.state().connected ? 'Yes' : 'No' }}
                    </span>
                  </div>
                </div>
              } @else if (!bt.state().loading) {
                <div class="placeholder-msg">
                  No device paired. Click 'Pair Device' to scan.
                </div>
              }

              @if (bt.state().error) {
                <div class="error-msg">
                  ⚠️ {{ bt.state().error?.message }}
                </div>
              }
            </div>
          } @else {
            <p class="error-text">Web Bluetooth API is not supported in this browser (Chrome/Edge/Opera supported on secure contexts).</p>
          }
        </div>

        <!-- Web NFC Card -->
        <div class="card">
          <div class="card-header">
            <h3>📡 Web NFC Tag Tools</h3>
            <span class="badge" [class.badge-primary]="nfc.state().supported" [class.badge-danger]="!nfc.state().supported">
              {{ nfc.state().supported ? 'Supported' : 'Not Supported' }}
            </span>
          </div>

          @if (nfc.state().supported) {
            <div class="card-content">
              <p class="help-text">Read and write NDEF message tags near your device's NFC chip reader.</p>

              <div class="btn-group">
                <button class="btn" (click)="onScanNfc()" [disabled]="nfc.state().reading">
                  {{ nfc.state().reading ? 'NFC Scanner Active 📡' : 'Start NFC Scan' }}
                </button>
                <button class="btn btn-secondary" (click)="onWriteNfc()">
                  Write Tag
                </button>
              </div>

              @if (nfc.state().message) {
                <div class="specs-grid">
                  <div class="spec-item">
                    <span class="label">Tag Serial:</span>
                    <span class="value">{{ nfc.state().message?.serialNumber || 'Unknown' }}</span>
                  </div>
                </div>

                <div style="margin-top: 10px;">
                  <strong>Records Found:</strong>
                  <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                    @for (record of nfc.state().message?.records; track $index) {
                      <li>
                        Type: <code>{{ record.recordType }}</code> 
                        @if (record.data) {
                          - Data: <code>{{ record.data }}</code>
                        }
                      </li>
                    }
                  </ul>
                </div>
              } @else {
                <div class="placeholder-msg">
                  {{ nfc.state().reading ? 'Listening for NFC tag alignment...' : 'Ready to start scanning NFC devices.' }}
                </div>
              }

              @if (nfc.state().error) {
                <div class="error-msg">
                  ⚠️ {{ nfc.state().error?.message }}
                </div>
              }
            </div>
          } @else {
            <p class="error-text">Web NFC is not supported in this browser or OS context (requires Chrome/Android or supported PWA modes).</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
    }
    .description {
      color: #555;
      font-size: 1.1rem;
      margin-bottom: 30px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }
    .card {
      background: #fafcfe;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid #e2edf8;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid #eef3fb;
      padding-bottom: 12px;
    }
    h2 {
      color: #1976d2;
      margin-top: 0;
      font-size: 2rem;
    }
    h3 {
      margin: 0;
      color: #2c3e50;
      font-size: 1.25rem;
    }
    .badge {
      font-size: 0.75rem;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-primary {
      background: #e3f2fd;
      color: #1976d2;
    }
    .badge-danger {
      background: #ffebee;
      color: #c62828;
    }
    .card-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }
    .loading {
      color: #777;
      font-style: italic;
      padding: 10px 0;
    }
    .battery-level-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .battery-bar-outer {
      flex: 1;
      height: 24px;
      border: 2px solid #2c3e50;
      border-radius: 6px;
      padding: 2px;
      background: #fff;
    }
    .battery-bar-inner {
      height: 100%;
      background: #4caf50;
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .battery-bar-inner.charging {
      background: #ffeb3b;
      position: relative;
      overflow: hidden;
    }
    .battery-percentage {
      font-size: 1.4rem;
      font-weight: bold;
      color: #2c3e50;
      min-width: 60px;
      text-align: right;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .spec-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #edf2f9;
    }
    .spec-item .label {
      color: #6c7a89;
      font-weight: 500;
    }
    .spec-item .value {
      color: #2c3e50;
      font-weight: bold;
    }
    .error-text {
      color: #bdc3c7;
      font-style: italic;
      line-height: 1.4;
      margin: 10px 0;
    }
    .help-text {
      color: #7f8c8d;
      font-size: 0.85rem;
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .btn-group {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .btn {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      background: #1976d2;
      color: white;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s ease, opacity 0.2s ease;
    }
    .btn:hover:not(:disabled) {
      background: #115293;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }
    .btn-secondary:hover:not(:disabled) {
      background: #bdbdbd;
    }
    .metrics {
      text-align: center;
      padding: 20px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #eef2f5;
    }
    .metric-big {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 10px;
    }
    .metric-value {
      font-size: 3rem;
      font-weight: 800;
      color: #1976d2;
    }
    .metric-unit {
      font-size: 1.25rem;
      color: #7f8c8d;
      font-weight: 500;
    }
    .ambient-description {
      margin: 0;
      color: #555;
      font-size: 0.95rem;
    }
    .placeholder-msg {
      text-align: center;
      color: #95a5a6;
      font-style: italic;
      padding: 30px 10px;
      background: #fff;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
    }
    .error-msg {
      background: #fdf2f2;
      color: #ec5d5d;
      padding: 12px;
      border-radius: 6px;
      margin-top: 10px;
      font-size: 0.9rem;
      border: 1px solid #fde2e2;
    }
    .vector-readings {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .reading-axis {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .axis-label {
      display: inline-block;
      width: 80px;
      font-weight: bold;
      color: white;
      text-align: center;
      padding: 4px;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .axis-label.X { background: #e74c3c; }
    .axis-label.Y { background: #2ecc71; }
    .axis-label.Z { background: #3498db; }
    .axis-value {
      font-family: monospace;
      font-size: 1.15rem;
      font-weight: bold;
      color: #2c3e50;
    }
    code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85rem;
      color: #e21d12;
    }
  `],
})
export class WebDemoComponent {
  readonly Infinity = Number.POSITIVE_INFINITY;
  battery = batterySignal();
  light = ambientLightSignal();
  acc = accelerometerSignal();
  gyro = gyroscopeSignal();
  orientation = deviceOrientationSignal();
  fs = fileSystemSignal();
  bt = bluetoothSignal();
  nfc = nfcSignal();

  async onRequestPermission() {
    const granted = await this.orientation.requestPermission();
    if (granted) {
      alert('iOS Motion & Orientation Permission successfully granted!');
    } else {
      alert('iOS Motion & Orientation Permission was denied.');
    }
  }

  async onPairBluetooth() {
    try {
      await this.bt.requestDevice({ acceptAllDevices: true });
    } catch (e: any) {
      console.warn('Bluetooth connection cancelled or failed', e);
    }
  }

  onDisconnectBluetooth() {
    this.bt.disconnect();
  }

  async onScanNfc() {
    try {
      await this.nfc.scan();
    } catch (e: any) {
      console.warn('NFC scanning activation failed', e);
    }
  }

  async onWriteNfc() {
    try {
      await this.nfc.write('Hello NFC from @angular-libs/web!');
      alert('Write command queued successfully! Hold your NFC tag near the reader.');
    } catch (e: any) {
      alert('NFC Write failed: ' + e?.message || e);
    }
  }
}
