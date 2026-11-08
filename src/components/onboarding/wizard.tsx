"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { completeOnboarding, saveOnboardingStep, type OnboardingState } from "@/server/onboarding/actions";
import { cn } from "@/lib/utils";

/**
 * 18-step onboarding grouped into 9 screens. Each screen persists server-side
 * so onboarding can be resumed.
 */
const SCREENS = [
  { title: "About you", steps: "Step 1 · Personal information", spec: [1] },
  { title: "Your organization", steps: "Steps 2–4 · Organization, industry, role", spec: [2, 3, 4] },
  { title: "Mission & vision", steps: "Steps 5–6", spec: [5, 6] },
  { title: "Business model & strategy", steps: "Steps 7–9 · Model, objectives, priorities", spec: [7, 8, 9] },
  { title: "Audiences & voice", steps: "Steps 10–11", spec: [10, 11] },
  { title: "Risk & priorities", steps: "Steps 12–15 · Risk, finance, technology, impact", spec: [12, 13, 14, 15] },
  { title: "Foundational documents", steps: "Step 16", spec: [16] },
  { title: "Plan", steps: "Step 17", spec: [17] },
  { title: "Enter C-Level HQ", steps: "Step 18", spec: [18] },
] as const;

export interface WizardDefaults {
  first_name: string;
  last_name: string;
  title: string;
  org_name: string;
  industry: string;
  constitution: Record<string, string>;
  startStep: number;
}

