"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { BrandLoading } from '@/components/common/brand-loading';

export type DataDomain =
  | 'profile'
  | 'products'
  | 'bills'
  | 'categories'
  | 'customers'
  | 'stores'
  | 'staff'
  | 'manualEntries'
  | 'messages';

export type DomainStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * All business data domains known to the app. `messages` (per-store chat) is
 * excluded from the default preload because it needs a specific store.
 */
export const ALL_DOMAINS: DataDomain[] = [
  'profile',
  'products',
  'bills',
  'categories',
  'customers',
  'stores',
  'staff',
  'manualEntries',
];

/**
 * Default domains preloaded once per company when the provider mounts.
 * - `profile` is normally loaded by login / admin-login flows, so it is not
 *   fetched again here unless a page explicitly asks for it.
 * - `customers` are derived from bills client-side, so they run in a second
 *   wave after `bills` completes.
 */
export const DEFAULT_PRELOAD_DOMAINS: DataDomain[] = [
  'products',
  'bills',
  'categories',
  'stores',
  'staff',
  'manualEntries',
];

/* ------------------------------------------------------------------ */
/* Module-level caches (session-scoped per company).                    */
/* ------------------------------------------------------------------ */

const loadedDomainsByCompany = new Map<string, Set<DataDomain>>();
const chatLoadedByStore = new Set<string>();

// Per (company:domain) in-flight promises so concurrent mounts / pages
// never trigger duplicate network requests.
const domainInflight = new Map<string, Promise<void>>();

// Per store chat in-flight promises.
const chatInflight = new Map<string, Promise<void>>();

function isDomainLoaded(companyId: string, domain: DataDomain): boolean {
  return loadedDomainsByCompany.get(companyId)?.has(domain) ?? false;
}

function markDomainLoaded(companyId: string, domain: DataDomain) {
  let set = loadedDomainsByCompany.get(companyId);
  if (!set) {
    set = new Set();
    loadedDomainsByCompany.set(companyId, set);
  }
  set.add(domain);
}

