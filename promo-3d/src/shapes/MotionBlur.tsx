import {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useCurrentFrame} from 'remotion';
import {camPose, applyCam, inWhip} from './camera';

// 与 ../three/MotionBlur.tsx 同一做法（快甩帧 16 个子帧累加），只是机位来自本片的 camera.ts。
const SAMPLES = 16, SHUTTER = 0.5;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv) * w; }';

export const ShapesMotionBlur: React.FC = () => {
  const f = useCurrentFrame();
  const {gl, size} = useThree();
  const res = useMemo(() => {
    const v = new THREE.Vector2(); gl.getDrawingBufferSize(v);
    const fb = new THREE.FramebufferTexture(v.x, v.y);
    const accum = new THREE.WebGLRenderTarget(v.x, v.y, {type: THREE.HalfFloatType, depthBuffer: false});
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = (tex: THREE.Texture, add: boolean) => {
      const m = new THREE.ShaderMaterial({uniforms: {t: {value: tex}, w: {value: 1}}, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
        ...(add ? {blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor} : {blending: THREE.NoBlending})});
      const sc = new THREE.Scene(); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
      return {sc, m};
    };
    return {fb, accum, cam, add: quad(fb, true), blit: quad(accum.texture, false)};
  }, [gl, size.width, size.height]);
  useEffect(() => () => { res.fb.dispose(); res.accum.dispose(); }, [res]);

  useFrame(({scene, camera}) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!inWhip(f)) { applyCam(cam, camPose(f)); gl.render(scene, cam); return; }
    const autoClear = gl.autoClear;
    res.add.m.uniforms.w.value = 1 / SAMPLES;
    for (let k = 0; k < SAMPLES; k++) {
      applyCam(cam, camPose(f + (k / (SAMPLES - 1) - 0.5) * SHUTTER));
      gl.setRenderTarget(null); gl.autoClear = true; gl.render(scene, cam);
      gl.copyFramebufferToTexture(res.fb);
      gl.setRenderTarget(res.accum); gl.autoClear = false;
      if (k === 0) { gl.setClearColor(0x000000, 0); gl.clear(); }
      gl.render(res.add.sc, res.cam);
    }
    gl.setRenderTarget(null); gl.autoClear = true;
    gl.render(res.blit.sc, res.cam);
    gl.autoClear = autoClear;
    applyCam(cam, camPose(f));
  }, 1);
  return null;
};
