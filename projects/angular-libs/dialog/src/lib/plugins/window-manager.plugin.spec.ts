import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../dialog.service';
import { windowManagerPlugin } from './window-manager.plugin';
import { minimize, restore } from '../actions';

@Component({
  selector: 'test-desktop-cmp',
  standalone: true,
  template: '<div>Desktop Dialog</div>',
})
class TestDesktopComponent {}

describe('windowManagerPlugin', () => {
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

  it('should initialize underlying composed plugins (draggable, snapping, dock)', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestDesktopComponent, {
      modal: false,
      plugins: [windowManagerPlugin()],
    });

    try {
      expect(ref.dialogEl.open).toBe(true);

      // Verify dock plugin features
      minimize(ref);
      const taskbar = document.querySelector('.al-dialog-taskbar');
      expect(taskbar).toBeTruthy();
      expect(ref.dialogEl.parentElement).toBe(taskbar);

      restore(ref);
      expect(ref.dialogEl.parentElement).toBe(document.body);
    } finally {
      ref.close();
    }
  });

  it('should respect false flags to disable selective sub-plugins', () => {
    TestBed.configureTestingModule({
      providers: [DialogService],
    });
    const service = TestBed.inject(DialogService);

    const ref = service.open(TestDesktopComponent, {
      modal: false,
      plugins: [windowManagerPlugin({ dock: false })],
    });

    try {
      minimize(ref);
      // Since dock is disabled, the minimize() core call sets states but no taskbar is rendered!
      const taskbar = document.querySelector('.al-dialog-taskbar');
      expect(taskbar).toBeNull();
    } finally {
      ref.close();
    }
  });
});
