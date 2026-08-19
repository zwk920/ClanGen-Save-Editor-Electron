import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { afterlifeStateForCat } from '../model/afterlife';
import spriteIndex from './catRenderer/assets/spritesIndex.json';
import poseSpriteData from './catRenderer/assets/pose_sprite_data.json';
import peltInfo from './catRenderer/assets/peltInfo.json';
import tints from './catRenderer/assets/tints/tint.json';
import whitePatchesTints from './catRenderer/assets/tints/white_patches_tint.json';
import whitePatchesLittleData from './catRenderer/assets/data/white_patches_little_sprite_data.json';
import whitePatchesMidData from './catRenderer/assets/data/white_patches_mid_sprite_data.json';
import whitePatchesMostlyData from './catRenderer/assets/data/white_patches_mostly_sprite_data.json';
import whitePatchesHighData from './catRenderer/assets/data/white_patches_high_sprite_data.json';

type Cat = Record<string, any>;
type SpriteInfo = { spritesheet: string; xOffset: number; yOffset: number };
type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const spriteCache = new Map<string, Promise<HTMLImageElement>>();
const spriteNames: Record<string, string> = {
  SingleColour: 'single',
  TwoColour: 'single',
  Tabby: 'tabby',
  Marbled: 'marbled',
  Rosette: 'rosette',
  Smoke: 'smoke',
  Ticked: 'ticked',
  Speckled: 'speckled',
  Bengal: 'bengal',
  Mackerel: 'mackerel',
  Classic: 'classic',
  Sokoke: 'sokoke',
  Agouti: 'agouti',
  Singlestripe: 'singlestripe',
  Masked: 'masked',
};

function loadSpriteSheet(resourceDirPath: string | null, name: string): Promise<HTMLImageElement> {
  const cacheKey = `${resourceDirPath ?? ''}::${name}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;
  const promise = (async () => {
    if (!resourceDirPath) throw new Error('Select the ClanGen data folder to preview cat sprites.');
    const base64 = await window.electronFileSystem.readSpriteFile(resourceDirPath, `${name}.png`);
    if (!base64) throw new Error(`Missing sprite sheet: ${name}`);
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => reject(new Error(`Missing sprite sheet: ${name}`)), { once: true });
      image.src = `data:image/png;base64,${base64}`;
    });
    return image;
  })();
  spriteCache.set(cacheKey, promise);
  return promise;
}

async function drawSprite(ctx: CanvasContext, resourceDirPath: string | null, spriteName: string, pose: number): Promise<void> {
  const info = (spriteIndex as Record<string, SpriteInfo>)[spriteName];
  if (!info) return;
  const image = await loadSpriteSheet(resourceDirPath, info.spritesheet);
  const column = pose % 3;
  const row = Math.floor(pose / 3);
  ctx.drawImage(image, info.xOffset + column * 50, info.yOffset + row * 50, 50, 50, 0, 0, 50, 50);
}

async function drawMaskedSprite(ctx: CanvasContext, resourceDirPath: string | null, spriteName: string, maskName: string, pose: number): Promise<void> {
  const layer = new OffscreenCanvas(50, 50);
  const layerContext = layer.getContext('2d');
  if (!layerContext) return;
  await drawSprite(layerContext, resourceDirPath, maskName, pose);
  layerContext.globalCompositeOperation = 'source-in';
  await drawSprite(layerContext, resourceDirPath, spriteName, pose);
  ctx.drawImage(layer, 0, 0);
}

async function drawMissingScar(ctx: CanvasContext, resourceDirPath: string | null, spriteName: string, pose: number): Promise<void> {
  const previous = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'destination-in';
  await drawSprite(ctx, resourceDirPath, spriteName, pose);

  const detailLayer = new OffscreenCanvas(50, 50);
  const detailContext = detailLayer.getContext('2d');
  if (detailContext) {
    detailContext.drawImage(ctx.canvas, 0, 0);
    detailContext.globalCompositeOperation = 'source-in';
    await drawSprite(detailContext, resourceDirPath, spriteName, pose);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(detailLayer, 0, 0);
  }
  ctx.globalCompositeOperation = previous;
}

function tintLayer(ctx: CanvasContext, color: number[], mode: GlobalCompositeOperation): void {
  const layer = new OffscreenCanvas(50, 50);
  const layerContext = layer.getContext('2d');
  if (!layerContext) return;
  layerContext.drawImage(ctx.canvas, 0, 0);
  layerContext.globalCompositeOperation = 'source-in';
  layerContext.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`;
  layerContext.fillRect(0, 0, 50, 50);
  const previous = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = mode;
  ctx.drawImage(layer, 0, 0);
  ctx.globalCompositeOperation = previous;
}

