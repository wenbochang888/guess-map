// 世界坐标约定：手机平躺在桌面，屏幕中心在原点，屏幕顶部朝 -z，靠近镜头为 +z。
// 截图 CSS 像素 (x,y) ↔ 屏幕平面上的世界坐标。
export const CSS_W = 390, CSS_H = 844;
export const SW = 1.95, SH = SW * CSS_H / CSS_W;
export const SCREEN_Y = 0.123;           // 屏幕表面高度
export const PHONE = {w: SW + 0.16, d: SH + 0.3, h: 0.12};
export const MASCOT_SCALE = 0.44;
export const css = (x: number, y: number, h = SCREEN_Y): [number, number, number] =>
  [(x / CSS_W - 0.5) * SW, h, (y / CSS_H - 0.5) * SH];
export const onPhone = (x: number, z: number) => Math.abs(x) <= PHONE.w / 2 && Math.abs(z) <= PHONE.d / 2;
