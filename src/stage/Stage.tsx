import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CanvasTexture } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { useVariant } from '../hooks/useVariant'
import type { Variant } from '../hooks/useVariant'
import { Avatar } from './Avatar'
import { createAvatarTransform, shadowBaseOpacity } from './layers'
import type { AvatarTransform } from './layers'
import './Stage.css'

// Brief 3.1/3.2 light setup: amber key + blue rim from behind-right for
// Noche, white key+rim for Día. Total intensity stays close to the ~1-1.5
// this phase's brief asks for (mockup.html's raw intensities run much
// hotter — ~5-6 combined — which reads fine there but blows out with r3f's
// default, non "physically correct" light units). Ambient/hemisphere carry
// more of the total than a literal ~1.5 split would give them: with only
// two directional lights, faces outside their narrow angle read as flat
// near-black and the pale Noche albedo (#D9D3C7) reads as muddy brown
// instead of cream — see the report for the visual comparison.
const VARIANT_LIGHTS: Record<
  Variant,
  {
    ambient: number
    key: { color: string; intensity: number }
    rim: { color: string; intensity: number }
    hemi: number
  }
> = {
  noche: {
    ambient: 0.4,
    key: { color: '#FFB547', intensity: 0.55 },
    rim: { color: '#6E86FF', intensity: 0.35 },
    hemi: 0.35,
  },
  dia: {
    ambient: 0.3,
    key: { color: '#FFFFFF', intensity: 0.5 },
    rim: { color: '#FFFFFF', intensity: 0.3 },
    hemi: 0.25,
  },
}

function useTabVisible() {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  )

  useEffect(() => {
    function onVisibilityChange() {
      setVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return visible
}

function Lights({ variant }: { variant: Variant }) {
  const config = VARIANT_LIGHTS[variant]
  return (
    <>
      <ambientLight intensity={config.ambient} />
      <directionalLight
        color={config.key.color}
        intensity={config.key.intensity}
        position={[-3, 4, 4]}
      />
      <directionalLight
        color={config.rim.color}
        intensity={config.rim.intensity}
        position={[3, 2, -4]}
      />
      <hemisphereLight args={['#ffffff', '#222233', config.hemi]} />
    </>
  )
}

function makeShadowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    )
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new CanvasTexture(canvas)
  return texture
}

interface ContactShadowProps {
  variant: Variant
  transformRef: MutableRefObject<AvatarTransform>
}

/**
 * Static contact shadow under the avatar's feet (brief 4.3). Reads the
 * avatar's current world transform from `transformRef` each frame. `x`/`y`
 * there deliberately exclude the jump offset (see `layers.ts`), so the
 * shadow "no sube con los saltos"; `jumpHeight` drives its opacity fading
 * out while airborne, mirroring mockup.html's
 * `opacity * (1 - min(.7, jump*1.4))`.
 */
function ContactShadow({ variant, transformRef }: ContactShadowProps) {
  const meshRef = useRef<Mesh>(null)
  const texture = useMemo(() => makeShadowTexture(), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const transform = transformRef.current
    const feetY = transform.y + transform.floorLocal * transform.scale

    mesh.position.set(transform.x, feetY, -0.2)
    mesh.scale.set(transform.scale * 1.25, transform.scale * 0.5, 1)
    const airborneFade = 1 - Math.min(0.7, transform.jumpHeight * 1.4)
    ;(mesh.material as MeshBasicMaterial).opacity = shadowBaseOpacity(variant) * airborneFade
  })

  return (
    <mesh ref={meshRef} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0} />
    </mesh>
  )
}

/**
 * The single fixed full-screen Canvas (brief 4.1), mounted once in App. Sits
 * above page content (z-index 1) and below the Header (z-index 10) — see
 * `Stage.css`. `pointer-events: none` on the wrapper so it never blocks
 * clicks; the page itself provides the background color via `--bg`.
 */
export function Stage() {
  const { variant } = useVariant()
  const tabVisible = useTabVisible()
  const transformRef = useRef<AvatarTransform>(createAvatarTransform())

  return (
    <div className="stage" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 30, position: [0, 0, 10], near: 0.1, far: 100 }}
        frameloop={tabVisible ? 'always' : 'never'}
      >
        <Lights variant={variant} />
        <ContactShadow variant={variant} transformRef={transformRef} />
        <Avatar variant={variant} transformRef={transformRef} />
      </Canvas>
    </div>
  )
}
