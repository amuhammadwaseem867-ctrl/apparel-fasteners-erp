// Montserrat (AF7 brand font), variable weights 100-900, served from the app itself.
import "@fontsource-variable/montserrat/wght.css";
import "./globals.css";
import "./premium-theme.css";

export const metadata = {
  title: "AF7 ERP",
  description: "Manufacturing, inventory, sales, production and business management system.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}