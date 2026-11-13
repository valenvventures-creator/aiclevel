"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ImagePicker } from "@/components/projects/image-picker";
import { LocationPicker } from "@/components/projects/location-picker";
import { createProjectAction, updateProjectAction } from "@/server/projects/actions";
import type { Project } from "@/types/domain";

const STATUSES = [["ACTIVE", "Active"], ["ON_HOLD", "On hold"], ["COMPLETED", "Completed"], ["ARCHIVED", "Archived"]] as const;

/** Create a project, or edit one (name, description, status, image and location). */
export function ProjectForm({ project }: { project?: Project }) {
  const [state, action, pending] = useActionState(project ? updateProjectAction : createProjectAction, {});
  const v = state.values;
  return (
    <form action={action} className="space-y-4">
      {project && <input type="hidden" name="id" value={project.id} />}
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.message && <Alert tone="ok">{state.message}</Alert>}
      <div><Label htmlFor="p-name">Project name</Label><Input id="p-name" name="name" required maxLength={120} defaultValue={v?.name ?? project?.name ?? ""} /></div>
      <div><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" name="description" rows={3} maxLength={2000} defaultValue={v?.description ?? project?.description ?? ""} /></div>
      {project && (
        <div>
          <Label htmlFor="p-status">Status</Label>
          <Select id="p-status" name="status" defaultValue={v?.status ?? project.status}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </div>
      )}
      <ImagePicker initialId={v ? v.image_file_id || null : project?.image_file_id} />
      <LocationPicker initial={v ? { label: v.location_label ?? null, latitude: v.latitude ? Number(v.latitude) : null, longitude: v.longitude ? Number(v.longitude) : null } : { label: project?.location_label ?? null, latitude: project?.latitude ?? null, longitude: project?.longitude ?? null }} />
      <Button type="submit" disabled={pending} className="w-full">{pending && <Loader2 className="size-4 animate-spin" />} {project ? "Save project" : "Create project"}</Button>
    </form>
  );
}
