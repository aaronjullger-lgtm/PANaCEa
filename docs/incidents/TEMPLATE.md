# Incident Postmortem — YYYY-MM-DD — <short slug>

Copy this file and rename it to `YYYY-MM-DD-<slug>.md` when writing a new
postmortem. Keep postmortems short. Longer ones don't get written.

---

## Summary (one paragraph)

What broke, how long it was broken, how many users were affected, how
it was fixed. Write this first; everything else supports it.

## Severity

SEV-1 / SEV-2 / SEV-3 — per `RUNBOOK.md` Section 1.

## Timeline (UTC)

- **HH:MM** — trigger event (deploy, config change, user report).
- **HH:MM** — detected (by whom / by what signal).
- **HH:MM** — mitigated (how — rollback, killswitch, hotfix).
- **HH:MM** — resolved (fully back to normal).

Keep timestamps to the minute. Duration is the key metric.

## Impact

- Users affected: (count or % if known; "unknown" is fine).
- Data integrity: (any lost writes? any reads that returned wrong data?)
- User-visible effect: (what did a PA student actually experience?)

## Root cause

One to three sentences. What actually went wrong. Not "the deploy broke
it" — what *in* the deploy broke it, and why.

## What went well

- Did rollback work?
- Did Sentry surface the right signal?
- Did CI catch anything adjacent?

## What went wrong

- Why didn't CI catch this?
- Why did it take N minutes to detect?
- Why was the blast radius this big?

## Action items

Each item has an owner (Aaron, since solo), a target date, and a link
to an issue once filed. Don't write action items you won't actually do.

- [ ] **Regression test** — (file / test name). Target: next sprint.
- [ ] **Monitoring gap fix** — (what alert / signal to add). Target: ...
- [ ] **Runbook update** — add this failure mode to `RUNBOOK.md`
      Section 3. Target: same-day.
- [ ] **CI gate** — if applicable, add a check that would have caught
      this. Target: ...

## Lessons

One or two sentences. Not "we should be more careful." Something actionable
and specific you would do differently next time.

---

## Checklist

Before marking this postmortem done:

- [ ] Summary reads cleanly on its own.
- [ ] Timeline has real timestamps, not "earlier that day".
- [ ] Root cause is specific, not vague.
- [ ] Action items have owners and target dates.
- [ ] Regression test merged or scheduled.
- [ ] `RUNBOOK.md` updated if this is a new failure mode.
