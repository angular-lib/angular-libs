import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService, injectDialog } from '@angular-libs/dialog';
import { DialogTestingController, provideDialogTesting } from './dialog-testing';

@Component({ template: '<p>{{ label() }}</p>' })
class Pick {
  readonly label = input.required<string>();
  readonly dialog = injectDialog<number>();
}

describe('provideDialogTesting', () => {
  let dialog: DialogService;
  let controller: DialogTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDialogTesting() });
    dialog = TestBed.inject(DialogService);
    controller = TestBed.inject(DialogTestingController);
  });

  it('answers stubbed components without rendering', async () => {
    controller.stub(Pick, (inputs: { label: string }) => ({ ok: true, value: inputs.label.length, source: 'manual' }));
    const outcome = await dialog.open(Pick, { label: 'abcd' }).closed;
    expect(outcome).toEqual({ ok: true, value: 4, source: 'manual' });
    expect(document.querySelector('dialog')).toBeNull();
    expect(controller.calls).toEqual([{ component: Pick, inputs: { label: 'abcd' } }]);
  });

  it('renders unstubbed components in a working <dialog>', async () => {
    const ref = dialog.open(Pick, { label: 'real' });
    expect((ref.element as HTMLDialogElement).open).toBe(true);
    expect(ref.element.textContent).toContain('real');
    await ref.close(1);
    expect(await ref.closed).toEqual({ ok: true, value: 1, source: 'manual' });
  });
});
