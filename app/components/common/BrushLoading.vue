<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  label?: string
  sublabel?: string
  size?: 'sm' | 'md' | 'lg'
  hideText?: boolean
}>(), {
  label: '颜料正在晕开，请稍候…',
  sublabel: '画笔正沿着亚麻纹理层层铺陈色彩与光影',
  size: 'md',
  hideText: false,
})

const uid = useId()
const strokeGradId = `paint-3d-stroke-${uid}`
const ribbonGradId = `paint-3d-ribbon-${uid}`
const sheenGradId = `paint-3d-sheen-${uid}`
const bristleGradId = `paint-3d-bristle-${uid}`
const tipGradId = `paint-3d-tip-${uid}`
</script>

<template>
  <div
    class="container_common_brush_center_wrap"
    :class="{ 'is-compact': hideText }"
    :data-size="size"
    role="status"
  >
    <div class="container_common_brush_center_stage" aria-hidden="true">
      <div class="container_common_brush_center_aura" />

      <div class="container_common_brush_center_world">
        <!-- 3D 亚麻画布板与立体木框厚度 -->
        <div class="container_common_brush_center_board">
          <div class="container_common_brush_center_floor" />
          <div class="container_common_brush_bottom_edge" />
          <div class="container_common_brush_right_edge" />

          <div class="container_common_brush_center_surface">
            <div class="container_common_brush_center_frame" />
            <div class="container_common_brush_center_puddle" />
          </div>

          <!-- 3D 厚涂颜料底层浮雕阴影 (Z = 2px) -->
          <svg class="container_common_brush_center_relief" viewBox="0 0 240 156" fill="none">
            <path
              class="container_common_brush_center_stroke"
              d="M36 102C78 46 132 44 202 64"
              stroke="rgba(59, 42, 32, 0.28)"
              stroke-width="24"
              stroke-linecap="round"
            />
            <path
              class="container_common_brush_center_ribbon"
              d="M198 76C150 118 96 116 42 94"
              stroke="rgba(59, 42, 32, 0.22)"
              stroke-width="16"
              stroke-linecap="round"
            />
          </svg>

          <!-- 3D 厚涂颜料主体层 (Z = 5px) -->
          <svg class="container_common_brush_center_paint" viewBox="0 0 240 156" fill="none">
            <defs>
              <linearGradient :id="strokeGradId" x1="32" y1="98" x2="206" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#F2B629" />
                <stop offset="0.38" stop-color="#D9482B" />
                <stop offset="0.72" stop-color="#C8557A" />
                <stop offset="1" stop-color="#2E4A9E" />
              </linearGradient>
              <linearGradient :id="ribbonGradId" x1="200" y1="76" x2="40" y2="96" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#2E4A9E" />
                <stop offset="0.45" stop-color="#2F8F6B" />
                <stop offset="1" stop-color="#F2B629" />
              </linearGradient>
            </defs>
            <path
              class="container_common_brush_center_stroke"
              d="M36 102C78 46 132 44 202 64"
              :stroke="`url(#${strokeGradId})`"
              stroke-width="22"
              stroke-linecap="round"
            />
            <path
              class="container_common_brush_center_ribbon"
              d="M198 76C150 118 96 116 42 94"
              :stroke="`url(#${ribbonGradId})`"
              stroke-width="14"
              stroke-linecap="round"
            />
            <circle class="container_common_brush_center_splatter" cx="52" cy="52" r="5.5" fill="#F2B629" />
            <circle class="container_common_brush_center_splatter" cx="188" cy="112" r="4.5" fill="#D9482B" />
            <circle class="container_common_brush_center_splatter" cx="152" cy="36" r="3.5" fill="#2E4A9E" />
          </svg>

          <!-- 3D 湿润油彩高光脊线 (Z = 8px) -->
          <svg class="container_common_brush_center_sheen" viewBox="0 0 240 156" fill="none">
            <defs>
              <linearGradient :id="sheenGradId" x1="36" y1="96" x2="202" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#FFF9EB" stop-opacity="0.75" />
                <stop offset="0.5" stop-color="#FFE39E" stop-opacity="0.45" />
                <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.7" />
              </linearGradient>
            </defs>
            <path
              class="container_common_brush_center_accent"
              d="M40 98C80 48 132 46 198 64"
              :stroke="`url(#${sheenGradId})`"
              stroke-width="4.5"
              stroke-linecap="round"
            />
          </svg>

          <!-- 3D 画笔在画布上的实时投射阴影 (Z = 3px) -->
          <div class="container_common_brush_center_shadow" />
        </div>

        <!-- 3D 悬浮颜料微粒 (Z = 18px ~ 58px) -->
        <div class="container_common_brush_center_orbit">
          <span class="container_common_brush_item_drop" />
          <span class="container_common_brush_item_drop" />
          <span class="container_common_brush_item_drop" />
          <span class="container_common_brush_item_drop" />
          <span class="container_common_brush_item_drop" />
        </div>

        <!-- 3D 立体画笔主体 (多平面正交体积构造) -->
        <div class="container_common_brush_center_pivot">
          <div class="container_common_brush_center_rig">
            <!-- 3D 实木烤漆笔杆 -->
            <div class="container_common_brush_top_handle">
              <div class="container_common_brush_top_vane" />
              <div class="container_common_brush_top_vane" />
              <div class="container_common_brush_top_vane" />
              <div class="container_common_brush_top_gloss" />
              <div class="container_common_brush_top_cap" />
            </div>

            <!-- 3D 黄铜金属笔箍 -->
            <div class="container_common_brush_center_ferrule">
              <div class="container_common_brush_center_band" />
              <div class="container_common_brush_center_band" />
              <div class="container_common_brush_center_band" />
              <div class="container_common_brush_center_ring" />
            </div>

            <!-- 3D 柔性笔毫与饱蘸颜料笔锋 -->
            <div class="container_common_brush_bottom_bristles">
              <svg class="container_common_brush_bottom_layer" viewBox="0 0 36 48" fill="none">
                <defs>
                  <linearGradient :id="bristleGradId" x1="18" y1="0" x2="18" y2="46" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#5C4028" />
                    <stop offset="0.38" stop-color="#8C6239" />
                    <stop offset="0.68" stop-color="#F2B629" />
                    <stop offset="0.86" stop-color="#D9482B" />
                    <stop offset="1" stop-color="#2E4A9E" />
                  </linearGradient>
                  <linearGradient :id="tipGradId" x1="10" y1="22" x2="26" y2="46" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#F2B629" />
                    <stop offset="0.52" stop-color="#D9482B" />
                    <stop offset="1" stop-color="#2E4A9E" />
                  </linearGradient>
                </defs>
                <!-- 笔毫主体锥面 -->
                <path
                  d="M7 2H29C31 14 30 27 21 44C19 47 16 47 14 44C6 29 5 15 7 2Z"
                  :fill="`url(#${bristleGradId})`"
                />
                <!-- 笔毫纹理丝线 -->
                <path
                  d="M11 3C10 15 11 26 15 41M15 3C15 16 16 28 17 43M21 3C21 16 20 28 19 43M25 3C26 15 24 27 21 41"
                  stroke="rgba(255, 246, 224, 0.28)"
                  stroke-width="1.1"
                  stroke-linecap="round"
                />
                <!-- 笔尖浓厚油彩包裹层 -->
                <path
                  class="container_common_brush_bottom_tip"
                  d="M8.5 23C13 26 23 25 27.5 22C26.5 31 23.5 39 20.5 44.5C18.8 47 16.2 47 14.5 44.5C11 38.5 9 30.5 8.5 23Z"
                  :fill="`url(#${tipGradId})`"
                />
              </svg>

              <!-- 正交 3D 体积层 -->
              <div class="container_common_brush_bottom_core" />
              <!-- 笔尖 3D 欲滴颜料珠 -->
              <div class="container_common_brush_bottom_bead" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!hideText" class="container_common_brush_bottom_copy">
      <p class="container_common_brush_bottom_text">{{ label }}</p>
      <p v-if="sublabel" class="container_common_brush_bottom_sub">{{ sublabel }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.container_common_brush_center_wrap {
  --brush-scale: 1;
  display: grid;
  min-height: 320px;
  place-items: center;
  align-content: center;
  gap: 14px;
  padding: 20px 12px;
  color: var(--color-ink-soft);
  text-align: center;

  &[data-size='sm'] {
    --brush-scale: 0.68;
    min-height: 156px;
    gap: 8px;
    padding: 6px;
  }

  &[data-size='lg'] {
    --brush-scale: 1.16;
    min-height: 270px;
    gap: 18px;
  }

  &.is-compact {
    min-height: auto;
    padding: 4px;
  }
}

.container_common_brush_center_stage {
  position: relative;
  display: grid;
  width: calc(300px * var(--brush-scale));
  height: calc(206px * var(--brush-scale));
  place-items: center;
  perspective: 920px;
  user-select: none;
}

.container_common_brush_center_aura {
  position: absolute;
  inset: 8% 10%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 35%, rgba($cadmium-yellow, 0.34), transparent 55%),
    radial-gradient(circle at 72% 62%, rgba($vermilion, 0.25), transparent 52%),
    radial-gradient(circle at 52% 78%, rgba($ultramarine, 0.24), transparent 58%);
  filter: blur(22px);
  animation: aura-pulse 4s ease-in-out infinite;
}

