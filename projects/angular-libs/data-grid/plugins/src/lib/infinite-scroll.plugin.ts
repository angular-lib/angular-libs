import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

export interface InfiniteScrollPluginOptions {
  threshold?: number;
}

/**
 * Owns near-end scroll detection via interaction capability.
 * Re-arms when content grows while already at the bottom (ResizeObserver).
 */
export function infiniteScrollPlugin<T = unknown>(
  options: InfiniteScrollPluginOptions = {},
): DataGridPlugin<T> {
  const threshold = options.threshold ?? 240;

  return {
    id: 'infiniteScroll',
    setup(context: DataGridPluginContext<T>): () => void {
      return context.capabilities.registerInteraction({
        id: 'infiniteScroll',
        setup: (element) => {
          let armed = true;
          let lastScrollHeight = 0;

          const scrollEl = (): HTMLElement | null =>
            element.querySelector('.al-data-grid__scroll') as HTMLElement | null;

          const check = (viewport: HTMLElement): void => {
            // New data landed (taller content) — allow another near-end notify.
            if (viewport.scrollHeight > lastScrollHeight) {
              armed = true;
            }
            lastScrollHeight = viewport.scrollHeight;

            const remaining =
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            if (remaining <= threshold) {
              if (armed) {
                armed = false;
                context.api.notifyNearEnd();
              }
            } else {
              armed = true;
            }
          };

          const onScroll = (event: Event): void => {
            const viewport = event.target as HTMLElement | null;
            if (!viewport?.classList?.contains('al-data-grid__scroll')) {
              return;
            }
            check(viewport);
          };

          element.addEventListener('scroll', onScroll, true);

          let resizeObserver: ResizeObserver | null = null;
          const observeViewport = (): void => {
            const viewport = scrollEl();
            if (!viewport || typeof ResizeObserver === 'undefined') {
              return;
            }
            if (!resizeObserver) {
              resizeObserver = new ResizeObserver(() => {
                const current = scrollEl();
                if (current) {
                  check(current);
                }
              });
            }
            resizeObserver.disconnect();
            resizeObserver.observe(viewport);
            if (viewport.firstElementChild) {
              resizeObserver.observe(viewport.firstElementChild);
            }
          };

          observeViewport();
          queueMicrotask(observeViewport);

          return () => {
            element.removeEventListener('scroll', onScroll, true);
            resizeObserver?.disconnect();
          };
        },
      });
    },
  };
}
