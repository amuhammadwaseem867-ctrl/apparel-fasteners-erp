"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import ProcessFlow from "@/components/brand/ProcessFlow";

import "./login.css";

const SAVED_EMAIL_KEY = "erp_login_email";

function subscribeToNothing() {
  return () => {};
}

function readSavedEmail() {
  try {
    return window.localStorage.getItem(SAVED_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function readNoSavedEmail() {
  return "";
}

export default function LoginPage() {
  const router = useRouter();
  const brandRef = useRef(null);

  /*
   * The remembered email lives in localStorage, which only exists in the
   * browser. useSyncExternalStore renders "" on the server and the saved
   * value after hydration without a setState inside an effect. Once the
   * user edits a field, their value (non-null) takes precedence.
   */
  const savedEmail = useSyncExternalStore(
    subscribeToNothing,
    readSavedEmail,
    readNoSavedEmail,
  );

  const [emailInput, setEmail] = useState(null);
  const [password, setPassword] = useState("");
  const [rememberMeInput, setRememberMe] = useState(null);

  const email = emailInput ?? savedEmail;
  const rememberMe = rememberMeInput ?? Boolean(savedEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  // Each failure alternates between two identical shake animations so it replays.
  const [attempt, setAttempt] = useState(0);

  function fail(message) {
    setError(message);
    setAttempt((current) => current + 1);
  }

  /* Spotlight follows the pointer; CSS variables avoid re-rendering. */
  function moveSpotlight(event) {
    const element = brandRef.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    element.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
    element.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading || success) {
      return;
    }

    setError("");

    if (!email.trim()) {
      fail("Please enter your email address.");
      return;
    }

    if (!password) {
      fail("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error?.message ||
            "Unable to sign in. Please check your credentials.",
        );
      }

      try {
        if (rememberMe) {
          window.localStorage.setItem(
            SAVED_EMAIL_KEY,
            email.trim().toLowerCase(),
          );
        } else {
          window.localStorage.removeItem(SAVED_EMAIL_KEY);
        }
      } catch {
        // Storage can be unavailable (private mode, blocked site data).
        // Remembering the email is a convenience; the login succeeded.
      }

      setSuccess(true);
      router.replace("/administration");
      router.refresh();
    } catch (err) {
      fail(
        err instanceof Error
          ? err.message
          : "Authentication is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || success;

  return (
    <main className="erp-login">
      <section
        ref={brandRef}
        className="erp-login__brand"
        onPointerMove={moveSpotlight}
      >
        <div className="erp-login__aurora" aria-hidden="true">
          <span className="erp-login__orb erp-login__orb--one" />
          <span className="erp-login__orb erp-login__orb--two" />
          <span className="erp-login__orb erp-login__orb--three" />
        </div>
        <div className="erp-login__grid" aria-hidden="true" />
        <div className="erp-login__spotlight" aria-hidden="true" />

        <div className="erp-login__brand-inner">
          <div className="erp-login__logo erp-rise" style={{ "--d": "0ms" }}>
            <Image
              src="/af7-logo-white.png"
              alt="AF7"
              width={186}
              height={110}
              priority
            />
          </div>

          <div className="erp-login__brand-content">
            <span className="erp-login__eyebrow erp-rise" style={{ "--d": "120ms" }}>
              AF7 ERP
            </span>

            <h1>
              <span className="erp-rise" style={{ "--d": "220ms" }}>Your operations,</span>
              <span className="erp-rise erp-login__headline-accent" style={{ "--d": "340ms" }}>in one system.</span>
            </h1>

            <p className="erp-rise" style={{ "--d": "460ms" }}>
              Sales, production, quality, dispatch, procurement and
              finance, connected end to end.
            </p>

            <div className="erp-rise" style={{ "--d": "580ms" }}>
              <div className="erp-login__flow">
                <ProcessFlow variant="row" />
              </div>
            </div>
          </div>

          <div className="erp-login__brand-footer erp-rise" style={{ "--d": "700ms" }}>
            <span>SECURE BUSINESS PLATFORM</span>
            <span>LAHORE · PAKISTAN</span>
          </div>
        </div>
      </section>

      <section className="erp-login__panel">
        <div
          className={`erp-login__form-area ${attempt ? `erp-login__form-area--shake-${attempt % 2}` : ""}`}
        >
          <div className="erp-login__mobile-logo">
            <Image
              src="/af7-logo-white.png"
              alt="AF7"
              width={152}
              height={90}
              priority
            />
          </div>

          <div className="erp-login__heading">
            <div className="erp-login__security-icon erp-rise" style={{ "--d": "150ms" }}>
              <ShieldCheck size={18} strokeWidth={1.9} />
            </div>

            <span className="erp-login__section-label erp-rise" style={{ "--d": "220ms" }}>
              SECURE ACCESS
            </span>

            <h2 className="erp-rise" style={{ "--d": "290ms" }}>Welcome back</h2>

            <p className="erp-rise" style={{ "--d": "360ms" }}>
              Sign in to continue to AF7 ERP.
            </p>
          </div>

          {error && (
            <div className="erp-login__error" role="alert">
              <span className="erp-login__error-marker" />
              <span>{error}</span>
            </div>
          )}

          <form
            className="erp-login__form"
            onSubmit={handleSubmit}
          >
            <div className="erp-login__field erp-rise" style={{ "--d": "430ms" }}>
              <label htmlFor="erp-login-email">
                Email address
              </label>

              <div className="erp-login__input">
                <Mail
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <input
                  id="erp-login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="name@company.com"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={busy}
                />
              </div>
            </div>

            <div className="erp-login__field erp-rise" style={{ "--d": "500ms" }}>
              <div className="erp-login__label-row">
                <label htmlFor="erp-login-password">
                  Password
                </label>

                <button
                  type="button"
                  className="erp-login__forgot"
                  onClick={() =>
                    setError(
                      "Ask an administrator to reset your password (Administration → Users).",
                    )
                  }
                  disabled={busy}
                >
                  Forgot password?
                </button>
              </div>

              <div className="erp-login__input">
                <LockKeyhole
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <input
                  id="erp-login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  minLength={8}
                  required
                  disabled={busy}
                />

                <button
                  type="button"
                  className="erp-login__password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  disabled={busy}
                >
                  <span key={showPassword ? "hide" : "show"} className="erp-login__toggle-icon">
                    {showPassword ? (
                      <EyeOff size={17} strokeWidth={1.8} />
                    ) : (
                      <Eye size={17} strokeWidth={1.8} />
                    )}
                  </span>
                </button>
              </div>
            </div>

            <label className="erp-login__remember erp-rise" style={{ "--d": "570ms" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                disabled={busy}
              />

              <span className="erp-login__checkbox">
                <span />
              </span>

              <span>Remember this email</span>
            </label>

            <div className="erp-rise" style={{ "--d": "640ms" }}>
              <button
                type="submit"
                className={`erp-login__submit ${success ? "erp-login__submit--success" : ""}`}
                disabled={
                  busy ||
                  !email.trim() ||
                  password.length < 8
                }
              >
                <span>
                  {success ? "Welcome" : loading ? "Signing in..." : "Sign in to ERP"}
                </span>

                {success ? (
                  <Check size={18} strokeWidth={2.4} className="erp-login__success-icon" />
                ) : loading ? (
                  <span className="erp-login__spinner" />
                ) : (
                  <ArrowRight size={18} strokeWidth={2} className="erp-login__arrow" />
                )}
              </button>
            </div>
          </form>

          <div className="erp-login__notice erp-rise" style={{ "--d": "720ms" }}>
            <ShieldCheck size={15} strokeWidth={1.8} />

            <span>
              Authorized personnel only. Access is protected
              by server-side authentication.
            </span>
          </div>

          <footer className="erp-login__footer erp-rise" style={{ "--d": "780ms" }}>
            <span>AF7 ERP</span>
            <span>v1.0</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
