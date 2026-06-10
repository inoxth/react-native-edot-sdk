# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to how they're represented in this repo's **Linear** tracker (team **DELI Dev Tasks**).

| Role in mattpocock/skills | In our tracker (Linear)     | Meaning                                  |
| ------------------------- | --------------------------- | ---------------------------------------- |
| `needs-triage`            | label `needs-triage`        | Maintainer needs to evaluate this issue  |
| `needs-info`              | label `needs-info`          | Waiting on reporter for more information |
| `ready-for-agent`         | label `ready-for-agent`     | Fully specified, ready for an AFK agent  |
| `ready-for-human`         | label `ready-for-human`     | Requires human implementation            |
| `wontfix`                 | **Canceled** workflow state | Will not be actioned                     |

Notes for Linear:

- The four `needs-*` / `ready-*` roles are **labels** — discover with `list_issue_labels`, apply via `save_issue`. They're created lazily on first use (none exist yet in the DEV team).
- `wontfix` is represented by the **Canceled** workflow **state**, not a label — set it via `save_issue` `state: "Canceled"`.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label/state from this table.
