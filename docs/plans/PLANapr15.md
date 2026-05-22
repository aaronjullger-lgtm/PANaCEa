# PANaCEa UI Audit And Remediation Plan

## Summary
The interface already has a recognizable visual direction: dark, clinical, serious, and brand-aware. The core problem is not that it looks amateur; it is that too many surfaces share the same weight, tone, density, and interaction language. The result is a product that feels over-templated, under-hierarchical, and harder to scan than it should be.

Across the screenshots, the same shell repeats: badge, status pill, large headline, long subtitle, right-aligned CTA cluster, four metric cards, then another large explanatory panel. This creates visual sameness, weakens page differentiation, and makes task priority less obvious. The UI is not failing because it lacks polish. It is failing because it does not clearly distinguish primary action, supporting context, passive information, empty state, and error state.

Important constraint: this audit is grounded primarily in the provided desktop screenshots. Any point marked `Inference` is a likely issue suggested by the visuals but not directly confirmed.

## Overall Visual / UX Diagnosis
- `Severity: Critical` Too much of the product uses one visual note. Evidence: almost every authenticated page uses the same hero strip, same rounded dark surfaces, same four-card metric row, same small uppercase eyebrow labels, and similar right-aligned CTA buttons. Why it hurts: users lose page identity and cannot quickly tell whether they are in a launch surface, analytics surface, reference surface, or tool surface. Fix: define 3-4 distinct page templates and 4 card roles only: `action`, `status`, `reference`, `alert/empty`. Expected impact: much stronger orientation and faster scanning. Priority: Phase 2.
- `Severity: Critical` Information hierarchy is too flat. Evidence: headings, status pills, metric cards, companion cards, and CTA clusters often all compete within the same viewport. Why it hurts: users must actively parse the UI instead of being guided through it. Fix: every page needs one dominant action, one dominant message, and at most two supporting metrics above the fold. Demote the rest below the first decision point. Expected impact: better task completion and lower cognitive load. Priority: Phase 1.
- `Severity: High` The interface narrates itself too much. Evidence: copy like “One narrative, one launch point...” and “Progress with narrative, not noise” explains the design intent rather than helping the user act. Why it hurts: prime screen real estate is spent on meta-language instead of concrete decisions. Fix: replace self-descriptive copy with action-framing copy tied to the user’s actual next decision. Expected impact: more direct, useful pages. Priority: Phase 1.
- `Severity: High` Surface contrast is too compressed. Evidence: the app uses many dark cards on a dark background with subtle border and hue shifts, but few strong layer jumps. Why it hurts: sections visually blend together, especially in dense pages like Study and Clinical-year focus. Fix: create clearer elevation tiers with distinct fill, border, and shadow tokens for `canvas`, `panel`, `interactive tile`, `selected tile`, and `alert`. Expected impact: better depth and scanability. Priority: Phase 2.
- `Severity: High` Uppercase micro-labels are overused. Evidence: nearly every card, section, and metric starts with small tracked uppercase text. Why it hurts: these labels stop signaling importance because they are everywhere; readability also drops. Fix: reserve uppercase tracked labels for true overlines and status only; use sentence case for most card headings and sublabels. Expected impact: calmer, more premium typography. Priority: Phase 1.

## Screen-By-Screen Audit

### 1. Landing Page
- `Severity: High` Hero composition is bold but internally crowded. Evidence: the left headline is extremely dominant while the right mockup contains dense, low-contrast content and overlapping callouts. Why it hurts: the product preview reads as decorative noise rather than proof of product value. Fix: simplify the preview into 1 strong app screenshot with 2-3 highlighted regions, not a full dashboard plus floating badge. Remove any overlapping badge that covers text. Expected impact: cleaner hero and stronger credibility. Priority: Phase 1.
- `Severity: High` The condensed display headline is visually strong but over-occupies the hero. Evidence: “PANCE MASTERY WITH CLINICAL INTELLIGENCE” spans multiple large stacked lines and pushes the supporting paragraph and CTA lower. Why it hurts: the user gets drama before clarity. Fix: reduce headline size by 10-15%, tighten line breaks intentionally, and bring the support copy/CTA closer to the promise. Expected impact: better balance between brand impact and comprehension. Priority: Phase 1.
- `Severity: Medium` Header navigation feels weak relative to the hero. Evidence: top nav links are light, evenly weighted, and visually passive while the brand and hero dominate. Why it hurts: users looking for trust-building or product exploration cues may skip them. Fix: give nav slightly stronger contrast and spacing; differentiate the primary CTA from the simple text links more decisively. Expected impact: improved top-level navigation clarity. Priority: Phase 3.
- `Severity: Medium` Brand palette is attractive, but gold is carrying too much of the visual interest alone. Evidence: headline accent, buttons, badges, and mockup details all lean on similar warm gold. Why it hurts: the interface starts to feel monotone despite multiple elements. Fix: keep gold for primary action and key emphasis only; let steel/plum/sage accents identify content types. Expected impact: richer but more controlled brand system. Priority: Phase 2.

