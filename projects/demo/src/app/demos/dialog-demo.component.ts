import { Component } from '@angular/core';

@Component({
  selector: 'app-dialog-demo',
  standalone: true,
  template: `
    <div class="demo-container">
      <h2>Dialog Library Demo</h2>
      <p class="description">Interactive window management, styling, and behavior control plugin demos will be implemented here.</p>
      
      <div class="card">
        <h3>Feature Placeholders</h3>
        <ul>
          <li>Draggable & Resizable Dialogs</li>
          <li>Layout Persistence</li>
          <li>Auto Close & Docking</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
    }
    .description {
      color: #666;
      font-size: 1.1rem;
      margin-bottom: 20px;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      border: 1px solid #eee;
    }
    h2 {
      color: #1976d2;
      margin-top: 0;
    }
    h3 {
      margin-top: 0;
      color: #333;
    }
    ul {
      padding-left: 20px;
      color: #444;
    }
    li {
      margin-bottom: 8px;
    }
  `]
})
export class DialogDemoComponent {}
