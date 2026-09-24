import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import { Vector3 } from 'three'
import type { Group, PerspectiveCamera } from 'three'
import type { Variant } from '../hooks/useVariant'
import {
  INITIAL_DISPLAY_POSE,
  POSE_KEYS,
  WORK_SECTION_INDEX,
  easeInOutCubic,
} from './choreography'
import type { Pose } from './choreography'
import type { ScrollPoseApi } from './useScrollPose'
import {
  avatarActionStore,
  avatarHeadStore,
  heroOStore,
  specLinesStore,
  workTrackingStore,
} from './store'

/**
 * Model-space anchor points for the Stack section's leader lines (brief 4.5
 * + 5.4). Order matches `content.specs.groups` in `es.json`/`en.json`
 * (Cerebro/Visión/Núcleo/Manos/Base) and mockup.html's `ANCHORS` array — the
 * brief's anchor table doesn't name which tag maps to which point, so this
 * mapping is ours: Cerebro→brain, Visión→glasses, Núcleo→torso, Manos→hand,
 * Base→feet.
 */
const SPEC_ANCHORS: readonly Vector3[] = [
  new Vector3(0.12, 0.86, 0.22), // Cerebro
  new Vector3(0.26, 0.18, 0.47), // Visión
  new Vector3(-0.05, -0.38, 0.25), // Núcleo
  new Vector3(0.31, -0.45, 0.12), // Manos
  new Vector3(-0.17, -0.92, 0.24), // Base
]

/** Mirrors mockup.html's `cur.specs > .02` gate for computing/showing the
 * leader lines at all — avoids the per-anchor projection work outside the
 * Stack section's held+blend range. */
const SPEC_LINES_VISIBLE_EPSILON = 0.02

/**
 * Model-space anchor for the speech bubble (brief 4.4): the point the
 * bubble is projected from every frame. Deliberately distinct from
 * `SPEC_ANCHORS`'s Cerebro point (0.12, 0.86, 0.22) used for the Stack
 * section's leader lines — see `avatarHeadStore` (`store.ts`).
 */
const HEAD_ANCHOR = new Vector3(0.1, 0.98, 0)

/**
 * Visible plane size (world units) at z = 0 for a perspective camera sitting
 * on the z axis and looking at the origin — brief 4.1's "coordenadas de
 * pantalla normalizadas, convertidas al plano z = 0". Mirrors
 * mockup.html's `FOV_H` (`tan(deg2rad(fov/2)) * distance`).
 */
export function getVisibleSize(
  camera: PerspectiveCamera,
  canvasWidth: number,
  canvasHeight: number,
) {
  const distance = camera.position.z
  const visibleHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance
  const visibleWidth = visibleHeight * (canvasWidth / canvasHeight)
  return { visibleWidth, visibleHeight }
}

/**
 * Idle float, brief 4.3: `sin(t * 1.6) * 0.012`. Mirrors mockup.html's
 * `bob`, which is applied as a fraction of the avatar's own world scale
 * (see `useAvatarPoseFrame`) rather than as a fixed world offset.
 */
export function idleBob(clock: number): number {
  return Math.sin(clock * 1.6) * 0.012
}

/**
 * Idle breathe, brief 4.3: scale oscillates ±0.6%. A beat out of phase with
 * `idleBob` (mirrors mockup.html) so the "chest" expands as the body dips.
 */
export function breatheFactor(clock: number): number {
  return 1 + Math.sin(clock * 1.6 + 1) * 0.006
}

/**
 * Cursor-follow, brief 4.3: `ry += look*mx*0.52`, `rx += look*my*0.18`.
 * `pointerX`/`pointerY` are r3f's NDC pointer (-1..1, Y up); mockup.html's
 * `my` is screen-space (Y down), so the Y term is negated here to match the
 * same visual tilt direction. `look` now varies per section (each pose row
 * in `choreography.ts` sets its own value) instead of being hardcoded to 1
 * like Phase 2's Hero-only pose.
 */
export function cursorRotation(look: number, pointerX: number, pointerY: number) {
  return {
    rx: look * -pointerY * 0.18,
    ry: look * pointerX * 0.52,
  }
}

/** Brief 4.3 contact shadow, per-variant base opacity (mockup.html). */
export function shadowBaseOpacity(variant: Variant): number {
  return variant === 'dia' ? 0.22 : 0.6
}