### 2. Study Home / Command Center
- `Severity: Critical` The first screen does not clearly answer “what should I do next?”. Evidence: the page shows greeting, descriptive sentence, multiple hero pills, four stats, and a CTA cluster before a single dominant task path emerges. Why it hurts: command centers must reduce choice, not multiply it. Fix: restructure the fold into: `next action`, `why now`, `one fallback route`, then supporting stats below. Expected impact: immediate usability gain. Priority: Phase 1.
- `Severity: High` Metric cards consume premium space while mostly showing zeros. Evidence: “To review 0”, “Recent accuracy 0%”, “Streak 0”, “Questions today 0” fill a large portion of the first viewport. Why it hurts: blank metrics look dead and discourage engagement. Fix: when values are low or absent, switch these cards into guided states with copy like “No review due now”, “Start 5 questions to establish your baseline”, or collapse low-signal cards entirely. Expected impact: less dead weight and better onboarding/returning-user clarity. Priority: Phase 1.
- `Severity: High` CTA grouping is visually detached from the hero copy. Evidence: “Practice”, “Progress”, and “Launch adaptive session” sit to the right and feel like separate controls rather than a clear hierarchy. Why it hurts: the user must infer which action is primary. Fix: place the primary action directly beneath the main explanation on the left; move secondary routes into a quieter segmented control or supporting links. Expected impact: stronger call-to-action clarity. Priority: Phase 1.
- `Severity: High` The “Home surface” section reads like internal design rationale. Evidence: “One narrative, one launch point...” describes the intended concept, not the user’s situation. Why it hurts: it adds reading without improving action. Fix: replace with a practical block: “Start here”, “Due now”, “Use if you only have 10 minutes”, “Open if you want reference before practice.” Expected impact: clearer decision architecture. Priority: Phase 1.

### 3. Study Home Mid-Page / Companion Tools
- `Severity: High` The “Recommended next” area creates dead space and imbalance. Evidence: one large card sits on the left with a large empty vertical area beneath it, while a 2x2 tools grid fills the right. Why it hurts: the layout feels unfinished and wastes a major portion of the canvas. Fix: either make recommendations a full-width strip above the tools, or split the layout into balanced columns with multiple recommendations on the left. Expected impact: improved page rhythm and perceived completeness. Priority: Phase 2.
- `Severity: Medium` Companion tool cards are informative but too similar in tone and shape. Evidence: Knowledge, Tools, Tutor, and My library all share nearly identical structure, density, and emphasis. Why it hurts: scanning is slow and there is no clear entrypoint. Fix: designate one featured companion card and three secondary cards; increase icon contrast and simplify copy to 2 lines max before the action. Expected impact: faster scanning and stronger pathway prioritization. Priority: Phase 2.

