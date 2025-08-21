/* eslint-disable @typescript-eslint/no-explicit-any */
export type Artifact = {
  artifact_id: string;
  kind: string;
  name: string;
  data: any;
  version?: number | string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  provenance?: any;
};

export type WorkspaceDetail = {
  _id: string;
  workspace_id: string;

  // top-level workspace meta (as returned by artifact-service parent response)
  workspace: {
    _id: string;
    name: string;
    description?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
  };

  // --- NEW: fields present on workspace_artifacts document ---
  /** Baseline inputs captured at the time of the first (or last promoted) baseline run */
  inputs_baseline?: {
    avc?: any;
    fss?: any;
    pss?: any;
  };
  /** Version counter for inputs_baseline (if backend sets it) */
  inputs_baseline_version?: number;
  /** The last run_id that was promoted into workspace_artifacts (if tracked) */
  last_promoted_run_id?: string | null;

  // artifacts currently promoted to the workspace
  artifacts: Artifact[];

  created_at: string;
  updated_at: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};
