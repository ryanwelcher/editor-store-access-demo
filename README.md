# Editor Store Access Demo

A tiny WordPress plugin that shows the difference between **reading the block
editor data store imperatively** through the `wp.data` global and
**subscribing to it correctly** from inside the editor's React tree.

**▶ [Try it in WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/ryanwelcher/editor-store-access-demo/trunk/blueprint.json)** — opens a
throwaway WordPress in your browser with the plugin active, straight into a draft
that walks you through the demo. Nothing to install; add or delete a block and
watch the notice at the top.

The draft is seeded on purpose: on an empty post every row would read `0`, and
row **A**'s "read before hydration" bug would look identical to the correct
answer. Starting at six blocks makes the stale rows visibly wrong.

## The point

It is *not* about being unable to access the store — the `wp.data` global reads
the **same** store the editor uses. It's about **when** you read and whether you
find out about changes:

| Symptom | Cause |
| --- | --- |
| Reads `0` at load | Store isn't **hydrated** yet |
| Value never changes | You captured a **stale snapshot** |
| Have to keep asking | `select()` is a snapshot, not a **subscription** |

The fix isn't "finally reaching the store" — it's plugging into the store's
lifecycle. `registerPlugin` + `useSelect` gives you hydration timing, reactivity,
and cleanup for free, from inside the editor tree (so SlotFills and block
context are available too).

## What you see in the editor

**One persistent notice at the top of the editor** that updates live as you
edit — titled *"Block-editor store · the same value, read different ways."* It
reads the same block count from the **same** store four ways — three via the
`wp.data` global (each with a catch) next to the one correct path:

| | `wp.data.select()` / `.subscribe()` (global, imperative) | ✅ `useSelect()` hook (React, subscribed) |
| --- | --- | --- |
| **A · read at load** | `0` — read once, before hydration → **wrong data** | the real count |
| **B · read on demand** | `select()` gives the value now, but only when you ask → **stale until you re-read by hand** | always current |
| **C · `subscribe()` for updates** | live + correct, but you hand-wire the diffing & cleanup, out of tree → **right data, wrong way** | reactive, managed, for free |

Three tiers, not two: **A/B** give you the *wrong data* (they aren't reactive),
**C** gives you the *right data the wrong way* (reactive, but hand-rolled and
out of tree), and **`useSelect`** gives you the right data the right way. As you
edit, A & B stay frozen (flagged **stale**), while C and `useSelect` tick
together — proof they read one and the same store.

The notice is rendered inside the editor's React tree via `registerPlugin`, and
re-dispatched with the same `id` on each change so it updates in place instead
of stacking.

**Accessibility:** status is never carried by colour alone. Each value shows a
word + shape pill (`✗ STALE`, `✓ LIVE`, `✓ LIVE · MANUAL`), the correct column
is marked with a tint and left border, and the palette uses blue vs rust/ochre
(distinguishable across common colour-vision types) — so the table reads the
same in greyscale.

**See the code:** a **"Show the code"** link on the notice opens a modal with all
four snippets side by side (A/B/C via the global `wp.data` API, and the
`useSelect` hook), each tagged `✗ AVOID` / `⚠ MANUAL` / `✓ USE THIS`. The modal
renders through a portal and keeps its own open state, so it stays put while the
live notice keeps updating. It's a read-only reference — handy in a talk or from
a shared Playground link, where switching to an IDE would break the flow.

## Files

- `src/store-consumer.js` — built with `@wordpress/scripts`. `registerPlugin` +
  `useSelect` drive the single live comparison notice.
- `assets/global-reads.js` — plain, un-built JS, **console-only**. The "out of
  tree" aside: reads the same store from outside the React tree at load (the
  hydration race) and via a hand-rolled `subscribe()`. Its `subscribe()` line
  logs in the same shape as the panel's live row, so console and panel tick
  together — proof they read one and the same store.
- `blueprint.json` — the Playground recipe behind the link above. It installs
  `editor-store-access-demo.zip` from this repo and lands on a new post.
- `editor-store-access-demo.zip` — the built plugin, **committed on purpose**:
  it's what the Playground link downloads. `build/` is gitignored, so this zip
  is the only copy of the compiled JS in the repo.

**After changing anything in `src/` or `assets/`, run `npm run plugin-zip` and
commit the refreshed zip** — it builds first, then repacks. Skip it and the
Playground link keeps serving the old code while the source here looks current.

## Run it

The fastest way to see it is the [Playground link](#editor-store-access-demo)
above — no checkout, no build.

To hack on it locally, use [`wp-env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/)
(Docker required — start Docker Desktop first):

```bash
npm install
npm run build          # or: npm start (watch)
npm run env            # boots WordPress at http://localhost:8888 with this plugin active
```

Log in at `http://localhost:8888/wp-admin` with `admin` / `password`, then open a
post. `npm run env:stop` shuts it down. The `.wp-env.json` here mounts the
plugin directory directly, so a rebuild is picked up on reload — pair
`npm start` with `wp-env` and you get a live edit loop.

Unlike the Playground link, wp-env doesn't seed a draft — add a few blocks and
save before reloading, or every row will read `0` and row **A** won't look wrong.

Read the notice at the top of the editor. Suggested live sequence:

1. Reload — row **A** shows `0` (read before hydration); the ✅ column shows the
   real count.
2. Add a few blocks — the ✅ column and row **C** (`subscribe()`) tick up on
   every edit; rows **A** and **B** freeze and are flagged **stale**.
3. Note the difference between **C** and ✅: same live number, but C is the
   hand-wired way (you write the subscription, the diffing, and the cleanup)
   while `useSelect` does all of that for you.

Open the console for the optional out-of-tree aside: `global-reads.js` runs the
same `subscribe()` from entirely outside the React tree and logs in a matching
format.
