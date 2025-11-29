import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Mail, Database, Send, Info } from 'lucide-react';

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
          // Try to get error details from response
          let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorDetails = errorData.error;
            } else if (errorData.errors && errorData.errors.length > 0) {
              errorDetails = errorData.errors.join(', ');
            }
          } catch {
            // If response isn't JSON, use status text
          }
          throw new Error(errorDetails);
        }
        
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch system status';
        console.error('[SystemStatus] Health check error:', err);
        setError(errorMessage);
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

  // Filter out non-critical warnings for cleaner display
  const criticalWarnings = health.config.warnings.filter(w => 
    !w.includes('TRACKING_BASE_URL') && !w.includes('NEXT_PUBLIC_APP_URL')
  );
  const trackingWarning = health.config.warnings.find(w => 
    w.includes('TRACKING_BASE_URL') || w.includes('NEXT_PUBLIC_APP_URL')
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Current system configuration and health</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="font-medium text-sm">{getStatusText()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email Method</span>
            </div>
            <span className="text-sm text-muted-foreground">{getEmailMethodText()}</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Database</span>
            </div>
            {health.services.supabase === 'ok' ? (
              <span className="text-sm text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            ) : (
              <span className="text-sm text-red-600 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Error
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email Service</span>
            </div>
            {health.services.email === 'ok' ? (
              <span className="text-sm text-green-600 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready
              </span>
            ) : health.services.email === 'warning' ? (
              <span className="text-sm text-yellow-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warning
              </span>
            ) : (
              <span className="text-sm text-red-600 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Error
              </span>
            )}
          </div>
        </div>

        {/* Critical Errors */}
        {health.config.errors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm font-medium text-red-900">Configuration Errors</p>
            </div>
            <ul className="text-xs text-red-800 space-y-1 ml-6">
              {health.config.errors.map((err, i) => (
                <li key={i} className="list-disc">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Critical Warnings */}
        {criticalWarnings.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-900">Warnings</p>
            </div>
            <ul className="text-xs text-yellow-800 space-y-1 ml-6">
              {criticalWarnings.map((warn, i) => (
                <li key={i} className="list-disc">{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tracking URL Info (non-critical, shown as info) */}
        {trackingWarning && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-900 mb-1">Email Tracking</p>
                <p className="text-xs text-blue-800">
                  Tracking URL not configured. Email opens will still be tracked, but tracking pixel URLs may use a default domain.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

