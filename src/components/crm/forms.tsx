"use client";

import { useActionState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { CRM_CURRENCIES, CRM_PIPELINE, DEAL_TYPE_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL } from "@/config/crm";
import { saveContactAction, saveDealAction, type CrmFormState } from "@/server/crm/actions";
import { CRM_DEAL_TYPES, CRM_LEAD_SOURCES, CRM_LEAD_STATUSES, type CrmContact, type CrmDeal, type CrmStage } from "@/types/domain";

type Owner = { id: string; name: string };

function Field({ name, label, state, children, wide }: { name: string; label: string; state: CrmFormState; children: ReactNode; wide?: boolean }) {
  const err = state.fieldErrors?.[name];
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label htmlFor={`f-${name}`}>{label}</Label>
      {children}
      {err && <p id={`e-${name}`} className="mt-1 text-xs text-risk">{err}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="eyebrow mb-2">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const inputProps = (name: string, state: CrmFormState) => ({ id: `f-${name}`, name, "aria-invalid": state.fieldErrors?.[name] ? true : undefined, "aria-describedby": state.fieldErrors?.[name] ? `e-${name}` : undefined });

/** Create or edit a contact. */
export function ContactForm({ contact, owners, meId }: { contact?: CrmContact; owners: Owner[]; meId: string }) {
  const [state, action, pending] = useActionState(saveContactAction, {});
  const v = (k: keyof CrmContact) => state.values?.[k] ?? (contact?.[k] as string | null | undefined) ?? "";
  const pick = <T,>(k: string, fallback: T) => (state.values?.[k] ?? fallback) as T | string;
  return (
    <form action={action} className="space-y-6" noValidate>
      {contact && <input type="hidden" name="id" value={contact.id} />}
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.message && <Alert tone="ok">{state.message}</Alert>}
      <Group title="Contact">
        <Field name="first_name" label="First name" state={state}><Input {...inputProps("first_name", state)} defaultValue={v("first_name")} autoComplete="given-name" maxLength={100} /></Field>
        <Field name="last_name" label="Last name *" state={state}><Input {...inputProps("last_name", state)} defaultValue={v("last_name")} autoComplete="family-name" required maxLength={100} /></Field>
        <Field name="email" label="Email" state={state}><Input {...inputProps("email", state)} type="email" defaultValue={v("email")} autoComplete="email" maxLength={254} /></Field>
        <Field name="title" label="Job title" state={state}><Input {...inputProps("title", state)} defaultValue={v("title")} maxLength={120} /></Field>
        <Field name="phone" label="Phone" state={state}><Input {...inputProps("phone", state)} type="tel" defaultValue={v("phone")} maxLength={40} /></Field>
        <Field name="mobile" label="Mobile" state={state}><Input {...inputProps("mobile", state)} type="tel" defaultValue={v("mobile")} maxLength={40} /></Field>
      </Group>
      <Group title="Company">
        <Field name="company" label="Company" state={state}><Input {...inputProps("company", state)} defaultValue={v("company")} maxLength={160} /></Field>
        <Field name="industry" label="Industry" state={state}><Input {...inputProps("industry", state)} defaultValue={v("industry")} maxLength={120} /></Field>
        <Field name="website" label="Website" state={state}><Input {...inputProps("website", state)} defaultValue={v("website")} placeholder="https://" maxLength={300} /></Field>
        <Field name="linkedin" label="LinkedIn" state={state}><Input {...inputProps("linkedin", state)} defaultValue={v("linkedin")} placeholder="https://linkedin.com/in/…" maxLength={300} /></Field>
      </Group>
      <Group title="Lead">
        <Field name="lead_status" label="Lead status" state={state}>
          <Select {...inputProps("lead_status", state)} defaultValue={pick("lead_status", contact?.lead_status ?? "NEW")}>{CRM_LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}</Select>
        </Field>
        <Field name="lead_source" label="Lead source" state={state}>
          <Select {...inputProps("lead_source", state)} defaultValue={pick("lead_source", contact?.lead_source ?? "")}><option value="">—</option>{CRM_LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}</Select>
        </Field>
        <Field name="owner_id" label="Owner" state={state}>
          <Select {...inputProps("owner_id", state)} defaultValue={pick("owner_id", contact?.owner_id ?? meId)}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
        </Field>
        <Field name="tags" label="Tags (comma separated)" state={state}><Input {...inputProps("tags", state)} defaultValue={pick("tags", contact?.tags.join(", ") ?? "")} placeholder="e.g. enterprise, referral" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="email_opt_out" defaultChecked={state.values ? state.values.email_opt_out === "on" : (contact?.email_opt_out ?? false)} className="accent-gold-400" /> Email opt-out (do not send marketing email)</label>
      </Group>
      <Group title="Address">
        <Field name="street" label="Street" state={state} wide><Input {...inputProps("street", state)} defaultValue={v("street")} autoComplete="street-address" maxLength={200} /></Field>
        <Field name="city" label="City" state={state}><Input {...inputProps("city", state)} defaultValue={v("city")} autoComplete="address-level2" maxLength={120} /></Field>
        <Field name="state" label="State / region" state={state}><Input {...inputProps("state", state)} defaultValue={v("state")} autoComplete="address-level1" maxLength={120} /></Field>
        <Field name="postal_code" label="Postal code" state={state}><Input {...inputProps("postal_code", state)} defaultValue={v("postal_code")} autoComplete="postal-code" maxLength={30} /></Field>
        <Field name="country" label="Country" state={state}><Input {...inputProps("country", state)} defaultValue={v("country")} autoComplete="country-name" maxLength={120} /></Field>
      </Group>
      <Field name="description" label="Description" state={state}><Textarea {...inputProps("description", state)} defaultValue={v("description")} rows={4} maxLength={5000} placeholder="Background, how you met, what matters to them…" /></Field>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {contact ? "Save contact" : "Create contact"}</Button>
    </form>
  );
}

/** Create or edit a deal. */
export function DealForm({ deal, contacts, owners, meId, defaults }: { deal?: CrmDeal; contacts: { id: string; name: string; company: string | null }[]; owners: Owner[]; meId: string; defaults?: { stage?: CrmStage; contact_id?: string; returnTo?: "board" } }) {
  const [state, action, pending] = useActionState(saveDealAction, {});
  const v = (k: keyof CrmDeal) => state.values?.[k] ?? (deal?.[k] as string | number | null | undefined) ?? "";
  const pick = <T,>(k: string, fallback: T) => (state.values?.[k] ?? fallback) as T | string;
  return (
    <form action={action} className="space-y-6" noValidate>
      {deal && <input type="hidden" name="id" value={deal.id} />}
      {defaults?.returnTo && !deal && <input type="hidden" name="return_to" value={defaults.returnTo} />}
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.message && <Alert tone="ok">{state.message}</Alert>}
      <Group title="Deal">
        <Field name="name" label="Deal name *" state={state} wide><Input {...inputProps("name", state)} defaultValue={v("name")} required maxLength={160} placeholder="e.g. Acme — annual leadership plan" /></Field>
        <Field name="stage" label="Stage" state={state}>
          <Select {...inputProps("stage", state)} defaultValue={pick("stage", deal?.stage ?? defaults?.stage ?? "PROSPECT")}>{CRM_PIPELINE.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
        </Field>
        <Field name="probability" label="Probability % (blank = stage default)" state={state}><Input {...inputProps("probability", state)} type="number" min={0} max={100} defaultValue={pick("probability", deal ? String(deal.probability) : "")} /></Field>
        <Field name="amount" label="Amount" state={state}><Input {...inputProps("amount", state)} inputMode="decimal" defaultValue={pick("amount", deal?.amount ?? "")} placeholder="e.g. 48000" /></Field>
        <Field name="currency" label="Currency" state={state}>
          <Select {...inputProps("currency", state)} defaultValue={pick("currency", deal?.currency ?? "USD")}>{[...new Set([deal?.currency ?? "USD", ...CRM_CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        <Field name="expected_close" label="Expected close" state={state}><Input {...inputProps("expected_close", state)} type="date" defaultValue={v("expected_close") as string} /></Field>
        <Field name="deal_type" label="Type" state={state}>
          <Select {...inputProps("deal_type", state)} defaultValue={pick("deal_type", deal?.deal_type ?? "")}><option value="">—</option>{CRM_DEAL_TYPES.map((t) => <option key={t} value={t}>{DEAL_TYPE_LABEL[t]}</option>)}</Select>
        </Field>
      </Group>
      <Group title="Client">
        <Field name="contact_id" label="Contact" state={state}>
          <Select {...inputProps("contact_id", state)} defaultValue={pick("contact_id", deal?.contact_id ?? defaults?.contact_id ?? "")}>
            <option value="">No contact</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
          </Select>
        </Field>
        <Field name="company" label="Company (blank = the contact's)" state={state}><Input {...inputProps("company", state)} defaultValue={v("company") as string} maxLength={160} /></Field>
        <Field name="lead_source" label="Lead source" state={state}>
          <Select {...inputProps("lead_source", state)} defaultValue={pick("lead_source", deal?.lead_source ?? "")}><option value="">—</option>{CRM_LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}</Select>
        </Field>
        <Field name="owner_id" label="Owner" state={state}>
          <Select {...inputProps("owner_id", state)} defaultValue={pick("owner_id", deal?.owner_id ?? meId)}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
        </Field>
      </Group>
      <Field name="next_step" label="Next step" state={state}><Input {...inputProps("next_step", state)} defaultValue={v("next_step") as string} maxLength={300} placeholder="e.g. Send proposal by Friday" /></Field>
      <Field name="description" label="Description" state={state}><Textarea {...inputProps("description", state)} defaultValue={v("description") as string} rows={4} maxLength={5000} /></Field>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {deal ? "Save deal" : "Create deal"}</Button>
    </form>
  );
}
