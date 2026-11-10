// 成片验收：node promo-3d/scripts/verify-film.mjs promo-3d/output/v1/caiditu-3d-30s.mp4
// 检查规格、完整解码、响度/真峰，并每 3 秒导出一张抽帧（用 Remotion 自带的精简 ffmpeg，无需另装）。
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile, mkdir} from 'node:fs/promises';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const file = path.resolve(process.argv[2] ?? '');
const run = (tool, args) => {
  const r = spawnSync('npx', ['remotion', tool, ...args], {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20});
  return (r.stdout ?? '') + (r.stderr ?? '');
};
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).match(/\{[\s\S]*\}/)[0]);
const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
// 精简版 ffmpeg 没有 wrapped_avframe 编码器，完整解码用 rawvideo/pcm 输出到 null
const decode = run('ffmpeg', ['-v', 'error', '-i', file, '-c:v', 'rawvideo', '-c:a', 'pcm_s16le', '-f', 'null', '-']).trim();
const loud = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-c:a', 'pcm_s16le', '-f', 'null', '-']);
const lj = JSON.parse(loud.match(/\{[^{}]*"input_i"[^{}]*\}/)?.[0] ?? '{}');
const I = Number(lj.input_i), TP = Number(lj.input_tp);
const sheet = file.replace(/\.mp4$/, '-frames');
await mkdir(sheet, {recursive: true});
for (let t = 0; t < Number(probe.format.duration); t += 3) run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t + 0.5), '-i', file, '-frames:v', '1', '-vf', 'scale=360:-2', path.join(sheet, `t${String(t).padStart(2, '0')}.png`)]);
const report = {
  file: path.basename(file), width: v.width, height: v.height, fps: v.r_frame_rate, frames: Number(v.nb_frames), duration: Number(probe.format.duration),
  videoCodec: v.codec_name, pixFmt: v.pix_fmt, colorSpace: v.color_space, audioCodec: a?.codec_name, sampleRate: a?.sample_rate, channels: a?.channels,
  integratedLUFS: I, truePeakDbtp: TP, decodeErrors: decode || null, frames3s: path.basename(sheet),
};
const checks = {
  aspect9x16: report.width * 16 === report.height * 9, frames900: report.frames === 900, fps30: report.fps === '30/1',
  h264: report.videoCodec === 'h264', yuv420p: report.pixFmt === 'yuv420p', hasAudio: !!a, notSilent: Number.isFinite(I) && I > -40,
  loudnessOK: I >= -18 && I <= -12, truePeakOK: TP <= -1, decodesClean: !decode,
};
await writeFile(file.replace(/\.mp4$/, '-verify.json'), JSON.stringify({report, checks}, null, 2));
console.log(JSON.stringify({report, checks}, null, 2));
if (Object.values(checks).some((x) => !x)) process.exitCode = 1;
