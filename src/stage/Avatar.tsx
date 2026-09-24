import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector2, Vector3 } from 'three'
import type { Group } from 'three'
import { useAvatarPoseFrame } from './layers'
import type { AvatarTransform } from './layers'
import { useScrollPose } from './useScrollPose'
import { avatarActionStore } from './store'
import type { Variant } from '../hooks/useVariant'

const MODEL_PATH = '/models/avatar.glb'

// avatar.glb now ships a real baked PBR material (base color + normal +
// metallic/roughness textures, matching the reference photo) instead of the
// earlier geometry-only export. AvatarModel below uses that material as-is
// rather than overwriting it — day/night is differentiated by Stage.tsx's
// per-variant lighting only now, not by swapping the avatar's own color.
// The sphere+capsule fallback has no UVs/texture of its own, so it still
// needs a flat per-variant color - kept here for that case only.
const VARIANT_MATERIAL: Record<Variant, { color: string; roughness: number }> = {
  noche: { color: '#D9D3C7', roughness: 0.55 },
  dia: { color: '#2B43E0', roughness: 0.42 },
}

// Sphere+capsule fallback proportions/floor, matching mockup.html's
// `placeholder()` closely enough that it reads as the same figure at the
// same on-screen size as the real model.
const FALLBACK_NATURAL_HEIGHT = 1.9
const FALLBACK_FLOOR_LOCAL = -0.94

interface AvatarProps {
  variant: Variant
  transformRef: MutableRefObject<AvatarTransform>
}

interface AvatarBodyProps extends AvatarProps {
  /** Lifted to `Avatar` so `AvatarTapListener` can raycast against whichever
   * of `AvatarModel`/`AvatarFallback` is actually mounted (brief 4.3
   * "Toque"). */
  poseGroupRef: MutableRefObject<Group | null>
}

interface AvatarErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface AvatarErrorBoundaryState {
  hasError: boolean
}

/**
 * `useGLTF` throws (after its Suspense promise rejects) if the GLB fails to
 * load. A regular React error boundary around the `Suspense` boundary does
 * catch that — brief 4.5's "si falla la carga: figura de reemplazo".
 */
class AvatarErrorBoundary extends Component<
  AvatarErrorBoundaryProps,
  AvatarErrorBoundaryState
> {
  state: AvatarErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error(
      '[stage] avatar.glb failed to load, using sphere+capsule fallback',
      error,
    )
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export function Avatar({ variant, transformRef }: AvatarProps) {
  // Outer pose group, shared between whichever of AvatarModel/AvatarFallback
  // is mounted and AvatarTapListener below — the tap reaction (brief 4.3
  // "Toque") needs to raycast against it regardless of which one is active.
  const poseGroupRef = useRef<Group>(null)

  return (
    <>
      <AvatarErrorBoundary
        fallback={
          <AvatarFallback
            variant={variant}
            transformRef={transformRef}
            poseGroupRef={poseGroupRef}
          />
        }
      >
        <Suspense fallback={null}>
          <AvatarModel variant={variant} transformRef={transformRef} poseGroupRef={poseGroupRef} />
        </Suspense>
      </AvatarErrorBoundary>
      <AvatarTapListener poseGroupRef={poseGroupRef} />
    </>
  )
}

interface AvatarTapListenerProps {
  poseGroupRef: MutableRefObject<Group | null>
}

/**
 * Manual raycast click detector for the avatar (brief 4.3 "Toque"). The
 * Stage wrapper is deliberately `pointer-events: none` (Stage.css) so the
 * fixed full-screen canvas never blocks clicks on page content beneath it —
 * which also means r3f's own per-mesh `onClick` can't fire, since it relies
 * on native pointer events actually reaching the canvas DOM element.
 * Instead this listens on `window` and manually raycasts against
 * `poseGroupRef`'s subtree on every click; it never calls
 * `preventDefault`/`stopPropagation`, so it's purely observational and
 * click-through to underlying page content keeps working everywhere.
 */
function AvatarTapListener({ poseGroupRef }: AvatarTapListenerProps) {
  const { camera, size } = useThree()

  useEffect(() => {
    const raycaster = new Raycaster()
    const ndc = new Vector2()

    function onClick(event: MouseEvent) {
      const group = poseGroupRef.current
      if (!group) return

      ndc.x = (event.clientX / size.width) * 2 - 1
      ndc.y = -(event.clientY / size.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.intersectObject(group, true).length > 0) {
        avatarActionStore.triggerPoke()
      }
    }

    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [camera, size, poseGroupRef])

  return null
}

function useVariantMaterial(variant: Variant) {
  // A fresh material per variant (rather than mutating one shared instance)
  // keeps this a plain, dependency-driven useMemo and disposes the old GPU
  // resource cleanly on every swap.
  const material = useMemo(() => {
    const config = VARIANT_MATERIAL[variant]
    return new MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness,
      metalness: 0.05,
    })
  }, [variant])

  useEffect(() => () => material.dispose(), [material])

  return material
}