### 4. Launch Lanes / Clinical-Year Focus
- `Severity: Critical` The page becomes visually noisy when tiles, metrics, system chips, and control buttons share the same container. Evidence: launch cards, rotation chips, summary tiles, date field, enable/disable actions, and micro system cards all compete inside one large surface. Why it hurts: the user must decode hierarchy manually. Fix: split this into 3 explicit zones: `rotation selection`, `timeline/control`, `system coverage grid`. Give each its own spacing and heading. Expected impact: major improvement in comprehensibility. Priority: Phase 1.
- `Severity: High` Selection state is inconsistent and overly border-driven. Evidence: Psychiatry chip appears selected with a gold outline; the smaller system cards use gold side accents and dots; other selected states elsewhere use filled gold buttons. Why it hurts: the user cannot build a reliable mental model of “selected” versus “featured” versus “actionable.” Fix: define one selected state language: stronger fill, stronger icon/background, and one accent border treatment only. Expected impact: more predictable interaction model. Priority: Phase 2.
- `Severity: High` “More options” floats without enough structural anchoring. Evidence: the button sits at section level but does not appear tied to a clear subset of content. Why it hurts: it reads as an afterthought. Fix: attach it to the specific control group it extends or move it into a kebab/menu tied to the rotation panel. Expected impact: reduced ambiguity. Priority: Phase 2.
- `Severity: Medium` Microcards with abbreviations are too dense for their size. Evidence: cards like CV, DERM, ENDO, HEENT, GI stack abbreviation, full label, mastery label, and percentage in a small tile. Why it hurts: the user gets low-value compression and truncation risk. Fix: either enlarge the tiles or reduce each to `system`, `status`, `value`. Show full names on hover/detail, not in cramped body text. Expected impact: better readability. Priority: Phase 2.
- `Severity: Medium` The date input and enable/disable actions feel visually separate from the selection task. Evidence: EOR date sits below system chips with large buttons beneath it. Why it hurts: the form reads like a detached footer instead of part of the workflow. Fix: move date + bulk actions into a right-side control panel or dedicated footer row within the rotation settings block. Expected impact: cleaner workflow grouping. Priority: Phase 2.

### 5. Specialized Tools Section
- `Severity: Medium` The card grid is clean but repetitive. Evidence: Custom study, Pearl deck, Clinical Eye, Visualizer all use the same card formula and similar text weight. Why it hurts: these should feel like distinct utilities, not four equivalent text slabs. Fix: introduce stronger visual differentiation by use case, such as icon framing, short utility tags, and one-line benefit statements. Expected impact: better feature discoverability. Priority: Phase 3.

### 6. Practice Page
- `Severity: High` Practice does not feel sufficiently different from Study Home. Evidence: the same hero strip, same four metric cards, similar CTA arrangement, and similar card language appear again. Why it hurts: mode-switching should feel purposeful; instead it feels like another skin on the same template. Fix: make Practice lead with search, mode discovery, and “start now” blocks, not another narrative page intro. Expected impact: better role clarity for the page. Priority: Phase 1.
- `Severity: High` The filter/search bar is visually underpowered relative to its importance. Evidence: search input is dark and large, but the filter pills beside it look like generic buttons rather than a strong mode selector. Why it hurts: filtering is core behavior here, but the controls do not feel central. Fix: treat this as a dedicated search/filter module with clearer segmentation, stronger selected state, and optional count feedback. Expected impact: more obvious browsing workflow. Priority: Phase 1.
- `Severity: Medium` “Grand Rounds” and “Start adaptive session” compete without sufficient explanation. Evidence: both sit as peer CTAs on the hero. Why it hurts: users cannot tell whether these are substitutes, complements, or different effort levels. Fix: label one as primary and frame the other as alternate with contextual microcopy. Expected impact: less decision friction. Priority: Phase 2.

### 7. Progress Page
- `Severity: High` The page says “narrative, not noise,” but the layout still starts with a standard dashboard pattern. Evidence: hero, four metric cards, explanatory card, toggle card. Why it hurts: the design promise and the actual information structure are misaligned. Fix: lead with one synthesized summary panel, one priority action, and one trend module before showing metrics. Expected impact: stronger integrity between message and layout. Priority: Phase 1.
- `Severity: Medium` “Reading mode” is conceptually useful but visually tucked away. Evidence: it appears as a small sub-card with a separate toggle/button below. Why it hurts: the relationship between explanation and control is weaker than necessary. Fix: combine the explanation and toggle into a compact control bar at the section header level. Expected impact: cleaner interaction model. Priority: Phase 2.
- `Severity: Medium` Numeric metrics are useful here, but still too visually uniform. Evidence: accuracy, due review, recorded answers, and streak all use similar card styling regardless of urgency. Why it hurts: due review should feel action-driving, not merely equal to a passive count. Fix: give action-driving metrics a stronger accent and attached next step. Expected impact: better prioritization. Priority: Phase 1.

