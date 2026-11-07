"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Textarea } from "@/components/ui/primitives";
import { createProjectAction } from "@/server/projects/actions";

export function ProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      <div><Label htmlFor="p-name">Project name</Label><Input id="p-name" name="name" required /></div>
      <div><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" name="description" rows={3} /></div>
      <Button type="submit" disabled={pending} className="w-full">Create project</Button>
    </form>
  );
}
