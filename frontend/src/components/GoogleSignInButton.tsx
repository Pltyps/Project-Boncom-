import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string; width?: number }) => void;
        };
      };
    };
  }
}

interface Props {
  onCredential: (idToken: string) => void;
}

// Thin wrapper around Google's own Identity Services script (loaded in
// index.html) - no @react-oauth/google or similar dependency needed for
// a single sign-in button.
export default function GoogleSignInButton({ onCredential }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    // index.html loads Google's script with async/defer, so it may not be
    // ready yet on first render - poll briefly rather than assume it's there.
    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled || !window.google || !containerRef.current) return;
      clearInterval(interval);
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
      });
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onCredential]);

  return <div ref={containerRef} />;
}
