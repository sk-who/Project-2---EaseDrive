import type { Metadata } from "next";
import { Poppins } from 'next/font/google'
import GoogleAnalytics from "@/components/GoogleAnalytics";

import "./globals.css";

const poppins = Poppins({
    subsets: ['latin'],
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: "StoreIt",
  description: "StoreIt - The only storage solution you need.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    const GA_MEASUREMENT_ID = "G-V8V9YKEBS0";

  return (
    <html lang="en">
      <body className={`${poppins.variable} font-poppins antialiased`}>
        <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />

        {children}
      </body>
    </html>
  );
}

// G - V8V9YKEBS0;