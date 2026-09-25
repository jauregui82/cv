import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import { Vector3 } from 'three'
import type { Group, PerspectiveCamera } from 'three'
import type { Variant } from '../hooks/useVariant'
import {
  INITIAL_DISPLAY_POSE,
  POSE_KEYS,
  SPECS_SECTION_INDEX,
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
import type { PokeKind } from './store'

/**
 * Model-space anchor points for the Stack section's leader lines (brief v2
 * §6, head-only model). Order matches `content.specs.groups` in
 * `es.json`/`en.json`: Cerebro·moño, Visión·gafas, Oído, Olfato, Barba.
 */
const SPEC_ANCHORS: readonly Vector3[] = [
  new Vector3(0.02, 0.48, -0.2), // Cerebro · moño
  new Vector3(0.2, -0.08, 0.33), // Visión · gafas
  new Vector3(-0.36, -0.06, -0.11), // Oído
  new Vector3(0.03, -0.17, 0.38), // Olfato
  new Vector3(-0.06, -0.43, 0.28), // Barba
]

/**
 * Per-anchor normal used to attenuate each leader line's opacity (brief v2
 * §6) as the head turns that part away from the camera. Normalized once
 * here, same as mockup.html's `NORMALS`.
 */
const SPEC_NORMALS: readonly Vector3[] = [
  new Vector3(0, 1, -0.3).normalize(),
  new Vector3(0, 0, 1).normalize(),
  new Vector3(-1, 0, 0).normalize(),
  new Vector3(0, 0, 1).normalize(),
  new Vector3(0, -0.4, 1).normalize(),
]

/** Mirrors mockup.html's `cur.specs > .02` gate for computing/showing the
 * leader lines at all — avoids the per-anchor projection work outside the
 * Stack section's held+blend range. */
const SPEC_LINES_VISIBLE_EPSILON = 0.02

/**
 * Model-space anchor for the speech bubble (brief v2 §7): the point the
 * bubble is projected from every frame. Deliberately distinct from
 * `SPEC_ANCHORS`'s Cerebro point used for the Stack section's leader lines —
 * see `avatarHeadStore` (`store.ts`).
 */
const HEAD_ANCHOR = new Vector3(0.12, 0.5, 0)

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
 * Cursor-follow, brief v2 §5: `ry += look*mx*0.62`, `rx += look*my*0.24`.
 * `pointerX`/`pointerY` are r3f's NDC pointer (-1..1, Y up); mockup.html's
 * `my` is screen-space (Y down), so the Y term is negated here to match the
 * same visual tilt direction.
 */
export function cursorRotation(look: number, pointerX: number, pointerY: number) {
  return {
    rx: look * -pointerY * 0.24,
    ry: look * pointerX * 0.62,
  }
}

/** Contact shadow base opacity, per variant (brief v2 §5). */
export function shadowBaseOpacity(variant: Variant): number {
  return variant === 'dia' ? 0.12 : 0.4
}

/**
 * Nod one-shot (brief v2 §5 "Asentir", replaces the old jump): triggered
 * when the Work section's active job changes (`store.ts`'s `jumpVersion`),
 * 0.6s, `sin(π·t)·0.32` added to `rx` — "ok, siguiente".
 */
const NOD_DURATION_SECONDS = 0.6
const NOD_AMPLITUDE = 0.32

/**
 * Tap one-shot (brief v2 §5 "Toque"): one of 3 reactions chosen at random
 * per tap (`store.ts`'s `pokeKind`), always paired with a speech bubble
 * (`SpeechBubble.tsx`). Spin runs 0.9s; shake and bounce run 1.1s.
 */
const POKE_SPIN_DURATION_SECONDS = 0.9
const POKE_OTHER_DURATION_SECONDS = 1.1
/** "No" shake: `ry += sin(t·6π)·0.42·(1−t)`. */
const POKE_SHAKE_FREQUENCY = 6 * Math.PI
const POKE_SHAKE_AMPLITUDE = 0.42
/** Bounce: squash `(1+q, 1−q, 1+q)`, `q = sin(t·3π)·(1−t)·0.14`, plus lift. */
const POKE_BOUNCE_FREQUENCY = 3 * Math.PI
const POKE_BOUNCE_SQUASH_AMPLITUDE = 0.14
const POKE_BOUNCE_LIFT = 0.25

/**
 * Language flip (brief v2 §5 "Idioma"): full turn on **Y** now (was X),
 * 1.1s, triggered by the Header's ES/EN toggle (`Header.tsx`), which
 * separately delays the actual `setLanguage` call to the 550ms midpoint.
 */
const FLIP_DURATION_SECONDS = 1.1

/** Contact "yes" nodding in bursts (brief v2 §5): `rx += wave·sin(t·7)·0.13·max(0, sin(t·0.9))`. */
const CONTACT_YES_FREQUENCY = 7
const CONTACT_YES_AMPLITUDE = 0.13
const CONTACT_YES_BURST_FREQUENCY = 0.9

/** Real "o" opacity rate (brief v2 §3): `1 - min(1, slot*1.25)`. */
const HERO_O_FADE_RATE = 1.25

/**
 * Shared sine-arc progress curve: `sin(progress*π) * height` while
 * `progress` runs 0→1 over some duration-normalized value, 0 once finished
 * (`progress >= 1`). Drives both the nod ("Asentir") and the bounce tap
 * reaction's elevation.
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
  /** Damped pose-space world Y — excludes idle bob and the bounce lift, so
   * the shadow (brief v2 §5) sits still under the avatar's target position. */
  y: number
  scale: number
  /** Local-space Y of the model's lowest point, after centering — unused by
   * the current shadow formula, kept for other consumers of this struct. */
  floorLocal: number
  /**
   * Current bounce-reaction lift (0 outside the "bounce" tap reaction) —
   * `ContactShadow` (`Stage.tsx`) reads this to fade out while airborne.
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
   * The `spin` child group — carries only the tap/flip one-shot rotations
   * (all on Y now, brief v2 §5), never the continuous cursor-follow/idle
   * rotation that lives on `poseGroupRef`'s group instead.
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
 * v2 §4, `useScrollPose`), exponentially damps the displayed pose towards it
 * (`k = 1 - exp(-dt*7)`), then layers idle float/breathe, cursor-follow and
 * the one-shot reactions on top (brief v2 §5), and does the screen -> world
 * placement (brief 4.1). Under `prefers-reduced-motion` idle/reactions/
 * Specs' scroll-tied rotation are suppressed — only the smooth
 * section-to-section repositioning remains (brief section 6). Used by both
 * the real GLB avatar and its sphere fallback so they behave identically.
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
  const nodProgressRef = useRef(1) // 1 == no nod in flight
  const pokeProgressRef = useRef(1) // 1 == no tap reaction in flight
  const pokeKindRef = useRef<PokeKind>(0)
  const flipProgressRef = useRef(1) // 1 == no language-flip in flight
  const lastJumpVersionRef = useRef(workTrackingStore.getSnapshot().jumpVersion)
  const lastPokeVersionRef = useRef(avatarActionStore.getSnapshot().pokeVersion)
  const lastFlipVersionRef = useRef(avatarActionStore.getSnapshot().flipVersion)
  const tmpAnchorRef = useRef(new Vector3())
  const tmpNormalRef = useRef(new Vector3())

  useFrame((state, delta) => {
    const group = poseGroupRef.current
    if (!group) return

    const { pose: targetPose, dominant, p, mobile } = scrollPose.getTargetPose(reducedMotion)

    const current = currentPoseRef.current
    // Mobile brief §2.1: a slightly faster damping (9 vs 7) so the head
    // doesn't lag behind its slot while scrolling.
    const k = 1 - Math.exp(-delta * (mobile ? 9 : 7))
    for (const key of POSE_KEYS) {
      current[key] += (targetPose[key] - current[key]) * k
    }

    // Nod trigger (brief v2 §5 "Asentir"): only while Work is actually the
    // pose in play, and never under reduced motion (brief section 6).
    const jumpVersion = workTrackingStore.getSnapshot().jumpVersion
    if (!reducedMotion && dominant === WORK_SECTION_INDEX && jumpVersion !== lastJumpVersionRef.current) {
      nodProgressRef.current = 0
    }
    lastJumpVersionRef.current = jumpVersion

    // Tap trigger: `AvatarTapListener` (Avatar.tsx) bumps `pokeVersion` and
    // rolls `pokeKind` on a hit-confirmed click; locked into a ref for the
    // one-shot's whole duration. Flip trigger: the Header's ES/EN toggle
    // bumps `flipVersion` before delaying the language swap. Both skipped
    // under reduced motion — `SpeechBubble.tsx` still reacts to
    // `pokeVersion` independently, so tapping still shows a bubble with no
    // physical reaction (brief section 6).
    const { pokeVersion, pokeKind, flipVersion } = avatarActionStore.getSnapshot()
    if (!reducedMotion && pokeVersion !== lastPokeVersionRef.current) {
      pokeProgressRef.current = 0
      pokeKindRef.current = pokeKind
    }
    lastPokeVersionRef.current = pokeVersion
    if (!reducedMotion && flipVersion !== lastFlipVersionRef.current) {
      flipProgressRef.current = 0
    }
    lastFlipVersionRef.current = flipVersion

    if (nodProgressRef.current < 1) {
      nodProgressRef.current = Math.min(1, nodProgressRef.current + delta / NOD_DURATION_SECONDS)
    }
    const pokeDuration = pokeKindRef.current === 0 ? POKE_SPIN_DURATION_SECONDS : POKE_OTHER_DURATION_SECONDS
    if (pokeProgressRef.current < 1) {
      pokeProgressRef.current = Math.min(1, pokeProgressRef.current + delta / pokeDuration)
    }
    if (flipProgressRef.current < 1) {
      flipProgressRef.current = Math.min(1, flipProgressRef.current + delta / FLIP_DURATION_SECONDS)
    }
    const nodProgress = nodProgressRef.current
    const pokeProgress = pokeProgressRef.current
    const flipProgress = flipProgressRef.current
    const isSpin = pokeKindRef.current === 0
    const isShake = pokeKindRef.current === 1
    const isBounce = pokeKindRef.current === 2

    const nodRx = !reducedMotion ? jumpOffset(nodProgress, NOD_AMPLITUDE) : 0
    const bounceLift = !reducedMotion && isBounce ? jumpOffset(pokeProgress, POKE_BOUNCE_LIFT) : 0
    const shakeRy =
      !reducedMotion && isShake && pokeProgress < 1
        ? Math.sin(pokeProgress * POKE_SHAKE_FREQUENCY) * POKE_SHAKE_AMPLITUDE * (1 - pokeProgress)
        : 0
    const squash =
      !reducedMotion && isBounce && pokeProgress < 1
        ? Math.sin(pokeProgress * POKE_BOUNCE_FREQUENCY) * (1 - pokeProgress) * POKE_BOUNCE_SQUASH_AMPLITUDE
        : 0

    // Spin one-shots, all on Y now (brief v2 §5): a full turn for the
    // "spin" tap reaction and for the language flip, eased the same way the
    // scroll-pose blend is (`easeInOutCubic`); the "no" shake rides the same
    // axis. Independent progress refs, so a tap and a flip can be
    // mid-flight together with no mutual exclusion; re-triggering either
    // one just restarts that one's own progress from 0.
    const spinPokeY = !reducedMotion && isSpin && pokeProgress < 1 ? easeInOutCubic(pokeProgress) * Math.PI * 2 : 0
    const spinFlipY = !reducedMotion && flipProgress < 1 ? easeInOutCubic(flipProgress) * Math.PI * 2 : 0
    const spinGroup = spinGroupRef.current
    if (spinGroup) {
      spinGroup.rotation.set(0, spinPokeY + shakeRy + spinFlipY, 0)
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

    const worldY = baseWorldY + (bob + bounceLift) * scale

    // Contact "yes" nodding, in bursts (brief v2 §5) — continuous while
    // `wave` is up (1 in Contact, 0 elsewhere, damped through `k` above),
    // not a one-shot.
    const contactYesRx = !reducedMotion
      ? current.wave *
        Math.sin(clock * CONTACT_YES_FREQUENCY) *
        CONTACT_YES_AMPLITUDE *
        Math.max(0, Math.sin(clock * CONTACT_YES_BURST_FREQUENCY))
      : 0

    // Mobile brief §3.1: a light sway while a Stack part is shown — off for
    // reduced motion, and only while Specs is actually the dominant section
    // (not mid-blend into/out of it).
    const specsWobble =
      !reducedMotion && mobile && dominant === SPECS_SECTION_INDEX ? Math.sin(clock * 0.8) * 0.06 : 0

    group.position.set(worldX, worldY, 0)
    group.scale.set(
      scale * breathe * (1 + squash),
      scale * breathe * (1 - squash),
      scale * breathe * (1 + squash),
    )
    group.rotation.set(current.rx + rx + contactYesRx + nodRx, current.ry + ry + specsWobble, current.rz)

    const transform = transformRef.current
    transform.x = worldX
    transform.y = baseWorldY
    transform.scale = scale
    transform.floorLocal = floorLocal
    transform.jumpHeight = bounceLift
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
      const tmpNormal = tmpNormalRef.current
      const anchors: [number, number][] = []
      const lineOpacities: number[] = []
      for (let i = 0; i < SPEC_ANCHORS.length; i++) {
        tmp.copy(SPEC_ANCHORS[i]).applyMatrix4(group.matrixWorld).project(state.camera)
        anchors.push([((tmp.x + 1) / 2) * state.size.width, ((1 - tmp.y) / 2) * state.size.height])

        // Attenuation (brief v2 §6): rotate the anchor's normal by the same
        // matrix used to project its position above, then fade the line as
        // that part of the head turns away from the camera — never below
        // 0.25, so a line dims but never fully disappears.
        tmpNormal.copy(SPEC_NORMALS[i]).transformDirection(group.matrixWorld)
        const facing = Math.min(1, Math.max(0.25, 0.5 + tmpNormal.z * 0.9))
        lineOpacities.push(current.specs * facing)
      }
      specLinesStore.update(anchors, dominant, p, current.specs, lineOpacities)
    } else {
      const snapshot = specLinesStore.getSnapshot()
      specLinesStore.update(snapshot.anchors, dominant, p, 0, snapshot.lineOpacities)
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
