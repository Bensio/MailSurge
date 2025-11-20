import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function Setup() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const hasSupabase = supabaseUrl && 
    supabaseUrl !== 'https://placeholder.supabase.co' && 
    supabaseKey && 
    supabaseKey !== 'placeholder-anon-key';
  
  const hasGoogle = googleClientId && googleClientId !== 'placeholder-client-id';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">MailSurge Setup</CardTitle>
          <CardDescription>
            Configure your environment variables to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 border rounded-lg">
              {hasSupabase ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Supabase Configuration</h3>
                {hasSupabase ? (
                  <p className="text-sm text-muted-foreground">
                    Supabase is configured ✓
                  </p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Create a <code className="bg-gray-100 px-1 rounded">.env</code> file in the root directory with:
                    </p>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
                    </pre>
                    <p className="text-muted-foreground">
                      Get these values from your Supabase project dashboard.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 border rounded-lg">
              {hasGoogle ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Google OAuth Configuration</h3>
                {hasGoogle ? (
                  <p className="text-sm text-muted-foreground">
                    Google OAuth is configured ✓
                  </p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Add to your <code className="bg-gray-100 px-1 rounded">.env</code> file:
                    </p>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback`}
                    </pre>
                    <p className="text-muted-foreground">
                      Get these from Google Cloud Console after setting up OAuth 2.0 credentials.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold mb-2 text-blue-900">Quick Start Guide</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Create a Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a></li>
              <li>Run the database migration from <code className="bg-blue-100 px-1 rounded">supabase/migrations/001_initial_schema.sql</code></li>
              <li>Copy your Supabase URL and anon key to <code className="bg-blue-100 px-1 rounded">.env</code></li>
              <li>Set up Google OAuth credentials (optional for now)</li>
              <li>Restart the dev server after adding environment variables</li>
            </ol>
          </div>

          {hasSupabase && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Configuration looks good! You can now <a href="/login" className="underline font-semibold">sign in</a> or <a href="/" className="underline font-semibold">go to dashboard</a>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




