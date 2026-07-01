export async function cleanupLegacyPwaArtifacts() {
  if (typeof window === "undefined") return;
  const hostname = window.location.hostname;
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname === "::1";

  if (!isLocalHost) return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map(registration => registration.unregister()));
    }
  } catch (error) {
    console.warn("[asset-composer][pwa] failed to unregister legacy service workers", error);
  }

  try {
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      const legacyKeys = cacheKeys.filter(key =>
        /workbox|vite|pwa|asset-composer/i.test(key),
      );
      await Promise.allSettled(legacyKeys.map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[asset-composer][pwa] failed to clear legacy caches", error);
  }
}
