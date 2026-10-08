"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  AlertCircle,
  Loader2,
} from "lucide-react";

import "./Profile.css";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result?.success) {
          window.location.href = "/login";
          return;
        }

        setUser(result.data);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  async function handlePasswordChange(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/auth/change-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        setError(
          result?.message ||
            result?.error?.message ||
            "Unable to change password.",
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setMessage(
        result?.data?.message ||
          "Password changed successfully.",
      );
    } catch {
      setError(
        "Unable to connect to the server. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">
          <Loader2 size={20} className="profile-loading__icon" />
          <span>Loading profile...</span>
        </div>
      </main>
    );
  }

  const role = user?.roles?.[0]
    ?.replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <main className="profile-page">
      <div className="profile-page__header">
        <div>
          <span className="profile-page__eyebrow">
            Administration
          </span>

          <h1>My Profile</h1>

          <p>
            Manage your account information and security.
          </p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card profile-card--identity">
          <div className="profile-card__heading">
            <div className="profile-card__icon">
              <UserRound size={19} />
            </div>

            <div>
              <h2>Personal Information</h2>
              <p>Your ERP account information.</p>
            </div>
          </div>

          <div className="profile-identity">
            <div className="profile-avatar">
              {user?.name
                ?.split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "U"}
            </div>

            <div>
              <strong>{user?.name}</strong>
              <span>{role || "User"}</span>
            </div>
          </div>

          <div className="profile-fields">
            <div className="profile-field">
              <span>Employee Code</span>
              <strong>{user?.employeeCode || "—"}</strong>
            </div>

            <div className="profile-field">
              <span>Email</span>
              <strong>
                <Mail size={15} />
                {user?.email || "—"}
              </strong>
            </div>

            <div className="profile-field">
              <span>Phone</span>
              <strong>
                <Phone size={15} />
                {user?.phone || "Not provided"}
              </strong>
            </div>

            <div className="profile-field">
              <span>Account Status</span>
              <strong className="profile-status">
                <CheckCircle2 size={15} />
                {user?.status || "UNKNOWN"}
              </strong>
            </div>

            <div className="profile-field">
              <span>Access Level</span>
              <strong>
                <ShieldCheck size={15} />
                {role || "User"}
              </strong>
            </div>
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-card__heading">
            <div className="profile-card__icon">
              <KeyRound size={19} />
            </div>

            <div>
              <h2>Change Password</h2>
              <p>
                Changing your password signs out other active
                sessions.
              </p>
            </div>
          </div>

          {message && (
            <div className="profile-alert profile-alert--success">
              <CheckCircle2 size={17} />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="profile-alert profile-alert--error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form
            className="profile-password-form"
            onSubmit={handlePasswordChange}
          >
            <label>
              <span>Current Password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />
            </label>

            <label>
              <span>New Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <label>
              <span>Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <div className="profile-password-note">
              Use at least 8 characters. For better security,
              use a combination of letters, numbers and symbols.
            </div>

            <button
              type="submit"
              className="profile-submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="profile-loading__icon" />
                  Updating...
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  Update Password
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
