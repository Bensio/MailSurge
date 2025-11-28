import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateConfiguration } from './lib/config-validator';
import { createClient } from '@supabase/supabase-js';

/**
 * Health check endpoint
 * Returns system status and configuration validation
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    config: ReturnType<typeof validateConfiguration>;
    services: {
      supabase: 'ok' | 'error';
      email: 'ok' | 'error' | 'warning';
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: validateConfiguration(),
    services: {
      supabase: 'ok',
      email: 'ok',
    },
  };

  // Check Supabase connection
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      // Simple connection test
      await supabase.from('campaigns').select('id').limit(1);
      health.services.supabase = 'ok';
    } else {
      health.services.supabase = 'error';
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.services.supabase = 'error';
    health.status = 'unhealthy';
  }

  // Check email configuration
  if (!health.config.isValid) {
    health.services.email = 'error';
    health.status = 'unhealthy';
  } else if (health.config.warnings.length > 0) {
    health.services.email = 'warning';
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  
  return res.status(statusCode).json(health);
}

