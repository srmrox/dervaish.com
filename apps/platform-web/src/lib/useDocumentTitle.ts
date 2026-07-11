import { useEffect } from "react";

/** Set the document title for basic SEO / shareable tabs.
 *  (Full SSR/pre-render for public pages is a later phase.) */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Dervaish` : "Dervaish";
    return () => {
      document.title = "Dervaish";
    };
  }, [title]);
}
