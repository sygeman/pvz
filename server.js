import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';

const app = new Hono();

// In-memory storage (replace with DB in production)
const users = new Map();
const sessions = new Map();
const games = new Map();

// GitHub OAuth config
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Static files
app.use('/*', serveStatic({ root: './client/dist' }));

// GitHub OAuth login
app.get('/api/auth/github', (c) => {
  const state = crypto.randomUUID();
  const redirectUri = `${BASE_URL}/api/auth/github/callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=user:email`;
  
  return c.redirect(githubUrl);
});

// GitHub OAuth callback
app.get('/api/auth/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  
  if (!code) {
    return c.json({ error: 'No code provided' }, 400);
  }
  
  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  
  const tokenData = await tokenRes.json();
  
  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to get access token' }, 400);
  }
  
  // Get user info from GitHub
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  
  const githubUser = await userRes.json();
  
  // Create or update user
  const user = {
    id: githubUser.id,
    login: githubUser.login,
    name: githubUser.name || githubUser.login,
    avatar: githubUser.avatar_url,
    createdAt: Date.now(),
  };
  
  users.set(githubUser.id, user);
  
  // Create session
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { userId: user.id, createdAt: Date.now() });
  
  // Redirect to game with session
  return c.redirect(`/?session=${sessionId}`);
});

// Get current user
app.get('/api/me', (c) => {
  const sessionId = c.req.header('X-Session-Id') || c.req.query('session');
  const session = sessions.get(sessionId);
  
  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json(user);
});

// Logout
app.post('/api/logout', (c) => {
  const sessionId = c.req.header('X-Session-Id');
  if (sessionId) {
    sessions.delete(sessionId);
  }
  return c.json({ success: true });
});

// Save game
app.post('/api/game/save', async (c) => {
  const sessionId = c.req.header('X-Session-Id');
  const session = sessions.get(sessionId);
  
  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const data = await c.req.json();
  games.set(session.userId, { ...data, savedAt: Date.now() });
  
  return c.json({ success: true });
});

// Load game
app.get('/api/game/load', (c) => {
  const sessionId = c.req.header('X-Session-Id');
  const session = sessions.get(sessionId);
  
  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const game = games.get(session.userId);
  return c.json(game || null);
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', bun: true }));

const port = process.env.PORT || 3000;
console.log(`Server running at http://localhost:${port}`);

serve({ fetch: app.fetch, port });
