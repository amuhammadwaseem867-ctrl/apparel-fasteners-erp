"use client";

import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import "./welcome.css";

export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <section className="welcome-visual">
        <div className="welcome-visual__inner">
          <div className="welcome-top">
            <Image
              src="/logo in white.png"
              alt="Apparel Fastener"
              width={320}
              height={92}
              priority
              className="welcome-logo"
            />
          </div>

          <div className="welcome-content">
            <span className="welcome-eyebrow">
              APPAREL FASTENER ERP
            </span>

            <h1>
              Manufacturing
              <br />
              operations,
              <br />
              connected.
            </h1>

            <p>
              A centralized business platform for managing sales,
              products, inventory, production, quality, dispatch
              and financial operations.
            </p>

            <div className="welcome-actions">
              <a href="/login" className="welcome-button">
                <span>Enter ERP</span>
                <ArrowRight size={19} strokeWidth={2} />
              </a>
            </div>
          </div>

          <div className="welcome-bottom">
            <div>
              <ShieldCheck size={16} strokeWidth={1.8} />
              <span>SECURE BUSINESS PLATFORM</span>
            </div>

            <span>LAHORE · PAKISTAN</span>
          </div>
        </div>
      </section>

      <section className="welcome-side">
        <div className="welcome-side__content">
          <span className="welcome-side__label">
            OPERATIONS PLATFORM
          </span>

          <h2>
            One system.
            <br />
            Every operation.
          </h2>

          <p>
            Apparel Fastener ERP brings your commercial and
            manufacturing workflows into one connected operating
            environment.
          </p>

          <div className="welcome-side__modules">
            <div>
              <span>01</span>
              <strong>Sales & CRM</strong>
            </div>

            <div>
              <span>02</span>
              <strong>Products & Inventory</strong>
            </div>

            <div>
              <span>03</span>
              <strong>Production & Quality</strong>
            </div>

            <div>
              <span>04</span>
              <strong>Dispatch & Finance</strong>
            </div>
          </div>
        </div>

        <footer className="welcome-footer">
          <span>APPAREL FASTENER ERP</span>
          <span>v1.0</span>
        </footer>
      </section>
    </main>
  );
}