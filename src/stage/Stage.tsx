import { Component, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CanvasTexture } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { useVariant } from '../hooks/useVariant'
import type { Variant } from '../hooks/useVariant'
import { Avatar } from './Avatar'
import { createAvatarTransform, shadowBaseOpacity } from './layers'
import type { AvatarTransform } from './layers'
import './Stage.css'

// Brief v2 §5 light setup (head-only avatar, real baked material - these
// numbers run hotter than the v1 body's flat-color material needed, since
// there's no flat albedo tint doing part of the work anymore).
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
    ambient: 0.35,
    key: { color: '#FFC47A', intensity: 2.1 },
    rim: { color: '#6E86FF', intensity: 3.2 },
    hemi: 0.45,
  },
  dia: {
    ambient: 0.7,
    key: { color: '#FFFFFF', intensity: 1.7 },
    rim: { color: '#BFD0FF', intensity: 1.4 },
    hemi: 0.7,
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
 * Static contact shadow under the avatar (brief v2 §5): smaller than the
 * old full-body shadow, sitting a fixed `0.64·scale` below the avatar's
 * (bob-free) center rather than tracking the model's actual floor. Reads
 * the avatar's current world transform from `transformRef` each frame;
 * `jumpHeight` (the bounce tap reaction's lift) drives its opacity fading
 * out while airborne.
 */
const SHADOW_Y_OFFSET = 0.64

function ContactShadow({ variant, transformRef }: ContactShadowProps) {
  const meshRef = useRef<Mesh>(null)
  const texture = useMemo(() => makeShadowTexture(), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const transform = transformRef.current
    const feetY = transform.y - SHADOW_Y_OFFSET * transform.scale

    mesh.position.set(transform.x, feetY, -0.2)
    mesh.scale.set(transform.scale * 0.9, transform.scale * 0.32, 1)
    const airborneFade = 1 - Math.min(0.7, transform.jumpHeight * 1.4)
    // No shadow while the head sits in the hero's letter slot (brief v2 §3).
    ;(mesh.material as MeshBasicMaterial).opacity =
      shadowBaseOpacity(variant) * airborneFade * (1 - transform.slot)
  })

  return (
    <mesh ref={meshRef} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0} />
    </mesh>
  )
}

interface CanvasErrorBoundaryProps {
  children: ReactNode
}

interface CanvasErrorBoundaryState {
  hasError: boolean
}

/**
 * Brief section 6: "el canvas es una mejora, no un requisito" — the page
 * must stay fully readable/functional with WebGL unavailable entirely (old
 * browser, disabled GPU…), not just when the GLB itself fails to load
 * (`AvatarErrorBoundary` in `Avatar.tsx` handles that narrower case, but it
 * only wraps the model-loading `Suspense`, nested *inside* this `<Canvas>`).
 *
 * When the browser can't construct a `WebGLRenderer`, r3f's `<Canvas>`
 * doesn't throw synchronously: its internal `root.current.configure(...)`
 * call is a promise, rejection is routed through `.catch(setError)` into
 * React state, and `<Canvas>` then re-renders and throws that state
 * synchronously during render (confirmed by reading
 * `@react-three/fiber`'s `CanvasImpl` — `if (error) throw error`). That
 * throw happens above `AvatarErrorBoundary`, so without a boundary here it
 * propagates uncaught and React unmounts the *entire* app, taking the
 * header/sections/nav down with it. This boundary catches it at the
 * `<Canvas>` root and renders nothing in its place — the rest of the page
 * (mounted as siblings in `App.tsx`, outside `.stage`) is unaffected.
 */
class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[stage] WebGL unavailable, rendering the page without the 3D avatar', error)
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

/**
 * The single fixed full-screen Canvas (brief 4.1), mounted once in App. Sits
 * above page content (z-index 1) and below the Header (z-index 10) — see
 * `Stage.css`. `pointer-events: none` on the wrapper so it never blocks
 * clicks; r3f's `<Canvas>` sets its own inline `pointer-events: auto` by
 * default, so it's overridden explicitly here too. The page itself provides
 * the background color via `--bg`.
 */
export function Stage() {
  const { variant } = useVariant()
  const tabVisible = useTabVisible()
  const transformRef = useRef<AvatarTransform>(createAvatarTransform())

  return (
    <div className="stage" aria-hidden="true">
      <CanvasErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 30, position: [0, 0, 10], near: 0.1, far: 100 }}
          frameloop={tabVisible ? 'always' : 'never'}
          style={{ pointerEvents: 'none' }}
        >
          <Lights variant={variant} />
          <ContactShadow variant={variant} transformRef={transformRef} />
          <Avatar variant={variant} transformRef={transformRef} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