function AvatarModel({ transformRef, poseGroupRef }: AvatarBodyProps) {
  const { scene } = useGLTF(MODEL_PATH)
  const spinGroupRef = useRef<Group>(null)
  const reducedMotion = useReducedMotion()
  const scrollPose = useScrollPose()

  // avatar.glb now ships its own real material (baseColor/normal/metallic-
  // roughness textures baked in) - use it as-is, don't overwrite it. Only
  // compute normals ourselves if a given export happens to lack them
  // (defensive - true for earlier geometry-only exports, brief 4.5).
  // Centering via Box3 mirrors mockup.html. Runs once per loaded scene.
  const { naturalHeight, floorLocal } = useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof Mesh && !child.geometry.getAttribute('normal')) {
        child.geometry.computeVertexNormals()
      }
    })

    const box = new Box3().setFromObject(scene)
    const center = new Vector3()
    box.getCenter(center)
    scene.position.sub(center)

    return {
      naturalHeight: box.max.y - box.min.y || FALLBACK_NATURAL_HEIGHT,
      floorLocal: box.min.y - center.y,
    }
  }, [scene])

  useAvatarPoseFrame({
    poseGroupRef,
    spinGroupRef,
    transformRef,
    naturalHeight,
    floorLocal,
    reducedMotion: Boolean(reducedMotion),
    scrollPose,
  })

  return (
    <group ref={poseGroupRef}>
      {/* Spin group (brief 4.3's "los giros extra van en un grupo hijo
          (spin)"): carries the tap/flip full-turn one-shots (Phase 5,
          `layers.ts`). The jump one-shot ("Salto", built Phase 4) applies
          directly to the pose group above instead, matching mockup.html
          (its `hop` term lives on `avatar.rotation`/position, not `spin`). */}
      <group ref={spinGroupRef}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

function AvatarFallback({ variant, transformRef, poseGroupRef }: AvatarBodyProps) {
  const spinGroupRef = useRef<Group>(null)
  const reducedMotion = useReducedMotion()
  const material = useVariantMaterial(variant)
  const scrollPose = useScrollPose()

  useAvatarPoseFrame({
    poseGroupRef,
    spinGroupRef,
    transformRef,
    naturalHeight: FALLBACK_NATURAL_HEIGHT,
    floorLocal: FALLBACK_FLOOR_LOCAL,
    reducedMotion: Boolean(reducedMotion),
    scrollPose,
  })

  return (
    <group ref={poseGroupRef}>
      <group ref={spinGroupRef}>
        <mesh position={[0, 0.38, 0]} scale={[1, 0.9, 0.95]} material={material}>
          <sphereGeometry args={[0.5, 48, 32]} />
        </mesh>
        <mesh position={[0, -0.45, 0]} material={material}>
          <capsuleGeometry args={[0.26, 0.45, 8, 24]} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
