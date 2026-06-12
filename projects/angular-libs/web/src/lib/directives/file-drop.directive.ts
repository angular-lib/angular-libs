import { Directive, HostListener, Output, EventEmitter, signal, HostBinding } from '@angular/core';

/**
 * A standalone directive to easily enable drag-and-drop file areas in any component.
 * Tracks custom active drag hover states reactively via Signals.
 *
 * @example
 * ```html
 * <div
 *   alFileDrop
 *   (fileDrop)="onFilesUploaded($event)"
 *   class="drop-zone"
 *   [class.active]="fileDropDir.isOver()"
 *   #fileDropDir="alFileDrop"
 * >
 *   Drag files here...
 * </div>
 * ```
 */
@Directive({
  selector: '[alFileDrop]',
  exportAs: 'alFileDrop',
  standalone: true,
})
export class AlFileDropDirective {
  /** Reactive state indicating if files are currently hovering above the target DOM drop zones. */
  readonly isOver = signal<boolean>(false);

  /** Emits the matching native FileList object when items are successfully dropped. */
  @Output() readonly fileDrop = new EventEmitter<FileList>();

  @HostBinding('class.al-file-drop-over') get dragOverStatus() {
    return this.isOver();
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isOver.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isOver.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fileDrop.emit(files);
    }
  }
}