/**
 * Jump one-shot (brief 4.3 "Salto"): triggered when the Work section's
 * active job changes (`store.ts`'s `jumpVersion`), 0.55s, `sin(π·t)·0.18`
 * added to Y plus a small z-axis sway. Mirrors mockup.html's `hop`.
 */
const JUMP_DURATION_SECONDS = 0.55
const JUMP_HEIGHT = 0.18
const JUMP_Z_SWAY = 0.08

/**
 * Tap one-shot (brief 4.3 "Toque"): 0.9s total, a bigger jump (`0.35`) than
 * the Work-section one above, plus a full Y-axis turn on the `spin` child
 * group (below) and a speech bubble (`SpeechBubble.tsx`). Reuses `jumpOffset`
 * rather than duplicating the sine-arc math — brief's own suggestion.
 */
const POKE_DURATION_SECONDS = 0.9
const POKE_JUMP_HEIGHT = 0.35

/**
 * Flip one-shot (brief 4.3 "Voltereta"): 1s, a full *backward* X-axis turn
 * on the `spin` child group, triggered by the Header's ES/EN toggle
 * (`Header.tsx`), which separately delays the actual `setLanguage` call by
 * 450ms so the text swaps at the flip's midpoint.
 */
const FLIP_DURATION_SECONDS = 1

/** Greeting wave (brief 4.3 "Saludo"): `rz += wave * sin(t*5) * 0.16`. */
const WAVE_FREQUENCY = 5
const WAVE_AMPLITUDE = 0.16

/** Real "o" opacity rate (brief v2 §3): `1 - min(1, slot*1.25)`. */
const HERO_O_FADE_RATE = 1.25

/**
 * Shared sine-arc jump curve (brief 4.3): `sin(progress*π) * height` while
 * `progress` runs 0→1 over some duration-normalized value, 0 once grounded
 * (`progress >= 1`). Both the Work-section job jump ("Salto") and the tap
 * reaction ("Toque") drive this with their own progress ref/height —
 * mirrors mockup.html's `hop`/`poke` terms in its `jump` sum.
 */
function jumpOffset(progress: number, height: number): number {
  return progress < 1 ? Math.sin(progress * Math.PI) * height : 0
}

/**
 * Shared DOM/canvas-internal transform handoff so the contact shadow can
 * track the avatar's current world position/scale without forcing a React
 * re-render every frame — brief section 8's "estado compartido ... en un
 * `ref` mutable".
 */
export interface AvatarTransform {
  x: number
  y: number
  scale: number
  /** Local-space Y of the model's lowest point, after centering. */
  floorLocal: number
  /**
   * Current jump height (brief 4.3's raw `sin(π·t)·0.18` term, unscaled by
   * avatar size) — 0 when grounded. `ContactShadow` (`Stage.tsx`) reads
   * this to fade out while the avatar is airborne; deliberately excluded
   * from `y` above so the shadow itself "no sube con los saltos".
   */
  jumpHeight: number
  /** Damped `slot` pose value (brief v2 §3) — `ContactShadow` (`Stage.tsx`)
   * multiplies its opacity by `(1 - slot)`: no shadow while the head sits
   * in the hero's letter slot. */
  slot: number
}

export function createAvatarTransform(): AvatarTransform {
  return { x: 0, y: 0, scale: 0, floorLocal: -0.95, jumpHeight: 0, slot: 1 }
}

interface PoseFrameOptions {
  poseGroupRef: MutableRefObject<Group | null>
  /**
   * The `spin` child group (brief 4.3's "los giros extra van en un grupo
   * hijo (spin)") — carries only the tap/flip one-shot rotations, never the
   * continuous cursor-follow/idle rotation that lives on `poseGroupRef`'s
   * group instead.
   */
  spinGroupRef: MutableRefObject<Group | null>
  transformRef: MutableRefObject<AvatarTransform>
  naturalHeight: number
  floorLocal: number
  reducedMotion: boolean
  scrollPose: ScrollPoseApi
}

/**
 * Per-frame pose placement: resolves the scroll-driven target pose (brief
 * 4.2, `useScrollPose`), exponentially damps the displayed pose towards it
 * (`k = 1 - exp(-dt*7)`), then layers idle float/breathe, cursor-follow and
 * the jump one-shot on top (brief 4.3), and does the screen -> world
 * placement (brief 4.1). Under `prefers-reduced-motion` idle/jump/Specs'
 * scroll-tied rotation are suppressed — only the smooth section-to-section
 * repositioning remains (brief section 6). Used by both the real GLB avatar
 * and its sphere+capsule fallback so they behave identically.
 */
