/**
 * DOURYA e-mail colours (same values as globals.css). Contrast on white:
 * ink 15:1, muted 7.6:1, pinkStrong 5.9:1. Ink on yellow (buttons) 13:1.
 * The white logo sits on the main pink (graphic contrast 3.4:1, above the 3:1 rule);
 * no body text is ever white on pink.
 */
export const colors = {
  pink: "#FF3C72",
  pinkSoft: "#FF739A",
  white: "#FFFFFF",
  yellow: "#FFE167",
  ink: "#2B1220",
  muted: "#6B4A5A",
  pinkStrong: "#C2185B",
  blush: "#FFF0F4",
} as const;

export const fontFamily = "'Nunito', 'Segoe UI', Arial, Helvetica, sans-serif";
