import * as React from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToViewport,
    getMobileSnapshot,
    getServerMobileSnapshot,
  );
}

function subscribeToViewport(onChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerMobileSnapshot() {
  return false;
}
