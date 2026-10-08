"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import "./login.css";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(
      "erp_login_email",
    );

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
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

      if (rememberMe) {
        window.localStorage.setItem(
          "erp_login_email",
          email.trim().toLowerCase(),
        );
      } else {
        window.localStorage.removeItem("erp_login_email");
      }

      router.replace("/administration");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="erp-login">
      <section className="erp-login__brand">
        <div className="erp-login__brand-inner">
          <div className="erp-login__logo">
            <Image
              src="/logo in white.png"
              alt="Apparel Fastener"
              width={360}
              height={110}
              priority
            />
          </div>

          <div className="erp-login__brand-content">
            <span className="erp-login__eyebrow">
              APPAREL FASTENER ERP
            </span>

            <h1>
              Your operations,
              <br />
              in one system.
            </h1>

            <p>
              Manage commercial and manufacturing operations
              through one connected business platform.
            </p>
          </div>

          <div className="erp-login__brand-footer">
            <span>SECURE BUSINESS PLATFORM</span>
            <span>LAHORE · PAKISTAN</span>
          </div>
        </div>
      </section>

      <section className="erp-login__panel">
        <div className="erp-login__form-area">
          <div className="erp-login__mobile-logo">
            <Image
              src="/logo in navy.png"
              alt="Apparel Fastener"
              width={300}
              height={90}
              priority
            />
          </div>

          <div className="erp-login__heading">
            <div className="erp-login__security-icon">
              <ShieldCheck size={18} strokeWidth={1.9} />
            </div>

            <span className="erp-login__section-label">
              SECURE ACCESS
            </span>

            <h2>Welcome back</h2>

            <p>
              Sign in to continue to the Apparel Fastener ERP.
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
            <div className="erp-login__field">
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
                  disabled={loading}
                />
              </div>
            </div>

            <div className="erp-login__field">
              <div className="erp-login__label-row">
                <label htmlFor="erp-login-password">
                  Password
                </label>

                <button
                  type="button"
                  className="erp-login__forgot"
                  onClick={() =>
                    setError(
                      "Password recovery will be connected to the authentication system.",
                    )
                  }
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={17} strokeWidth={1.8} />
                  ) : (
                    <Eye size={17} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            <label className="erp-login__remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                disabled={loading}
              />

              <span className="erp-login__checkbox">
                <span />
              </span>

              <span>Remember this email</span>
            </label>

            <button
              type="submit"
              className="erp-login__submit"
              disabled={
                loading ||
                !email.trim() ||
                password.length < 8
              }
            >
              <span>
                {loading ? "Signing in..." : "Sign in to ERP"}
              </span>

              {loading ? (
                <span className="erp-login__spinner" />
              ) : (
                <ArrowRight size={18} strokeWidth={2} />
              )}
            </button>
          </form>

          <div className="erp-login__notice">
            <ShieldCheck size={15} strokeWidth={1.8} />

            <span>
              Authorized personnel only. Access is protected
              by server-side authentication.
            </span>
          </div>

          <footer className="erp-login__footer">
            <span>APPAREL FASTENER ERP</span>
            <span>v1.0</span>
          </footer>
        </div>
      </section>
    </main>
  );
}