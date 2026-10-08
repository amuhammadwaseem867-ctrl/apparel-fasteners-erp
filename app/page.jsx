"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import "./login.css";

export default function LoginPage() {
  const [currentYear, setCurrentYear] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    setCurrentYear(String(new Date().getFullYear()));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!form.password) {
      setError("Please enter your password.");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const payload = await response.json();

      if (!response.ok || payload.success === false) {
        setError(payload?.error?.message || "Authentication failed.");
        return;
      }

      window.location.assign("/administration");
    } catch (error) {
      setError("Authentication is temporarily unavailable.");
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-panel__inner">
          <div className="login-brand-panel__top">
            <div className="login-brand-panel__logo">
              <Image
                src="/logos/logo in navy.png"
                alt="Apparel Fastener"
                width={420}
                height={120}
                priority
              />
            </div>
          </div>

          <div className="login-brand-panel__content">
            <span className="login-brand-panel__eyebrow">
              APPAREL FASTENER ERP
            </span>

            <h1>
              Production.
              <br />
              Precision.
              <br />
              Control.
            </h1>

            <p>
              A centralized platform for managing orders, production,
              inventory, quality, packing and delivery across the
              Apparel Fastener manufacturing operation.
            </p>
          </div>

          <div className="login-brand-panel__footer">
            <span>APPAREL FASTENER</span>
            <span>LAHORE · PAKISTAN</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-mobile-logo">
            <Image
              src="/logos/logo in navy.png"
              alt="Apparel Fastener"
              width={300}
              height={90}
              priority
            />
          </div>

          <div className="login-heading">
            <span className="login-heading__eyebrow">
              SECURE ACCESS
            </span>

            <h2>Welcome back</h2>

            <p>
              Sign in to access the Apparel Fastener ERP.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="login-field">
              <label htmlFor="email">
                Email address
              </label>

              <div className="login-input-wrapper">
                <Mail
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-field__label-row">
                <label htmlFor="password">
                  Password
                </label>

                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => {
                    setError(
                      "Password recovery will be connected to the authentication system."
                    );
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <div className="login-input-wrapper">
                <LockKeyhole
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.8} />
                  ) : (
                    <Eye size={18} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            <label className="login-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
              />

              <span className="login-checkbox">
                <span />
              </span>

              <span>Remember me</span>
            </label>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
            >
              <span>Sign in</span>
              <ArrowRight
                size={18}
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
          </form>

          <div className="login-security">
            <span className="login-security__line" />

            <p>
              Authorized personnel only
            </p>

            <span className="login-security__line" />
          </div>

          <p className="login-copyright">
            © {currentYear} Apparel Fastener.
            All rights reserved.
          </p>
        </div>
      </section>
    </main>
  );
}