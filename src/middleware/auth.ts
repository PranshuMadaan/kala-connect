import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedUser {
  id: string;
  phone: string;
  role: string;
  displayName: string;
  artisanId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { artisanProfile: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists' });
    }

    req.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      displayName: user.displayName,
      artisanId: user.artisanProfile?.id
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { artisanProfile: true }
    });

    if (user) {
      req.user = {
        id: user.id,
        phone: user.phone,
        role: user.role,
        displayName: user.displayName,
        artisanId: user.artisanProfile?.id
      };
    }
  } catch {
    // Ignore invalid token in optional auth
  }

  next();
};

export const optionalAuthenticate = optionalAuth;

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: `Forbidden: Requires role [${roles.join(', ')}]` });
    }
    next();
  };
};
