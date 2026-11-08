# Component Hierarchy

```
RootLayout (fonts, skip link)
├─ LandingPage ─ Wordmark · Council (seven seats around the crest) · SectionIntro · Bento · SessionPreview
├─ AuthLayout (brand panel) ─ LoginForm · SignupForm · ForgotForm · ResetForm · VerifyEmailForms
├─ OnboardingPage ─ OnboardingWizard ─ Uploader
└─ CSuiteLayout ─ AppShell
   ├─ Sidebar (SidebarContent · OrganizationSwitcher · nav sections · YOUR C-LEVEL avatars · UserMenu · collapse)
   ├─ Mobile drawer
   ├─ TopHeader (GlobalSearch trigger · ProviderStatus · NotificationCenter)
   ├─ CommandPalette (⌘K / Ctrl+K: actions, ask-executive, navigation, /api/search)
   └─ pages
      ├─ HQ ─ QuickActionCard · Daily CEO Brief (Markdown) · DecisionCard · CommunicationPreview · approvals · Widget(Financial snapshot, Risk alerts, SessionPreview, Memory to confirm) · ProductionJobCard
      ├─ Executives ─ ExecutiveCard (ExecutiveAvatar + status)
      ├─ Executive Office ─ header actions · tabs · ExecutiveConversation (MessageRow, composer, voice) · Profile · ReportPreview · Activity timeline
      ├─ Comms ─ mailbox · thread list · ThreadView · ExecutiveCommsComposer
      ├─ Sessions ─ NewSessionForm · transcript · SessionRunner (SpeakingIndicator, controls, vote options) · decision record panel
      ├─ Memory ─ search · filters · MemoryForm · inspector
      ├─ Studio ─ StudioRequest (live routing) · ProductionJobCard · Finished Work viewer · AutoRefresh
      ├─ Decisions · Reports · Files (FileUploader) · Projects (ProjectForm)
      └─ Settings ─ SettingsNav · ActionForm · TestConnection · section panels
```

Primitives (`src/components/ui`): `Button`/`ButtonLink`, `Card`, `Plate`, `Badge`, `SimulatedBadge`, `Input`, `Textarea`, `Select`, `Label`, `FieldError`, `Alert`, `EmptyState`, `PageHeader`, `SectionTitle`, `Markdown` (safe, no raw HTML), `AutoRefresh`.

Every async surface implements loading (`(c-suite)/loading.tsx`, inline spinners), empty (`EmptyState` with plain-language copy), success, error (`(c-suite)/error.tsx`, inline `Alert`s) and retry (regenerate, retry analysis, retry job).
