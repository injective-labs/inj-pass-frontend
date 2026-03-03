/**
 * Embed layout — overrides root layout's black body background.
 *
 * In Next.js App Router, <style> tags inside Server Components are
 * hoisted to <head> and take effect before any client-side JS runs,
 * so this reliably wins over globals.css.
 *
 * No file restructuring needed — just an extra nested layout.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Force transparent background — overrides globals.css body { background-color: #000 } */}
      <style>{`
        html,
        body,
        body.antialiased,
        #__next {
          background: transparent !important;
          background-color: transparent !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          min-height: unset !important;
          width: unset !important;
        }

        /* Hide GeometricShapes / animated-background injected by root layout */
        .animated-background,
        .animated-background::before,
        .animated-background::after {
          display: none !important;
          background: transparent !important;
        }
      `}</style>
      {children}
    </>
  );
}
