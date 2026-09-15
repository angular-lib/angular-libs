import { TestBed } from '@angular/core/testing';
import { DefaultDialogComponent } from './default-dialog.component';

describe('DefaultDialogComponent', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = vi.fn();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it('should have default tooltips configured', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    const component = fixture.componentInstance;

    // Set show minimize, maximize, and fullscreen icons so they render in template
    fixture.componentRef.setInput('showMinimizeIcon', true);
    fixture.componentRef.setInput('showMaximizeIcon', true);
    fixture.componentRef.setInput('showFullscreenIcon', true);
    // Mimic isNonModal to allow minimize icon
    component['isNonModal'] = true;

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    
    // Find buttons by their class
    const buttons = element.querySelectorAll<HTMLButtonElement>('.al-action-icon');
    
    // Expecting 4 buttons (minimize, maximize, fullscreen, close)
    expect(buttons.length).toBe(4);
    
    expect(buttons[0].getAttribute('title')).toBe('Minimize');
    expect(buttons[1].getAttribute('title')).toBe('Maximize');
    expect(buttons[2].getAttribute('title')).toBe('Fullscreen');
    expect(buttons[3].getAttribute('title')).toBe('Close');
  });

  it('should allow custom tooltips via inputs', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('showMinimizeIcon', true);
    fixture.componentRef.setInput('showMaximizeIcon', true);
    fixture.componentRef.setInput('showFullscreenIcon', true);
    // Set custom tooltips
    fixture.componentRef.setInput('minimizeTooltip', 'Minimize Window');
    fixture.componentRef.setInput('maximizeTooltip', 'Maximize Window');
    fixture.componentRef.setInput('restoreTooltip', 'Restore State');
    fixture.componentRef.setInput('fullscreenTooltip', 'Go Fullscreen');
    fixture.componentRef.setInput('exitFullscreenTooltip', 'Exit Full');
    fixture.componentRef.setInput('closeTooltip', 'Close Window');
    
    component['isNonModal'] = true;

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>('.al-action-icon');

    expect(buttons[0].getAttribute('title')).toBe('Minimize Window');
    expect(buttons[1].getAttribute('title')).toBe('Maximize Window');
    expect(buttons[2].getAttribute('title')).toBe('Go Fullscreen');
    expect(buttons[3].getAttribute('title')).toBe('Close Window');
  });

  it('should show restore and exit-fullscreen tooltips when maximized/fullscreen', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('showMaximizeIcon', true);
    fixture.componentRef.setInput('showFullscreenIcon', true);
    fixture.componentRef.setInput('restoreTooltip', 'Restore State');
    fixture.componentRef.setInput('exitFullscreenTooltip', 'Exit Full');

    // Spy/Mock properties
    vi.spyOn(component, 'isMaximized', 'get').mockReturnValue(true);
    (component as any).isFullscreenState.set(true);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const buttons = element.querySelectorAll<HTMLButtonElement>('.al-action-icon');

    // buttons[0] is Maximize/Restore button, buttons[1] is Fullscreen, buttons[2] is Close
    expect(buttons[0].getAttribute('title')).toBe('Restore State');
    expect(buttons[1].getAttribute('title')).toBe('Exit Full');
  });

  it('should omit the header when there is nothing to show', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    fixture.componentRef.setInput('showCloseIcon', false);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.al-dialog-header')).toBeNull();
  });

  it('should render the header when a title is set', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    fixture.componentRef.setInput('showCloseIcon', false);
    fixture.componentRef.setInput('title', 'Hello');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.al-dialog-header')).not.toBeNull();
    expect(element.querySelector('.al-dialog-title')?.textContent?.trim()).toBe('Hello');
  });

  it('exposes stable data-al-dialog-part hooks', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    fixture.componentRef.setInput('title', 'Hello');
    fixture.componentRef.setInput('contentText', 'Body');
    fixture.componentRef.setInput('primaryButtonText', 'OK');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-al-dialog-part="container"]')).not.toBeNull();
    expect(element.querySelector('[data-al-dialog-part="header"]')).not.toBeNull();
    expect(element.querySelector('[data-al-dialog-part="title"]')?.textContent?.trim()).toBe('Hello');
    expect(element.querySelector('[data-al-dialog-part="content"]')).not.toBeNull();
    expect(element.querySelector('[data-al-dialog-part="message"]')?.textContent?.trim()).toBe('Body');
    expect(element.querySelector('[data-al-dialog-action="primary"]')?.textContent?.trim()).toBe(
      'OK',
    );
    expect(element.querySelector('[data-al-dialog-action="close"]')).not.toBeNull();
  });

  it('applies headless chrome class when appearance is headless', () => {
    const fixture = TestBed.createComponent(DefaultDialogComponent);
    fixture.componentRef.setInput('appearance', 'headless');
    fixture.componentRef.setInput('title', 'T');
    fixture.detectChanges();

    const container = (fixture.nativeElement as HTMLElement).querySelector('.al-dialog-container');
    expect(container?.classList.contains('al-dialog-chrome-headless')).toBe(true);
  });
});
