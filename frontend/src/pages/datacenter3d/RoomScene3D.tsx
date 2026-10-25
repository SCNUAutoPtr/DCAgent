// three.js part of the 3D room view, loaded on demand by Datacenter3DPage.
// Everything declared in JSX is disposed by react-three-fiber on unmount (and it drops the WebGL context);
// the few geometries built by hand here are disposed in their own effect cleanups.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Grid, Html, OrbitControls, QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useTranslation } from 'react-i18next';
import type { PanelFace } from '@contracts/enums';
import { useUText } from './useUText';
import type { RoomScene, SceneCabinet, SceneDevice, SceneWorkstation } from '@contracts/scene';
import { DEFAULT_WORKSTATION_DEPTH_M, DEFAULT_WORKSTATION_WIDTH_M } from '@contracts/scene';
import {
  BACKGROUND,
  CABINET_BASE_M,
  MEDIUM_COLORS,
  U_M,
  arcControl,
  cabinetYaw,
  deviceBox,
  deviceColor,
  occupancyColor,
  placeCabinets,
  portUsage,
  toWorld,
  uUsage,
  type CabinetPlacement,
  type ColorMode,
  type DeviceBox,
  type Vec3,
} from './layout';

export interface RoomScene3DProps {
  scene: RoomScene;
  colorMode: ColorMode;
  showCables: boolean;
  selectedCabinetId: string | null;
  selectedDeviceId: string | null;
  /** bumped by the page's "reset view" button */
  resetToken: number;
  onSelectCabinet: (id: string | null) => void;
  onSelectDevice: (deviceId: string, cabinetId: string) => void;
}

interface Racked {
  device: SceneDevice;
  cabinet: SceneCabinet;
  placement: CabinetPlacement;
  box: DeviceBox;
}

const v3 = (p: Vec3): [number, number, number] => [p.x, p.y, p.z];

export default function RoomScene3D(props: RoomScene3DProps) {
  const { scene, colorMode, showCables, selectedCabinetId, selectedDeviceId, onSelectCabinet } = props;
  const layout = useMemo(() => placeCabinets(scene.cabinets, scene.room, scene.workstations), [scene]);
  const racked = useMemo(() => {
    const m = new Map<string, Racked>();
    for (const cabinet of scene.cabinets) {
      const placement = layout.placements.get(cabinet.id)!;
      for (const device of cabinet.devices) {
        const box = deviceBox(placement, cabinet.heightU, device);
        if (box) m.set(device.id, { device, cabinet, placement, box });
      }
    }
    return m;
  }, [scene, layout]);

  // one unit cube shared by every device and workstation, scaled per mesh
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => unitBox.dispose(), [unitBox]);

  const span = Math.max(layout.roomW, layout.roomD);

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ fov: 45, near: 0.05, far: 600, position: [layout.roomW / 2, span, layout.roomD + span * 0.6] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={(e) => e.type === 'click' && onSelectCabinet(null)}
    >
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, span * 1.5, span * 5]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#9db4ff', '#0b1020', 0.7]} />
      <directionalLight position={[layout.roomW * 0.8, 12, layout.roomD * 1.2]} intensity={1.1} />
      <directionalLight position={[-4, 6, -4]} intensity={0.35} color="#7dd3fc" />

      <Floor w={layout.roomW} d={layout.roomD} />

      {scene.cabinets.map((c) => (
        <Cabinet
          key={c.id}
          cabinet={c}
          placement={layout.placements.get(c.id)!}
          unitBox={unitBox}
          colorMode={colorMode}
          selected={c.id === selectedCabinetId}
          selectedDeviceId={selectedDeviceId}
          onSelectCabinet={onSelectCabinet}
          onSelectDevice={props.onSelectDevice}
        />
      ))}

      <Workstations items={scene.workstations} unitBox={unitBox} />

      {showCables && <Cables scene={scene} racked={racked} selectedDeviceId={selectedDeviceId} />}

      <OrbitControls makeDefault enableDamping={false} maxPolarAngle={Math.PI / 2 - 0.05} minDistance={0.8} maxDistance={span * 4} />
      <CameraRig layout={layout} selectedCabinetId={selectedCabinetId} resetToken={props.resetToken} />
    </Canvas>
  );
}

