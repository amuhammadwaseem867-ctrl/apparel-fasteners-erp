export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f4f6f8",
        color: "#17202a",
        fontFamily:
          'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          padding: "40px",
          background: "#ffffff",
          border: "1px solid #dde2e7",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            marginBottom: "12px",
            color: "#243146",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.12em",
          }}
        >
          APPAREL FASTENER ERP
        </div>

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            margin: "0",
            color: "#667085",
            fontSize: "13px",
          }}
        >
          The page you are looking for does not exist or has been moved.
        </p>

        <a
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "24px",
            minHeight: "40px",
            padding: "0 16px",
            borderRadius: "7px",
            background: "#243146",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Return to Dashboard
        </a>
      </div>
    </main>
  );
}