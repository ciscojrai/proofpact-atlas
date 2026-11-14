import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WorkOrder, LatLon } from '../types';
import { latLonToVector3, getSubSolarPointFromIso } from '../utils/geo';

interface Earth3DProps {
  workOrders: WorkOrder[];
  selectedWorkOrder: WorkOrder;
  onSelectWorkOrder: (workOrderId: string) => void;
  activeTimestampIso: string;
}

const EARTH_RADIUS = 100;

// Pre-allocated math helpers at module scope (Zero GC in render loop)
const _curDir = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _qCur = new THREE.Quaternion();
const _qTarget = new THREE.Quaternion();
const _newDir = new THREE.Vector3();
const _origin = new THREE.Vector3(0, 0, 0);

function generateGreatCircleArc(
  coord1: LatLon,
  coord2: LatLon,
  baseRadius: number,
  arcAltitude: number,
  segments = 48
): THREE.Vector3[] {
  const v1 = new THREE.Vector3(...latLonToVector3(coord1.lat, coord1.lon, 1)).normalize();
  const v2 = new THREE.Vector3(...latLonToVector3(coord2.lat, coord2.lon, 1)).normalize();

  const dot = Math.min(1, Math.max(-1, v1.dot(v2)));
  const omega = Math.acos(dot);
  const points: THREE.Vector3[] = [];

  if (omega < 0.005) {
    return points;
  }

  const sinOmega = Math.sin(omega);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    const elevation = Math.sin(t * Math.PI) * arcAltitude;
    const pt = new THREE.Vector3()
      .addScaledVector(v1, a)
      .addScaledVector(v2, b)
      .normalize()
      .multiplyScalar(baseRadius + elevation);
    points.push(pt);
  }
  return points;
}

function getMarkerColorHex(wo: WorkOrder, isSelected: boolean): number {
  if (isSelected) return 0x38bdf8; // Sky-400 active focus
  if (wo.policy.decision === 'DENY') return 0xf43f5e; // Rose-500
  if (wo.policy.decision === 'REQUIRE APPROVAL') return 0xf59e0b; // Amber-500
  return 0x10b981; // Emerald-500
}

type ArcStyle = 'paid' | 'refunded' | 'unlinked';

/** Settlement outcome drives arc rendering: green paid, amber refunded, dashed unlinked. */
function getArcStyle(wo: WorkOrder): ArcStyle {
  if (wo.evidence.isImported && wo.evidence.onChainVerification.txs.length > 0) {
    return wo.settlement.status === 'Refunded' ? 'refunded' : 'paid';
  }
  return 'unlinked';
}

