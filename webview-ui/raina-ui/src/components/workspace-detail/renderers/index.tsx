/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSX } from "react";
import DocumentSwitch from "../renderers/kinds/DocumentSwitch";
import ContextMapRenderer from "./kinds/ContextMapRenderer";
import ServiceContractRenderer from "./kinds/ServiceContractRenderer";
import SequenceRenderer from "./kinds/SequenceRenderer";
import JsonFallback from "./kinds/JsonFallback";

type Props = {
  kind: string;
  data: any;
  editable: boolean;
  onChange: (updater: (draftData: any) => void) => void;
};

// Map by canonical kind. cam.document is routed via DocumentSwitch by data shape.
const map: Record<string, (p: Props) => JSX.Element> = {
  "cam.document": (p) => <DocumentSwitch {...p} />,
  "cam.context_map": (p) => <ContextMapRenderer {...p} />,
  "cam.service_contract": (p) => <ServiceContractRenderer {...p} />,
  "cam.sequence_diagram": (p) => <SequenceRenderer {...p} />,
  // "cam.capability_model": (p) => <CapabilityModelRenderer {...p} />,
  // "cam.erd": (p) => <ErdRenderer {...p} />,
  "cam.adr_index": (p) => <JsonFallback {...p} />, // placeholder
};

export function ArtifactRenderer(props: Props) {
  const Comp = map[props.kind] ?? JsonFallback;
  return <Comp {...props} />;
}
