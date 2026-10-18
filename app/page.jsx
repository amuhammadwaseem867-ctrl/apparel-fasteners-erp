"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Factory,
  Landmark,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

import "./welcome.css";

const HEADLINE = [["Manufacturing"], ["operations,"], ["connected.", true]];

const MODULES = [
  { icon: ShoppingCart, title: "Sales & CRM", text: "Customers, orders, approvals" },
  { icon: Boxes, title: "Products & Inventory", text: "Item master, stock, batches" },
  { icon: Factory, title: "Planning & Production", text: "BOM, MRP, nine-stage flow" },
  { icon: ClipboardCheck, title: "Quality", text: "Inspections, NCR, CAPA" },
  { icon: Truck, title: "Packing & Dispatch", text: "Packing lists, challans" },
  { icon: Landmark, title: "Finance", text: "Invoices, payables, ledger" },
  { icon: Users, title: "People & Payroll", text: "Attendance, leave, payslips" },
  { icon: BarChart3, title: "Reports", text: "Live reports, CSV export" },
];

const TEETH = 22;

/* Decorative zipper: two rows of teeth that interlock as the slider passes. */
function ZipperArt() {
  return (
    <div className="wz" aria-hidden="true">
      <div className="wz__track">
        {Array.from({ length: TEETH }, (_, index) => <span key={`l${index}`} className="wz__tooth wz__tooth--left" style={{ "--i": index }} />)}
      </div>
      <div className="wz__track wz__track--right">
        {Array.from({ length: TEETH }, (_, index) => <span key={`r${index}`} className="wz__tooth wz__tooth--right" style={{ "--i": index }} />)}
      </div>
      <span className="wz__slider"><span className="wz__pull" /></span>
    </div>
  );
}

export default function WelcomePage() {
  const pageRef = useRef(null);
  const ctaRef = useRef(null);

  /* Pointer-driven light and a gentle pull on the main button (CSS variables, no re-render). */
  function onPointerMove(event) {
    const page = pageRef.current;
    if (page) {
      page.style.setProperty("--spot-x", `${event.clientX}px`);
      page.style.setProperty("--spot-y", `${event.clientY}px`);
    }
  }

  function onCtaMove(event) {
    const button = ctaRef.current;
    if (!button) return;
    const box = button.getBoundingClientRect();
    button.style.setProperty("--pull-x", `${(event.clientX - box.left - box.width / 2) * 0.18}px`);
    button.style.setProperty("--pull-y", `${(event.clientY - box.top - box.height / 2) * 0.25}px`);
  }

  function onCtaLeave() {
    ctaRef.current?.style.setProperty("--pull-x", "0px");
    ctaRef.current?.style.setProperty("--pull-y", "0px");
  }

  function onCardMove(event) {
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  return (
    <main ref={pageRef} className="welcome" onPointerMove={onPointerMove}>
      <div className="welcome__aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="welcome__grid" aria-hidden="true" />
      <div className="welcome__spotlight" aria-hidden="true" />

      <header className="welcome__bar">
        <Image src="/af7-logo-white.png" alt="AF7" width={156} height={92} priority className="welcome__logo" />
        <Link href="/login" className="welcome__signin">
          Sign in
          <ArrowRight size={15} strokeWidth={2.2} />
        </Link>
      </header>

      <section className="welcome__hero">
        <span className="welcome__eyebrow w-rise" style={{ "--d": "100ms" }}>
          <span className="welcome__dot" />
          AF7 ERP
        </span>

        <h1 className="welcome__title">
          {HEADLINE.map(([word, accent], index) => (
            <span key={word} className="welcome__line">
              <span className={`welcome__word${accent ? " welcome__word--accent" : ""}`} style={{ "--d": `${250 + index * 140}ms` }}>
                {word}
              </span>
            </span>
          ))}
        </h1>

        <p className="w-rise" style={{ "--d": "720ms" }}>
          One platform for sales, products, inventory, production, quality,
          dispatch, procurement, finance and payroll, from the first order to
          the last payment.
        </p>

        <div className="welcome__actions w-rise" style={{ "--d": "860ms" }}>
          <Link
            ref={ctaRef}
            href="/login"
            className="welcome__cta"
            onPointerMove={onCtaMove}
            onPointerLeave={onCtaLeave}
          >
            <span>Enter ERP</span>
            <ArrowRight size={19} strokeWidth={2} />
          </Link>
          <span className="welcome__secure">
            <ShieldCheck size={16} strokeWidth={1.8} />
            Authorised personnel only
          </span>
        </div>

        <div className="w-rise" style={{ "--d": "1000ms" }}>
          <ZipperArt />
        </div>
      </section>

      <section className="welcome__modules" aria-label="Modules">
        {MODULES.map(({ icon: Icon, title, text }, index) => (
          <article key={title} className="welcome__card" style={{ "--d": `${1050 + index * 80}ms` }} onPointerMove={onCardMove}>
            <span className="welcome__card-icon"><Icon size={19} strokeWidth={1.9} /></span>
            <span className="welcome__card-number">{String(index + 1).padStart(2, "0")}</span>
            <strong>{title}</strong>
            <small>{text}</small>
          </article>
        ))}
      </section>

      <footer className="welcome__footer">
        <span>SECURE BUSINESS PLATFORM</span>
        <span>LAHORE · PAKISTAN</span>
        <span>v1.0</span>
      </footer>
    </main>
  );
}