async function drawWhiteLayer(
  ctx: CanvasContext,
  resourceDirPath: string | null,
  spriteName: string,
  pose: number,
  tintName: string,
  tintColours: Record<string, number[] | null>,
): Promise<void> {
  const layer = new OffscreenCanvas(50, 50);
  const layerContext = layer.getContext('2d');
  if (!layerContext) return;
  await drawSprite(layerContext, resourceDirPath, spriteName, pose);
  const tint = tintColours[tintName];
  if (tint) tintLayer(layerContext, tint, 'multiply');
  ctx.drawImage(layer, 0, 0);
}

function spritePrefix(name: unknown): string {
  const value = String(name ?? 'SingleColour');
  const normalized = value.toLowerCase();
  if (normalized === 'tortiesolid') return 'single';
  if (normalized === 'tortietabby') return 'tabby';
  return spriteNames[value] ?? normalized;
}

function valueOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value !== 'none' ? value : undefined;
}

async function drawCat(canvas: HTMLCanvasElement, resourceDirPath: string | null, cat: Cat, poseName?: string): Promise<void> {
  const outputContext = canvas.getContext('2d');
  const compositeCanvas = new OffscreenCanvas(50, 50);
  const context = compositeCanvas.getContext('2d');
  if (!context || !outputContext) return;
  outputContext.clearRect(0, 0, 50, 50);
  const selectedPose = poseName ?? String(cat.sprite_adult ?? 'adult_long0');
  const pose = (poseSpriteData.poses as string[]).indexOf(selectedPose);
  const poseIndex = pose >= 0 ? pose : (poseSpriteData.poses as string[]).indexOf('adult_long0');
  const peltName = String(cat.pelt_name ?? 'SingleColour');
  const colour = String(cat.pelt_color ?? 'CREAM');
  const isTortie = peltName === 'Tortie' || peltName === 'Calico';

  if (isTortie) {
    const base = spritePrefix(cat.tortie_base ?? 'single');
    const pattern = String(cat.tortie_pattern ?? 'single') === 'Single' ? 'SingleColour' : spritePrefix(cat.tortie_pattern ?? 'single');
    await drawSprite(context, resourceDirPath, `colours_${base}${colour}`, poseIndex);
    await drawMaskedSprite(context, resourceDirPath, `colours_${pattern}${String(cat.tortie_color ?? colour)}`, `patches_tortie${String(cat.tortie_marking ?? '')}`, poseIndex);
  } else {
    await drawSprite(context, resourceDirPath, `colours_${spritePrefix(peltName)}${colour}`, poseIndex);
  }

  const tintName = String(cat.tint ?? 'none');
  const tintData = tints as { tint_colours: Record<string, number[] | null>; dilute_tint_colours: Record<string, number[] | null> };
  const normalTint = tintData.tint_colours[tintName];
  const diluteTint = tintData.dilute_tint_colours[tintName];
  if (normalTint) tintLayer(context, normalTint, 'multiply');
  if (diluteTint) tintLayer(context, diluteTint, 'lighter');

  const whitePatchTint = String(cat.white_patches_tint ?? 'none');
  const whitePatchTintData = whitePatchesTints as { tint_colours: Record<string, number[] | null> };
  const whitePatch = valueOrUndefined(cat.white_patches);
  if (whitePatch) {
    const patchGroups = [whitePatchesLittleData, whitePatchesMidData, whitePatchesMostlyData, whitePatchesHighData];
    for (const group of patchGroups) {
      if ((group.sprite_list as string[][]).flat().includes(whitePatch)) {
        await drawWhiteLayer(context, resourceDirPath, `${group.spritesheet}${whitePatch}`, poseIndex, whitePatchTint, whitePatchTintData.tint_colours);
        break;
      }
    }
  }
  const points = valueOrUndefined(cat.points);
  if (points) await drawWhiteLayer(context, resourceDirPath, `patches_points${points}`, poseIndex, whitePatchTint, whitePatchTintData.tint_colours);
  const vitiligo = valueOrUndefined(cat.vitiligo);
  if (vitiligo) await drawSprite(context, resourceDirPath, `patches_vitiligo${vitiligo}`, poseIndex);

  await drawSprite(context, resourceDirPath, `eyes${String(cat.eye_colour ?? 'YELLOW')}`, poseIndex);
  const eyeColour2 = valueOrUndefined(cat.eye_colour2);
  if (eyeColour2) await drawMaskedSprite(context, resourceDirPath, `eyes${eyeColour2}`, 'heterochromiamask', poseIndex);

  const scars = Array.isArray(cat.scars) ? cat.scars.filter((scar): scar is string => typeof scar === 'string') : [];
  const scarInfo = peltInfo as { scars1: string[]; scars2: string[]; scars3: string[]; plant_accessories: string[]; wild_accessories: string[] };
  for (const scar of scars) if (scarInfo.scars1.includes(scar) || scarInfo.scars3.includes(scar)) await drawSprite(context, resourceDirPath, `scars${scar}`, poseIndex);
  const afterlifeState = afterlifeStateForCat(cat);
  const isLifegenResourcePack = resourceDirPath?.toLowerCase().includes('lifegen') ?? false;
  const lineart = afterlifeState === 'starclan'
    ? 'lineart_sc'
    : afterlifeState === 'dark_forest'
      ? 'lineart_df'
      : afterlifeState === 'unknown_residence'
        ? isLifegenResourcePack ? 'lifegen_lineart_ur' : 'lineart_ur'
        : 'lineart';
  await drawSprite(context, resourceDirPath, lineart, poseIndex);
  await drawSprite(context, resourceDirPath, `skin${String(cat.skin ?? 'BLACK')}`, poseIndex);
  if (afterlifeState === 'starclan') await drawSprite(context, resourceDirPath, 'line_sc_overlay', poseIndex);
  for (const scar of scars) if (scarInfo.scars2.includes(scar)) await drawMissingScar(context, resourceDirPath, `scars_missing_part${scar}`, poseIndex);

  const accessories = Array.isArray(cat.accessory) ? cat.accessory.filter((item): item is string => typeof item === 'string') : [];
  for (const accessory of accessories) {
    if (scarInfo.plant_accessories.includes(accessory)) await drawSprite(context, resourceDirPath, `acc_plants${accessory}`, poseIndex);
    if (scarInfo.wild_accessories.includes(accessory)) await drawSprite(context, resourceDirPath, `acc_wilds${accessory}`, poseIndex);
  }

  if (cat.reverse) {
    outputContext.save();
    outputContext.scale(-1, 1);
    outputContext.drawImage(compositeCanvas, -50, 0);
    outputContext.restore();
  } else {
    outputContext.drawImage(compositeCanvas, 0, 0);
  }
}

interface CatPreviewProps {
  cat: Cat | null;
  poseName?: string;
  label?: string;
  size?: number;
}

export function CatPreview({ cat, poseName, label, size = 128 }: CatPreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const resourceDirPath = useEditorStore((state) => state.resourceDirPath);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cat) return;
    let cancelled = false;
    void drawCat(canvas, resourceDirPath, cat, poseName).then(() => {
      if (!cancelled) setError(null);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to render this cat.');
    });
    return () => { cancelled = true; };
  }, [cat, poseName, resourceDirPath]);

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', gap: 0, minWidth: size }}>
      <canvas ref={canvasRef} width={50} height={50} aria-label={label ? `${label} cat appearance preview` : 'Cat appearance preview'} style={{ width: size, height: size, imageRendering: 'pixelated' }} />
      {label && <Typography variant="caption" color="text.secondary">{label}</Typography>}
      {error && <Typography variant="caption" color="error" align="center">{error}</Typography>}
    </Box>
  );
}