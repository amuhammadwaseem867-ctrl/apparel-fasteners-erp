// Montserrat (AF7 brand font), served from the app itself.
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
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