// ---------- floor ----------

function Floor({ w, d }: { w: number; d: number }) {
  return (
    <group position={[w / 2, 0, d / 2]}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#111a2e" roughness={0.95} />
      </mesh>
      {/* 600 mm raised-floor tiles, a section line every 3 m */}
      <Grid
        args={[w, d]}
        cellSize={0.6}
        cellThickness={0.6}
        cellColor="#22314f"
        sectionSize={3}
        sectionThickness={1.1}
        sectionColor="#3b5b8f"
        fadeDistance={Math.max(w, d) * 4}
        fadeStrength={1}
      />
      <mesh position-y={0.01}>
        <boxGeometry args={[w, 0.02, d]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#4b6cb7" />
      </mesh>
    </group>
  );
}

// ---------- cabinets and devices ----------

interface CabinetProps {
  cabinet: SceneCabinet;
  placement: CabinetPlacement;
  unitBox: THREE.BoxGeometry;
  colorMode: ColorMode;
  selected: boolean;
  selectedDeviceId: string | null;
  onSelectCabinet: (id: string | null) => void;
  onSelectDevice: (deviceId: string, cabinetId: string) => void;
}

function Cabinet({ cabinet, placement: p, unitBox, colorMode, selected, selectedDeviceId, onSelectCabinet, onSelectDevice }: CabinetProps) {
  const [hovered, setHovered] = useState(false);
  const frameColor = selected ? '#7dd3fc' : colorMode === 'occupancy' ? occupancyColor(uUsage(cabinet).ratio) : hovered ? '#94a3b8' : '#4a5d82';

  // U scale on the front-left post: a tick per U, a longer one every 5 U
  const ticks = useMemo(() => {
    const pts: number[] = [];
    const x0 = -p.w / 2 + 0.004;
    const z = -p.d / 2 - 0.002;
    for (let u = 0; u <= cabinet.heightU; u++) {
      const y = CABINET_BASE_M + u * U_M;
      pts.push(x0, y, z, x0 + (u % 5 === 0 ? 0.045 : 0.02), y, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [cabinet.heightU, p.w, p.d]);
  useEffect(() => () => ticks.dispose(), [ticks]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectCabinet(cabinet.id);
  };

  return (
    <group position={[p.cx, 0, p.cz]} rotation-y={cabinetYaw(p.rotation)}>
      {/* glass body */}
      <mesh
        position-y={p.heightM / 2}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[p.w, p.heightM, p.d]} />
        <meshStandardMaterial color="#9fb4d9" transparent opacity={selected ? 0.14 : 0.07} depthWrite={false} />
        <Edges color={frameColor} />
      </mesh>
      {/* plinth and roof */}
      <mesh geometry={unitBox} position-y={CABINET_BASE_M / 2} scale={[p.w, CABINET_BASE_M, p.d]}>
        <meshStandardMaterial color="#1c2436" />
      </mesh>
      <mesh geometry={unitBox} position-y={p.heightM - 0.02} scale={[p.w, 0.04, p.d]}>
        <meshStandardMaterial color="#1c2436" />
      </mesh>
      <lineSegments geometry={ticks}>
        <lineBasicMaterial color={selected ? '#7dd3fc' : '#5b6b8c'} />
      </lineSegments>

      {cabinet.devices.map((d) => {
        const box = deviceBox(p, cabinet.heightU, d);
        return box ? (
          <Device
            key={d.id}
            device={d}
            box={box}
            unitBox={unitBox}
            color={deviceColor(d, colorMode)}
            selected={d.id === selectedDeviceId}
            onSelect={() => onSelectDevice(d.id, cabinet.id)}
          />
        ) : null;
      })}

      <Html position={[0, p.heightM + 0.12, -p.d / 2]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`dc3d-cabinet-label${selected ? ' is-selected' : ''}`}>
          {cabinet.name}
          {cabinet.label && (selected || hovered) && <span className="dc3d-short-id">{cabinet.label.shortId}</span>}
        </div>
      </Html>
    </group>
  );
}

interface DeviceProps {
  device: SceneDevice;
  box: DeviceBox;
  unitBox: THREE.BoxGeometry;
  color: string;
  selected: boolean;
  onSelect: () => void;
}

function Device({ device, box, unitBox, color, selected, onSelect }: DeviceProps) {
  const [hovered, setHovered] = useState(false);
  const glow = selected ? 0.9 : hovered ? 0.55 : 0.12;
  // the cleanup also runs on unmount, so a device that disappears while hovered does not leave the pointer cursor behind
  useEffect(() => {
    if (!hovered) return undefined;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);
  return (
    <group position={[0, box.y0 + box.h / 2, box.zCenter]}>
      <mesh
        geometry={unitBox}
        scale={[box.w, box.h, box.depth]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} metalness={0.35} roughness={0.45} />
      </mesh>
      {/* bright front bezel line so stacked 1U devices stay readable */}
      <mesh geometry={unitBox} position-z={-box.depth / 2 - 0.001} scale={[box.w, Math.max(box.h * 0.18, 0.004), 0.002]}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {hovered && <DeviceTooltip device={device} at={[0, box.h / 2 + 0.02, -box.depth / 2]} />}
    </group>
  );
}

function DeviceTooltip({ device, at }: { device: SceneDevice; at: [number, number, number] }) {
  const uText = useUText();
  const { t } = useTranslation(['datacenter3d', 'device']);
  const usage = portUsage(device);
  return (
    <Html position={at} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none', transform: 'translateY(-110%)' }}>
      <div className="dc3d-tooltip">
        <div className="dc3d-tooltip-title">{device.name}</div>
        <div>
          {t(`device:deviceTypes.${device.type}`)}
          {device.deviceModel ? ` / ${device.deviceModel.name}` : ''}
        </div>
        <div>
          {device.uPosition == null ? t('datacenter3d:drawer.unplaced') : uText(device.uPosition, device.uHeight)}
        </div>
        <div>{usage.total ? t('datacenter3d:tooltip.ports', { connected: usage.connected, total: usage.total }) : t('datacenter3d:tooltip.noPorts')}</div>
      </div>
    </Html>
  );
}

// ---------- workstations ----------

const WORKSTATION_COLORS = { online: '#22c55e', offline: '#475569', maintenance: '#f59e0b', faulty: '#ef4444', retired: '#1e293b' };
const DESK_H = 0.75;

function workstationColor(w: SceneWorkstation) {
  if (w.adminState === 'MAINTENANCE') return WORKSTATION_COLORS.maintenance;
  if (w.adminState === 'FAULTY') return WORKSTATION_COLORS.faulty;
  if (w.adminState === 'RETIRED') return WORKSTATION_COLORS.retired;
  return w.online ? WORKSTATION_COLORS.online : WORKSTATION_COLORS.offline;
}

/** Workstations with a floor plan position, as one instanced mesh (a classroom can hold hundreds). */
function Workstations({ items, unitBox }: { items: SceneWorkstation[]; unitBox: THREE.BoxGeometry }) {
  const placed = useMemo(() => items.filter((w) => w.fpX != null && w.fpY != null), [items]);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    placed.forEach((w, i) => {
      const fw = w.fpW ?? DEFAULT_WORKSTATION_WIDTH_M;
      const fd = w.fpD ?? DEFAULT_WORKSTATION_DEPTH_M;
      m.compose(
        new THREE.Vector3(w.fpX! + fw / 2, DESK_H / 2, w.fpY! + fd / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(fw * 0.92, DESK_H, fd * 0.92),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(workstationColor(w)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placed]);
  if (!placed.length) return null;
  return (
    <instancedMesh key={placed.length} ref={ref} args={[unitBox, undefined, placed.length]}>
      <meshStandardMaterial transparent opacity={0.85} roughness={0.8} />
    </instancedMesh>
  );
}

// ---------- cables ----------

interface CablesProps {
  scene: RoomScene;
  racked: Map<string, Racked>;
  selectedDeviceId: string | null;
}

/** One arc per cable between the faces its ends are plugged into; the selected device's cables stand out. */
function Cables({ scene, racked, selectedDeviceId }: CablesProps) {
  const arcs = useMemo(() => {
    // spread the ends leaving one device face so parallel cables do not collapse into one line
    const slot = new Map<string, number>();
    const anchor = (deviceId: string, face: PanelFace): Vec3 | null => {
      const r = racked.get(deviceId);
      if (!r) return null;
      const key = `${deviceId}:${face}`;
      const i = slot.get(key) ?? 0;
      slot.set(key, i + 1);
      const x = (((i % 7) - 3) / 7) * r.box.w;
      const z = face === 'FRONT' ? -r.placement.d / 2 - 0.01 : r.placement.d / 2 + 0.01;
      return toWorld(r.placement, x, r.box.y0 + r.box.h / 2, z);
    };
    return scene.links.flatMap((l) => {
      const a = anchor(l.aDeviceId, l.aFace);
      const b = anchor(l.bDeviceId, l.bFace);
      if (!a || !b) return [];
      return [{ id: l.cableId, a, b, mid: arcControl(a, b), color: MEDIUM_COLORS[l.medium], devices: [l.aDeviceId, l.bDeviceId] }];
    });
  }, [scene.links, racked]);

  return (
    <group>
      {arcs.map((arc) => {
        const hit = selectedDeviceId !== null && arc.devices.includes(selectedDeviceId);
        const dim = selectedDeviceId !== null && !hit;
        return (
          <QuadraticBezierLine
            key={arc.id}
            start={v3(arc.a)}
            end={v3(arc.b)}
            mid={v3(arc.mid)}
            color={arc.color}
            lineWidth={hit ? 3.5 : 1.6}
            transparent
            opacity={dim ? 0.15 : hit ? 1 : 0.75}
            toneMapped={false}
          />
        );
      })}
    </group>
  );
}

// ---------- camera ----------

interface CameraGoal {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function overviewGoal(roomW: number, roomD: number): CameraGoal {
  const span = Math.max(roomW, roomD);
  return {
    position: new THREE.Vector3(roomW / 2, span * 0.85, roomD + span * 0.55),
    target: new THREE.Vector3(roomW / 2, 0, roomD / 2),
  };
}

function cabinetGoal(p: CabinetPlacement): CameraGoal {
  // viewed from the front, local -x is screen right: aim right of the cabinet so the drawer does not cover it
  const shift = -0.9;
  const eye = toWorld(p, shift + 0.8, p.heightM * 0.7, -p.d / 2 - p.heightM * 1.7);
  const target = toWorld(p, shift, p.heightM * 0.5, 0);
  return { position: new THREE.Vector3(eye.x, eye.y, eye.z), target: new THREE.Vector3(target.x, target.y, target.z) };
}

/** Flies the camera to the selected cabinet or back to the room overview; any drag cancels the flight. */
function CameraRig({
  layout,
  selectedCabinetId,
  resetToken,
}: {
  layout: ReturnType<typeof placeCabinets>;
  selectedCabinetId: string | null;
  resetToken: number;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<CameraGoal | null>(null);

  useEffect(() => {
    const p = selectedCabinetId ? layout.placements.get(selectedCabinetId) : undefined;
    goal.current = p ? cabinetGoal(p) : overviewGoal(layout.roomW, layout.roomD);
    invalidate();
  }, [layout, selectedCabinetId, resetToken, controls, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      goal.current = null;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    camera.position.lerp(g.position, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.01 && controls.target.distanceTo(g.target) < 0.01) goal.current = null;
    else invalidate();
  });
  return null;
}
