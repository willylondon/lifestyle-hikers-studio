import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { downloadObject, isSupabaseEnabled, objectExists, uploadObject } from './supabase';

export type MediaStorageState = 'original' | 'enhanced' | 'derivative' | 'export';

export function mediaPath(state: MediaStorageState, filename: string): string {
  return path.join(config.mediaDir, state, filename);
}

function objectPath(state: MediaStorageState, filename: string): string {
  return `${state}/${safeFilename(filename)}`;
}

function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.zip') return 'application/zip';
  return 'application/octet-stream';
}

export async function writeMedia(state: MediaStorageState, filename: string, data: Buffer): Promise<string> {
  if (isSupabaseEnabled()) {
    const p = objectPath(state, filename);
    await uploadObject(p, data, mimeFromFilename(filename));
    return p;
  }
  const p = mediaPath(state, filename);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return p;
}

export async function readMedia(state: MediaStorageState, filename: string): Promise<Buffer> {
  if (isSupabaseEnabled()) return downloadObject(objectPath(state, filename));
  return fs.readFileSync(mediaPath(state, filename));
}

export async function mediaExists(state: MediaStorageState, filename: string): Promise<boolean> {
  if (isSupabaseEnabled()) return objectExists(objectPath(state, filename));
  return fs.existsSync(mediaPath(state, filename));
}

export function safeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80);
  return `${base}${ext}`;
}
