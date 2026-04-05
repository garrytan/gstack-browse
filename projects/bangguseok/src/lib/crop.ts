import sharp from 'sharp';
import type { FaceCoordsType } from './schemas';
import type { PhotoSpec } from './photo-specs';

/**
 * Sharp 크롭 파이프라인
 *
 * 핵심 전략:
 *   - 머리 꼭대기: 픽셀 스캔 (흰 배경 → 머리카락 시작점을 직접 탐지)
 *   - 턱 위치: Gemini 좌표 사용
 *   - 이 조합으로 Gemini 좌표 불안정성 문제 해결
 */

interface CropArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropResult {
  image: string;
  headCropped: boolean;
}

/**
 * 흰 배경에서 인물(머리카락) 시작 y좌표를 픽셀 스캔으로 찾기
 *
 * 이미지 상단부터 아래로 스캔하면서, 흰색이 아닌 픽셀이
 * 일정 비율 이상 나타나는 첫 번째 행을 찾는다.
 *
 * @returns 머리카락 시작 y좌표 (px), 찾지 못하면 null
 */
async function detectHairTopByPixel(imageBuffer: Buffer): Promise<number | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .rotate()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // 상단 60%만 스캔 (하단은 어깨/옷이므로 무의미)
    const scanLimit = Math.floor(height * 0.6);

    for (let y = 0; y < scanLimit; y++) {
      let nonWhiteCount = 0;

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 흰색 기준: RGB 모두 240 이상이면 배경
        if (r < 240 || g < 240 || b < 240) {
          nonWhiteCount++;
        }
      }

      // 해당 행에서 비배경 픽셀이 3% 이상이면 → 인물 시작
      if (nonWhiteCount / width > 0.03) {
        console.log(`[crop] Hair top detected at y=${y} (${(y / height * 100).toFixed(1)}%)`);
        return y;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 크롭 영역 계산
 *
 * hairTopPx: 픽셀 스캔으로 찾은 실제 머리 꼭대기
 * face.chin: Gemini가 감지한 턱 위치
 */
function calculateCropArea(
  imgWidth: number,
  imgHeight: number,
  hairTopPx: number,
  face: FaceCoordsType,
  spec: PhotoSpec,
): { area: CropArea; headCropped: boolean } {
  const faceChinPx = face.chin * imgHeight;
  const faceCenterXPx = face.centerX * imgWidth;

  // 머리 길이 = 머리카락 꼭대기 ~ 턱
  const faceHeightPx = faceChinPx - hairTopPx;

  // 전체 크롭 높이 = 머리 길이 / faceRatio
  const cropHeight = faceHeightPx / spec.faceRatio;
  const cropWidth = cropHeight * (spec.w / spec.h);

  // 머리 위 여백: 사진 전체의 약 3% (4.5cm 기준 약 1.35mm)
  const topMargin = cropHeight * 0.03;
  const rawCropTop = hairTopPx - topMargin;

  const headCropped = rawCropTop < 0;
  let cropTop = Math.max(0, rawCropTop);
  let cropLeft = Math.max(0, faceCenterXPx - cropWidth / 2);

  // 우하단 경계 클램핑
  const finalWidth = Math.min(cropWidth, imgWidth - cropLeft);
  const finalHeight = Math.min(cropHeight, imgHeight - cropTop);

  return {
    area: {
      left: Math.round(cropLeft),
      top: Math.round(cropTop),
      width: Math.round(finalWidth),
      height: Math.round(finalHeight),
    },
    headCropped,
  };
}

/**
 * 이미지 크롭 + 리사이즈 + 압축
 */
export async function cropAndResize(
  imageBuffer: Buffer,
  face: FaceCoordsType,
  spec: PhotoSpec,
): Promise<CropResult | null> {
  try {
    const rotated = sharp(imageBuffer).rotate();
    const metadata = await rotated.metadata();

    const imgWidth = metadata.width;
    const imgHeight = metadata.height;
    if (!imgWidth || !imgHeight) return null;

    const geminiFaceTopPx = face.top * imgHeight;
    const geminiChinPx = face.chin * imgHeight;
    const faceBoxHeight = geminiChinPx - geminiFaceTopPx;

    // 1) 픽셀 스캔으로 실제 머리 꼭대기 찾기
    let hairTopPx = await detectHairTopByPixel(imageBuffer);
    
    // 픽셀 스캔 결과 검증 (오탐률 보정)
    if (hairTopPx !== null) {
      // 1-1. 빛 반사 오탐: 머리 꼭대기가 얼굴 상단(이마)보다 너무 아래인 경우 (얼굴 높이 10% 이상 하강)
      if (hairTopPx > geminiFaceTopPx + faceBoxHeight * 0.1) {
        console.warn(`[crop] Pixel scan hairTop (${hairTopPx}) is too low (glare detected). Fallbacking.`);
        hairTopPx = null;
      }
      // 1-2. 배경 노이즈 오탐: 머리 꼭대기가 얼굴 상단보다 너무 높은 경우 (얼굴 높이의 80% 초과 상승)
      else if (hairTopPx < geminiFaceTopPx - faceBoxHeight * 0.8) {
        console.warn(`[crop] Pixel scan hairTop (${hairTopPx}) is too high (noise/shadow). Fallbacking.`);
        hairTopPx = null;
      }
    }

    // Geometry 기반 안전한 Fallback
    // 픽셀 검증 실패 시: Gemini가 잡은 얼굴 상단(보통 이마)에서 얼굴 높이의 25%만큼 위로 올린 지점을 정수리(Vertex)로 추정.
    const geometricHairTop = Math.max(0, geminiFaceTopPx - faceBoxHeight * 0.25);
    const actualHairTop = hairTopPx ?? geometricHairTop;

    console.log(`[crop] hairTop: pixel=${hairTopPx}, geminiTop=${Math.round(geminiFaceTopPx)}, using=${Math.round(actualHairTop)}`);

    // 2) 크롭 영역 계산 (머리 잘리면 faceRatio 줄여서 재시도)
    let currentSpec = { ...spec };
    let cropArea: CropArea;
    let headCropped = false;

    for (let retry = 0; retry < 3; retry++) {
      const result = calculateCropArea(imgWidth, imgHeight, actualHairTop, face, currentSpec);
      cropArea = result.area;
      headCropped = result.headCropped;

      if (!headCropped) break;

      currentSpec = { ...currentSpec, faceRatio: currentSpec.faceRatio - 0.05 };
      console.log(`[crop] Head cropped, retrying with faceRatio=${currentSpec.faceRatio}`);
    }

    if (cropArea!.width < 50 || cropArea!.height < 50) return null;

    // 3) JPEG 압축
    let quality = 92;
    const MIN_QUALITY = 50;

    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await sharp(imageBuffer)
        .rotate()
        .extract(cropArea!)
        .resize(spec.w, spec.h, { fit: 'fill' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (result.byteLength / 1024 <= spec.maxKB) {
        return { image: result.toString('base64'), headCropped };
      }

      quality -= 12;
      if (quality < MIN_QUALITY) break;
    }

    const fallback = await sharp(imageBuffer)
      .rotate()
      .extract(cropArea!)
      .resize(spec.w, spec.h, { fit: 'fill' })
      .jpeg({ quality: MIN_QUALITY, mozjpeg: true })
      .toBuffer();

    return { image: fallback.toString('base64'), headCropped };

  } catch (err) {
    console.error('[crop] Error:', err);
    return null;
  }
}
