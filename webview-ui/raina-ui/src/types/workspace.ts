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
  workspace: {
    _id: string;
    name: string;
    description?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
  };
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
