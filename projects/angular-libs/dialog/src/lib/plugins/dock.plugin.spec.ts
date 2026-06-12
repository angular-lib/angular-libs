import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { dockPlugin } from './dock.plugin';
import { minimize, restore } from '../actions';

@Component({
  selector: 'test-dock-cmp',
  standalone: true,
  template: '<div>Dock Dialog</div>',
})
class TestDockComponent {}

describe('dockPlugin', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      const event = new Event('close');
      this.dispatchEvent(event);
    });
  });

  afterEach(() => {
    document.querySelector('.al-dialog-taskbar')?.remove();
  });

  it('should move the dialog element into taskbar when minimized', async () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestDockComponent, {
      modal: false,
      plugins: [dockPlugin()],
    });

    try {
      expect(ref.dialogEl.open).toBe(true);
      expect(ref.dialogEl.parentElement).toBe(document.body);

      minimize(ref);

      const taskbar = document.querySelector('.al-dialog-taskbar');
      expect(taskbar).toBeTruthy();
      expect(ref.dialogEl.parentElement).toBe(taskbar);

      restore(ref);
      expect(ref.dialogEl.parentElement).toBe(document.body);
      expect(document.querySelector('.al-dialog-taskbar')).toBeNull();
    } finally {
      ref.close();
    }
  });

  it('should support customized minimization target selectors or elements', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const customTarget = document.createElement('div');
    customTarget.id = 'custom-dock';
    document.body.appendChild(customTarget);

    const ref = service.open(TestDockComponent, {
      modal: false,
      plugins: [dockPlugin({ minimizeTarget: '#custom-dock' })],
    });

    try {
      minimize(ref);
      expect(ref.dialogEl.parentElement).toBe(customTarget);

      restore(ref);
      expect(ref.dialogEl.parentElement).toBe(document.body);
    } finally {
      ref.close();
      customTarget.remove();
    }
  });
});
