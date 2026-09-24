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

// Runtime string, not a build-time import - Vite's `base` rewriting (needed
// for the site to work under a subpath like GitHub Pages' /cv/) only
// applies to asset references it can see at build time (index.html links,
// static imports). BASE_URL is Vite's own env var for exactly this case.
const MODEL_PATH = `${import.meta.env.BASE_URL}models/avatar.glb`

// avatar.glb ships a real baked PBR material (base color + normal + metallic/
// roughness WebP textures) - AvatarModel uses that material as-is rather
// than overwriting it (brief v2 §2: "No sobrescribas su material"). Day/
// night is differentiated by Stage.tsx's per-variant lighting only, not by
// swapping the avatar's own color. The fallback sphere has no UVs/texture of
// its own, so it still needs a flat per-variant color - kept here for that
// case only.
const VARIANT_MATERIAL: Record<Variant, { color: string; roughness: number }> = {
  noche: { color: '#D9D3C7', roughness: 0.55 },
  dia: { color: '#2B43E0', roughness: 0.42 },
}

// Brief v2 §2: the avatar is head-only now (no body/legs) - a single sphere
// fallback replaces the old sphere+capsule pair. Scale (0.82, 1.08, 0.86)
// per the brief, sphere radius 0.5 centered at the origin (matching how the
// real head is Box3-centered) - floor is just that scaled sphere's bottom.
const FALLBACK_SCALE: [number, number, number] = [0.82, 1.08, 0.86]
const FALLBACK_SPHERE_RADIUS = 0.5
// Brief v2 §2: "Altura natural: 0.98 (antes 1.9)."
const FALLBACK_NATURAL_HEIGHT = 0.98
const FALLBACK_FLOOR_LOCAL = -FALLBACK_SPHERE_RADIUS * FALLBACK_SCALE[1]

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
    console.error('[stage] avatar.glb failed to load, using sphere fallback', error)
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
        <mesh scale={FALLBACK_SCALE} material={material}>
          <sphereGeometry args={[FALLBACK_SPHERE_RADIUS, 48, 32]} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
