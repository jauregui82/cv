import { useFrame } from '@react-three/fiber'
import type { MotionValue } from 'motion/react'
import type { RefObject } from 'react'
import type { Group } from 'three'

export interface ScrollAvatarMotionOptions {
  /** Horizontal sway amplitude, in scene units. */
  swayAmplitude?: number
  /** Vertical bob amplitude, in scene units. */
  bobAmplitude?: number
  /** How many full sway cycles happen across the tracked scroll range. */
  swayCycles?: number
  /** Bob runs at a higher frequency than sway (footsteps vs. side-to-side). */
  bobCyclesMultiplier?: number
  /** Max lean-into-the-step tilt, in radians. */
  tiltAmplitude?: number
  /** Max subtle turn synced with sway, in radians. */
  turnAmplitude?: number
  /** When false, the avatar settles to a static, neutral pose (reduced motion). */
  enabled?: boolean
}

const DEFAULTS: Required<ScrollAvatarMotionOptions> = {
  swayAmplitude: 0.7,
  bobAmplitude: 0.13,
  swayCycles: 3,
  bobCyclesMultiplier: 3.5,
  tiltAmplitude: 0.09,
  turnAmplitude: 0.06,
  enabled: true,
}

/**
 * Drives whole-object position/rotation to simulate the avatar "walking"
 * as the visitor scrolls the page. `avatar.glb` is currently a static mesh
 * (no skeleton, no animation clips), so movement is faked by transforming
 * the loaded object itself rather than playing bone animation.
 *
 * This is the ONLY place that should change if a rigged/animated version of
 * the model is swapped in later - everything else just loads the glTF.
 */
export function useScrollAvatarMotion(
  target: RefObject<Group | null>,
  progress: MotionValue<number>,
  options: ScrollAvatarMotionOptions = {},
) {
  const opts = { ...DEFAULTS, ...options }

  useFrame(() => {
    const obj = target.current
    if (!obj) return

    if (!opts.enabled) {
      obj.position.x = 0
      obj.position.y = 0
      obj.rotation.z = 0
      obj.rotation.y = 0
      return
    }

    const p = progress.get()
    const swayPhase = p * Math.PI * 2 * opts.swayCycles
    const bobPhase = swayPhase * opts.bobCyclesMultiplier

    const sway = Math.sin(swayPhase)
    const bob = Math.abs(Math.sin(bobPhase))

    obj.position.x = sway * opts.swayAmplitude
    obj.position.y = bob * opts.bobAmplitude
    obj.rotation.z = sway * opts.tiltAmplitude
    obj.rotation.y = sway * opts.turnAmplitude
  })
}
