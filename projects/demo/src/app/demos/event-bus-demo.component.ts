import { Component } from '@angular/core';

@Component({
  selector: 'app-event-bus-demo',
  standalone: true,
  template: `
    <div class="demo-container">
      <h2>Event Bus Library Demo</h2>
      <p class="description">Publish-subscribe communication model with type safety and schematics demo will be implemented here.</p>
      
      <div class="card">
        <h3>Feature Placeholders</h3>
        <ul>
          <li>Event Publishing & Subscribing</li>
          <li>Typed Message Routing</li>
          <li>Internal Message Queue and Store Integration</li>
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
export class EventBusDemoComponent {}
