import React from 'react';
import {Environment, Lightformer} from '@react-three/drei';

// 暖色主光 + 冷色轮廓光 + 程序化环境反射（不依赖联网 HDR）。
export const StageLights: React.FC<{intensity?: number}> = ({intensity = 1}) => (
  <>
    <ambientLight intensity={0.25 * intensity} />
    <directionalLight position={[3, 5, 4]} intensity={2.2 * intensity} color="#ffe2c2" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-bias={-0.0004} />
    <directionalLight position={[-4, 2.5, -3]} intensity={1.4 * intensity} color="#9fc2b0" />
    <pointLight position={[0, 1.2, 3]} intensity={0.6 * intensity} color="#ffb48a" />
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={1.2} color="#ffd9b0" position={[2, 3, 3]} scale={[4, 2, 1]} />
      <Lightformer intensity={0.6} color="#bcd6c8" position={[-3, 1, -2]} scale={[3, 3, 1]} />
      <Lightformer intensity={0.4} color="#ffffff" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
    </Environment>
  </>
);
