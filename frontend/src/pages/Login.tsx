import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/authContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import ThemeToggle from "../components/ThemeToggle";

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
    <div className="login-shell">
      <ThemeToggle className="login-theme-toggle" />
      <div className="login-brand-panel">
        <span className="eyebrow">
          <img src="/boncom-logo-gray.png" alt="Boncom Toolshed" className="brand-logo" />
        </span>
        <h1>One place for Boncom's internal tools.</h1>
        <p>
          Sign in with your Boncom Google account to get to Quoted and the other tools joining
          the Toolshed soon.
        </p>
      </div>
      <div className="login-form-panel">
        <div className="card login-card">
          <h2>Sign in</h2>
          <p>Use your Boncom Google account to access the Toolshed.</p>
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
    </div>
  );
}
