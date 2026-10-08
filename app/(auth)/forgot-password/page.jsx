"use client";

import Link from "next/link";
import { KeyRound, ArrowLeft } from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  return (
    <div style={{ padding: "32px 28px" }}>
      <div style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: "#eef2ff",
            color: "#1d4ed8",
            marginBottom: "12px",
          }}
        >
          <KeyRound size={18} strokeWidth={2} />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            lineHeight: 1.2,
            color: "#111827",
          }}
        >
          Reset Password
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          Enter your email address to receive reset instructions.
        </p>
      </div>

      <form style={{ display: "grid", gap: "16px" }}>
        <Input label="Email address" type="email" placeholder="name@company.com" />
        <Button type="submit" variant="primary" size="md">
          Send Reset Link
        </Button>
      </form>

      <div style={{ marginTop: "18px", textAlign: "center" }}>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#374151",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