.container_common_brush_center_world {
  position: relative;
  width: 240px;
  height: 156px;
  transform-style: preserve-3d;
  transform: scale(var(--brush-scale)) rotateX(54deg) rotateZ(-15deg);
  animation: brush-world-orbit 6s ease-in-out infinite;
}

.container_common_brush_center_board {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

.container_common_brush_center_floor {
  position: absolute;
  inset: -8px;
  border-radius: 20px;
  background: radial-gradient(
    ellipse at 52% 54%,
    rgba(32, 20, 12, 0.44) 0%,
    rgba(32, 20, 12, 0.18) 56%,
    transparent 78%
  );
  filter: blur(11px);
  transform: translateZ(-26px) translate3d(10px, 16px, 0);
}

.container_common_brush_bottom_edge {
  position: absolute;
  right: 6px;
  bottom: 0;
  left: 6px;
  height: 13px;
  border-radius: 0 0 6px 6px;
  background: linear-gradient(180deg, #dfb974 0%, #b8893b 48%, #6d4d1d 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
  transform-origin: center bottom;
  transform: rotateX(-90deg);
}

.container_common_brush_right_edge {
  position: absolute;
  top: 6px;
  right: 0;
  bottom: 6px;
  width: 13px;
  border-radius: 0 6px 6px 0;
  background: linear-gradient(90deg, #c99b49 0%, #8c6326 52%, #4d3411 100%);
  transform-origin: right center;
  transform: rotateY(90deg);
}

.container_common_brush_center_surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 1.5px solid rgba($frame-gold, 0.72);
  border-radius: 14px;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(110, 90, 74, 0.045) 0 1px,
      transparent 1px 5px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(110, 90, 74, 0.045) 0 1px,
      transparent 1px 5px
    ),
    radial-gradient(circle at 24% 22%, rgba(255, 252, 244, 0.9), transparent 60%),
    linear-gradient(145deg, var(--color-paper) 0%, var(--color-canvas) 100%);
  box-shadow:
    inset 0 2px 6px rgba(255, 255, 255, 0.55),
    inset 0 -4px 12px rgba(59, 42, 32, 0.12);
  transform: translateZ(0);
}

.container_common_brush_center_frame {
  position: absolute;
  inset: 7px;
  border: 1px dashed rgba($frame-gold, 0.42);
  border-radius: 9px;
  pointer-events: none;
}

.container_common_brush_center_puddle {
  position: absolute;
  inset: 14px 20px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 60%, rgba($cadmium-yellow, 0.25), transparent 48%),
    radial-gradient(circle at 55% 42%, rgba($vermilion, 0.2), transparent 50%),
    radial-gradient(circle at 78% 52%, rgba($ultramarine, 0.22), transparent 48%);
  filter: blur(8px);
  animation: puddle-bloom 3.6s ease-in-out infinite;
}

