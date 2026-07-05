import { useEffect, useRef } from "react";
import { useTheme } from "../lib/theme";

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
  const { theme } = useTheme();

  // onCredential is a fresh function identity on every render of the parent
  // (Login isn't memoized), so it's read via ref instead of being an effect
  // dependency - otherwise every parent re-render (theme toggle, auth state,
  // etc.) would re-run google.accounts.id.initialize(), which logs GSI's own
  // "initialize() is called multiple times" warning and can leave stray
  // partially-initialized instances behind.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const initializedRef = useRef(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    // index.html loads Google's script with async/defer, so it may not be
    // ready yet on first render - poll briefly rather than assume it's there.
    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled || !window.google || !containerRef.current) return;
      clearInterval(interval);
      if (!initializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => onCredentialRef.current(resp.credential),
        });
        initializedRef.current = true;
      }
      // Google's own themed button, not our CSS, so it needs re-rendering
      // (not just recoloring) when the app switches theme - "outline" reads
      // as a light-grey button that disappears on a dark card.
      containerRef.current.replaceChildren();
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
      });
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [theme]);

  return <div ref={containerRef} />;
}
