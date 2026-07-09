# Adversarial Scenario Matrix

These scenarios preserve the broader CFP-style test backlog. The current static prototype only implements editor, canvas, connector, theme, and fake-data scenario behavior. Platform scenarios that require persistence, PDF export, autosave, tldraw, migrations, or concurrency are marked `pending-platform`.

| ID | Scenario | Current status | Primary risk |
| --- | --- | --- | --- |
| S1 | Empty diagram lifecycle | implemented | Empty state bounds, presentation framing |
| S2 | Single account, no flows | implemented | Fill calculation without flows |
| S3 | Self-loop | implemented | Degenerate connector and recompute no-op |
| S4 | Two-node cycle | implemented | Deterministic recompute, readable bidirectional routes |
| S5 | Parallel multi-edge | implemented | Additive math, independent connector selection |
| S6 | Flow exceeds source value | implemented | Negative value warning, fill clamp |
| S7 | Zero-starting source | implemented | Capacity fallback, divide-by-zero avoidance |
| S8 | Three-node cycle | implemented | Order-independent recompute |
| S9 | Long rollover chain with tax leakage | implemented | Advisor realism, mixed flow types |
| S10 | Disconnected components | implemented | Fit-to-content and presentation framing |
| S11 | Orphaned flow after delete | pending-platform | Snapshot reconciliation |
| S12 | Orphaned canvas shape | pending-platform | Domain/canvas store drift |
| S13 | Concurrent save conflict | pending-platform | Optimistic concurrency |
| S14 | Snapshot schema migration | pending-platform | Migration and validation |
| S15 | Pathological scale: household of 18 | implemented | Rendering performance and legibility |
| S16 | Extreme value range | implemented | Fill scale determinism |
| S17 | Adversarial labels | implemented | DOM escaping, long labels, bidi text |
| S18 | Floating-point and rounding | pending-platform | Integer cents math once persistence/schema exists |

Implementation rule: do not add backend, auth, persistence, autosave, PDF export, or tldraw only to satisfy pending-platform tests. Keep those as contract tests for the later platform build.