.container_common_brush_center_relief,
.container_common_brush_center_paint,
.container_common_brush_center_sheen {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.container_common_brush_center_relief {
  filter: blur(1.5px);
  transform: translateZ(2px);
}

.container_common_brush_center_paint {
  filter: drop-shadow(0 2px 3px rgba(59, 42, 32, 0.22));
  transform: translateZ(5px);
}

.container_common_brush_center_sheen {
  transform: translateZ(8px);
}

.container_common_brush_center_stroke,
.container_common_brush_center_accent {
  stroke-dasharray: 210;
  stroke-dashoffset: 210;
  animation: stroke-draw-main 3.6s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}

.container_common_brush_center_ribbon {
  stroke-dasharray: 190;
  stroke-dashoffset: 190;
  animation: stroke-draw-return 3.6s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}

.container_common_brush_center_splatter {
  transform-box: fill-box;
  transform-origin: center;
  animation: splatter-pop 3.6s ease-in-out infinite;

  &:nth-of-type(2) {
    animation-delay: 1.1s;
  }

  &:nth-of-type(3) {
    animation-delay: 2.1s;
  }
}

.container_common_brush_center_shadow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 56px;
  height: 22px;
  margin-top: -11px;
  margin-left: -28px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(35, 22, 14, 0.52) 0%, rgba(35, 22, 14, 0.18) 58%, transparent 80%);
  filter: blur(4px);
  transform: translateZ(3px);
  animation: brush-shadow-sweep 3.6s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}

