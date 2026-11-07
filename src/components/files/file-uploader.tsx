"use client";

import { useRouter } from "next/navigation";
import { Uploader } from "@/components/onboarding/wizard";

export function FileUploader() {
  const router = useRouter();
  return <Uploader onUploaded={() => router.refresh()} />;
}
