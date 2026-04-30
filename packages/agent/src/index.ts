// Placeholder. Implementation removed during spec-driven reset
// (tag: bootstrap-snapshot). See `docs/specs/architecture.md` first.

export const status = "awaiting-spec" as const;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(
    "[openmath/agent] No implementation yet. See docs/specs/architecture.md.",
  );
}