### 8. Knowledge Page
- `Severity: High` The page still looks like a dashboard instead of a reference workspace. Evidence: hero + four metrics + large explanatory block repeats, even though this is reference-oriented content. Why it hurts: reference tools should optimize lookup and context switching, not narrative onboarding each time. Fix: move lane switching and search/reference actions up; demote summary stats. Expected impact: stronger task fit. Priority: Phase 1.
- `Severity: High` The error toast is visually detached and insufficiently integrated. Evidence: “Unable to load organ systems...” appears as a toast in the lower right while the relevant content remains in the page. Why it hurts: users do not know where the problem lives or what to do next. Fix: surface the error inline in the affected module with retry, while reserving toasts for non-blocking confirmations. Expected impact: better recovery and trust. Priority: Phase 1.
- `Severity: Medium` The two top-right actions lack clear hierarchy. Evidence: “Lab Reference” and “Open Pharmacopoeia” are presented as peer controls. Why it hurts: unclear whether one is mode switch, destination switch, or contextual shortcut. Fix: if one is the current context and one is the next route, reflect that with tab treatment versus primary action treatment. Expected impact: more explicit navigation semantics. Priority: Phase 2.

### 9. Utilities Page
- `Severity: Medium` The headline wraps awkwardly and creates an ungainly block. Evidence: “Reach for the right aid before the guesswork starts” breaks into a tall multi-line stack. Why it hurts: the title becomes heavier than the supporting structure can support. Fix: constrain measure or rewrite to a shorter, sharper line; do not let hero headlines exceed roughly 2 lines at this width. Expected impact: cleaner first impression. Priority: Phase 2.
- `Severity: Medium` Toolkit metrics are not the right first impression. Evidence: toolkit lanes, calculator library, pinned tools, recent launches dominate the fold. Why it hurts: tools pages should favor findability and quick launch first, not passive counts. Fix: surface `recent`, `pinned`, and `search` first; move aggregate counts lower. Expected impact: more task-efficient tool launch. Priority: Phase 1.

### 10. Study Path Failure State
- `Severity: High` The error state has duplicated recovery actions. Evidence: top-right “Try again” and center “Reload plan” appear at once. Why it hurts: two CTAs for the same recovery path create uncertainty. Fix: keep one clear primary retry and one secondary “Back to Study” or “View due review instead.” Expected impact: better error recovery clarity. Priority: Phase 1.
- `Severity: Medium` The failure surface lacks contextual guidance. Evidence: it says the optimizer could not return a safe recommendation, but gives no likely cause or alternate path. Why it hurts: users hit a dead end. Fix: add one sentence explaining probable causes and one alternate safe route such as Practice, Due Review, or Knowledge. Expected impact: less abandonment. Priority: Phase 1.
- `Severity: Medium` The empty space is excessive. Evidence: a large central container holds very little content. Why it hurts: the state feels unfinished rather than intentional. Fix: reduce vertical area or add a clear recovery stack with status detail, last sync, and fallback routes. Expected impact: more credible failure handling. Priority: Phase 2.

### 11. Daily Challenges
- `Severity: High` Urgent status is visually underplayed. Evidence: “Needs attention 3” is styled almost the same as neutral metrics. Why it hurts: problems should interrupt the visual rhythm. Fix: convert blocked/problem states into alert cards with stronger tone and attached action. Expected impact: better issue visibility. Priority: Phase 1.
- `Severity: Medium` The hero again over-explains mode philosophy. Evidence: “Use daily challenges as...” copy describes when to use the feature rather than immediately showing the three challenges. Why it hurts: this mode should feel quick and low-friction. Fix: let the daily challenge cards themselves dominate the fold. Expected impact: faster entry into the activity. Priority: Phase 2.

