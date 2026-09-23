import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import type { Group, PerspectiveCamera } from 'three'
import type { Variant } from '../hooks/useVariant'
import { INITIAL_DISPLAY_POSE, POSE_KEYS, WORK_SECTION_INDEX } from './choreography'
import type { Pose } from './choreography'
import type { ScrollPoseApi } from './useScrollPose'
import { workTrackingStore } from './store'

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
}

export function createAvatarTransform(): AvatarTransform {
  return { x: 0, y: 0, scale: 0, floorLocal: -0.95, jumpHeight: 0 }
}

interface PoseFrameOptions {
  poseGroupRef: MutableRefObject<Group | null>
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
  transformRef,
  naturalHeight,
  floorLocal,
  reducedMotion,
  scrollPose,
}: PoseFrameOptions) {
  const currentPoseRef = useRef<Pose>({ ...INITIAL_DISPLAY_POSE })
  const jumpProgressRef = useRef(1) // 1 == grounded / no jump in flight
  const lastJumpVersionRef = useRef(workTrackingStore.getSnapshot().jumpVersion)

  useFrame((state, delta) => {
    const group = poseGroupRef.current
    if (!group) return

    const { pose: targetPose, dominant } = scrollPose.getTargetPose(reducedMotion)

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

    if (jumpProgressRef.current < 1) {
      jumpProgressRef.current = Math.min(1, jumpProgressRef.current + delta / JUMP_DURATION_SECONDS)
    }
    const jumpProgress = jumpProgressRef.current
    const jumpHeight =
      !reducedMotion && jumpProgress < 1 ? Math.sin(jumpProgress * Math.PI) * JUMP_HEIGHT : 0
    const jumpRz =
      !reducedMotion && jumpProgress < 1 ? Math.sin(jumpProgress * Math.PI * 2) * JUMP_Z_SWAY : 0

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

    group.position.set(worldX, worldY, 0)
    group.scale.setScalar(scale * breathe)
    group.rotation.set(current.rx + rx, current.ry + ry, current.rz + jumpRz)

    const transform = transformRef.current
    transform.x = worldX
    transform.y = baseWorldY + bob * scale
    transform.scale = scale
    transform.floorLocal = floorLocal
    transform.jumpHeight = jumpHeight
  })
}
