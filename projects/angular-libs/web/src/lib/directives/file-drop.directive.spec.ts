import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlFileDropDirective, FileRejection } from './file-drop.directive';

@Component({
  template: `
    <div
      alFileDrop
      [accept]="acceptTypes()"
      [maxFileSize]="maxSize()"
      (fileDrop)="onFileDrop($event)"
      (filesDropped)="onFilesDropped($event)"
      (fileRejected)="onFileRejected($event)"
      #dropDir="alFileDrop"
      id="drop-zone"
    >
      <span id="over-status">{{ dropDir.isOver() }}</span>
    </div>
  `,
  imports: [AlFileDropDirective],
  standalone: true,
})
class TestHostComponent {
  acceptTypes = signal<string | undefined>(undefined);
  maxSize = signal<number | undefined>(undefined);

  droppedFileList?: FileList;
  droppedFilesArray: File[] = [];
  rejectedFilesArray: FileRejection[] = [];

  onFileDrop(files: FileList) {
    this.droppedFileList = files;
  }

  onFilesDropped(files: File[]) {
    this.droppedFilesArray = files;
  }

  onFileRejected(rejections: FileRejection[]) {
    this.rejectedFilesArray = rejections;
  }
}

describe('AlFileDropDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).createComponent(TestHostComponent);

    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create host component and directive', () => {
    expect(component).toBeTruthy();
  });

  it('should set isOver signal to true on dragover and false on dragleave', () => {
    const dropZone = fixture.nativeElement.querySelector('#drop-zone');

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    dropZone.dispatchEvent(dragOverEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#over-status').textContent).toBe('true');
    expect(dropZone.classList.contains('al-file-drop-over')).toBe(true);

    const dragLeaveEvent = new Event('dragleave', { bubbles: true, cancelable: true });
    dropZone.dispatchEvent(dragLeaveEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#over-status').textContent).toBe('false');
    expect(dropZone.classList.contains('al-file-drop-over')).toBe(false);
  });

  it('should process dropped accepted files', () => {
    const dropZone = fixture.nativeElement.querySelector('#drop-zone');
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    });

    dropZone.dispatchEvent(dropEvent);
    fixture.detectChanges();

    expect(component.droppedFilesArray.length).toBe(1);
    expect(component.droppedFilesArray[0].name).toBe('test.txt');
    expect(component.rejectedFilesArray.length).toBe(0);
  });

  it('should reject files exceeding maxFileSize', () => {
    component.maxSize.set(10); // 10 bytes
    fixture.detectChanges();

    const dropZone = fixture.nativeElement.querySelector('#drop-zone');
    const file = new File(['a large content file exceeding max size'], 'large.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 100 });

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    });

    dropZone.dispatchEvent(dropEvent);
    fixture.detectChanges();

    expect(component.rejectedFilesArray.length).toBe(1);
    expect(component.rejectedFilesArray[0].reason).toBe('size');
    expect(component.droppedFilesArray.length).toBe(0);
  });

  it('should reject files not matching accept filter', () => {
    component.acceptTypes.set('.pdf,image/*');
    fixture.detectChanges();

    const dropZone = fixture.nativeElement.querySelector('#drop-zone');
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'name', { value: 'notes.txt' });
    Object.defineProperty(file, 'type', { value: 'text/plain' });

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] },
    });

    dropZone.dispatchEvent(dropEvent);
    fixture.detectChanges();

    expect(component.rejectedFilesArray.length).toBe(1);
    expect(component.rejectedFilesArray[0].reason).toBe('type');
    expect(component.droppedFilesArray.length).toBe(0);
  });
});
