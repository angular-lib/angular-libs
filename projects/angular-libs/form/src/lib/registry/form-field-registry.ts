import { Type } from '@angular/core';
import type { FormElementType } from '../types';

/**
 * Maps element `type` → field component. Supports parent chaining (like CellEditorRegistry).
 */
export class FormFieldRegistry {
  private readonly map = new Map<string, Type<unknown>>();

  constructor(private readonly parent: FormFieldRegistry | null = null) {}

  register(type: FormElementType | string, component: Type<unknown>): () => void {
    this.map.set(type, component);
    return () => {
      if (this.map.get(type) === component) {
        this.map.delete(type);
      }
    };
  }

  resolve(type: FormElementType | string): Type<unknown> | null {
    const hit = this.map.get(type);
    if (hit) {
      return hit;
    }
    return this.parent?.resolve(type) ?? null;
  }
}

export const defaultFormFieldRegistry = new FormFieldRegistry();