export function useAvatarPoseFrame({
  poseGroupRef,
  spinGroupRef,
  transformRef,
  naturalHeight,
  floorLocal,
  reducedMotion,
  scrollPose,
}: PoseFrameOptions) {
  const currentPoseRef = useRef<Pose>({ ...INITIAL_DISPLAY_POSE })
  const jumpProgressRef = useRef(1) // 1 == grounded / no jump in flight
  const pokeProgressRef = useRef(1) // 1 == no tap reaction in flight
  const flipProgressRef = useRef(1) // 1 == no language-flip in flight
  const lastJumpVersionRef = useRef(workTrackingStore.getSnapshot().jumpVersion)
  const lastPokeVersionRef = useRef(avatarActionStore.getSnapshot().pokeVersion)
  const lastFlipVersionRef = useRef(avatarActionStore.getSnapshot().flipVersion)
  const tmpAnchorRef = useRef(new Vector3())

  useFrame((state, delta) => {
    const group = poseGroupRef.current
    if (!group) return

    const { pose: targetPose, dominant, p } = scrollPose.getTargetPose(reducedMotion)

    const current = currentPoseRef.current
    const k = 1 - Math.exp(-delta * 7)
    for (const key of POSE_KEYS) {
      current[key] += (targetPose[key] - current[key]) * k
    }

    // Jump trigger: only while the Work section is actually the pose in
    // play (mirrors mockup.html gating `hop` on `dominant===3`), and never
    // under reduced motion (brief section 6).
    const jumpVersion = workTrackingStore.getSnapshot().jumpVersion
    if (!reducedMotion && dominant === WORK_SECTION_INDEX && jumpVersion !== lastJumpVersionRef.current) {
      jumpProgressRef.current = 0
    }
    lastJumpVersionRef.current = jumpVersion

    // Tap trigger (brief 4.3 "Toque"): `AvatarTapListener` (Avatar.tsx)
    // bumps `pokeVersion` on a hit-confirmed click. Flip trigger
    // ("Voltereta"): the Header's ES/EN toggle bumps `flipVersion` before
    // delaying the actual language swap. Both are read-and-diffed the same
    // way as `jumpVersion` above, and both are skipped under reduced motion
    // — `SpeechBubble.tsx` still reacts to `pokeVersion` independently of
    // this, so tapping still shows a bubble with no physical reaction
    // (brief section 6).
    const { pokeVersion, flipVersion } = avatarActionStore.getSnapshot()
    if (!reducedMotion && pokeVersion !== lastPokeVersionRef.current) {
      pokeProgressRef.current = 0
    }
    lastPokeVersionRef.current = pokeVersion
    if (!reducedMotion && flipVersion !== lastFlipVersionRef.current) {
      flipProgressRef.current = 0
    }
    lastFlipVersionRef.current = flipVersion

    if (jumpProgressRef.current < 1) {
      jumpProgressRef.current = Math.min(1, jumpProgressRef.current + delta / JUMP_DURATION_SECONDS)
    }
    if (pokeProgressRef.current < 1) {
      pokeProgressRef.current = Math.min(1, pokeProgressRef.current + delta / POKE_DURATION_SECONDS)
    }
    if (flipProgressRef.current < 1) {
      flipProgressRef.current = Math.min(1, flipProgressRef.current + delta / FLIP_DURATION_SECONDS)
    }
    const jumpProgress = jumpProgressRef.current
    const pokeProgress = pokeProgressRef.current
    const flipProgress = flipProgressRef.current
    const jumpHeight =
      (!reducedMotion ? jumpOffset(jumpProgress, JUMP_HEIGHT) : 0) +
      (!reducedMotion ? jumpOffset(pokeProgress, POKE_JUMP_HEIGHT) : 0)
    const jumpRz =
      !reducedMotion && jumpProgress < 1 ? Math.sin(jumpProgress * Math.PI * 2) * JUMP_Z_SWAY : 0

    // Spin one-shots (brief 4.3: "los giros extra van en un grupo hijo
    // (spin)") — a full turn on Y for the tap, a full *backward* turn on X
    // for the flip, eased the same way the scroll-pose blend is
    // (`easeInOutCubic`). Independent progress refs on different axes, so
    // (mirroring mockup.html) a tap and a flip can be mid-flight at the same
    // time with no mutual exclusion; re-triggering either one just restarts
    // that one's own progress from 0, cutting its rotation back to the start
    // rather than queueing or blending.
    const spinPokeY = !reducedMotion && pokeProgress < 1 ? easeInOutCubic(pokeProgress) * Math.PI * 2 : 0
    const spinFlipX =
      !reducedMotion && flipProgress < 1 ? -easeInOutCubic(flipProgress) * Math.PI * 2 : 0
    const spinGroup = spinGroupRef.current
    if (spinGroup) {
      spinGroup.rotation.set(spinFlipX, spinPokeY, 0)
    }

    const { visibleWidth, visibleHeight } = getVisibleSize(
      state.camera as PerspectiveCamera,
      state.size.width,
      state.size.height,
    )

    const worldX = current.x * (visibleWidth / 2)
    const baseWorldY = current.y * (visibleHeight / 2)
    const scale = (current.h * visibleHeight) / naturalHeight

    const clock = state.clock.elapsedTime
    const bob = reducedMotion ? 0 : idleBob(clock)
    const breathe = reducedMotion ? 1 : breatheFactor(clock)
    const { rx, ry } = reducedMotion
      ? { rx: 0, ry: 0 }
      : cursorRotation(current.look, state.pointer.x, state.pointer.y)

    // The jump lifts the mesh but not the shadow's tracked Y (brief 4.3:
    // shadow "no sube con los saltos") — see `transform.y` below.
    const worldY = baseWorldY + (bob + jumpHeight) * scale

    // Greeting wave (brief 4.3 "Saludo"): `rz += wave * sin(t*5) * 0.16`.
    // `current.wave` is already the pose's damped 0-1 value (1 at Contact,
    // 0 elsewhere, smoothed through the same exponential `k` above).
    const waveRz = !reducedMotion ? current.wave * Math.sin(clock * WAVE_FREQUENCY) * WAVE_AMPLITUDE : 0

    group.position.set(worldX, worldY, 0)
    group.scale.setScalar(scale * breathe)
    group.rotation.set(current.rx + rx, current.ry + ry, current.rz + jumpRz + waveRz)

    const transform = transformRef.current
    transform.x = worldX
    transform.y = baseWorldY + bob * scale
    transform.scale = scale
    transform.floorLocal = floorLocal
    transform.jumpHeight = jumpHeight
    transform.slot = current.slot

    // Real "o" glyph opacity (brief v2 §3): fully hidden once the head has
    // settled into the slot, back to normal once it's left.
    heroOStore.update(1 - Math.min(1, current.slot * HERO_O_FADE_RATE))

    // Stack leader lines (brief 5.4 + 4.5): project the 5 model-space
    // anchors through the avatar's *this-frame* world transform. R3F's
    // implicit render (which recomputes matrixWorld for the whole scene)
    // only runs after every useFrame callback has finished, so without this
    // explicit call `group.matrixWorld` here would still hold last frame's
    // transform — mirrors mockup.html's own explicit `avatar.updateMatrixWorld()`
    // right before it projects the same anchors.
    group.updateMatrixWorld(true)

    if (current.specs > SPEC_LINES_VISIBLE_EPSILON) {
      const tmp = tmpAnchorRef.current
      const anchors = SPEC_ANCHORS.map((anchor): [number, number] => {
        tmp.copy(anchor).applyMatrix4(group.matrixWorld).project(state.camera)
        return [((tmp.x + 1) / 2) * state.size.width, ((1 - tmp.y) / 2) * state.size.height]
      })
      specLinesStore.update(anchors, dominant, p, current.specs)
    } else {
      specLinesStore.update(specLinesStore.getSnapshot().anchors, dominant, p, 0)
    }

    // Speech bubble anchor (brief 4.4): projects through `spin`'s world
    // transform rather than the outer pose group's, so the bubble tracks
    // the model itself (including any tap/flip spin in flight) — `spin` is
    // a descendant of `group`, so `group.updateMatrixWorld(true)` above
    // already refreshed its `matrixWorld` too. Falls back to the pose
    // group's own matrix on the very first frame(s), before the ref
    // attaches.
    const headTmp = tmpAnchorRef.current
    const headMatrix = spinGroup ? spinGroup.matrixWorld : group.matrixWorld
    headTmp.copy(HEAD_ANCHOR).applyMatrix4(headMatrix).project(state.camera)
    avatarHeadStore.update(
      [((headTmp.x + 1) / 2) * state.size.width, ((1 - headTmp.y) / 2) * state.size.height],
      dominant,
    )
  })
}