export function OnboardingWizard({ defaults }: { defaults: WizardDefaults }) {
  const [screen, setScreen] = useState(defaults.startStep);
  const [state, action, pending] = useActionState(async (prev: OnboardingState, fd: FormData) => {
    const res = await saveOnboardingStep(prev, fd);
    if (res.ok && typeof res.step === "number") setScreen(res.step);
    return res;
  }, {});
  const [completing, setCompleting] = useState(false);

  const c = defaults.constitution;
  const current = SCREENS[screen];
  const pct = Math.round(((current.spec[current.spec.length - 1]) / 18) * 100);

  return (
    <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
      <nav aria-label="Onboarding progress" className="hidden lg:block">
        <ol className="space-y-1">
          {SCREENS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                disabled={i > screen}
                onClick={() => setScreen(i)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition", i === screen ? "bg-gold-400/[0.08] text-gold-200" : i < screen ? "text-ivory hover:bg-white/[0.03]" : "text-ivory-faint")}
                aria-current={i === screen ? "step" : undefined}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[10px]", i < screen ? "border-gold-500 bg-gold-500 text-ink-950" : i === screen ? "border-gold-400 text-gold-300" : "border-line-strong")}>
                  {i < screen ? <Check className="size-3.5" /> : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="min-w-0">
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-ivory-muted">
            <span className="font-mono tracking-[0.2em]">{current.steps.toUpperCase()}</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <h1 className="mt-6 font-heading text-3xl font-semibold sm:text-4xl">{current.title}</h1>
        </div>

        {state.error && (
          <div className="mb-4">
            <Alert tone="risk">{state.error}</Alert>
          </div>
        )}

        {screen < 6 && (
          <form action={action} className="plate space-y-5 p-6 sm:p-8" key={screen}>
            <input type="hidden" name="step" value={screen} />
            {screen === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="First name" name="first_name" d={defaults.first_name} required />
                  <F label="Last name" name="last_name" d={defaults.last_name} required />
                </div>
                <F label="Your role / title" name="title" d={defaults.title} placeholder="Founder & CEO" />
              </>
            )}
            {screen === 1 && (
              <>
                <F label="Organization name" name="name" d={defaults.org_name} required placeholder="Acme Holdings" />
                <F label="Industry" name="industry" d={defaults.industry} placeholder="e.g. Financial services, Healthcare, Nonprofit" />
                <F label="Your role in the organization" name="title" d={defaults.title} placeholder="Founder & CEO" />
                <p className="text-xs text-ivory-faint">You&apos;ll be the Owner. Your seven A.I. Executives are created when you continue.</p>
              </>
            )}
            {screen === 2 && (
              <>
                <T label="Mission" name="mission" d={c.mission} hint="Why does the organization exist?" />
                <T label="Vision" name="vision" d={c.vision} hint="What future are you building toward?" />
                <T label="Values" name="values" d={c.values} hint="Optional — the principles your executives should respect." />
              </>
            )}
            {screen === 3 && (
              <>
                <T label="Business model" name="business_model" d={c.business_model} hint="How do you create and capture value?" />
                <T label="Strategic objectives" name="strategic_priorities" d={c.strategic_priorities} hint="Your 12–36 month objectives." />
                <T label="Current priorities" name="current_priorities" d={c.current_priorities} hint="What matters most this quarter?" />
              </>
            )}
            {screen === 4 && (
              <>
                <T label="Primary audiences" name="primary_audiences" d={c.primary_audiences} hint="Customers, partners, donors, investors…" />
                <T label="Brand voice" name="brand_voice" d={c.brand_voice} hint="How should your organization sound?" />
              </>
            )}
            {screen === 5 && (
              <>
                <div>
                  <Label htmlFor="risk_tolerance">Risk tolerance</Label>
                  <Select id="risk_tolerance" name="risk_tolerance" defaultValue={c.risk_tolerance || "BALANCED"}>
                    <option value="CONSERVATIVE">Conservative — protect the downside first</option>
                    <option value="BALANCED">Balanced — measured risk for measured return</option>
                    <option value="AGGRESSIVE">Aggressive — move fast, accept volatility</option>
                  </Select>
                </div>
                <T label="Financial priorities" name="financial_objectives" d={c.financial_objectives} hint="Revenue, runway, margins, fundraising…" />
                <T label="Technology priorities" name="technology_objectives" d={c.technology_objectives} hint="Systems, AI, security, data…" />
                <T label="Impact & philanthropic priorities" name="impact_objectives" d={c.impact_objectives} hint="Optional — charity, sustainability, community." />
              </>
            )}
            <Nav screen={screen} setScreen={setScreen} pending={pending} />
          </form>
        )}

        {screen === 6 && (
          <div className="plate space-y-5 p-6 sm:p-8">
            <p className="text-sm text-ivory-muted">Upload foundational documents — business plan, financials, brand guidelines, policies. They are stored privately to your organization and become searchable by your executives. You can also do this later from Files.</p>
            <Uploader />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setScreen(5)} type="button"><ArrowLeft className="size-4" /> Back</Button>
              <Button onClick={() => setScreen(7)} type="button">Continue <ArrowRight className="size-4" /></Button>
            </div>
          </div>
        )}

        {screen === 7 && (
          <div className="plate space-y-5 p-6 sm:p-8">
            <div className="rounded-2xl border border-line-gold bg-gold-400/[0.05] p-5">
              <p className="font-heading text-xl">Trial organization</p>
              <p className="mt-1 text-sm text-ivory-muted">Your organization starts on a trial with the full seven-executive C-Level. Billing is not yet enabled — no payment details are required.</p>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setScreen(6)} type="button"><ArrowLeft className="size-4" /> Back</Button>
              <Button onClick={() => setScreen(8)} type="button">Continue <ArrowRight className="size-4" /></Button>
            </div>
          </div>
        )}

        {screen === 8 && (
          <form action={async () => { setCompleting(true); await completeOnboarding(); }} className="plate space-y-5 p-6 text-center sm:p-10">
            <p className="font-heading text-2xl">Your C-Level is ready to convene.</p>
            <p className="mx-auto max-w-lg text-sm text-ivory-muted">We&apos;ll write your Organization Constitution into C-Level Memory so all seven executives share the same context, then open C-Level HQ.</p>
            <Button type="submit" size="lg" disabled={completing}>
              {completing && <Loader2 className="size-4 animate-spin" />} Enter C-Level HQ <ArrowRight className="size-4" />
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

function F({ label, name, d, required, placeholder }: { label: string; name: string; d?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}{required && <span className="text-gold-400"> *</span>}</Label>
      <Input id={name} name={name} defaultValue={d} required={required} placeholder={placeholder} />
    </div>
  );
}

function T({ label, name, d, hint }: { label: string; name: string; d?: string; hint?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={d} rows={3} aria-describedby={hint ? `${name}-hint` : undefined} />
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-ivory-faint">{hint}</p>}
    </div>
  );
}

function Nav({ screen, setScreen, pending }: { screen: number; setScreen: (n: number) => void; pending: boolean }) {
  return (
    <div className="flex items-center justify-between pt-2">
      {screen > 0 ? (
        <Button variant="ghost" type="button" onClick={() => setScreen(screen - 1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      ) : <span />}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />} Save &amp; continue <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

export function Uploader({ onUploaded }: { onUploaded?: () => void }) {
  const [items, setItems] = useState<{ name: string; status: "uploading" | "done" | "error"; error?: string }[]>([]);
  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      setItems((s) => [...s, { name: f.name, status: "uploading" }]);
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/files", { method: "POST", body });
      const ok = res.ok;
      const err = ok ? undefined : ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed";
      setItems((s) => s.map((x) => (x.name === f.name && x.status === "uploading" ? { ...x, status: ok ? "done" : "error", error: err } : x)));
      if (ok) onUploaded?.();
    }
  }
  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center transition hover:border-line-gold hover:bg-gold-400/[0.03]">
        <Upload className="size-6 text-gold-300" aria-hidden />
        <span className="text-sm">Drop files or <span className="text-gold-300">browse</span></span>
        <span className="text-xs text-ivory-faint">PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, PNG, JPG, WEBP · up to 20 MB</span>
        <input type="file" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp" />
      </label>
      {items.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {items.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
              <span className="truncate">{i.name}</span>
              <span className={cn("text-xs", i.status === "done" ? "text-ok" : i.status === "error" ? "text-risk" : "text-ivory-muted")}>{i.status === "uploading" ? "Uploading…" : i.status === "done" ? "Stored" : i.error}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
