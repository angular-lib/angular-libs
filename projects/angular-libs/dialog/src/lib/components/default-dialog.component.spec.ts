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
});
