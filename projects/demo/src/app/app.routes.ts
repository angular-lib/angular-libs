import { Routes } from '@angular/router';
import { DialogDemoComponent } from './demos/dialog-demo.component';
import { EventBusDemoComponent } from './demos/event-bus-demo.component';
import { StoreDemoComponent } from './demos/store-demo.component';
import { TranslateDemoComponent } from './demos/translate-demo.component';
import { WebDemoComponent } from './demos/web-demo.component';
import { ShortcutDemoComponent } from './demos/shortcut-demo.component';
import { SocketDemoComponent } from './demos/socket-demo.component';
import { DataGridDemoComponent } from './demos/data-grid-demo.component';
import { FormDemoComponent } from './demos/form-demo.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dialog', pathMatch: 'full' },
  { path: 'dialog', component: DialogDemoComponent },
  { path: 'event-bus', component: EventBusDemoComponent },
  { path: 'store', component: StoreDemoComponent },
  { path: 'translate', component: TranslateDemoComponent },
  { path: 'web', component: WebDemoComponent },
  { path: 'shortcut', component: ShortcutDemoComponent },
  { path: 'socket', component: SocketDemoComponent },
  { path: 'data-grid', component: DataGridDemoComponent },
  { path: 'form', component: FormDemoComponent },
];