## Component-Level Audit
- `Severity: Critical` Navigation rail relies too heavily on unlabeled icons. Evidence: the collapsed desktop rail shows icon-only navigation for every major area. Why it hurts: discoverability is poor, especially for infrequent destinations. Fix: default to slightly wider labeled rail on desktop, or show persistent text labels on hover/focus with grouped separators that are obvious. Expected impact: reduced orientation cost. Priority: Phase 1.
- `Severity: High` Global header actions are cryptic. Evidence: shield, gear/layers, help, theme icons appear with no labels in the top right. Why it hurts: these look like utility chrome, but their meaning and urgency are unclear. Fix: add concise tooltips and consider moving lower-frequency utilities into a single profile/settings menu. Expected impact: cleaner global header. Priority: Phase 2.
- `Severity: High` Metric cards need role differentiation. Evidence: every metric card uses the same layout regardless of being informative, empty, blocked, or urgent. Why it hurts: the user cannot visually separate “FYI” from “act now.” Fix: create four variants: `summary`, `empty guidance`, `warning/action`, `progress`. Expected impact: better semantic scanning. Priority: Phase 1.
- `Severity: High` Buttons and pills do not form a strong hierarchy. Evidence: many secondary controls are dark pills with borders; primary gold buttons are good but often detached. Why it hurts: action hierarchy is inconsistent across pages. Fix: define one primary button, one secondary button, one tab treatment, one filter-chip treatment, and one subtle ghost action. Expected impact: more predictable interaction language. Priority: Phase 2.
- `Severity: High` Card interiors are too text-heavy. Evidence: many cards contain heading, long descriptive copy, and bottom action text. Why it hurts: these become mini-articles instead of fast decision aids. Fix: limit supporting copy on interactive cards to 2 lines; move longer explanation into panel detail or hover/secondary view. Expected impact: better scanability. Priority: Phase 1.
- `Severity: Medium` Icon treatment is decorative more than functional. Evidence: many cards show small icon badges at top corners, but those icons rarely communicate state. Why it hurts: they consume visual attention without adding much meaning. Fix: use icons only when they encode category or urgency. Remove redundant decorative icons. Expected impact: cleaner cards. Priority: Phase 3.
- `Severity: Medium` Toast and error affordances are too subtle for blocking issues. Evidence: the knowledge page toast blends into the dark UI and appears peripheral. Why it hurts: reliability issues feel easy to miss. Fix: reserve toast for transient success; use inline alerts for data failure and sticky banners for cross-page issues. Expected impact: better resilience UX. Priority: Phase 1.
- `Severity: Medium` Form grouping needs improvement. Evidence: the EOR date field and related enable/disable actions are visually isolated. Why it hurts: related controls should feel like one workflow step. Fix: define standard `field + helper + bulk action` grouping within settings surfaces. Expected impact: more coherent forms. Priority: Phase 2.

## Accessibility / Readability Concerns
- `Severity: Critical` Tertiary text contrast appears too low in several areas. Evidence: descriptive copy inside cards and inactive pills often uses muted gray on dark blue-gray. Why it hurts: low vision users and fatigue-heavy study sessions will struggle. Fix: raise body text contrast noticeably and reserve the most muted tone for purely decorative labels. Expected impact: immediate readability improvement. Priority: Phase 1.
- `Severity: High` Small uppercase labels are not ideal for long-term reading. Evidence: many overlines use tracked uppercase at small sizes. Why it hurts: legibility and scan speed both drop. Fix: keep these larger or use sentence case for most labels. Expected impact: calmer, more readable UI. Priority: Phase 1.
- `Severity: High` Icon-only controls require stronger non-visual support. Evidence: rail and header rely on icons only. Why it hurts: accessibility and discoverability both suffer. Fix: ensure explicit labels/tooltips/ARIA names and visible hover/focus disclosure. Expected impact: better keyboard and first-time-use support. Priority: Phase 1.
- `Severity: Medium` `Inference` Focus states may be too subtle relative to the low-contrast UI. Evidence: the visual system already relies on faint borders and dark surfaces. Why it hurts: keyboard navigation can disappear into the background. Fix: define a bright, unmistakable focus ring token and apply it consistently. Expected impact: stronger accessibility compliance. Priority: Phase 2.
- `Severity: Medium` `Inference` Responsive behavior is at risk on dense pages. Evidence: hero strips, four-card rows, long headlines, and multi-column control groups are tightly packed on desktop. Why it hurts: these layouts are likely to collapse awkwardly on smaller widths. Fix: define hard mobile/tablet content priorities and collapse rules for hero, CTA cluster, metric rows, and selection grids. Expected impact: safer responsive adaptation. Priority: Phase 2.

