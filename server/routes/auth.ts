import { Router } from 'express';
import { dbRepository } from '../dbRepository';
import { signJwtToken, authenticateJwt, AuthenticatedRequest } from '../jwt';
import { hashPassword, verifyPassword } from '../../src/utils/password';
import { getDefaultPassword, normalizeUsername } from '../../src/utils/credentials';

const router = Router();

/**
 * POST /api/auth/setup
 * Initialize the first coordinator account if no users exist.
 */
router.post('/setup', async (req, res) => {
  try {
    const userCount = await dbRepository.getUserCount();
    if (userCount > 0) {
      res.status(400).json({ error: 'System has already been set up. Please sign in.' });
      return;
    }

    const { firstName, lastName, password } = req.body;
    if (!firstName || !lastName || !password) {
      res.status(400).json({ error: 'First name, last name, and password are required.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const username = normalizeUsername(firstName, lastName);
    const passwordHash = await hashPassword(password);
    const newUser = {
      id: crypto.randomUUID(),
      username,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: 'instructor' as const,
      passwordHash,
      mustChangePassword: false,
    };

    await dbRepository.saveUser(newUser);

    const token = signJwtToken({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    });

    res.json({ token, user: newUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Setup failed' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate with username and password, returns signed JWT token and user info.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const account = await dbRepository.findUserByUsername(username);
    if (!account) {
      res.status(401).json({ error: 'Incorrect username or password.' });
      return;
    }

    const expectedDefaultPass = getDefaultPassword(account.username);
    const valid = account.passwordHash
      ? await verifyPassword(password, account.passwordHash)
      : account.mustChangePassword &&
        (password === expectedDefaultPass ||
         password === getDefaultPassword(account.firstName) ||
         (account.role === 'instructor' && password === getDefaultPassword(normalizeUsername(account.firstName, account.lastName))));

    if (!valid) {
      res.status(401).json({ error: 'Incorrect username or password.' });
      return;
    }

    let userToReturn = account;
    if (!account.passwordHash) {
      const newHash = await hashPassword(password);
      userToReturn = { ...account, passwordHash: newHash };
      await dbRepository.saveUser(userToReturn);
    }

    const token = signJwtToken({
      id: userToReturn.id,
      username: userToReturn.username,
      role: userToReturn.role,
      firstName: userToReturn.firstName,
      lastName: userToReturn.lastName,
    });

    res.json({ token, user: userToReturn });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Fetch authenticated user profile using JWT token.
 */
router.get('/me', authenticateJwt, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const account = await dbRepository.findUserById(req.user.id);
    if (!account) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: account });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch current user' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user.
 */
router.post('/change-password', authenticateJwt, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      res.status(400).json({ error: 'New password is required.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const account = await dbRepository.findUserById(req.user.id);
    if (!account) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (!account.mustChangePassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required.' });
        return;
      }
      const defaultPass = getDefaultPassword(account.username);
      const valid = account.passwordHash
        ? await verifyPassword(currentPassword, account.passwordHash)
        : currentPassword === defaultPass || currentPassword === getDefaultPassword(account.firstName);

      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    } else if (currentPassword) {
      const defaultPass = getDefaultPassword(account.username);
      const valid = account.passwordHash
        ? await verifyPassword(currentPassword, account.passwordHash)
        : currentPassword === defaultPass || currentPassword === getDefaultPassword(account.firstName);
      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const newHash = await hashPassword(newPassword);
    const updated = {
      ...account,
      passwordHash: newHash,
      mustChangePassword: false,
    };
    await dbRepository.saveUser(updated);

    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Password update failed' });
  }
});

export default router;

