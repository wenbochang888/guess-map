import React from 'react';
import {Composition} from 'remotion';
import {MascotSheet} from './MascotSheet';
import {Film} from './Film';
import {FPS, TOTAL, WIDTH, HEIGHT} from './timeline';

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: false, audio: true}} />
    <Composition id="FilmGuides" component={Film} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: true, audio: false}} />
    <Composition id="MascotSheet" component={MascotSheet} durationInFrames={1} fps={30} width={2560} height={1360} defaultProps={{tone: 'warm' as const}} />
  </>
);
