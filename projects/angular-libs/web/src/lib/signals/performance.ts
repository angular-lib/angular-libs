import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface PerformanceSignalState {
  /** If the Web Performance API is supported by the browser. */
  supported: boolean;
  /** Navigation timing metrics such as DOM interactive, load times. */
  navigation: {
    dnsLookup: number;
    tcpConnection: number;
    responseTime: number;
    domInteractive: number;
    domComplete: number;
    loadEventTime: number;
  } | null;
  /** Browser memory measurements (primarily Chrome/Chromium-based). */
  memory: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  } | null;
  /** Tracks page responsiveness metrics such as Paint scores (FCP). */
  vitals: {
    fcp: number | null;
    lcp: number | null;
  };
}

/**
 * Exposes core dynamic web speed and navigation metrics of the page session.
 *
 * @returns A Readonly Signal containing dynamic performance metrics.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (perf().supported) {
 *       <p>FCP: {{ perf().vitals.fcp }}ms</p>
 *       @if (perf().memory) {
 *         <p>Heap Used: {{ perf().memory?.usedJSHeapSize }} bytes</p>
 *       }
 *     }
 *   `
 * })
 * export class DiagnosticsComponent {
 *   perf = performanceSignal();
 * }
 * ```
 */
export function performanceSignal(): Signal<PerformanceSignalState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const perf = win?.performance;
  const supported = !!perf;

  const getNavigationMetrics = () => {
    if (!supported) return null;
    try {
      const entry = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!entry) return null;

      return {
        dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
        tcpConnection: entry.connectEnd - entry.connectStart,
        responseTime: entry.responseEnd - entry.requestStart,
        domInteractive: entry.domInteractive,
        domComplete: entry.domComplete,
        loadEventTime: entry.loadEventEnd - entry.loadEventStart,
      };
    } catch {
      return null;
    }
  };

  const getMemoryMetrics = () => {
    if (!supported) return null;
    const memory = (perf as any).memory;
    if (!memory) return null;

    return {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
    };
  };

  const state = signal<PerformanceSignalState>({
    supported,
    navigation: getNavigationMetrics(),
    memory: getMemoryMetrics(),
    vitals: {
      fcp: null,
      lcp: null,
    },
  });

  if (win && supported) {
    let observers: any[] = [];

    try {
      // Monitor First Contentful Paint
      const paintObserver = new win.PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find((e) => e.name === 'first-contentful-paint');
        if (fcpEntry) {
          state.update((prev) => ({
            ...prev,
            vitals: { ...prev.vitals, fcp: fcpEntry.startTime },
          }));
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
      observers.push(paintObserver);

      // Monitor Largest Contentful Paint
      const lcpObserver = new win.PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          state.update((prev) => ({
            ...prev,
            vitals: { ...prev.vitals, lcp: lastEntry.startTime },
          }));
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcpObserver);
    } catch {
      // PerformanceObserver error suppression (e.g. types unsupported on older engines)
    }

    // Capture navigation timings after onload fires fully
    const handleLoad = () => {
      // Use setTimeout to ensure performance navigation entry records are fully compiled
      win.setTimeout(() => {
        state.update((prev) => ({
          ...prev,
          navigation: getNavigationMetrics(),
          memory: getMemoryMetrics(),
        }));
      }, 0);
    };

    win.addEventListener('load', handleLoad);

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        win.removeEventListener('load', handleLoad);
        observers.forEach((obs) => obs.disconnect());
      });
    }
  }

  return state.asReadonly();
}