export const Earth3D: React.FC<Earth3DProps> = ({
  workOrders,
  selectedWorkOrder,
  onSelectWorkOrder,
  activeTimestampIso,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showArcs, setShowArcs] = useState<boolean>(true);
  const [showTerminator, setShowTerminator] = useState<boolean>(true);
  const [cameraViewMode, setCameraViewMode] = useState<'focus' | 'global'>('focus');
  const [contextLost, setContextLost] = useState<boolean>(false);
  const prefersReducedMotionRef = useRef<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const arcsGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const userOverrideRef = useRef<boolean>(false);

  const onSelectRef = useRef(onSelectWorkOrder);
  useEffect(() => {
    onSelectRef.current = onSelectWorkOrder;
  }, [onSelectWorkOrder]);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;

    // Software WebGL guard (SwiftShader / llvmpipe / WARP)
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060910);
    sceneRef.current = scene;

    // Subtle background starfield
    const starGeo = new THREE.BufferGeometry();
    const starCoords: number[] = [];
    for (let i = 0; i < 900; i++) {
      const x = (Math.random() - 0.5) * 3200;
      const y = (Math.random() - 0.5) * 3200;
      const z = (Math.random() - 0.5) * 3200;
      if (Math.hypot(x, y, z) > 400) {
        starCoords.push(x, y, z);
      }
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.4,
      transparent: true,
      opacity: 0.45,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 4000);
    const initCoords = selectedWorkOrder.orgContext.operationCoords;
    const initVec = latLonToVector3(initCoords.lat, initCoords.lon, 275);
    camera.position.set(...initVec);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;
    controls.enablePan = false;
    controls.minDistance = 145;
    controls.maxDistance = 480;
    controlsRef.current = controls;

    controls.addEventListener('start', () => {
      userOverrideRef.current = true;
      targetCamPosRef.current = null;
    });

    // Lighting rig
    const ambientLight = new THREE.AmbientLight(0xcbd5e1, 0.55);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.4);
    sunLight.position.set(400, 120, 300);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Procedural fallback Day & Night textures (never 404/black void)
    const createFallbackDayTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#172554');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      for (let y = 0; y <= 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }
      for (let x = 0; x <= 1024; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const createFallbackNightTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, 1024, 512);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const createFallbackWaterTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 128);
      return new THREE.CanvasTexture(canvas);
    };

    const fallbackDay = createFallbackDayTexture();
    const fallbackNight = createFallbackNightTexture();
    const fallbackWater = createFallbackWaterTexture();

    // Enterprise Earth Shader (retains high-res Blue Marble + Night lights + clean corporate tinting)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 72, 72);
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        u_day_texture: { value: fallbackDay },
        u_night_texture: { value: fallbackNight },
        u_water_texture: { value: fallbackWater },
        u_sun_pos: { value: new THREE.Vector3(1, 0.2, 0.4) },
        u_show_terminator: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vNormalWorld;
        varying vec3 vPositionWorld;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vNormalWorld = normalize(normalMatrix * normal);
          vPositionWorld = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_day_texture;
        uniform sampler2D u_night_texture;
        uniform sampler2D u_water_texture;
        uniform vec3 u_sun_pos;
        uniform float u_show_terminator;

        varying vec3 vNormalWorld;
        varying vec3 vPositionWorld;
        varying vec2 vUv;

        void main() {
          vec3 dayColor = texture2D(u_day_texture, vUv).rgb;
          vec3 nightColor = texture2D(u_night_texture, vUv).rgb;
          float isWater = texture2D(u_water_texture, vUv).r;

          // Subtle muted corporate cartography grading
          vec3 luma = vec3(dot(dayColor, vec3(0.299, 0.587, 0.114)));
          dayColor = mix(luma, dayColor, 0.65) * 0.72;
          if (isWater > 0.5) {
            dayColor = mix(dayColor, vec3(0.06, 0.12, 0.22), 0.45);
          } else {
            dayColor = mix(dayColor, vec3(0.18, 0.24, 0.32), 0.20);
          }

          nightColor = pow(nightColor, vec3(0.85)) * 1.15 + vec3(0.02, 0.03, 0.055);

          vec3 sunDir = normalize(u_sun_pos);
          float ndotl = dot(vPositionWorld, sunDir);
          float dayFactor = u_show_terminator > 0.5 ? smoothstep(-0.12, 0.12, ndotl) : 0.85;

          vec3 finalColor = mix(nightColor, dayColor, dayFactor);

          // Subtle ocean specular
          if (isWater > 0.5 && dayFactor > 0.1) {
            vec3 viewDir = normalize(cameraPosition - (vPositionWorld * 100.0));
            vec3 halfDir = normalize(sunDir + viewDir);
            float spec = pow(max(0.0, dot(vNormalWorld, halfDir)), 28.0);
            finalColor += vec3(0.55, 0.72, 0.90) * spec * dayFactor * 0.12;
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Load NASA Blue Marble & Night textures asynchronously
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    const loadedTextures: THREE.Texture[] = [fallbackDay, fallbackNight, fallbackWater];

    loader.load('https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      earthMat.uniforms.u_day_texture.value = tex;
      loadedTextures.push(tex);
    });
    loader.load('https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      earthMat.uniforms.u_night_texture.value = tex;
      loadedTextures.push(tex);
    });
    loader.load('https://unpkg.com/three-globe@2.31.1/example/img/earth-water.png', (tex) => {
      tex.anisotropy = maxAniso;
      earthMat.uniforms.u_water_texture.value = tex;
      loadedTextures.push(tex);
    });

    // Subtle atmospheric rim halo
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.015, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.58 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.22, 0.56, 0.85, 1.0) * max(0.0, intensity) * 0.55;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosphereMesh);

    // Subtle lat/lon graticule ring for operational frame reference
    const equatorPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      equatorPts.push(new THREE.Vector3(Math.cos(a) * (EARTH_RADIUS * 1.003), 0, Math.sin(a) * (EARTH_RADIUS * 1.003)));
    }
    const eqGeo = new THREE.BufferGeometry().setFromPoints(equatorPts);
    const eqMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35 });
    const equatorLine = new THREE.Line(eqGeo, eqMat);
    scene.add(equatorLine);

    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    const arcsGroup = new THREE.Group();
    scene.add(arcsGroup);
    arcsGroupRef.current = arcsGroup;

    // Hover cursor feedback (throttled)
    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;

      if (!markersGroupRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(markersGroupRef.current.children, true);
      renderer.domElement.style.cursor = hits.some((h) => h.object.userData?.workOrderId || h.object.parent?.userData?.workOrderId)
        ? 'pointer'
        : 'grab';
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // Animation loop with software-WebGL pacing & zero-GC slerp camera damping
    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 70);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (isDisposed) return;
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (targetCamPosRef.current && !userOverrideRef.current) {
        const curPos = camera.position;
        const targetPos = targetCamPosRef.current;

        if (prefersReducedMotionRef.current) {
          curPos.copy(targetPos);
          targetCamPosRef.current = null;
        } else {
          const curDist = curPos.length();
          const targetDist = targetPos.length();

          _curDir.copy(curPos).normalize();
          _targetDir.copy(targetPos).normalize();

          const dot = Math.max(-1, Math.min(1, _curDir.dot(_targetDir)));
          const angle = Math.acos(dot);

          if (angle < 0.005 && Math.abs(curDist - targetDist) < 0.5) {
            curPos.copy(targetPos);
            targetCamPosRef.current = null;
          } else {
            const factor = 1 - Math.exp(-4.5 * delta);
            _qCur.setFromUnitVectors(_zAxis, _curDir);
            _qTarget.setFromUnitVectors(_zAxis, _targetDir);
            _qCur.slerp(_qTarget, factor);
            _newDir.copy(_zAxis).applyQuaternion(_qCur).normalize();
            const newDist = THREE.MathUtils.damp(curDist, targetDist, 4.5, delta);
            curPos.copy(_newDir.multiplyScalar(newDist));
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 480;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      starGeo.dispose();
      starMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      eqGeo.dispose();
      eqMat.dispose();
      loadedTextures.forEach((t) => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update sun terminator, operation markers, processing region arcs, and camera target
  useEffect(() => {
    if (!earthMeshRef.current || !markersGroupRef.current || !arcsGroupRef.current) return;

    // 1. Update solar terminator
    const mat = earthMeshRef.current.material as THREE.ShaderMaterial;
    const subSolar = getSubSolarPointFromIso(activeTimestampIso);
    const sunVec = latLonToVector3(subSolar.lat, subSolar.lon, 1);
    mat.uniforms.u_sun_pos.value.set(...sunVec);
    mat.uniforms.u_show_terminator.value = showTerminator ? 1.0 : 0.0;
    if (sunLightRef.current) {
      sunLightRef.current.position.set(sunVec[0] * 400, sunVec[1] * 400, sunVec[2] * 400);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = showTerminator ? 0.55 : 0.95;
    }

    // 2. Rebuild Operation Location Markers (dispose previous geometries/materials cleanly)
    while (markersGroupRef.current.children.length > 0) {
      const group = markersGroupRef.current.children[0];
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) m.forEach((item) => item.dispose());
          else m.dispose();
        }
      });
      markersGroupRef.current.remove(group);
    }

    workOrders.forEach((wo) => {
      const isSelected = wo.id === selectedWorkOrder.id;
      const color = getMarkerColorHex(wo, isSelected);
      const pos = latLonToVector3(wo.orgContext.operationCoords.lat, wo.orgContext.operationCoords.lon, EARTH_RADIUS * 1.006);

      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(...pos);
      nodeGroup.lookAt(_origin);
      nodeGroup.userData = { workOrderId: wo.id };

      // Invisible larger hit target for reliable raycast clicking
      const hitGeo = new THREE.SphereGeometry(3.2, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { workOrderId: wo.id };
      nodeGroup.add(hitMesh);

      // Core beacon sphere
      const coreGeo = new THREE.SphereGeometry(isSelected ? 1.35 : 0.9, 14, 14);
      const coreMat = new THREE.MeshBasicMaterial({ color });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.userData = { workOrderId: wo.id };
      nodeGroup.add(coreMesh);

      // Outer crisp ring
      const ringGeo = new THREE.RingGeometry(isSelected ? 2.4 : 1.5, isSelected ? 2.9 : 1.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.55,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.userData = { workOrderId: wo.id };
      nodeGroup.add(ringMesh);

      // Secondary outer halo ring for selected operation
      if (isSelected) {
        const outerGeo = new THREE.RingGeometry(4.0, 4.35, 36);
        const outerMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        nodeGroup.add(new THREE.Mesh(outerGeo, outerMat));
      }

      markersGroupRef.current?.add(nodeGroup);
    });

    // 3. Rebuild Geodesic Routing Arcs (Operation Location -> Configured Processing Region)
    while (arcsGroupRef.current.children.length > 0) {
      const obj = arcsGroupRef.current.children[0] as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((item) => item.dispose());
        else m.dispose();
      }
      arcsGroupRef.current.remove(obj);
    }

    if (showArcs) {
      workOrders.forEach((wo) => {
        const { operationCoords, processingRegionCoords } = wo.orgContext;
        const isSelected = wo.id === selectedWorkOrder.id;
        const style = getArcStyle(wo);
        const arcColor = style === 'paid' ? 0x10b981 : style === 'refunded' ? 0xf59e0b : 0x94a3b8;

        let pts = generateGreatCircleArc(
          operationCoords,
          processingRegionCoords,
          EARTH_RADIUS * 1.005,
          16,
          44
        );
        let isPlume = false;
        if (pts.length <= 2) {
          // Coincident endpoints (operation == configured region): draw a vertical
          // settlement beacon instead of a degenerate arc.
          isPlume = true;
          const normal = new THREE.Vector3(
            ...latLonToVector3(operationCoords.lat, operationCoords.lon, 1)
          ).normalize();
          pts = [0, 0.34, 0.67, 1].map((t) =>
            normal.clone().multiplyScalar(EARTH_RADIUS * 1.005 + t * 20)
          );
        }

        if (style === 'unlinked') {
          const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineDashedMaterial({
            color: arcColor,
            dashSize: 2.4,
            gapSize: 1.8,
            transparent: true,
            opacity: isSelected ? 0.95 : 0.55,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          line.computeLineDistances();
          arcsGroupRef.current?.add(line);
        } else {
          const curve = new THREE.CatmullRomCurve3(pts);
          const tubeGeo = new THREE.TubeGeometry(curve, 36, isSelected ? 0.55 : 0.3, 6, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: arcColor,
            transparent: true,
            opacity: isSelected ? 0.9 : 0.55,
          });
          arcsGroupRef.current?.add(new THREE.Mesh(tubeGeo, tubeMat));
        }

        if (!isPlume) {
          // Configured Processing Region destination node
          const destPos = latLonToVector3(processingRegionCoords.lat, processingRegionCoords.lon, EARTH_RADIUS * 1.006);
          const destGeo = new THREE.BoxGeometry(isSelected ? 1.8 : 1.2, isSelected ? 1.8 : 1.2, isSelected ? 1.8 : 1.2);
          const destMat = new THREE.MeshBasicMaterial({
            color: arcColor,
            transparent: true,
            opacity: isSelected ? 0.95 : 0.6,
          });
          const destMesh = new THREE.Mesh(destGeo, destMat);
          destMesh.position.set(...destPos);
          destMesh.lookAt(_origin);
          arcsGroupRef.current?.add(destMesh);
        }
      });
    }
  }, [workOrders, selectedWorkOrder, activeTimestampIso, showArcs, showTerminator]);

  // Smoothly focus camera when selectedWorkOrder or cameraViewMode changes
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    userOverrideRef.current = false;

    if (cameraViewMode === 'global') {
      targetCamPosRef.current = new THREE.Vector3(0, 120, 310);
      controlsRef.current.target.set(0, 0, 0);
    } else {
      const coords = selectedWorkOrder.orgContext.operationCoords;
      const currentDist = Math.max(210, Math.min(310, cameraRef.current.position.length() || 265));
      const camVec = latLonToVector3(coords.lat, coords.lon, currentDist);
      targetCamPosRef.current = new THREE.Vector3(...camVec);
      controlsRef.current.target.set(0, 0, 0);
    }
  }, [selectedWorkOrder.id, cameraViewMode]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !markersGroupRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const hits = raycasterRef.current.intersectObjects(markersGroupRef.current.children, true);
    if (hits.length > 0) {
      let node: THREE.Object3D | null = hits[0].object;
      while (node && !node.userData?.workOrderId && node.parent) {
        node = node.parent;
      }
      if (node?.userData?.workOrderId) {
        setCameraViewMode('focus');
        onSelectRef.current(node.userData.workOrderId);
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[300px] bg-[#060910] overflow-hidden">
      {/* Dedicated WebGL Mount Container */}
      {!contextLost ? (
        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Global enterprise operations 3D globe"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#080C14]">
          <p className="text-sm font-medium text-slate-300">WebGL rendering context interrupted</p>
          <p className="text-xs text-slate-500 mt-1">
            Operation telemetry and governance panels remain active.
          </p>
        </div>
      )}

      {/* Subtle Top-Left Coordinate Overlay (no backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-3 left-3 px-3 py-2 rounded-md bg-[#0B0F17]/90 border border-slate-800 text-xs max-w-sm">
        <div className="font-medium text-slate-200">{selectedWorkOrder.orgContext.operationLocation}</div>
        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
          {selectedWorkOrder.orgContext.operationCoords.lat.toFixed(2)}°,{' '}
          {selectedWorkOrder.orgContext.operationCoords.lon.toFixed(2)}° · Configured region:{' '}
          {selectedWorkOrder.orgContext.configuredProcessingRegion}
        </div>
        <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-[3px] rounded-sm bg-emerald-400" aria-hidden="true" />
            Paid
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-[3px] rounded-sm bg-amber-400" aria-hidden="true" />
            Refunded
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-slate-400" aria-hidden="true" />
            No on-chain settlement
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          Illustrative business context · Selection opens details only
        </div>
      </div>

      {/* Compact Bottom-Center Globe Viewport Toolbar (solid surface, zero backdrop-blur) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 rounded-lg bg-[#0B0F17]/95 border border-slate-800 shadow-lg">
        <button
          type="button"
          onClick={() => {
            userOverrideRef.current = false;
            setCameraViewMode('focus');
            if (cameraRef.current) {
              const coords = selectedWorkOrder.orgContext.operationCoords;
              const camVec = latLonToVector3(coords.lat, coords.lon, 255);
              targetCamPosRef.current = new THREE.Vector3(...camVec);
            }
          }}
          className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            cameraViewMode === 'focus'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          Focus Operation
        </button>
        <button
          type="button"
          onClick={() => {
            userOverrideRef.current = false;
            setCameraViewMode('global');
            targetCamPosRef.current = new THREE.Vector3(0, 120, 310);
          }}
          className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            cameraViewMode === 'global'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          Global View
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setShowArcs((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            showArcs
              ? 'bg-slate-800 text-slate-100 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          Region Arcs: {showArcs ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          onClick={() => setShowTerminator((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            showTerminator
              ? 'bg-slate-800 text-slate-100 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          Day/Night: {showTerminator ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};