## Layout / Spacing System Issues
- `Severity: High` Vertical rhythm is inconsistent across pages. Evidence: some hero blocks feel overly tall, while some mid-page sections compress dense controls into a single large surface. Why it hurts: the product alternates between airy and cramped without clear logic. Fix: standardize page rhythm: `hero`, `primary action module`, `supporting metrics`, `secondary modules`, each with fixed gap ranges. Expected impact: stronger compositional consistency. Priority: Phase 2.
- `Severity: High` Grid logic changes too often within single surfaces. Evidence: large parent panels contain mixed chip grids, stat blocks, mini cards, and form controls. Why it hurts: the eye loses track of column logic. Fix: avoid mixed-density zones; use nested sections with explicit subheadings and separate surfaces. Expected impact: better structure. Priority: Phase 2.
- `Severity: Medium` Max-width and rail combination can make the app feel slightly boxed-in. Evidence: large desktop canvas still shows big side gutters while some content areas feel crowded internally. Why it hurts: available width is not always used where it matters. Fix: use wider content templates for analytic, selection-heavy, and reference-heavy pages; keep narrow templates for narrative pages only. Expected impact: better desktop efficiency. Priority: Phase 2.

## Visual Consistency / System Issues
- `Severity: Critical` The current system confuses “same family” with “same appearance.” Evidence: almost every surface shares identical radius, border strength, texture, and darkness. Why it hurts: the interface loses semantic range. Fix: create explicit component families with differentiated appearance, not just accent color changes. Expected impact: stronger system maturity. Priority: Phase 2.
- `Severity: High` Accent colors appear assigned decoratively, not semantically. Evidence: gold, steel, plum, and green appear across metrics and cards without a stable meaning. Why it hurts: color cannot become a reliable signal. Fix: map each accent to a semantic role or product domain and keep it consistent. Expected impact: faster recognition and stronger brand logic. Priority: Phase 2.
- `Severity: Medium` Noise textures and subtle gradients are overused. Evidence: many large surfaces use similar texture overlays. Why it hurts: visual atmosphere becomes static and heavy. Fix: reserve texture for hero or major containers; keep smaller cards cleaner. Expected impact: more refined premium feel. Priority: Phase 3.

## Important Component / Interface Changes
- No external API changes are needed.
- The primary interface changes should happen at the shared workspace component layer so fixes cascade system-wide.
- Add component roles to the workspace primitives: `hero`, `summaryMetric`, `actionTile`, `emptyState`, `alertState`, `referenceTile`.
- Add explicit state variants to shared cards and buttons: `default`, `selected`, `warning`, `error`, `empty`, `disabled`.
- Add navigation metadata so the rail can support grouped labels, hover disclosure, and clearer active states.
- Standardize page-template props so each page declares its mode: `launch`, `analytics`, `reference`, `toolkit`, `challenge`, `error`.

## Prioritized Remediation Plan
- `Priority 1` Rebuild first-screen hierarchy on authenticated pages so each page has one primary task, one supporting status block, and fewer zero-value metric cards above the fold.
- `Priority 1` Fix low-information states: replace zero-value stat slabs with guided empty states and convert urgent/problem states into alert cards.
- `Priority 1` Make navigation and global controls more legible with labels/tooltips and clearer grouping.
- `Priority 1` Reduce meta/explanatory copy and replace it with action-oriented, context-specific copy.
- `Priority 1` Improve text contrast and reduce overuse of tiny uppercase labels.
- `Priority 2` Split the shared workspace shell into differentiated templates by page purpose rather than using one pattern everywhere.
- `Priority 2` Redesign selection states, chip states, and card families so action, status, and reference do not look interchangeable.
- `Priority 2` Rework dense composite sections like Clinical-year focus into smaller, structurally clear modules.
- `Priority 3` Refine premium feel through more selective texture use, cleaner depth hierarchy, stronger icon discipline, and improved page-specific personality.

## Phased Roadmap

### Phase 1: High-Impact Quick Wins
- Reduce hero subtitle length across authenticated pages by roughly 30-50%.
- Limit top-fold metric rows to the 2 highest-signal items; convert the rest into contextual empty states or move them down.
- Move the primary CTA directly next to the main task explanation instead of letting it float as a right-side peer.
- Replace self-referential copy with direct action framing.
- Increase body text contrast and reduce muted gray usage.
- Fix the study-path failure state to one retry action plus one fallback route.
- Convert error toasts for data failure into inline module errors with retry.

