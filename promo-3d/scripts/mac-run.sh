#!/usr/bin/env bash
# 猜地图 3D 宣传片 · Mac 一键脚本（Apple Silicon，GPU 渲染）
# 用法（在任意目录）：bash promo-3d/scripts/mac-run.sh <步骤> [版本号]
#   setup     安装 promo-3d 依赖（首次）
#   capture   用真实游戏采集 7 张界面截图（种子 61：山东答对 → 江西答错）
#   stills    渲染 10 张带安全区参考线的样式帧（半分辨率，几十秒）
#   preview   渲染 540×960 预览片（带声音）
#   final     渲染 1080×1920 正式片并自动验收
#   all       setup + capture + stills + preview
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
STEP="${1:-help}"; VER="${2:-v1}"
export GL="${GL:-angle}"

# 渲染用的 headless 浏览器：复用 Playwright 已装好的 chrome-headless-shell，绝不让 Remotion 去 Google 下载。
# 可用 REMOTION_BROWSER=/path/to/chrome-headless-shell 手动指定；PW_CACHE 可改 Playwright 缓存目录（默认 Mac 路径）。
find_browser() {
  if [ -n "${REMOTION_BROWSER:-}" ]; then
    [ -x "$REMOTION_BROWSER" ] || { echo "REMOTION_BROWSER 指向的文件不存在或不可执行：$REMOTION_BROWSER"; exit 1; }
  else
    local cache="${PW_CACHE:-$HOME/Library/Caches/ms-playwright}" best="" best_rev=-1 f rev
    for f in "$cache"/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell; do
      [ -x "$f" ] || continue
      rev="${f#"$cache"/chromium_headless_shell-}"; rev="${rev%%/*}"
      case "$rev" in *[!0-9]*|"") continue ;; esac
      if [ "$rev" -gt "$best_rev" ]; then best="$f"; best_rev="$rev"; fi
    done
    if [ -z "$best" ]; then
      echo "没找到本机的 headless 浏览器（在 $cache 下）。"
      echo "请先运行：npx playwright install chromium"
      echo "或手动指定：REMOTION_BROWSER=/path/to/chrome-headless-shell bash promo-3d/scripts/mac-run.sh <步骤>"
      exit 1
    fi
    export REMOTION_BROWSER="$best"
  fi
  echo "渲染浏览器：$REMOTION_BROWSER"
}

need_root_deps() {
  [ -d node_modules/vite ] && [ -d node_modules/@playwright/test ] || { echo "根工程依赖缺失：先在仓库根目录 npm ci"; exit 1; }
}
case "$STEP" in
  setup)
    npm ci --prefix promo-3d
    need_root_deps
    npx playwright install chromium ;;
  capture)
    need_root_deps
    node promo-3d/scripts/capture.mjs --seed=61 --expect=山东省,江西省 ;;
  stills)
    find_browser
    OUT="promo-3d/output/stills-$(date +%Y%m%d-%H%M%S)"
    node promo-3d/scripts/render-stills.mjs FilmGuides "$OUT" 30,90,150,200,300,450,560,700,752,880 --scale=0.5
    echo "样式帧 → $OUT" ;;
  preview)
    find_browser
    node promo-3d/scripts/render-film.mjs --preview --version="$VER" ;;
  final)
    find_browser
    node promo-3d/scripts/render-film.mjs --version="$VER"
    node promo-3d/scripts/verify-film.mjs "promo-3d/output/$VER/caiditu-3d-30s.mp4" ;;
  all)
    "$0" setup && "$0" capture && "$0" stills && "$0" preview "$VER" ;;
  *)
    sed -n '2,10p' "$0" ;;
esac
