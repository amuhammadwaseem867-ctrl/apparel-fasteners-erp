import "../globals.css";

export default function AuthLayout({ children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f5f7",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "18px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        {children}
      </div>
    </main>
  );
}
