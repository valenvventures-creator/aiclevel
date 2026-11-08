-- =============================================================================
-- Migration 010: product wording "C-Suite" → "C-Level" in platform-written data
--
-- Rewrites only text the platform seeded: executive definitions and personas
-- copied from the defaults, and the "Session Minutes" report type. Content
-- written by customers is not touched. Demo mode applies the same change at
-- runtime (src/server/organizations/stored-labels.ts).
-- =============================================================================

update public.ai_executives
set description = replace(replace(description, 'C-Suite', 'C-Level'), 'C-SUITE', 'C-LEVEL'),
    functional_mandate = replace(replace(functional_mandate, 'C-Suite', 'C-Level'), 'C-SUITE', 'C-LEVEL')
where is_core and (description like '%C-Suite%' or functional_mandate like '%C-Suite%');

update public.ai_executive_personas p
set north_star = replace(north_star, 'C-Suite', 'C-Level'),
    core_belief = replace(core_belief, 'C-Suite', 'C-Level'),
    leadership_promise = replace(leadership_promise, 'C-Suite', 'C-Level'),
    biography = replace(biography, 'C-Suite', 'C-Level'),
    personality = replace(personality, 'C-Suite', 'C-Level'),
    communication_style = replace(communication_style, 'C-Suite', 'C-Level'),
    decision_style = replace(decision_style, 'C-Suite', 'C-Level'),
    primary_question = replace(primary_question, 'C-Suite', 'C-Level'),
    system_instructions = replace(system_instructions, 'C-Suite', 'C-Level'),
    reasoning_guidelines = replace(reasoning_guidelines, 'C-Suite', 'C-Level'),
    output_preferences = replace(output_preferences, 'C-Suite', 'C-Level'),
    risk_constraints = replace(risk_constraints, 'C-Suite', 'C-Level')
from public.ai_executives e
where e.id = p.executive_id and e.is_core;

update public.reports
set report_type = 'C-Level Session Minutes'
where report_type = 'C-Suite Session Minutes';