.container_common_brush_center_orbit {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}

.container_common_brush_item_drop {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 30%, #fffdf7 0%, $cadmium-yellow 38%, $vermilion 100%);
  box-shadow: 0 3px 8px rgba(217, 72, 43, 0.35);
  animation: drop-float-3d 3.6s ease-in-out infinite;

  &:nth-child(1) {
    top: 28%;
    left: 22%;
     --drop-z: 28px;
    animation-delay: 0s;
  }

  &:nth-child(2) {
    top: 22%;
    left: 62%;
    width: 8px;
    height: 8px;
    background: radial-gradient(circle at 32% 30%, #fffdf7 0%, #6d8cf2 35%, $ultramarine 100%);
    box-shadow: 0 3px 8px rgba(46, 74, 158, 0.35);
    --drop-z: 44px;
    animation-delay: 0.7s;
  }

  &:nth-child(3) {
    top: 66%;
    left: 74%;
    width: 9px;
    height: 9px;
    background: radial-gradient(circle at 32% 30%, #fffdf7 0%, #f59bb6 35%, $rose-madder 100%);
    --drop-z: 34px;
    animation-delay: 1.4s;
  }

  &:nth-child(4) {
    top: 72%;
    left: 34%;
    width: 7px;
    height: 7px;
    background: radial-gradient(circle at 32% 30%, #fffdf7 0%, #6ad1ad 35%, $viridian 100%);
    --drop-z: 50px;
    animation-delay: 2.1s;
  }

  &:nth-child(5) {
    top: 44%;
    left: 48%;
    width: 6px;
    height: 6px;
    --drop-z: 58px;
    animation-delay: 2.7s;
  }
}

.container_common_brush_center_pivot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  animation: brush-3d-sweep 3.6s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}

.container_common_brush_center_rig {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  transform: rotateX(-64deg) rotateY(18deg) rotateZ(14deg);
}

/* 3D 实木笔杆：从笔箍上方 (-60px) 向上延伸至笔尾 (-166px) */
.container_common_brush_top_handle {
  position: absolute;
  bottom: 58px;
  left: -9px;
  width: 18px;
  height: 108px;
  transform-style: preserve-3d;
}

.container_common_brush_top_vane {
  position: absolute;
  inset: 0;
  border-radius: 9px 9px 5px 5px / 28px 28px 18px 18px;
  background:
    linear-gradient(
      180deg,
      $cadmium-yellow 0%,
      $vermilion 14%,
      #b8893b 16%,
      #593722 22%,
      #7c4d30 52%,
      #3b2314 88%,
      #2a180d 100%
    );
  box-shadow: inset 2px 0 4px rgba(255, 236, 204, 0.28), inset -3px 0 5px rgba(18, 9, 4, 0.55);
  clip-path: polygon(26% 0%, 74% 0%, 96% 28%, 100% 56%, 76% 100%, 24% 100%, 0% 56%, 4% 28%);

  &:nth-child(2) {
    transform: rotateY(60deg);
    filter: brightness(0.92);
  }

  &:nth-child(3) {
    transform: rotateY(-60deg);
    filter: brightness(1.08);
  }
}

.container_common_brush_top_gloss {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 7px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.65) 0%,
    rgba(255, 230, 186, 0.35) 55%,
    transparent 100%
  );
  transform: translateZ(5px);
}

.container_common_brush_top_cap {
  position: absolute;
  top: -4px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff6d6 0%, $cadmium-yellow 48%, $vermilion 100%);
  box-shadow: 0 0 10px rgba($cadmium-yellow, 0.55);
  transform: translateZ(2px);
}

