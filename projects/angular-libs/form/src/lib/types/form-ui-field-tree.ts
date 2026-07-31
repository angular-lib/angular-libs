/**
 * Intentional boundary type for FieldTree across form UI components.
 * Angular's FieldTree generics are invariant across model types in templates;
 * cast once at AlSignalForm / group boundaries instead of sprinkling `$any`.
 */
export type FormUiFieldTree = FieldTreeForUi;

// Separate alias so call sites read as UI-boundary, not "give up on types".
type FieldTreeForUi = import('@angular/forms/signals').FieldTree<any>;
