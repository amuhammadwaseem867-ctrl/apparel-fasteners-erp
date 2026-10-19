"use client";

/*
 * The AF7 welcome page, shown before sign-in. Brand, what the ERP does
 * (the order flow from order to payment, the modules, the factory-floor
 * features) and the way in. Everything said here is what the ERP does;
 * no figures are shown. Animations are CSS only and stop for users who
 * prefer less motion.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Factory,
  FileText,
  Gauge,
  Landmark,
  PackageCheck,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

import ProcessFlow from "@/components/brand/ProcessFlow";

import "./welcome.css";

const HEADLINE = [["From order"], ["to payment,"], ["one flow.", true]];

const MODULES = [
  { icon: ShoppingCart, title: "Orders", text: "Order sheet in your sequence: product, finish, type, tape colour, slider." },
  { icon: Factory, title: "Production", text: "Nine stages with start, complete and a note at each one." },
  { icon: ClipboardCheck, title: "Quality", text: "Inspections, approvals and check points per stage." },
  { icon: PackageCheck, title: "Packing", text: "Packing lists with cartons, bags and net / gross weight." },
  { icon: Truck, title: "Dispatch", text: "Shipments and inward / outward gate passes." },
  { icon: Landmark, title: "Invoice & payment", text: "Sales tax invoices, receipts and customer balances." },
  { icon: Warehouse, title: "Inventory", text: "Raw material to finished goods, by shelf, row and column." },
  { icon: Users, title: "HR & Payroll", text: "Employees, attendance, leave and payslips." },
];

const FEATURES = [
  { icon: Gauge, title: "Check points at every stage", text: "Shade, fastness, teeth gap, plating, stops, length. A stage cannot complete until its checks pass." },
  { icon: Scale, title: "Kilograms to pieces", text: "Tape is weighed in kg through dyeing and pressing; teeth making counts the order's pieces." },
  { icon: FileText, title: "AF7 documents", text: "Order sheet, sales tax invoice, gate pass and packing list, printed in your own layout." },
  { icon: BarChart3, title: "Every order traceable", text: "One profile shows where an order is, who did what, what is next and what is blocking it." },
];

/* Adds "is-in" to [data-reveal] elements as they scroll into view. */
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = root.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-in"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [rootRef]);
}

