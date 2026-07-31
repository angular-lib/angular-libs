import { Directive, signal, input, output } from '@angular/core';

export interface FileRejection {
  file: File;
  reason: 'type' | 'size';
}

/**
 * A standalone directive to easily enable drag-and-drop file areas in any component.
 * Tracks custom active drag hover states reactively via Signals, supports accept & size filters.
 *
 * @example
 * ```html
 * <div
 *   alFileDrop
 *   accept=".csv,.xlsx"
 *   [maxFileSize]="5000000"
 *   (filesDropped)="onFilesUploaded($event)"
 *   (fileRejected)="onRejected($event)"
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
  host: {
    '[class.al-file-drop-over]': 'isOver()',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class AlFileDropDirective {
  /** Optional file type / extension filter, e.g. '.csv,.xlsx' or 'image/*,application/pdf'. */
  readonly accept = input<string>();

  /** Optional maximum allowed file size in bytes. */
  readonly maxFileSize = input<number>();

  /** Reactive state indicating if files are currently hovering above the target DOM drop zones. */
  readonly isOver = signal<boolean>(false);

  /** Emits the native drop `FileList` when at least one file is accepted.
   *  This is the browser's original list and may still include rejected entries —
   *  prefer `filesDropped` for the filtered `File[]`, and `fileRejected` for rejects. */
  readonly fileDrop = output<FileList>();

  /** Emits only files that passed `accept` / `maxFileSize` validation. */
  readonly filesDropped = output<File[]>();

  /** Emits array of rejected files with failure reason ('type' or 'size'). */
  readonly fileRejected = output<FileRejection[]>();

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const related = event.relatedTarget as Node | null;
    const current = event.currentTarget as Node | null;
    // Ignore leave events that bubble when moving into a child of the drop zone.
    if (related && current && current.contains(related)) {
      return;
    }
    this.isOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isOver.set(false);

    const rawFileList = event.dataTransfer?.files;
    if (!rawFileList || rawFileList.length === 0) {
      return;
    }

    const rawFiles = Array.from(rawFileList);
    const acceptedFiles: File[] = [];
    const rejectedFiles: FileRejection[] = [];

    const acceptFilter = this.accept();
    const maxFileSizeFilter = this.maxFileSize();

    for (const file of rawFiles) {
      if (acceptFilter && !this.isFileTypeAccepted(file, acceptFilter)) {
        rejectedFiles.push({ file, reason: 'type' });
      } else if (maxFileSizeFilter && file.size > maxFileSizeFilter) {
        rejectedFiles.push({ file, reason: 'size' });
      } else {
        acceptedFiles.push(file);
      }
    }

    if (rejectedFiles.length > 0) {
      this.fileRejected.emit(rejectedFiles);
    }

    if (acceptedFiles.length > 0) {
      this.filesDropped.emit(acceptedFiles);
      this.fileDrop.emit(rawFileList);
    }
  }

  private isFileTypeAccepted(file: File, accept: string): boolean {
    if (!accept || !accept.trim()) return true;
    const acceptTypes = accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    return acceptTypes.some((type) => {
      if (type.startsWith('.')) {
        return fileName.endsWith(type);
      }
      if (type.endsWith('/*')) {
        const baseType = type.replace('/*', '');
        return fileType.startsWith(baseType + '/');
      }
      return fileType === type;
    });
  }
}
