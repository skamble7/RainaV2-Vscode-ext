// src/types/workspace.ts
export type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

// in future we’ll tuck *all* workspace-local state here:
export type WorkspaceState = {
  meta: Workspace;
  // artifacts?: ...
  // diagrams?: ...
};

export type ViewMode = "grid" | "list";
