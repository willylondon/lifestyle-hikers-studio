import { getDb } from './db';
import { isSupabaseEnabled, supabaseInsert, supabaseSelect } from './supabase';
import type { MediaAsset, PhotoAnalysis } from './types';

function mapAsset(row: Record<string, unknown>): MediaAsset {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    sourceId: row.source_id as string,
    kind: row.kind as MediaAsset['kind'],
    mimeType: row.mime_type as string,
    filename: row.filename as string,
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    orientation: row.orientation as MediaAsset['orientation'],
    bytes: Number(row.bytes || 0),
    createdAt: row.created_at as string,
  };
}

export async function getAssetById(id: string): Promise<MediaAsset | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<Record<string, unknown>>('media_assets', `id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0] ? mapAsset(rows[0]) : null;
  }
  const row = getDb().prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapAsset(row) : null;
}

export async function listAssets(projectId: string): Promise<MediaAsset[]> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<Record<string, unknown>>('media_assets', `project_id=eq.${encodeURIComponent(projectId)}&order=created_at.asc`);
    return rows.map(mapAsset);
  }
  const rows = getDb().prepare('SELECT * FROM media_assets WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as Array<Record<string, unknown>>;
  return rows.map(mapAsset);
}

export async function saveAsset(asset: MediaAsset): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseInsert('media_assets', {
      id: asset.id,
      project_id: asset.projectId,
      source_id: asset.sourceId,
      kind: asset.kind,
      mime_type: asset.mimeType,
      filename: asset.filename,
      width: asset.width,
      height: asset.height,
      orientation: asset.orientation,
      bytes: asset.bytes,
      created_at: asset.createdAt,
    }, 'id');
    return;
  }
  getDb().prepare(
    `INSERT INTO media_assets (id, project_id, source_id, kind, mime_type, filename, width, height, orientation, bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id, kind = excluded.kind, mime_type = excluded.mime_type, filename = excluded.filename, width = excluded.width, height = excluded.height, orientation = excluded.orientation, bytes = excluded.bytes`,
  ).run(
    asset.id, asset.projectId, asset.sourceId, asset.kind, asset.mimeType, asset.filename,
    asset.width, asset.height, asset.orientation, asset.bytes, asset.createdAt,
  );
}

export async function saveAssetAnalysis(analysis: PhotoAnalysis): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseInsert('enhancement_profiles', {
      asset_id: analysis.assetId,
      profile: analysis.enhancement,
      engine: 'local-photo-analysis-v2',
      qa_confidence: analysis.qaConfidence,
      camera_analysis: analysis.camera,
      analysis,
    }, 'asset_id');
    return;
  }

  getDb().prepare(
    `INSERT INTO enhancement_profiles (asset_id, profile, engine, qa_confidence, camera_analysis, analysis)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET profile = excluded.profile, engine = excluded.engine,
       qa_confidence = excluded.qa_confidence, camera_analysis = excluded.camera_analysis,
       analysis = excluded.analysis`,
  ).run(
    analysis.assetId,
    JSON.stringify(analysis.enhancement),
    'local-photo-analysis-v2',
    analysis.qaConfidence,
    JSON.stringify(analysis.camera),
    JSON.stringify(analysis),
  );
}

export async function listAssetAnalyses(projectId: string): Promise<PhotoAnalysis[]> {
  const assets = await listAssets(projectId);
  if (assets.length === 0) return [];

  if (isSupabaseEnabled()) {
    const ids = assets.map((asset) => asset.id).join(',');
    const rows = await supabaseSelect<{ asset_id: string; analysis: PhotoAnalysis | null }>(
      'enhancement_profiles',
      `select=asset_id,analysis&asset_id=in.(${encodeURIComponent(ids)})`,
    );
    return rows.flatMap((row) => row.analysis ? [{ ...row.analysis, assetId: row.asset_id }] : []);
  }

  const placeholders = assets.map(() => '?').join(',');
  const rows = getDb().prepare(
    `SELECT asset_id, analysis FROM enhancement_profiles WHERE asset_id IN (${placeholders})`,
  ).all(...assets.map((asset) => asset.id)) as Array<{ asset_id: string; analysis: string | null }>;
  return rows.flatMap((row) => row.analysis ? [{ ...(JSON.parse(row.analysis) as PhotoAnalysis), assetId: row.asset_id }] : []);
}
