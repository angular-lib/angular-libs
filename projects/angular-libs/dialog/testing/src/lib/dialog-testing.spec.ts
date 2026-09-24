import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService, defineDialog, injectDialog } from '@angular-libs/dialog';
import {
  DialogTestingController,
  provideDialogTesting,
  wrapDialogServiceForTesting,
} from './dialog-testing';

@Component({ selector: 'dt-pick', template: '<p>{{ label() }}</p>' })
class PickComponent {
  readonly label = input.required<string>();
  readonly dialog = injectDialog<number>();
}

const PickDialog = defineDialog(PickComponent);

describe('dialog testing helpers', () => {
  let service: DialogService;
  let controller: DialogTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideDialogTesting() });
    service = TestBed.inject(DialogService);
    controller = TestBed.inject(DialogTestingController);
  });

  afterEach(() => {
    document.querySelectorAll('dialog').forEach((el) => el.remove());
  });

  it('tracks open calls without a manual wrap step', async () => {
    const ref = service.open(PickDialog, { label: 'Pick' }, { size: 'sm' });
    expect(controller.openCalls).toHaveLength(1);
    expect(controller.openCalls[0].component).toBe(PickComponent);
    expect(controller.openCalls[0].options).toMatchObject({ size: 'sm', inputs: { label: 'Pick' } });
    expect(controller.last).toBe(ref);
    await controller.flushClose(7);
    expect(await ref.outcome).toEqual({ ok: true, value: 7, source: 'manual' });
  });

  it('manual wrap after auto-wrap is a no-op', () => {
    wrapDialogServiceForTesting(service, controller);
    service.open(PickDialog, { label: 'Once' });
    expect(controller.openCalls).toHaveLength(1);
  });

  it('stub answers run() without rendering', async () => {
    controller.stub(PickDialog, (inputs: { label: string }) => ({
      ok: true,
      value: inputs.label.length,
      source: 'manual',
    }));
    const outcome = await service.run(PickDialog, { label: 'abcd' });
    expect(outcome).toEqual({ ok: true, value: 4, source: 'manual' });
    expect(controller.runCalls).toEqual([
      { definition: PickDialog, inputs: { label: 'abcd' }, stubbed: true },
    ]);
    expect(controller.openCalls).toHaveLength(0);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('unstubbed run() opens through the tracked path', async () => {
    const pending = service.run(PickDialog, { label: 'x' });
    expect(controller.openCalls).toHaveLength(1);
    await controller.flushClose();
    expect(await pending).toEqual({ ok: false, reason: 'manual' });
  });
});
