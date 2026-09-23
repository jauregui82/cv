import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { Group } from 'three'
import { useAvatarPoseFrame } from './layers'
import type { AvatarTransform } from './layers'
import type { Variant } from '../hooks/useVariant'

const MODEL_PATH = '/models/avatar.glb'

// Brief 3.1/3.2: material per variant. Metalness isn't specified in the
// brief tables — kept at mockup.html's 0.05 for both.
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
  return (
    <AvatarErrorBoundary
      fallback={<AvatarFallback variant={variant} transformRef={transformRef} />}
    >
      <Suspense fallback={null}>
        <AvatarModel variant={variant} transformRef={transformRef} />
      </Suspense>
    </AvatarErrorBoundary>
  )
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

function AvatarModel({ variant, transformRef }: AvatarProps) {
  const { scene } = useGLTF(MODEL_PATH)
  const poseGroupRef = useRef<Group>(null)
  const reducedMotion = useReducedMotion()
  const material = useVariantMaterial(variant)

  // avatar.glb carries POSITION only (no normals/UVs/materials/skeleton, per
  // glTF inspection) — normals must be computed after load or lighting is
  // flat/wrong (brief 4.5). Centering via Box3 mirrors mockup.html. Runs
  // once per loaded scene, independent of the variant material below.
  const { naturalHeight, floorLocal } = useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof Mesh) child.geometry.computeVertexNormals()
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

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof Mesh) child.material = material
    })
  }, [scene, material])

  useAvatarPoseFrame({
    poseGroupRef,
    transformRef,
    naturalHeight,
    floorLocal,
    reducedMotion: Boolean(reducedMotion),
  })

  return (
    <group ref={poseGroupRef}>
      {/* Spin group: reserved for the full-turn jump/poke/flip animations
          of Phase 3+ (brief 4.3's "los giros extra van en un grupo hijo
          (spin)"). Identity this phase — nothing rotates it yet. */}
      <group>
        <primitive object={scene} />
      </group>
    </group>
  )
}

function AvatarFallback({ variant, transformRef }: AvatarProps) {
  const poseGroupRef = useRef<Group>(null)
  const reducedMotion = useReducedMotion()
  const material = useVariantMaterial(variant)

  useAvatarPoseFrame({
    poseGroupRef,
    transformRef,
    naturalHeight: FALLBACK_NATURAL_HEIGHT,
    floorLocal: FALLBACK_FLOOR_LOCAL,
    reducedMotion: Boolean(reducedMotion),
  })

  return (
    <group ref={poseGroupRef}>
      <group>
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
