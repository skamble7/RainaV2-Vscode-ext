/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/components/workspace-detail/renderers/index.tsx
import type { JSX } from "react";
import DocumentSwitch from "./kinds/DocumentSwitch";           // cam.document (+ doc_type back-compat)
import ContextMapRenderer from "./kinds/ContextMapRenderer";   // cam.context_map
import CapabilityModelRenderer from "./kinds/CapabilityModelRenderer"; // cam.capability_model
import ServiceContractRenderer from "./kinds/ServiceContractRenderer"; // cam.service_contract
import SequenceRenderer from "./kinds/SequenceRenderer";       // cam.sequence_diagram
import ErdRenderer from "./kinds/ErdRenderer";                 // cam.erd
import AdrIndexRenderer from "./kinds/AdrIndexRenderer";       // cam.adr_index
import JsonFallback from "./kinds/JsonFallback";

type Props = {
  kind: string;
  data: any;
  editable: boolean;
  onChange: (updater: (draftData: any) => void) => void;
};

const map: Record<string, (p: Props) => JSX.Element> = {
  "cam.document": (p) => <DocumentSwitch {...p} />,
  "cam.context_map": (p) => <ContextMapRenderer {...p} />,
  "cam.capability_model": (p) => <CapabilityModelRenderer {...p} />,
  "cam.service_contract": (p) => <ServiceContractRenderer {...p} />,
  "cam.sequence_diagram": (p) => <SequenceRenderer {...p} />,
  "cam.erd": (p) => <ErdRenderer {...p} />,
  "cam.adr_index": (p) => <AdrIndexRenderer {...p} />,
};

export function ArtifactRenderer(props: Props) {
  const Comp = map[props.kind] ?? JsonFallback;
  return <Comp {...props} />;
}
