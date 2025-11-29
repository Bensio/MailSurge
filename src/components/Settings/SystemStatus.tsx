import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  config: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    emailMethod: 'gmail-oauth' | 'esp' | 'none' | 'both';
  };
  services: {
    supabase: 'ok' | 'error';
    email: 'ok' | 'error' | 'warning';
  };
}

export function SystemStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/campaigns?health=true');
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.statusText}`);
        }
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch system status');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Checking system configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Unable to check system status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Health check failed</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Error:</strong> {error || 'Unknown error'}</p>
              <p className="mt-2">This could indicate:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>API endpoint is not responding</li>
                <li>Network connectivity issues</li>
                <li>Server configuration problems</li>
              </ul>
              <p className="mt-2 text-xs">
                Check browser console for more details or contact support if the issue persists.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (health.status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (health.status) {
      case 'healthy':
        return 'All systems operational';
      case 'degraded':
        return 'Some warnings detected';
      case 'unhealthy':
        return 'Configuration issues detected';
    }
  };

  const getEmailMethodText = () => {
    switch (health.config.emailMethod) {
      case 'both':
        return 'Gmail OAuth + ESP';
      case 'gmail-oauth':
        return 'Gmail OAuth (users can add ESP accounts)';
      case 'esp':
        return 'ESP (SendGrid/Postmark/etc.)';
      case 'none':
        return 'Not configured - Add email account in Settings';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Current system configuration and health</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email Method:</span>
            <span className="font-medium">{getEmailMethodText()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Supabase:</span>
            {health.services.supabase === 'ok' ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Error
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email Service:</span>
            {health.services.email === 'ok' ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Ready
              </span>
            ) : health.services.email === 'warning' ? (
              <span className="text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Warning
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Error
              </span>
            )}
          </div>
        </div>

        {health.config.errors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-900 mb-2">Configuration Errors:</p>
            <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
              {health.config.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {health.config.warnings.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-900 mb-2">Warnings:</p>
            <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
              {health.config.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Last checked: {new Date(health.timestamp).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}