### Phase 2: Structural Layout / System Improvements
- Introduce page templates by mode: `Study Home`, `Practice Discovery`, `Analytics`, `Reference`, `Toolkit`, `Challenge`, `Failure`.
- Redefine the workspace primitives so card roles are visually distinct.
- Redesign the nav rail with stronger discoverability and grouped labels.
- Rebuild Clinical-year focus and other dense panels into smaller workflow modules.
- Establish semantic color mapping and unified selected/active/alert states.
- Define responsive collapse rules for hero strips, metric modules, and selection grids.

### Phase 3: Premium Polish And Refinement
- Reduce texture repetition and use lighting/depth more intentionally.
- Introduce more deliberate asymmetry only where it improves emphasis, not where it creates empty space.
- Tighten typography rhythm, especially headline wrapping and card copy lengths.
- Improve page differentiation with subtle mode-specific identity cues.
- Refine iconography so it carries meaning rather than decoration.

## Design-System Recommendations
- Define 5 surface tiers: `canvas`, `hero panel`, `standard card`, `interactive tile`, `alert/error`.
- Define 4 text tiers only for most screens: `display`, `page title`, `section title`, `body/supporting`. Stop inventing too many intermediate label styles.
- Reserve uppercase tracked text for true overlines/status only.
- Reserve gold for primary action/selected emphasis; map other accents to stable domains or semantic roles.
- Create a single action hierarchy: `primary button`, `secondary button`, `ghost action`, `tab`, `filter chip`, `inline link action`.
- Create a single state hierarchy: `default`, `selected`, `warning`, `error`, `success`, `empty`.
- Standardize card copy rules: headline, 1-2 lines of support, optional action. Longer instructional copy belongs in expandable help or secondary panels.
- Standardize failure states: headline, cause, immediate retry, fallback route, and scope of failure.

## Consistency Checklist
- One primary action per page above the fold.
- No more than two high-signal metrics in the first viewport.
- Zero states never appear as dead numeric slabs.
- Alert/problem states never look like neutral stats.
- Selected state is visually identical in logic across chips, cards, tabs, and filters.
- Header utilities have labels or reliable tooltips.
- Rail navigation is discoverable without memorizing icons.
- Accent colors mean something consistent.
- Tiny uppercase labels are used sparingly.
- Interactive cards do not exceed two lines of support copy.
- Error feedback appears inline when it blocks the task.
- Each page template looks meaningfully different based on purpose.

## Top 10 Biggest UI Problems
1. Page templates are too repetitive across fundamentally different workflows.
2. Information hierarchy is too flat above the fold.
3. Metric cards occupy prime space even when they say almost nothing.
4. Navigation is too icon-dependent and under-labeled.
5. Cards for action, information, empty state, and alerts look too similar.
6. Too much copy explains the product instead of guiding the task.
7. Dense sections mix grids, forms, chips, and metrics without strong substructure.
8. Contrast is too muted in supporting text and tertiary controls.
9. Error and recovery states are weakly integrated into the relevant modules.
10. The system has brand style, but not enough semantic differentiation.

## Before Changing Code, Verify These Things
- Which pages share the same workspace primitives and should be fixed systemically first.
- Which top-fold metrics users actually use versus which are ornamental.
- Which routes are primary destinations from Study Home versus merely adjacent tools.
- Whether zero states dominate for new/returning users and need alternate card behavior.
- Which nav items are hardest for users to discover without labels.
- Whether the dark theme contrast values meet target accessibility thresholds.
- Which pages need wider desktop layouts and which should stay narrow.
- Where error states originate so inline recovery can be attached to the correct module.
- How these layouts behave at tablet widths and smaller laptop heights.
- Which accent colors should map to domain, state, or interaction, so color stops being decorative.

## Assumptions And Defaults
- Desktop dark theme is the only directly observed mode.
- Hover, focus, responsive, and animation concerns marked `Inference` are based on strong visual likelihood, not direct interaction evidence.
- Because the repo uses shared workspace primitives, the remediation should start at the system layer, not as page-by-page one-off patching.
- The correct goal is not to make the UI louder; it is to make it more decisive, more legible, and more semantically differentiated.