export default function WelcomePage() {
  const pageRef = useRef(null);
  const ctaRef = useRef(null);
  const cardRef = useRef(null);
  useReveal(pageRef);

  /* Pointer light, the flow card's tilt and the button's pull, all through CSS variables. */
  function onPointerMove(event) {
    const page = pageRef.current;
    if (page) {
      page.style.setProperty("--spot-x", `${event.clientX}px`);
      page.style.setProperty("--spot-y", `${event.clientY}px`);
    }
    const card = cardRef.current;
    if (card) {
      const box = card.getBoundingClientRect();
      const x = Math.max(-0.5, Math.min(0.5, (event.clientX - box.left) / box.width - 0.5));
      const y = Math.max(-0.5, Math.min(0.5, (event.clientY - box.top) / box.height - 0.5));
      card.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(x * 8).toFixed(2)}deg`);
    }
  }

  function onCtaMove(event) {
    const button = event.currentTarget;
    const box = button.getBoundingClientRect();
    button.style.setProperty("--pull-x", `${(event.clientX - box.left - box.width / 2) * 0.18}px`);
    button.style.setProperty("--pull-y", `${(event.clientY - box.top - box.height / 2) * 0.25}px`);
  }

  function onCtaLeave(event) {
    event.currentTarget.style.setProperty("--pull-x", "0px");
    event.currentTarget.style.setProperty("--pull-y", "0px");
  }

  function onCardMove(event) {
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  }

  return (
    <main ref={pageRef} className="welcome" onPointerMove={onPointerMove}>
      <div className="welcome__backdrop" aria-hidden="true">
        <span className="welcome__orb welcome__orb--a" />
        <span className="welcome__orb welcome__orb--b" />
        <span className="welcome__orb welcome__orb--c" />
        <span className="welcome__grid" />
        <span className="welcome__spotlight" />
        <span className="welcome__sparks">
          {Array.from({ length: 14 }, (_, index) => <i key={index} style={{ "--s": index }} />)}
        </span>
      </div>

      <header className="welcome__bar">
        <Link href="/" className="welcome__brand" aria-label="AF7 home">
          <Image src="/af7-logo-white.png" alt="AF7" width={100} height={59} priority className="welcome__logo" />
        </Link>
        <nav className="welcome__nav" aria-label="Welcome">
          <a href="#flow">How it works</a>
          <a href="#modules">Modules</a>
          <Link href="/login" className="welcome__signin">
            Sign in
            <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
        </nav>
      </header>

      <section className="welcome__hero">
        <div className="welcome__intro">
          <span className="welcome__eyebrow w-rise" style={{ "--d": "80ms" }}>
            <span className="welcome__dot" />
            AF7 ERP · Lahore, Pakistan
          </span>

          <h1 className="welcome__title">
            {HEADLINE.map(([word, accent], index) => (
              <span key={word} className="welcome__line">
                <span className={`welcome__word${accent ? " welcome__word--accent" : ""}`} style={{ "--d": `${220 + index * 150}ms` }}>
                  {word}
                </span>
              </span>
            ))}
          </h1>

          <p className="welcome__lead w-rise" style={{ "--d": "720ms" }}>
            The AF7 system for zippers and apparel fasteners: order sheets,
            production stages, quality checks, packing, dispatch, invoices and
            payments, connected so every order can be followed end to end.
          </p>

          <div className="welcome__actions w-rise" style={{ "--d": "860ms" }}>
            <Link ref={ctaRef} href="/login" className="welcome__cta" onPointerMove={onCtaMove} onPointerLeave={onCtaLeave}>
              <span>Enter ERP</span>
              <ArrowRight size={19} strokeWidth={2} />
            </Link>
            <a href="#flow" className="welcome__ghost">See the flow</a>
          </div>

          <span className="welcome__secure w-rise" style={{ "--d": "1000ms" }}>
            <ShieldCheck size={16} strokeWidth={1.8} />
            Authorised personnel only · every action is recorded
          </span>
        </div>

        <div className="welcome__stage w-rise" style={{ "--d": "520ms" }}>
          <div ref={cardRef} className="welcome__flowcard">
            <span className="welcome__ring" aria-hidden="true" />
            <div className="welcome__flowcard-head">
              <Image src="/af7-mark-white.png" alt="" width={64} height={30} className="welcome__mark" />
              <span>Order flow</span>
              <span className="welcome__live"><i /> Step by step</span>
            </div>
            <ProcessFlow variant="column" />
          </div>
        </div>
      </section>

      <section id="flow" className="welcome__band" data-reveal>
        <div className="welcome__section-head">
          <span className="welcome__kicker">How it works</span>
          <h2>Seven steps, one screen for each order.</h2>
          <p>Each step unlocks the next. The system shows what to do now and what is blocking it, and keeps a note of every step.</p>
        </div>
        <ProcessFlow variant="row" />
      </section>

      <section id="modules" className="welcome__section">
        <div className="welcome__section-head" data-reveal>
          <span className="welcome__kicker">Modules</span>
          <h2>Everything an order needs.</h2>
        </div>
        <div className="welcome__modules">
          {MODULES.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="welcome__card" data-reveal style={{ "--d": `${index * 70}ms` }} onPointerMove={onCardMove}>
              <span className="welcome__card-icon"><Icon size={20} strokeWidth={1.9} /></span>
              <span className="welcome__card-number">{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <small>{text}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="welcome__section">
        <div className="welcome__section-head" data-reveal>
          <span className="welcome__kicker">Built for the factory floor</span>
          <h2>Made around how AF7 works.</h2>
        </div>
        <div className="welcome__features">
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="welcome__feature" data-reveal style={{ "--d": `${index * 90}ms` }}>
              <span className="welcome__feature-icon"><Icon size={22} strokeWidth={1.8} /></span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="welcome__final" data-reveal>
        <Boxes size={26} strokeWidth={1.6} aria-hidden="true" />
        <h2>Ready to start the day?</h2>
        <p>Sign in with the account your administrator gave you.</p>
        <Link href="/login" className="welcome__cta welcome__cta--light" onPointerMove={onCtaMove} onPointerLeave={onCtaLeave}>
          <span>Sign in to AF7 ERP</span>
          <ArrowRight size={19} strokeWidth={2} />
        </Link>
      </section>

      <footer className="welcome__footer">
        <Image src="/af7-logo-white.png" alt="AF7" width={54} height={32} />
        <span>Plot# 33 B Punjab Small Sundar Industrial Estate II, Raiwind Road, Lahore</span>
        <a href="https://www.afgroup.com.hk/AF7" target="_blank" rel="noreferrer">www.afgroup.com.hk/AF7</a>
      </footer>
    </main>
  );
}
