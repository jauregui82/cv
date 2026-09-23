import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Group } from 'three'
import type { MotionValue } from 'motion/react'
import { useScrollAvatarMotion } from '../../hooks/useScrollAvatarMotion'

const MODEL_PATH = '/models/avatar.glb'

// `avatar.glb` currently carries POSITION only - no normals, UVs, vertex
// colors, or materials, so it loads with Three's flat-gray default material.
// A matte graphite tone reads as an intentional "3D sculpt/prototype" look
// instead of a broken/untextured one. Swap this out once a textured export
// is available - this is the only place that needs to change.
const PLACEHOLDER_MATERIAL = new MeshStandardMaterial({
  color: '#8a8a92',
  roughness: 0.5,
  metalness: 0.1,
})

interface AvatarModelProps {
  progress: MotionValue<number>
  reducedMotion: boolean
}

/**
 * `avatar.glb` is a static mesh - no skins, no animation clips. We load it
 * generically with `useGLTF` so a future rigged version only requires
 * changes in `useScrollAvatarMotion`, not here.
 */
export function AvatarModel({ progress, reducedMotion }: AvatarModelProps) {
  const motionGroup = useRef<Group>(null)
  const { scene } = useGLTF(MODEL_PATH)

  // Normalize scale/pivot regardless of how the source asset was authored,
  // so it frames consistently in the hero canvas.
  useEffect(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    const center = new Vector3()
    box.getSize(size)
    box.getCenter(center)

    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const targetHeight = 2.6
    const scale = targetHeight / maxDim

    scene.scale.setScalar(scale)
    scene.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    )

    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = PLACEHOLDER_MATERIAL
      }
    })
  }, [scene])

  useScrollAvatarMotion(motionGroup, progress, { enabled: !reducedMotion })

  return (
    <group ref={motionGroup} dispose={null}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
