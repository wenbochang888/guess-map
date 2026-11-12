import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import provinces from './provinces.json';
import {CANVAS_W, CANVAS_H, MARGIN, drawDoodle} from './doodle';

// 省份厚片：题库路径原样挤出（不改边界），顶面是纯色 + 纸纹，边缘一圈奶油色描边自发光；
// 顶面上方贴一层透明涂鸦画布。世界尺寸：1 视框单位 = 0.01，整片 4×3。
export const UNIT = 0.01, DEPTH = 24; // 厚度（视框单位）

export const regionPath = (name: string) => {
  const r = provinces.regions.find((x) => x.name.startsWith(name));
  if (!r) throw Error(`region not found: ${name}`);
  return r.path;
};

const geoCache = new Map<string, THREE.ExtrudeGeometry>();
function slabGeometry(name: string) {
  const hit = geoCache.get(name);
  if (hit) return hit;
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${regionPath(name)}"/></svg>`);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const uv = {
    // 顶面 UV 直接取视框坐标，对应 400×300 的纹理
    generateTopUV: (_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) =>
      [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / 400, 1 - v[i * 3 + 1] / 300)),
    generateSideWallUV: (_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number, d: number) =>
      [a, b, c, d].map((i) => new THREE.Vector2(v[i * 3] / 400, v[i * 3 + 2] / DEPTH)),
  };
  const geo = new THREE.ExtrudeGeometry(shapes, {depth: DEPTH, bevelEnabled: false, UVGenerator: uv as unknown as THREE.UVGenerator});
  // 视框 (x,y) → 世界 (x, 0, y)：顶面在 y=0，向下挤出；再平移让视框中心 (200,150) 落在原点
  geo.rotateX(Math.PI / 2);
  geo.translate(-200, 0, -150);
  geo.computeVertexNormals();
  geoCache.set(name, geo);
  return geo;
}

function topTextures(name: string, small: boolean) {
  const W = small ? 400 : 1200, H = small ? 300 : 900, s = W / 400;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };
  // 纸纹：白底上的细颗粒（乘以材质颜色）
  const grain = mk(), g = grain.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < (small ? 1000 : 9000); i++) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
  // 描边：只在轮廓内侧一圈（自发光贴图）
  const rim = mk(), r = rim.getContext('2d')!;
  r.fillStyle = '#000'; r.fillRect(0, 0, W, H);
  r.save(); r.scale(s, s);
  const p = new Path2D(regionPath(name));
  r.clip(p); r.strokeStyle = '#fff'; r.lineWidth = small ? 9 : 5; r.lineJoin = 'round'; r.stroke(p);
  r.restore();
  const tex = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return {grain: tex(grain), rim: tex(rim)};
}

export type SlabProps = {
  name: string; color?: string;
  reveal?: number;   // 0 剪影（深色）→ 1 本色
  doodle?: number;   // 涂鸦进度 0..1
  art?: string;      // 涂鸦名（默认同省名；甘肃的三个说法是 甘肃A/B/C）
  rim?: number;      // 轮廓描边自发光强度（默认 0.55）
  small?: boolean;   // 片尾墙小块：贴图降到 1/3 分辨率，31 块同屏也不吃内存
  position?: [number, number, number]; tilt?: number; spin?: number; roll?: number;
  scale?: number; squash?: number;
};

const SILHOUETTE = new THREE.Color('#2a2622');
const PAPER = '#efe1c3', SIDE = new THREE.Color('#7a5a3e');

export const Slab: React.FC<SlabProps> = ({name, color = PAPER, reveal = 1, doodle = 0, art, rim = 0.55, small = false, position = [0, 0, 0], tilt = 0, spin = 0, roll = 0, scale = 1, squash = 0}) => {
  const geo = useMemo(() => slabGeometry(name), [name]);
  const tx = useMemo(() => topTextures(name, small), [name, small]);
  const mats = useMemo(() => [
    new THREE.MeshStandardMaterial({map: tx.grain, emissive: new THREE.Color('#ffe6bf'), emissiveMap: tx.rim, emissiveIntensity: 0.55, roughness: 0.6, side: THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({roughness: 0.7, side: THREE.DoubleSide}),
  ], [tx]);
  const top = useMemo(() => new THREE.Color(), []);
  top.copy(SILHOUETTE).lerp(new THREE.Color(color), reveal);
  mats[0].color.copy(top);
  mats[1].color.copy(SILHOUETTE).lerp(SIDE, reveal);
  mats[0].emissiveIntensity = rim;

  const ds = small ? 1 / 3 : 1;
  const dcv = useMemo(() => { const cv = document.createElement('canvas'); cv.width = Math.round(CANVAS_W * ds); cv.height = Math.round(CANVAS_H * ds); return cv; }, [ds]);
  const dtex = useMemo(() => { const t = new THREE.CanvasTexture(dcv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }, [dcv]);
  const key = art ?? name;
  useMemo(() => { // 只在涂鸦内容或进度变了时重画、重新上传贴图
    const g = dcv.getContext('2d')!;
    g.setTransform(ds, 0, 0, ds, 0, 0);
    drawDoodle(g, key, doodle);
    dtex.needsUpdate = true;
  }, [dcv, dtex, ds, key, doodle]);
  useEffect(() => () => { mats.forEach((m) => m.dispose()); dtex.dispose(); }, [mats, dtex]);

  const k = UNIT * scale, sy = 1 - squash, sxz = 1 + squash * 0.5;
  return (
    // position 是厚片中心；绕中心 tilt 让顶面朝镜头立起来，spin 左右摆露出侧面厚度
    <group position={position} rotation={[tilt, spin, roll]} scale={[k * sxz, k * sy, k * sxz]}>
      <group position={[0, DEPTH / 2, 0]}>
        <mesh geometry={geo} material={mats} castShadow receiveShadow />
        {doodle > 0 && (
          // 涂鸦层离顶面的距离：小块（片尾墙）缩得很小，0.6 会和顶面几乎重合而互相闪烁，所以抬高
          <mesh position={[0, small ? 4 : 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[400 + 2 * MARGIN, 300 + 2 * MARGIN]} />
            <meshBasicMaterial map={dtex} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
};
