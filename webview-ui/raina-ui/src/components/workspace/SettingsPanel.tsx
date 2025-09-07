/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/workspace/SettingsPanel.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Settings } from "lucide-react";

type Props = {
  /** Hooks to wire later when we build the tabs */
  onOpenCam?: () => void;
  onOpenCapabilityPack?: () => void;
};

export default function SettingsPanel({
  onOpenCam,
  onOpenCapabilityPack,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[420px] sm:w-[520px] bg-neutral-950 border-neutral-800"
      >
        <SheetHeader>
          <SheetTitle>Settings &amp; Tools</SheetTitle>
          <SheetDescription>
            Admin panels for managing models and packs.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {/* CAM */}
          <div className="flex items-start justify-between rounded-xl border border-neutral-800 p-4">
            <div className="pr-3">
              <div className="font-medium">Canonical Artifact Model (CAM)</div>
              <p className="text-sm text-neutral-400">
                Create &amp; maintain artifact kinds, schemas, and validators.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenCam?.();
              }}
            >
              Open
            </Button>
          </div>

          {/* Capability Pack */}
          <div className="flex items-start justify-between rounded-xl border border-neutral-800 p-4">
            <div className="pr-3">
              <div className="font-medium">Capability Packs</div>
              <p className="text-sm text-neutral-400">
                Design and manage discovery packs &amp; playbooks.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                onOpenCapabilityPack?.();
              }}
            >
              Open
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
