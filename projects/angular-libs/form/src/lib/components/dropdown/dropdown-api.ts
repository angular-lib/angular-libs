export type DropdownItem = Record<string, unknown>;

export interface AlDropdownApi {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  isLoading: () => boolean;
  getItems: () => readonly DropdownItem[];
  setItems: (items: readonly DropdownItem[]) => void;
  getValue: () => readonly DropdownItem[];
  setValue: (rows: readonly DropdownItem[]) => void;
  selectById: (id: unknown) => void;
  selectByIds: (ids: readonly unknown[]) => void;
  reload: () => void;
  create: (term: string) => Promise<void>;
  expand: (id: unknown) => void;
  collapse: (id: unknown) => void;
}
