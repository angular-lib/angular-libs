import { Routes } from '@angular/router';
import { DialogDemoComponent } from './demos/dialog-demo.component';
import { EventBusDemoComponent } from './demos/event-bus-demo.component';
import { StoreDemoComponent } from './demos/store-demo.component';
import { TranslateDemoComponent } from './demos/translate-demo.component';
import { WebDemoComponent } from './demos/web-demo.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dialog', pathMatch: 'full' },
  { path: 'dialog', component: DialogDemoComponent },
  { path: 'event-bus', component: EventBusDemoComponent },
  { path: 'store', component: StoreDemoComponent },
  { path: 'translate', component: TranslateDemoComponent },
  { path: 'web', component: WebDemoComponent },
];
