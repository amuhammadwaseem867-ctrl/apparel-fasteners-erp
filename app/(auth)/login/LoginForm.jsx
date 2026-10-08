"use client";

import Link from "next/link";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginForm() {
  return (
    <div style={{ padding: "32px 28px" }}>
      <div style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            background: "#ecfdf5",
            color: "#047857",
            marginBottom: "12px",
          }}
        >
          <ShieldCheck size={18} strokeWidth={2} />
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            lineHeight: 1.2,
            color: "#111827",
          }}
        >
          ERP Sign In
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            color: "#6b7280",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          AppareL Fastener Factory operations platform
        </p>
      </div>

      <form style={{ display: "grid", gap: "16px" }}>
        <Input
          label="Email address"
          type="email"
          placeholder="name@company.com"
          icon={Mail}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          icon={LockKeyhole}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" />
            Remember me
          </label>

          <Link href="/forgot-password" style={{ color: "#1d4ed8", textDecoration: "none" }}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="md">
          Sign In
        </Button>
      </form>
    </div>
  );
}
