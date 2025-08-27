/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/components/workspace-detail/renderers/kinds/DocumentSwitch.tsx
import DocumentRenderer from "./DocumentRenderer";
import ServiceCatalogRenderer from "./ServiceCatalogRenderer";
import ApiContractsRenderer from "./ApiContractsRenderer";
import JsonFallback from "./JsonFallback";

export default function DocumentSwitch({
  data, editable, onChange,
}: { data: any; editable: boolean; onChange: (u: (d: any) => void) => void }) {
  // Route by explicit doc_type first
  if (data?.doc_type === "api_contracts") {
    return <ApiContractsRenderer data={data} editable={editable} onChange={onChange} />;
  }
  // Add more: if (data?.doc_type === "event_catalog") return <EventCatalogRenderer ... />
  //          if (data?.doc_type === "nfr_matrix") return <NfrMatrixRenderer ... />

  // Heuristic: service catalog (no doc_type, has services array with owner-ish fields)
  if (Array.isArray(data?.services) && !data?.doc_type) {
    return <ServiceCatalogRenderer data={data} editable={editable} onChange={onChange} />;
  }

  // Rich document (title/sections)
  if (data?.title || Array.isArray(data?.sections)) {
    return <DocumentRenderer data={data} editable={editable} onChange={onChange} />;
  }

  return <JsonFallback data={data} />;
}
