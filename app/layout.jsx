import "./globals.css";

export const metadata = {
  title: "Apparel Fastener ERP",
  description: "Manufacturing, inventory, sales, production and business management system.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}