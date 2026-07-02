import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';
import { signToken } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errors';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  organization_name: z.string().min(1).max(255),
});

// POST /api/auth/register — creates a user AND their first organization.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const db = getDb();

    const existing = await db.collection('users').findOne({ email: body.email });
    if (existing) {
      throw new ApiError(409, 'A user with that email already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const now = new Date();

    const userId = uuidv4();
    const orgId = uuidv4();

    const user = { id: userId, name: body.name, email: body.email, password_hash: passwordHash, created_at: now };
    const org = { id: orgId, name: body.organization_name, created_by: userId, created_at: now };
    const member = { organization_id: orgId, user_id: userId, role: 'owner', joined_at: now };

    // MongoDB doesn't have cross-collection transactions without a replica set,
    // but these are independent inserts — if one fails the error propagates.
    await db.collection('users').insertOne(user);
    await db.collection('organizations').insertOne(org);
    await db.collection('organization_members').insertOne(member);

    const token = signToken({ id: userId, email: body.email });
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at },
      organization: { id: org.id, name: org.name },
      token,
    });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const db = getDb();

    const user = await db.collection('users').findOne({ email: body.email });
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(body.password, user.password_hash as string);
    if (!valid) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ id: user.id as string, email: user.email as string });
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  })
);

export default router;
