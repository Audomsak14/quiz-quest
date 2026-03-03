"use client";

import { useEffect } from "react";

function resolveBackendOrigin() {
  const explicit = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:5000";
  const host = window.location.hostname || "localhost";
  return `http://${host}:5000`;
}

function rewriteUrl(url, targetOrigin) {
  if (!url) return url;

  if (typeof url === "string") {
    return url.replace("http://localhost:5000", targetOrigin);
  }

  if (url instanceof URL) {
    const text = url.toString().replace("http://localhost:5000", targetOrigin);
    return new URL(text);
  }

  return url;
}

export default function LocalNetworkBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__qqNetworkBridgePatched) return;

    const targetOrigin = resolveBackendOrigin();

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const rewritten = rewriteUrl(input, targetOrigin);
      return nativeFetch(rewritten, init);
    };

    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      const rewritten = rewriteUrl(url, targetOrigin);
      return nativeOpen.call(this, method, rewritten, ...rest);
    };

    window.__qqNetworkBridgePatched = true;
  }, []);

  return null;
}
