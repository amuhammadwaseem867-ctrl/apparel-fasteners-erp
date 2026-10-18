/*
 * The AF7 company document frame (company documents: sales tax invoice,
 * gate pass, packing list, order sheet): logo and address on the left,
 * document title on the right, numbered sections, signature boxes, the
 * company stamp box and the "Quality / Innovation / Sustainability" band.
 */

import "./Af7Document.css";

export function Af7Page({ company, title, subtitle, children }) {
  return (
    <article className="print-doc__page af7">
      <header className="af7__head">
        {/* eslint-disable-next-line @next/next/no-img-element -- printed documents need the plain image */}
        <img className="af7__logo" src="/af7-logo.png" alt="AF7" />
        <div className="af7__company">
          <strong>{company.name}</strong>
          <span className="af7__city">LAHORE · PAKISTAN</span>
          {company.address && <span>{company.address}</span>}
          {[company.phone, company.email].filter(Boolean).length > 0 && <span>{[company.phone, company.email].filter(Boolean).join(" · ")}</span>}
          {company.taxRegistration && <span>NTN / STRN: {company.taxRegistration}</span>}
        </div>
        <div className="af7__title">
          <h1>{title}</h1>
          {subtitle}
        </div>
      </header>
      {children}
      <footer className="af7__band">
        <span>QUALITY / INNOVATION / SUSTAINABILITY</span>
        <span>{company.website}</span>
      </footer>
    </article>
  );
}

export function Af7Section({ number, title, children, className = "" }) {
  return (
    <section className={`af7__section ${className}`}>
      <h2>{number ? `${number}. ` : ""}{title}</h2>
      {children}
    </section>
  );
}

/* Label : value rows, as on the paper forms. Empty values print a line to fill by hand. */
export function Af7Fields({ rows }) {
  return (
    <dl className="af7__fields">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value || " "}</dd></div>
      ))}
    </dl>
  );
}

export function Af7Stamp() {
  return (
    <div className="af7__stamp-box">
      <span>COMPANY STAMP</span>
      <div className="af7__stamp">AF7<br />STAMP</div>
    </div>
  );
}

export function Af7Signatures({ roles, stamp = true }) {
  return (
    <div className="af7__signatures">
      {roles.map(([role, name]) => (
        <div key={role} className="af7__signature">
          <strong>{role}</strong>
          <span>Name : {name || ""}</span>
          <span>Signature :</span>
          <span>Date :</span>
        </div>
      ))}
      {stamp && <Af7Stamp />}
    </div>
  );
}