function readSession(): { companyId?: string; mode?: string } {
  if (typeof window === 'undefined') return {};
  return {
    companyId: localStorage.getItem('companyId') ?? undefined,
    mode: localStorage.getItem('stockflowDataMode') ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Context                                                              */
/* ------------------------------------------------------------------ */

export interface AppDataContextValue {
  companyId?: string;
  mode?: string;
  statusMap: Record<DataDomain, DomainStatus>;
  isInitializing: boolean;
  isReady: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  loadedDomains: DataDomain[];
  isDomainLoaded: (domain: DataDomain) => boolean;
  ensureLoaded: (domains?: DataDomain[]) => Promise<void>;
  ensureStoreChatLoaded: (storeId: string, companyId: string) => Promise<void>;
  refresh: (domains?: DataDomain[]) => Promise<void>;
  reloadAll: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const SESSION_CHANGE_EVENT = 'stockflow:session-change';

interface AppDataProviderProps {
  children: React.ReactNode;
  /** Domains to preload on mount/company change. Defaults to DEFAULT_PRELOAD_DOMAINS. */
  domains?: DataDomain[];
  /** Explicit company (e.g. storeportal uses sessionStorage instead of localStorage). */
  companyId?: string;
  /** Explicit data mode override. */
  mode?: string;
  /** Called after the initial preload completes. */
  onReady?: () => void;
}

const initialAllStatus = (): Record<DataDomain, DomainStatus> =>
  ALL_DOMAINS.reduce((acc, d) => { acc[d] = 'idle'; return acc; }, {} as Record<DataDomain, DomainStatus>);

function runDomainLoad(domain: DataDomain, companyId: string, storeId?: string): Promise<unknown> {
  const store = () => useInventoryStore.getState();
  switch (domain) {
    case 'profile': return store().fetchCompanyProfile(companyId);
    case 'products': return store().fetchProducts(companyId);
    case 'bills': return store().fetchBills(companyId);
    case 'categories': return store().fetchCategories(companyId);
    case 'customers': return store().fetchCustomers(companyId);
    case 'stores': return store().fetchStores(companyId);
    case 'staff': return store().fetchStaff(companyId);
    case 'manualEntries': return store().fetchManualEntries(companyId);
    case 'messages': {
      if (!storeId) return Promise.resolve();
      return store().fetchMessagesForStore(storeId, companyId);
    }
    default: return Promise.resolve();
  }
}

export function AppDataProvider({ children, domains = DEFAULT_PRELOAD_DOMAINS, companyId: explicitCompanyId, mode: explicitMode, onReady }: AppDataProviderProps) {
  const [session, setSession] = useState<{ companyId?: string; mode?: string }>(() =>
    explicitCompanyId || explicitMode ? { companyId: explicitCompanyId, mode: explicitMode } : readSession()
  );
  const [statusMap, setStatusMap] = useState<Record<DataDomain, DomainStatus>>(initialAllStatus);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const companyId = session.companyId;
  const mode = session.mode;
  const readyNotified = useRef(false);
  const preloadDomainsKey = useMemo(() => domains.join(','), [domains]);
  const preloadDomains: DataDomain[] = useMemo(() => preloadDomainsKey.split(',') as DataDomain[], [preloadDomainsKey]);

  const setDomainStatus = useCallback((domain: DataDomain, status: DomainStatus) => {
    setStatusMap(prev => ({ ...prev, [domain]: status }));
  }, []);

  // Keeps the provider in sync when the session changes (login/logout/switch,
  // including from another tab).
  useEffect(() => {
    const sync = () => {
      const next = explicitCompanyId || explicitMode
        ? { companyId: explicitCompanyId, mode: explicitMode }
        : readSession();
      setSession(prev => {
        if (prev.companyId === next.companyId && prev.mode === next.mode) return prev;
        return next;
      });
    };
    window.addEventListener('storage', sync);
    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
    };
  }, [explicitCompanyId, explicitMode]);

  // Ensure the persisted store has rehydrated before local-mode filtering.
  const waitForHydration = useCallback(async () => {
    if (mode !== 'local') return;
    try {
      if (useInventoryStore.persist.hasHydrated()) return;
      await new Promise<void>(resolve => {
        let settled = false;
        let unsub: (() => void) | undefined;
        const timeout = setTimeout(() => {
          if (!settled) { settled = true; resolve(); }
        }, 3000);
        try {
          unsub = useInventoryStore.persist.onFinishHydration(() => {
            if (!settled) { settled = true; clearTimeout(timeout); resolve(); }
          });
        } catch {
          if (!settled) { settled = true; clearTimeout(timeout); resolve(); }
        }
      });
    } catch {
      // hydrated or resolved via timeout
    }
  }, [mode]);

  /**
   * Ensures a set of domains is loaded for the current company. Deduplicated:
   * returns instantly (no network) when already loaded, otherwise shares the
   * single in-flight request. `customers` always waits for `bills` first.
   */
  const ensureLoaded = useCallback(
    async (domainsArg?: DataDomain[]) => {
      const cid = companyId;
      if (!cid) {
        return;
      }
      let targets = (domainsArg && domainsArg.length ? domainsArg : ALL_DOMAINS).slice();
      if (targets.includes('customers') && !targets.includes('bills')) targets.push('bills');

      const missing = targets.filter(d => !isDomainLoaded(cid, d));
      if (missing.length === 0) return;

      // Wave 1: everything except customers. Wave 2: customers (needs bills).
      const wave1 = missing.filter(d => d !== 'customers');
      const wave2 = missing.filter(d => d === 'customers');

      const runWave = async (list: DataDomain[]) => {
        await Promise.all(list.map(domain => {
          const key = `${cid}:${domain}`;
          if (domainInflight.has(key)) return domainInflight.get(key);
          const promise = (async () => {
            setDomainStatus(domain, 'loading');
            try {
              await runDomainLoad(domain, cid);
              markDomainLoaded(cid, domain);
              setDomainStatus(domain, 'loaded');
            } catch (err) {
              console.error(`AppDataProvider: failed to load "${domain}" for ${cid}:`, err);
              setDomainStatus(domain, 'error');
              setError(String(err instanceof Error ? err.message : err));
            }
          })();
          domainInflight.set(key, promise);
          promise.finally(() => domainInflight.delete(key)).catch(() => {});
          return promise;
        }));
      };

      if (wave1.length) await runWave(wave1);
      if (wave2.length) await runWave(wave2);
      setLastSyncedAt(new Date());
    },
    [companyId, setDomainStatus]
  );

  /** Re-fetches even if already loaded (used by refresh/reload). */
  const refresh = useCallback(
    async (domainsArg?: DataDomain[]) => {
      const cid = companyId;
      if (!cid) return;
      const targets = (domainsArg && domainsArg.length ? domainsArg : ALL_DOMAINS).slice();
      targets.forEach(d => loadedDomainsByCompany.get(cid)?.delete(d));
      setIsRefreshing(true);
      try {
        await ensureLoaded(targets);
      } finally {
        setIsRefreshing(false);
        setLastSyncedAt(new Date());
      }
    },
    [companyId, ensureLoaded]
  );

  const reloadAll = useCallback(async () => {
    const cid = companyId;
    if (!cid) return;
    loadedDomainsByCompany.delete(cid);
    chatLoadedByStore.clear();
    await refresh(DEFAULT_PRELOAD_DOMAINS);
  }, [companyId, refresh]);

  const ensureStoreChatLoaded = useCallback(
    async (storeId: string, cid: string) => {
      if (chatLoadedByStore.has(storeId)) return;
      const key = `chat:${storeId}`;
      if (chatInflight.has(key)) return chatInflight.get(key);
      const promise = (async () => {
        setDomainStatus('messages', 'loading');
        try {
          await runDomainLoad('messages', cid, storeId);
          chatLoadedByStore.add(storeId);
          setDomainStatus('messages', 'loaded');
        } catch (err) {
          console.error(`AppDataProvider: failed to load chat for store ${storeId}:`, err);
          setDomainStatus('messages', 'error');
          setError(String(err instanceof Error ? err.message : err));
        }
      })();
      chatInflight.set(key, promise);
      promise.finally(() => chatInflight.delete(key)).catch(() => {});
      await promise;
    },
    [setDomainStatus]
  );

  // Initial preload happens once per mounted provider (per company/mode).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await waitForHydration();
      if (cancelled) return;
      if (!companyId) {
        setIsInitializing(false);
        setError('No active company detected.');
        return;
      }
      setIsInitializing(true);
      setError(null);
      await ensureLoaded(preloadDomains);
      if (cancelled) return;
      setIsInitializing(false);
      setLastSyncedAt(new Date());
      if (!readyNotified.current) {
        readyNotified.current = true;
        onReady?.();
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, mode, preloadDomains, onReady, waitForHydration, ensureLoaded]);

  const isDomainLoadedCb = useCallback(
    (domain: DataDomain) => (companyId ? isDomainLoaded(companyId, domain) : true),
    [companyId]
  );

  const loadedDomains = useMemo(() => {
    if (!companyId) return [] as DataDomain[];
    return [...(loadedDomainsByCompany.get(companyId) ?? [])];
  }, [companyId, statusMap]);

  const value = useMemo<AppDataContextValue>(() => ({
    companyId,
    mode,
    statusMap,
    isInitializing,
    isReady: !isInitializing && !!companyId,
    isRefreshing,
    error,
    lastSyncedAt,
    loadedDomains,
    isDomainLoaded: isDomainLoadedCb,
    ensureLoaded,
    ensureStoreChatLoaded,
    refresh,
    reloadAll,
  }), [companyId, mode, statusMap, isInitializing, isRefreshing, error, lastSyncedAt, loadedDomains, isDomainLoadedCb, ensureLoaded, ensureStoreChatLoaded, refresh, reloadAll]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

/** Access the universal data manager. */
export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within an <AppDataProvider>.');
  }
  return ctx;
}

/**
 * Convenience hook: ensures the given domains are loaded (no-op when the
 * universal manager has already preloaded them) and resolves instantly.
 */
export function useEnsureDomains(domains?: DataDomain[]) {
  const ctx = useAppData();
  useEffect(() => {
    ctx.ensureLoaded(domains);
  }, [ctx.ensureLoaded, domains?.join(',')]);
  return ctx;
}

/**
 * Convenience hook for per-store chat: ensures messages for a store are
 * loaded exactly once.
 */
export function useEnsureStoreChat(storeId?: string) {
  const { ensureStoreChatLoaded } = useAppData();
  useEffect(() => {
    if (!storeId) return;
    const cid = typeof window !== 'undefined' ? (localStorage.getItem('companyId') ?? undefined) : undefined;
    if (cid) ensureStoreChatLoaded(storeId, cid);
  }, [storeId, ensureStoreChatLoaded]);
}

/**
 * Rendering gate: blocks children until the universal preload finishes so the
 * first paint already has data. Use it at the app-shell level.
 */
export function DataReadyGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { isReady } = useAppData();
  if (!isReady) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <BrandLoading size={56} text="Loading data…" />
      </div>
    );
  }
  return <>{children}</>;
}