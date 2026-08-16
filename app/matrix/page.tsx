import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import MatrixCanvas from "@/components/matrix/MatrixCanvas";

/**
 * MIFTACH'S MATRIX lives outside the (site) layout group on purpose: it is a
 * full-bleed game surface, so it takes no header, footer or page chrome.
 *
 * Typography per the GDD: a pixel-mono HUD as the 1995 handshake, and variable
 * expanded grotesk on the layer cards to say 2070. Deliberately none of the
 * fonts that ship pre-installed on the idea of "cyber".
 */

const hud = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mm-hud",
  display: "swap",
});

const body = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mm-body",
  display: "swap",
});

const title = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-mm-title",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Miftach's Matrix",
  description:
    "Ride the inside of a live data conduit as the intrusion payload Miftach compiled. Ten layers down to root, ten percent faster every layer.",
};

export const viewport: Viewport = {
  themeColor: "#05060B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MatrixPage() {
  return (
    <div className={`mm-root ${hud.variable} ${body.variable} ${title.variable}`}>
      <MatrixCanvas />
    </div>
  );
}
