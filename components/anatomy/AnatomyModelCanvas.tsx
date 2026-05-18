import React, { useEffect, useRef, useState } from 'react';
import type { Material, Object3D, WebGLRenderer } from 'three';

interface AnatomyModelCanvasProps {
  modelUrl: string;
  modelName: string;
  scale?: number;
  defaultRotation?: [number, number, number];
  autoRotate?: boolean;
  wireframe?: boolean;
  reducedMotion?: boolean;
}

const DEFAULT_ROTATION: [number, number, number] = [0, 0, 0];

interface MaterialHost extends Object3D {
  material?: Material | Material[];
}

interface WireframeMaterial extends Material {
  wireframe: boolean;
  needsUpdate: boolean;
}

function hasMaterial(object: Object3D): object is MaterialHost {
  return 'material' in object;
}

function hasWireframe(material: Material): material is WireframeMaterial {
  return typeof (material as { wireframe?: unknown }).wireframe === 'boolean';
}

function applyWireframe(scene: Object3D, wireframe: boolean) {
  scene.traverse((object) => {
    if (!hasMaterial(object) || !object.material) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!hasWireframe(material)) return;
      material.wireframe = wireframe;
      material.needsUpdate = true;
    });
  });
}

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    const maybeMesh = child as Object3D & {
      geometry?: { dispose: () => void };
      material?: Material | Material[];
    };

    maybeMesh.geometry?.dispose();
    if (!maybeMesh.material) return;

    const materials = Array.isArray(maybeMesh.material) ? maybeMesh.material : [maybeMesh.material];
    materials.forEach((material) => material.dispose());
  });
}

function readCssColor(variableName: string, fallback: string) {
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

export function AnatomyModelCanvas({
  modelUrl,
  modelName,
  scale = 1,
  defaultRotation = DEFAULT_ROTATION,
  autoRotate = false,
  wireframe = false,
  reducedMotion = false,
}: AnatomyModelCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let loadedRoot: Object3D | null = null;
    let controls: {
      dispose: () => void;
      update: () => boolean;
      addEventListener: (type: 'change', listener: () => void) => void;
      enableDamping: boolean;
      enablePan: boolean;
      enableZoom: boolean;
      minDistance: number;
      maxDistance: number;
    } | null = null;

    async function initScene() {
      const mount = mountRef.current;
      if (!mount) return;

      setError(null);
      setIsSceneReady(false);
      setLoadProgress(null);

      if (!window.WebGLRenderingContext) {
        setError('This browser does not support WebGL anatomy scenes.');
        return;
      }

      const [Three, { GLTFLoader }, { OrbitControls }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/controls/OrbitControls.js'),
      ]);

      if (disposed || !mountRef.current) return;

      const scene = new Three.Scene();
      const camera = new Three.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0.16, 4.2);

      try {
        renderer = new Three.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'low-power',
        });
      } catch {
        setError('The 3D anatomy scene could not start in this browser.');
        return;
      }

      renderer.outputColorSpace = Three.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      mount.appendChild(renderer.domElement);

      const atlasCyan = readCssColor('--atlas-accent-cyan', 'cyan');
      const atlasWhite = readCssColor('--atlas-clinical-white', 'white');

      const ambientLight = new Three.AmbientLight(atlasWhite, 0.68);
      const keyLight = new Three.DirectionalLight(atlasWhite, 1.35);
      keyLight.position.set(2.5, 3.2, 4);
      const cyanLight = new Three.PointLight(atlasCyan, 0.85);
      cyanLight.position.set(-2.8, -1.4, 2.4);
      scene.add(ambientLight, keyLight, cyanLight);

      const scannerRings = new Three.Group();
      scannerRings.rotation.x = Math.PI / 2;
      [1.35, 1.65, 1.95].forEach((radius, index) => {
        const geometry = new Three.TorusGeometry(radius, 0.004 + index * 0.001, 12, 160);
        const material = new Three.MeshBasicMaterial({
          color: new Three.Color(atlasCyan),
          transparent: true,
          opacity: 0.16 - index * 0.03,
        });
        scannerRings.add(new Three.Mesh(geometry, material));
      });
      scene.add(scannerRings);

      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelUrl, (event) => {
        if (!event.total) return;
        setLoadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      });
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }

      loadedRoot = gltf.scene;
      loadedRoot.rotation.set(...defaultRotation);
      applyWireframe(loadedRoot, wireframe);

      const bounds = new Three.Box3().setFromObject(loadedRoot);
      const center = bounds.getCenter(new Three.Vector3());
      const size = bounds.getSize(new Three.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      loadedRoot.position.sub(center);
      loadedRoot.scale.setScalar((2.45 / maxAxis) * scale);
      scene.add(loadedRoot);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = !reducedMotion;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 1.2;
      controls.maxDistance = 7;
      controls.addEventListener('change', render);

      function resize() {
        if (!renderer || !mountRef.current) return;
        const { clientWidth, clientHeight } = mountRef.current;
        camera.aspect = Math.max(clientWidth, 1) / Math.max(clientHeight, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight, false);
        render();
      }

      function render() {
        if (!renderer) return;
        renderer.render(scene, camera);
      }

      function animate() {
        if (disposed || !renderer) return;
        if (autoRotate && !reducedMotion && loadedRoot) {
          loadedRoot.rotation.y += 0.003;
          scannerRings.rotation.z += 0.0014;
        }
        controls?.update();
        render();
        if (autoRotate && !reducedMotion) {
          animationFrame = window.requestAnimationFrame(animate);
        }
      }

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      resize();
      setIsSceneReady(true);
      animate();
    }

    initScene().catch((err: unknown) => {
      console.error('[AnatomyModelCanvas] Failed to load model scene:', err);
      if (!disposed) setError('The 3D anatomy scene could not be loaded.');
    });

    return () => {
      disposed = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (loadedRoot) disposeObject(loadedRoot);
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    };
  }, [autoRotate, defaultRotation, modelUrl, reducedMotion, scale, wireframe]);

  return (
    <div
      className="relative h-full w-full"
      aria-label={`${modelName} interactive 3D anatomy model`}
    >
      <div ref={mountRef} className="h-full w-full" />
      {!error && !isSceneReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-secondary)]/88 p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Loading 3D atlas scene
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]" aria-live="polite">
              {loadProgress === null ? 'Preparing WebGL model...' : `${loadProgress}% loaded`}
            </p>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-secondary)]/90 p-6 text-center text-sm text-[var(--color-text-secondary)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default AnatomyModelCanvas;
