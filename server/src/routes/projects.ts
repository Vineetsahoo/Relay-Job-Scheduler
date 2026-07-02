import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';
import { asyncHandler, ApiError } from '../middleware/errors';

const router = Router();

/** Throws 403 unless req.user belongs to the given organization. */
async function assertOrgMember(userId: string, organizationId: string) {
  const db = getDb();
  const member = await db.collection('organization_members').findOne({
    organization_id: organizationId,
    user_id: userId,
  });
  if (!member) throw new ApiError(403, 'Not a member of this organization');
}

/** Throws 403 unless req.user belongs to the org that owns the given project. */
async function assertProjectAccess(userId: string, projectId: string) {
  const db = getDb();
  const project = await db.collection('projects').findOne({ id: projectId });
  if (!project) throw new ApiError(403, 'No access to this project');

  const member = await db.collection('organization_members').findOne({
    organization_id: project.organization_id,
    user_id: userId,
  });
  if (!member) throw new ApiError(403, 'No access to this project');
}

// GET /api/organizations — orgs the current user belongs to
router.get(
  '/organizations',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const memberships = await db
      .collection('organization_members')
      .find({ user_id: req.user!.id })
      .toArray();

    const orgIds = memberships.map((m) => m.organization_id);
    const orgs = await db
      .collection('organizations')
      .find({ id: { $in: orgIds } })
      .sort({ created_at: 1 })
      .toArray();

    const roleMap = new Map(memberships.map((m) => [m.organization_id as string, m.role]));

    const data = orgs.map((o) => ({
      id: o.id,
      name: o.name,
      role: roleMap.get(o.id as string),
      created_at: o.created_at,
    }));

    res.json({ data });
  })
);

const createProjectSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(255),
});

// POST /api/projects
router.post(
  '/projects',
  asyncHandler(async (req, res) => {
    const body = createProjectSchema.parse(req.body);
    await assertOrgMember(req.user!.id, body.organization_id);

    const db = getDb();
    const project = {
      id: uuidv4(),
      organization_id: body.organization_id,
      name: body.name,
      // 48-char hex api key (24 random bytes)
      api_key: [...Array(48)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
      created_at: new Date(),
    };

    await db.collection('projects').insertOne(project);
    res.status(201).json({
      id: project.id,
      organization_id: project.organization_id,
      name: project.name,
      api_key: project.api_key,
      created_at: project.created_at,
    });
  })
);

// GET /api/projects?organization_id=...
router.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const organizationId = req.query.organization_id as string | undefined;
    if (!organizationId) throw new ApiError(400, 'organization_id query param is required');
    await assertOrgMember(req.user!.id, organizationId);

    const db = getDb();
    const projects = await db
      .collection('projects')
      .find({ organization_id: organizationId })
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      data: projects.map((p) => ({
        id: p.id,
        organization_id: p.organization_id,
        name: p.name,
        api_key: p.api_key,
        created_at: p.created_at,
      })),
    });
  })
);

// GET /api/projects/:id
router.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    await assertProjectAccess(req.user!.id, req.params.id);
    const db = getDb();
    const project = await db.collection('projects').findOne({ id: req.params.id });
    if (!project) throw new ApiError(404, 'Project not found');
    const { _id, ...rest } = project;
    res.json(rest);
  })
);

export { assertProjectAccess, assertOrgMember };
export default router;
