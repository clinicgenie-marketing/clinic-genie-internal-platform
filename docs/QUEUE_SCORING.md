# Dashboard action queue scoring (proposed)

The referenced `05_DASHBOARD_ACTION_QUEUE.md` was not supplied, so this rule set is a proposal. It is deterministic and implemented in `packages/db/src/services/queue.ts`. Dates use Asia/Singapore day boundaries. Completed and cancelled tasks are excluded before scoring.

## Sections

| Section | Rule |
| --- | --- |
| Urgent | Due date is in the past, or priority is Critical and the task is due within 2 days |
| Due today | Due date is today |
| Waiting | Status is Waiting. Shown with "follow-up due" when the follow-up date is today or earlier |
| Upcoming | Due within the next 7 days |
| Later | Everything else (visible in My Tasks, not in the dashboard sections) |

## Score

Score = priority weight + overdue bonus + due-today bonus + upcoming bonus + follow-up bonus.

| Component | Value |
| --- | --- |
| Priority weight | Critical 40, High 30, Medium 20, Low 10 |
| Overdue bonus | 5 per day overdue, capped at 14 days (max 70) |
| Due today | 15 |
| Upcoming | 7 minus days until due (6 for tomorrow, down to 0 at 7 days) |
| Follow-up due | 12 when a Waiting task's follow-up date is today or earlier |

## Tie-breaking

Within a section: score descending, then due date ascending (no due date last), then priority (Critical first), then creation time ascending, then id ascending. Two runs over the same data always produce the same order.

## Deadlines and follow-ups

A task has at most one due date (the deadline). A Waiting task also has a follow-up date and a "waiting on" value; follow-up dates never replace deadlines.
