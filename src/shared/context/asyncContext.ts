import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  organizationId?: string;
  userId?: string;
  userRole?: string;
  method?: string;
  path?: string;
  ip?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function updateRequestContext(updates: Partial<RequestContext>): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    Object.assign(store, updates);
  }
}
