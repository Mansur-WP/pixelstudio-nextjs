import QRCode from "react-qr-code";

interface GalleryQrCodeProps {
  /**
   * Either:
   *  - A relative gallery path, e.g. "/gallery/abc123"  → origin is prepended.
   *  - An absolute URL,           e.g. "mailto:..."      → used as-is.
   */
  galleryLink: string;
  /** QR code size in px (default 160) */
  size?: number;
  /** Override the heading above the code (default: "Scan to View Your Photos") */
  label?: string;
  /** Override the caption below the code */
  description?: string;
}

/**
 * Renders a QR code that points to a given URL.
 *
 * For gallery links (relative paths) the full URL is built from
 * window.location.origin so it always reflects the correct domain.
 * For absolute URLs (mailto:, https://, etc.) the value is used as-is.
 *
 * Accepts optional `label` and `description` overrides so the same
 * component can serve both confirmed gallery QR codes and draft
 * contact-info QR codes on offline invoices.
 *
 * Print-safe: renders as SVG and stays crisp at any DPI.
 */
export function GalleryQrCode({
  galleryLink,
  size = 160,
  label       = "Scan to View Your Photos",
  description = "Scan this QR code to access and download your photos.",
}: GalleryQrCodeProps) {
  // Use the value as-is when it is already an absolute URL (has a protocol),
  // otherwise prefix with the current origin so relative paths resolve correctly.
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(galleryLink);
  const fullUrl = isAbsolute ? galleryLink : `${window.location.origin}${galleryLink}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        {label}
      </p>

      {/* White padding around the QR code is required for scanners */}
      <div className="gallery-qr-wrapper bg-white p-3 rounded-xl border border-slate-200 shadow-sm inline-block">
        <QRCode
          value={fullUrl}
          size={size}
          level="M"
          style={{ display: "block" }}
        />
      </div>

      <p className="text-xs text-slate-500 text-center max-w-[200px] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
