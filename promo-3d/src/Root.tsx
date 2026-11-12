import React from 'react';
import {Composition, Still} from 'remotion';
import {MascotSheet} from './MascotSheet';
import {Film} from './Film';
import {FPS, TOTAL, WIDTH, HEIGHT} from './timeline';
import {ShapesFilm} from './shapes/ShapesFilm';
import {ShapesCover, COVER_SIZES} from './shapes/ShapesCover';
import {SAMPLE_END, TOTAL as SHAPES_TOTAL} from './shapes/timeline';

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: false, audio: true}} />
    <Composition id="FilmGuides" component={Film} durationInFrames={TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: true, audio: false}} />
    {/* 「各省像什么」：5 秒样片（黑龙江 → 广东），确认效果后再做全片 */}
    <Composition id="ShapesSample" component={ShapesFilm} durationInFrames={SAMPLE_END} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: false, audio: true}} />
    <Composition id="ShapesSampleGuides" component={ShapesFilm} durationInFrames={SAMPLE_END} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: true, audio: false}} />
    <Composition id="Shapes" component={ShapesFilm} durationInFrames={SHAPES_TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: false, audio: true}} />
    <Composition id="ShapesGuides" component={ShapesFilm} durationInFrames={SHAPES_TOTAL} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{guides: true, audio: false}} />
    <Still id="ShapesCover34" component={ShapesCover} width={COVER_SIZES['34'].w} height={COVER_SIZES['34'].h} defaultProps={{v: '34' as const}} />
    <Still id="ShapesCover43" component={ShapesCover} width={COVER_SIZES['43'].w} height={COVER_SIZES['43'].h} defaultProps={{v: '43' as const}} />
    <Still id="ShapesCover169" component={ShapesCover} width={COVER_SIZES['169'].w} height={COVER_SIZES['169'].h} defaultProps={{v: '169' as const}} />
    <Composition id="MascotSheet" component={MascotSheet} durationInFrames={1} fps={30} width={2560} height={1360} defaultProps={{tone: 'warm' as const}} />
  </>
);
