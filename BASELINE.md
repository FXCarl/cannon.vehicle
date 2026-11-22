# cannon.vehicle baseline record

- Status: review branch
- Baseline date: 2026-11-23
- Upstream line: [pmndrs/cannon-es](https://github.com/pmndrs/cannon-es)
- Stable base: `v0.20.0` (`8b14771`, released upstream lineage)

## Scope

This repository is the Cannon runtime baseline for vehicle-simulation hosts. It is not the home of the engine-independent advanced vehicle model. Applications still construct and own their physics worlds; this package provides rigid bodies, collision queries, integration, legacy RaycastVehicle behavior and reviewed fixes.

## Accepted deltas

### 1. Upstream v0.20.0 synchronization

The previous repository head was synchronized with the stable upstream `v0.20.0` tag. Relevant inherited improvements include current TypeScript/Jest/Rollup tooling, CI, ray fixes, fixed-step helpers, trigger bodies, contact-material removal, configurable RaycastVehicle constants and exposed wheel count.

Upstream provenance remains visible in Git history. The large generated documentation and `dist/` changes from this synchronization are not hand-authored vehicle changes.

### 2. Closest-ray face-index consistency

Source: [pmndrs/cannon-es PR #220](https://github.com/pmndrs/cannon-es/pull/220), authored by Tarik Ermis, source commit `9815f4128fa1c8cca520744b194bd87108a1484f`.

In `Ray.CLOSEST` mode, farther intersections could overwrite `hitFaceIndex` after the closest hit position, normal and distance had already been accepted. The fix stores the face index only alongside accepted hit data. Regression coverage includes `CLOSEST`, `ALL` and `ANY` modes.

This commit was cherry-picked with its original authorship retained.

### 3. RaycastVehicle lifecycle and steep-contact robustness

Source for the adapted approach: [pmndrs/cannon-es PR #215](https://github.com/pmndrs/cannon-es/pull/215), authored by Marcu Tudoran (`Nugget8`), source head `03fa2a00c1697119849f5005044cdb17e5013f94`.

Accepted behavior:

- the internal world listener is separate from the user's `preStepCallback`;
- repeated attachment to the same world is a no-op instead of leaking callbacks;
- removing and reattaching a vehicle preserves exactly one model update per step;
- `updateVehicle(timeStep)` remains public for explicit-host integrations;
- steep-contact force no longer multiplies the existing inverse contact projection into a launching impulse;
- modern closest-ray query is used and chassis `collisionResponse` is restored even when a raycast throws.

The adaptation intentionally does **not** remove the public `constraints` property, change `updateVehicle`/`updateSuspension` signatures, or add the PR's visual wheel-rotation switch labelled `antiLockBraking`. That switch is not a physical ABS controller.

## Historical RaycastVehicle audit

The old `fxcarl` branch contains JavaScript-era experiments, including slip-angle saturation, an empirical mass term, braking clamps and a separate dynamic controller. These are not present in the TypeScript `master` baseline and were not ported wholesale.

Reasons for rejection in this baseline:

- several constants are empirical and lack a dimensional or stability contract;
- some changes mix force and impulse quantities without an explicit timestep;
- the dynamic controller belongs to the future vehicle-model research layer, not the Cannon runtime;
- the upstream line already contains the useful configurable wheel and raycast behavior from earlier community work.

The historical commits remain available for later controlled experiments; no claim is made that their handling model has been validated here.

## Explicitly deferred candidates

- PR #191 world interpolation rewrite: changes public time/state semantics and is not required for the narrow vehicle baseline.
- PR #110 dynamic body scaling: broad feature with independent API and inertia implications.
- experimental convex/trimesh collision work: substantial collision-system change, outside this round.
- PR #218 test-porting work: useful upstream coverage, but it does not yet port the RaycastVehicle tests and is not needed to validate these deltas.
- GPU depth-buffer wheel queries from cannon.js issue #413: an application/rendering integration technique, not a Cannon core patch.

## Verification contract

A baseline change is acceptable only when source typechecking, the complete Jest suite, production bundle generation and focused RaycastVehicle regressions pass. Generated `dist/` files must be rebuilt from the reviewed source. All accepted third-party changes retain their original commit authorship and the repository MIT license.

## Verification result

- TypeScript strict typecheck: passed.
- Complete Jest suite: 8 suites and 98 tests passed.
- New RaycastVehicle regression suite: 6 tests passed. Against the unchanged `v0.20.0` implementation, 5 of those tests fail, confirming that the suite detects the old lifecycle and contact defects.
- Production ESM, CJS and declaration bundles: rebuilt successfully.
- Published-file dry run: package version `0.20.0-fxcarl.0`; only the license, README, manifest and three distribution files are included.
- Built CJS consumer smoke test: 240 fixed steps at 120 Hz, four wheels grounded, exactly 240 user pre-step callbacks, finite settled chassis state and clean detachment.