/* 3D 黄铜金属笔箍：位于笔杆与笔毫之间 */
.container_common_brush_center_ferrule {
  position: absolute;
  bottom: 35px;
  left: -9px;
  width: 18px;
  height: 25px;
  transform-style: preserve-3d;
}

.container_common_brush_center_band {
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    #634518 0%,
    #f3d58d 28%,
    #b8893b 52%,
    #fff4d2 74%,
    #523812 100%
  );
  box-shadow:
    inset 0 2px 1px rgba(255, 255, 255, 0.5),
    inset 0 -2px 2px rgba(59, 42, 32, 0.45);

  &:nth-child(2) {
    transform: rotateY(60deg);
  }

  &:nth-child(3) {
    transform: rotateY(-60deg);
  }
}

.container_common_brush_center_ring {
  position: absolute;
  right: -1px;
  left: -1px;
  top: 6px;
  height: 12px;
  border-top: 1.5px solid rgba(255, 248, 220, 0.75);
  border-bottom: 1.5px solid rgba(90, 60, 20, 0.65);
  transform: translateZ(4px);
}

/* 3D 柔性笔毫：以笔箍底端为旋转轴动态弯曲 */
.container_common_brush_bottom_bristles {
  position: absolute;
  bottom: 0;
  left: -18px;
  width: 36px;
  height: 42px;
  transform-style: preserve-3d;
  transform-origin: center top;
  animation: bristle-3d-flex 3.6s cubic-bezier(0.42, 0, 0.58, 1) infinite;
}

.container_common_brush_bottom_layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 2px 4px rgba(46, 74, 158, 0.28));
  transform: translateZ(2px);
}

.container_common_brush_bottom_core {
  position: absolute;
  top: 2px;
  left: 9px;
  width: 18px;
  height: 39px;
  border-radius: 4px 4px 50% 50%;
  background: linear-gradient(
    180deg,
    #4d341e 0%,
    #7b5330 36%,
    $cadmium-yellow 66%,
    $vermilion 85%,
    $ultramarine 100%
  );
  transform: rotateY(75deg);
}

.container_common_brush_bottom_bead {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 9px;
  height: 9px;
  margin-left: -4.5px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff 0%, $cadmium-yellow 36%, $vermilion 72%, $ultramarine 100%);
  box-shadow: 0 0 10px rgba($cadmium-yellow, 0.7);
  transform: translateZ(5px);
}

.container_common_brush_bottom_copy {
  display: grid;
  gap: 4px;
}

.container_common_brush_bottom_text {
  margin: 0;
  color: var(--color-ink);
  font-family: $font-display;
  font-size: 19px;
  letter-spacing: 0.04em;
}

.container_common_brush_bottom_sub {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 13px;
  letter-spacing: 0.04em;
}

@keyframes brush-world-orbit {
  0%, 100% {
    transform: scale(var(--brush-scale)) rotateX(53deg) rotateY(-4deg) rotateZ(-16deg) translateY(0);
  }
  50% {
    transform: scale(var(--brush-scale)) rotateX(57deg) rotateY(5deg) rotateZ(-10deg) translateY(-4px);
  }
}

@keyframes brush-3d-sweep {
  0% {
    transform: translate3d(-74px, 22px, 6px) rotateZ(-12deg) rotateY(14deg) rotateX(6deg);
  }
  22% {
    transform: translate3d(-8px, -16px, 4px) rotateZ(4deg) rotateY(4deg) rotateX(-4deg);
  }
  44% {
    transform: translate3d(72px, -12px, 5px) rotateZ(16deg) rotateY(-12deg) rotateX(5deg);
  }
  52% {
    transform: translate3d(76px, -4px, 28px) rotateZ(22deg) rotateY(-20deg) rotateX(14deg);
  }
  74% {
    transform: translate3d(6px, 24px, 4px) rotateZ(-6deg) rotateY(-6deg) rotateX(-6deg);
  }
  92% {
    transform: translate3d(-68px, 16px, 6px) rotateZ(-16deg) rotateY(10deg) rotateX(4deg);
  }
  97% {
    transform: translate3d(-76px, 20px, 22px) rotateZ(-18deg) rotateY(16deg) rotateX(12deg);
  }
  100% {
    transform: translate3d(-74px, 22px, 6px) rotateZ(-12deg) rotateY(14deg) rotateX(6deg);
  }
}

