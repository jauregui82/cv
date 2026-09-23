import { useFrame } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import type { Group, PerspectiveCamera } from 'three'
import type { Variant } from '../hooks/useVariant'

/** Matches the `<760px` breakpoint used across `src/sections/*.css`. */
export const MOBILE_BREAKPOINT = 760

export interface Pose {
  x: number
  y: number
  h: number
  ry: number
  rx: number
  rz: number
  look: number
}

// Brief table 4.2, Hero row only — this phase renders the Hero pose
// statically. Scroll-driven pose choreography for the other sections
// (choreography.ts / useScrollPose.ts) is Phase 3.
export const HERO_POSE_DESKTOP: Pose = {
  x: 0,
  y: -0.08,
  h: 0.7,
  ry: 0,
  rx: 0,
  rz: 0,
  look: 1,
}

// Brief table 4.2 literally specifies y:-0.3, h:0.3 here, but at that size/
// position the avatar overlaps `.hero .lede` (the intro paragraph) on
// mobile — which brief section 6 explicitly forbids in a fixed pose ("en
// las poses fijas no debe tapar párrafos"). The mockup itself has the same
// overlap at this breakpoint, so this is a mockup inconsistency, not
// something to replicate. Retuned to sit in the gap between the name and
// the lede instead — see the verification screenshots for the fix.
export const HERO_POSE_MOBILE: Pose = {
  x: 0,
  y: 0.13,
  h: 0.21,
  ry: 0,
  rx: 0,
  rz: 0,
  look: 1,
}

export function getHeroPose(isMobile: boolean): Pose {
  return isMobile ? HERO_POSE_MOBILE : HERO_POSE_DESKTOP
}

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
 * same visual tilt direction.
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
}

export function createAvatarTransform(): AvatarTransform {
  return { x: 0, y: 0, scale: 0, floorLocal: -0.95 }
}

interface PoseFrameOptions {
  poseGroupRef: MutableRefObject<Group | null>
  transformRef: MutableRefObject<AvatarTransform>
  naturalHeight: number
  floorLocal: number
  reducedMotion: boolean
}

/**
 * Per-frame Hero-pose placement: screen -> world positioning (brief 4.1)
 * plus the idle float/breathe and cursor-follow layers (brief 4.3), applied
 * to the pose group. Under `prefers-reduced-motion` the avatar sits still
 * at its static hero-pose position (brief section 6). Used by both the real
 * GLB avatar and its sphere+capsule fallback so they behave identically.
 */
export function useAvatarPoseFrame({
  poseGroupRef,
  transformRef,
  naturalHeight,
  floorLocal,
  reducedMotion,
}: PoseFrameOptions) {
  useFrame((state) => {
    const group = poseGroupRef.current
    if (!group) return

    const isMobile = state.size.width < MOBILE_BREAKPOINT
    const pose = getHeroPose(isMobile)
    const { visibleWidth, visibleHeight } = getVisibleSize(
      state.camera as PerspectiveCamera,
      state.size.width,
      state.size.height,
    )

    const worldX = pose.x * (visibleWidth / 2)
    const baseWorldY = pose.y * (visibleHeight / 2)
    const scale = (pose.h * visibleHeight) / naturalHeight

    const clock = state.clock.elapsedTime
    const bob = reducedMotion ? 0 : idleBob(clock)
    const breathe = reducedMotion ? 1 : breatheFactor(clock)
    const { rx, ry } = reducedMotion
      ? { rx: 0, ry: 0 }
      : cursorRotation(pose.look, state.pointer.x, state.pointer.y)

    const worldY = baseWorldY + bob * scale

    group.position.set(worldX, worldY, 0)
    group.scale.setScalar(scale * breathe)
    group.rotation.set(pose.rx + rx, pose.ry + ry, pose.rz)

    const transform = transformRef.current
    transform.x = worldX
    transform.y = worldY
    transform.scale = scale
    transform.floorLocal = floorLocal
  })
}
