// Project + data repository helpers. Uses Supabase in production when configured,
// with SQLite retained as a local-development fallback.

import { getDb } from './db';
import { isSupabaseEnabled, supabaseInsert, supabasePatch, supabaseSelect } from './supabase';
import { newId, nowIso, generateProjectSlug } from './ids';
import type { Carousel, Concept, Project } from './types';

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    location: (row.location as string) || '',
    hikeDate: (row.hike_date as string | null) ?? null,
    context: (row.context as string) || '',
    slug: row.slug as string,
    status: row.status as Project['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createProject(input: { userId: string; name: string; location: string; hikeDate: string | null; context: string }): Promise<Project> {
  const id = newId('prj');
  const slug = generateProjectSlug(input.name);
  const now = nowIso();
  const project: Project = {
    id,
    name: input.name,
    location: input.location,
    hikeDate: input.hikeDate,
    context: input.context,
    slug,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseEnabled()) {
    await supabaseInsert('projects', {
      id,
      user_id: input.userId,
      name: input.name,
      location: input.location,
      hike_date: input.hikeDate,
      context: input.context,
      slug,
      status: 'Draft',
      created_at: now,
      updated_at: now,
    });
    return project;
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO projects (id, user_id, name, location, hike_date, context, slug, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)`,
  ).run(id, input.userId, input.name, input.location, input.hikeDate, input.context, slug, now, now);
  return project;
}

export async function getProject(id: string, userId: string): Promise<Project | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<Record<string, unknown>>('projects', `id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    return rows[0] ? mapProject(rows[0]) : null;
  }
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId) as Record<string, unknown> | undefined;
  return row ? mapProject(row) : null;
}

export async function listProjects(userId: string): Promise<Project[]> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<Record<string, unknown>>('projects', `user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`);
    return rows.map(mapProject);
  }
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as Array<Record<string, unknown>>;
  return rows.map(mapProject);
}

export async function updateProjectStatus(id: string, userId: string, status: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabasePatch('projects', `id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`, { status, updated_at: nowIso() });
    return;
  }
  getDb().prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(status, nowIso(), id, userId);
}

export async function saveConcept(projectId: string, concept: Concept, scoreTotal: number): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseInsert('concepts', {
      id: concept.id,
      project_id: projectId,
      data: concept,
      score_total: scoreTotal,
      created_at: nowIso(),
    }, 'id');
    return;
  }
  getDb().prepare('INSERT INTO concepts (id, project_id, data, score_total, created_at) VALUES (?, ?, ?, ?, ?)').run(
    concept.id,
    projectId,
    JSON.stringify(concept),
    scoreTotal,
    nowIso(),
  );
}

export async function loadConcepts(projectId: string): Promise<Concept[]> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<{ data: Concept }>('concepts', `project_id=eq.${encodeURIComponent(projectId)}&order=created_at.asc`);
    return rows.map((r) => r.data);
  }
  const rows = getDb().prepare('SELECT data FROM concepts WHERE project_id = ?').all(projectId) as Array<{ data: string }>;
  return rows.map((r) => JSON.parse(r.data) as Concept);
}

export async function saveCarousel(carousel: Carousel): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseInsert('carousels', {
      id: carousel.id,
      project_id: carousel.projectId,
      concept_id: carousel.conceptId,
      title: carousel.title,
      pillar: carousel.pillar,
      data: carousel,
      status: carousel.status,
      updated_at: nowIso(),
    }, 'id');
    return;
  }
  getDb().prepare(
    `INSERT INTO carousels (id, project_id, concept_id, title, pillar, data, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, title = excluded.title, pillar = excluded.pillar, status = excluded.status, updated_at = excluded.updated_at`,
  ).run(
    carousel.id,
    carousel.projectId,
    carousel.conceptId,
    carousel.title,
    carousel.pillar,
    JSON.stringify(carousel),
    carousel.status,
    nowIso(),
  );
}

export async function loadCarousel(projectId: string): Promise<Carousel | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<{ data: Carousel }>('carousels', `project_id=eq.${encodeURIComponent(projectId)}&order=updated_at.desc&limit=1`);
    return rows[0]?.data ?? null;
  }
  const row = getDb().prepare('SELECT data FROM carousels WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1').get(projectId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Carousel) : null;
}

export function newCarouselId(): string {
  return newId('car');
}
