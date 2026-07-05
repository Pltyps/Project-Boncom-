import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/authContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleCredential(idToken: string) {
    setError(null);
    try {
      const { token, user } = await api.loginWithGoogle(idToken);
      login(token, user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="card" style={{ padding: "2.5rem", textAlign: "center", maxWidth: 360 }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Quoted</h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
          Sign in to view and manage estimates.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleSignInButton onCredential={handleCredential} />
        </div>
        {error && (
          <p className="field-error" style={{ marginTop: "1rem" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
