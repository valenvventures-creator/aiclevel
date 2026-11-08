# Client Onboarding

Route: `/onboarding` (`src/app/(onboarding)/onboarding`, wizard in `src/components/onboarding/wizard.tsx`, actions in `src/server/onboarding/actions.ts`).

The 18 specified steps are grouped into 9 screens. Each screen persists server-side, so onboarding can be resumed; returning owners resume at the Constitution screens.

| Screen | Spec steps | Persists |
|---|---|---|
| About you | 1 Personal information | profile names, title |
| Your organization | 2 Organization name · 3 Industry · 4 Role/title | `create_organization` → organization + OWNER membership + blank Constitution + seven executives (seeded) + audit |
| Mission & vision | 5 Mission · 6 Vision (+ values) | Constitution |
| Business model & strategy | 7 Business model · 8 Strategic objectives · 9 Current priorities | Constitution |
| Audiences & voice | 10 Primary audiences · 11 Brand voice | Constitution |
| Risk & priorities | 12 Risk tolerance · 13 Financial · 14 Technology · 15 Impact | Constitution |
| Foundational documents | 16 Uploads | `files` (+ PROPOSED document memory for text formats) |
| Plan | 17 Subscription (trial; billing disabled) | — |
| Enter C-Level HQ | 18 | Constitution → initial C-Level Memory (USER_CONFIRMED, source IMPORT), `onboarding_completed`, welcome notification |

Invited members skip organizational onboarding and land in HQ. Owners with incomplete onboarding are redirected back from the app shell.

Outcome: every executive's first request already includes the Organization Constitution and initial memory — the "initial executive briefing context".
