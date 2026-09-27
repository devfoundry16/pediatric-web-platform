import { Font } from "@react-pdf/renderer";

/**
 * Font family used by every @react-pdf document in the app. Cairo covers both
 * Arabic and Latin, so the same family works for either locale. The built-in
 * Helvetica has no Arabic glyphs and renders Arabic text as blanks.
 *
 * Static instances (Regular 400 / Bold 700) live in /public/fonts; react-pdf
 * needs static TTF/OTF files (no woff2, variable fonts are unreliable). They
 * were instanced from Google Fonts' Cairo[slnt,wght].ttf with fontTools, and
 * the Arabic kerning pairs were rewritten from XPlacement+XAdvance on the first
 * glyph to an XAdvance on the second: react-pdf 4.x drops GPOS x-offsets when
 * drawing, which otherwise swallows the space in e.g. "التطعيمات في".
 * Regenerate them with scripts/build-pdf-fonts.py.
 */
export const PDF_FONT_FAMILY = "Cairo";

let registered = false;

/**
 * Registers the PDF font family once. PDFs are generated in the browser, so the
 * default base is the public URL path. Pass a filesystem directory when
 * rendering in Node (scripts/tests).
 */
export function registerPdfFonts(baseUrl = "/fonts"): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: `${baseUrl}/Cairo-Regular.ttf`, fontWeight: "normal" },
      { src: `${baseUrl}/Cairo-Bold.ttf`, fontWeight: "bold" },
    ],
  });

  // Never hyphenate/split words: react-pdf's default English hyphenation can
  // break Arabic words mid-word and destroy letter joining.
  Font.registerHyphenationCallback((word) => [word]);
}
