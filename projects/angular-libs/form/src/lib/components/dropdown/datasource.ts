import type { FormDropdownDatasource, FormDropdownLoaderParams } from '../../types';
import type { DropdownItem } from './dropdown-utils';

export interface DatasourceController {
  items: () => readonly DropdownItem[];
  loading: () => boolean;
  error: () => string | null;
  hasMore: () => boolean;
  reset: (searchTerm?: string) => void;
  loadNext: () => Promise<void>;
  setStaticItems: (items: readonly DropdownItem[]) => void;
  destroy: () => void;
}

export function createDatasourceController(
  config: FormDropdownDatasource | undefined,
  onItems: (items: DropdownItem[], append: boolean) => void,
  onLoading: (loading: boolean) => void,
  onError: (error: string | null) => void,
): DatasourceController {
  let items: DropdownItem[] = [];
  let loading = false;
  let error: string | null = null;
  let hasMore = true;
  let startRow = 0;
  let abort: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentSearch = '';

  const chunkSize = config?.chunkSize ?? 50;
  const debounceMs = config?.debounceMs ?? 250;

  const setLoading = (v: boolean) => {
    loading = v;
    onLoading(v);
  };

  const setError = (e: string | null) => {
    error = e;
    onError(e);
  };

  const destroy = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    abort?.abort();
    abort = null;
  };

  const loadPage = async (append: boolean, searchTerm: string) => {
    if (!config?.loader) {
      return;
    }
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    setLoading(true);
    setError(null);
    const params: FormDropdownLoaderParams = {
      abortSignal: signal,
      searchTerm: config.searchLocally ? undefined : searchTerm || undefined,
      startRow,
      endRow: startRow + chunkSize,
    };
    try {
      const page = await config.loader(params);
      if (signal.aborted) {
        return;
      }
      const list = [...page];
      if (append) {
        items = [...items, ...list];
      } else {
        items = list;
      }
      hasMore = list.length >= chunkSize;
      startRow = items.length;
      onItems(items, append);
    } catch (err) {
      if (signal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to load items';
      setError(message);
      if (!append) {
        items = [];
        onItems([], false);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  };

  return {
    items: () => items,
    loading: () => loading,
    error: () => error,
    hasMore: () => hasMore,
    setStaticItems: (next) => {
      items = [...next];
      hasMore = false;
      onItems(items, false);
    },
    reset: (searchTerm = '') => {
      destroy();
      currentSearch = searchTerm;
      startRow = 0;
      hasMore = true;
      items = [];
      const run = () => {
        void loadPage(false, currentSearch);
      };
      if (config?.loader && !config.searchLocally && debounceMs > 0 && searchTerm) {
        debounceTimer = setTimeout(run, debounceMs);
      } else {
        run();
      }
    },
    loadNext: async () => {
      if (!config?.loader || loading || !hasMore) {
        return;
      }
      await loadPage(true, currentSearch);
    },
    destroy,
  };
}
