import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

/**
 * `defaultCache` finishes with catch-all rules that answer navigation and RSC requests
 * from the cache. A cached document for a redirecting route (`/` -> `/admin` ->
 * `/admin/dashboard`) is stored under the requested URL but holds the body of the final
 * target, so the App Router's canonical URL disagrees with the tree it rendered. It then
 * forces an MPA navigation, which throws mid-render and surfaces as React error #310.
 *
 * Only the immutable-asset rules use a RegExp matcher, so keeping just those leaves
 * documents, RSC payloads and API calls unmatched. Serwist skips `respondWith` when no
 * rule matches, letting the browser handle those requests and their redirects itself.
 */
const assetRuntimeCaching = defaultCache.filter(
  entry => entry.matcher instanceof RegExp && entry.matcher.source !== ".*",
);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: assetRuntimeCaching,
});

serwist.addEventListeners();