@keyframes bristle-3d-flex {
  0% {
    transform: rotateZ(18deg) rotateX(10deg);
  }
  22% {
    transform: rotateZ(24deg) rotateX(14deg);
  }
  44% {
    transform: rotateZ(14deg) rotateX(8deg);
  }
  52% {
    transform: rotateZ(-8deg) rotateX(-6deg);
  }
  74% {
    transform: rotateZ(-22deg) rotateX(-12deg);
  }
  92% {
    transform: rotateZ(-12deg) rotateX(-6deg);
  }
  97% {
    transform: rotateZ(6deg) rotateX(4deg);
  }
  100% {
    transform: rotateZ(18deg) rotateX(10deg);
  }
}

@keyframes brush-shadow-sweep {
  0% {
    opacity: 0.5;
    filter: blur(4px);
    transform: translate3d(-70px, 24px, 3px) scale(0.95) rotate(-12deg);
  }
  22% {
    opacity: 0.58;
    filter: blur(3.5px);
    transform: translate3d(-4px, -14px, 3px) scale(0.9) rotate(4deg);
  }
  44% {
    opacity: 0.52;
    filter: blur(4px);
    transform: translate3d(74px, -10px, 3px) scale(0.95) rotate(14deg);
  }
  52% {
    opacity: 0.22;
    filter: blur(9px);
    transform: translate3d(84px, 4px, 3px) scale(1.3) rotate(18deg);
  }
  74% {
    opacity: 0.56;
    filter: blur(3.5px);
    transform: translate3d(10px, 26px, 3px) scale(0.92) rotate(-8deg);
  }
  92% {
    opacity: 0.5;
    filter: blur(4px);
    transform: translate3d(-64px, 18px, 3px) scale(0.95) rotate(-14deg);
  }
  97% {
    opacity: 0.25;
    filter: blur(8px);
    transform: translate3d(-68px, 26px, 3px) scale(1.22) rotate(-14deg);
  }
  100% {
    opacity: 0.5;
    filter: blur(4px);
    transform: translate3d(-70px, 24px, 3px) scale(0.95) rotate(-12deg);
  }
}

@keyframes stroke-draw-main {
  0% {
    stroke-dashoffset: 210;
    opacity: 0.35;
  }
  44%, 86% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  96%, 100% {
    stroke-dashoffset: -210;
    opacity: 0.25;
  }
}

@keyframes stroke-draw-return {
  0%, 48% {
    stroke-dashoffset: 190;
    opacity: 0.2;
  }
  88% {
    stroke-dashoffset: 0;
    opacity: 0.95;
  }
  97%, 100% {
    stroke-dashoffset: -190;
    opacity: 0.2;
  }
}

@keyframes puddle-bloom {
  0%, 100% {
    opacity: 0.55;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.06);
  }
}

@keyframes aura-pulse {
  0%, 100% {
    opacity: 0.65;
    transform: scale(0.94);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes drop-float-3d {
  0%, 100% {
    opacity: 0.35;
    transform: translate3d(0, 4px, 16px) scale(0.75);
  }
  50% {
    opacity: 0.95;
    transform: translate3d(0, -8px, var(--drop-z, 38px)) scale(1.12);
  }
}

@keyframes splatter-pop {
  0%, 20%, 100% {
    opacity: 0.25;
    transform: scale(0.6);
  }
  45%, 80% {
    opacity: 0.85;
    transform: scale(1.15);
  }
}

@keyframes brush-reduced-sweep {
  0%, 100% { transform: translate3d(-14px, 8px, 6px); }
  50% { transform: translate3d(14px, 8px, 6px); }
}

@media (prefers-reduced-motion: reduce) {
  .container_common_brush_center_stage * {
    animation: none !important;
  }

  // 加载状态保留轻微移动，避免全局减弱动效规则使画笔看起来卡住。
  .container_common_brush_center_pivot {
    animation: brush-reduced-sweep 4.8s ease-in-out infinite !important;
  }

  .container_common_brush_center_stroke,
  .container_common_brush_center_ribbon,
  .container_common_brush_center_accent {
    stroke-dashoffset: 0;
  }
}
</style>
