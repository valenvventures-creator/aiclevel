import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow">Settings</p>
      <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">Organization & account</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
