import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { MotionValue } from 'motion/react'
import { AvatarModel } from './AvatarModel'
import { AvatarErrorBoundary } from './AvatarErrorBoundary'
import './AvatarScene.css'

interface AvatarSceneProps {
  progress: MotionValue<number>
  reducedMotion: boolean
}

/** Subtle camera parallax that follows the pointer, smoothed by lerp. */
function CameraRig({ disabled }: { disabled: boolean }) {
  useFrame((state) => {
    if (disabled) return
    const targetX = state.pointer.x * 0.3
    const targetY = 1.4 + state.pointer.y * 0.15
    state.camera.position.x += (targetX - state.camera.position.x) * 0.06
    state.camera.position.y += (targetY - state.camera.position.y) * 0.06
    state.camera.lookAt(0, 1.3, 0)
  })
  return null
}

function AvatarFallback() {
  return (
    <div className="avatar-fallback" role="img" aria-label="Avatar placeholder">
      <span>JC</span>
    </div>
  )
}

export function AvatarScene({ progress, reducedMotion }: AvatarSceneProps) {
  return (
    <div className="avatar-canvas">
      <AvatarErrorBoundary fallback={<AvatarFallback />}>
        <Canvas
          camera={{ position: [0, 1.4, 4.4], fov: 35 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 2]} intensity={0.85} />
          <CameraRig disabled={reducedMotion} />
          <Suspense fallback={null}>
            <AvatarModel progress={progress} reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>
      </AvatarErrorBoundary>
    </div>
  )
}
