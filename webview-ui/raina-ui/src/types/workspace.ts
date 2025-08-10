/* eslint-disable @typescript-eslint/no-explicit-any */
// src/types/workspace.ts
export type Artifact = {
  artifact_id: string;
  kind: string;
  name: string;
  data: any;
  version?: any;
  created_at?: any;
  updated_at?: any;
  deleted_at?: any;
  provenance?: any;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceDetail = {
  _id: string;
  workspace_id: string;
  workspace: {
    _id: string;
    name: string;
    description?: string | null;
    created_by?: string | null;
    created_at: any;
    updated_at: any;
  };
  artifacts: Artifact[];
  created_at?: any;
  updated_at?: any;
};
