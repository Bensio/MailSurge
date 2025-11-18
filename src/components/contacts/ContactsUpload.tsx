import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseCSV, validateEmail } from '@/lib/utils';
import { ContactSchema } from '@/lib/validations';
import { supabase } from '@/lib/supabase';
import { Upload } from 'lucide-react';

interface ContactsUploadProps {
  campaignId: string; // Empty string means library (no campaign)
  onUploadComplete: () => void;
}

export function ContactsUpload({ campaignId, onUploadComplete }: ContactsUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('CSV file is empty or invalid');
      }

      // Validate CSV has required columns (case-insensitive)
      const requiredColumns = ['email', 'company'];
      const firstRow = rows[0];
      if (!firstRow) {
        throw new Error('CSV file is empty or invalid');
      }
      const headers = Object.keys(firstRow);
      const headersLower = headers.map(h => h.toLowerCase());
      const missingColumns = requiredColumns.filter((col) => !headersLower.includes(col.toLowerCase()));

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      // Helper function to get value by case-insensitive key
      const getValue = (row: Record<string, string>, key: string): string | undefined => {
        const lowerKey = key.toLowerCase();
        const actualKey = headers.find(h => h.toLowerCase() === lowerKey);
        return actualKey ? row[actualKey] : undefined;
      };

      // Validate and transform contacts
      const contacts = rows.map((row) => {
        const email = getValue(row, 'email')?.trim();
        const company = getValue(row, 'company')?.trim();

        if (!email || !validateEmail(email)) {
          throw new Error(`Invalid email: ${email}`);
        }

        if (!company) {
          throw new Error(`Missing company for email: ${email}`);
        }

        const customFields: Record<string, string> = {};
        Object.keys(row).forEach((key) => {
          const lowerKey = key.toLowerCase();
          if (lowerKey !== 'email' && lowerKey !== 'company') {
            customFields[key] = row[key] || '';
          }
        });

        return ContactSchema.parse({
          email,
          company,
          custom_fields: customFields,
        });
      });

      // Upload to API
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/contacts/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaignId || undefined, // Send undefined if empty string
          contacts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.details || 'Failed to upload contacts';
        // Error is already handled by alert above
        throw new Error(errorMessage);
      }

      onUploadComplete();
      setFile(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload contacts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Contacts</CardTitle>
        <CardDescription>
          Upload a CSV file with email and company columns. Additional columns will be saved as custom fields.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">CSV File</Label>
          <Input
            id="file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        <Button onClick={handleUpload} disabled={!file || loading}>
          <Upload className="mr-2 h-4 w-4" />
          {loading ? 'Uploading...' : 'Upload Contacts'}
        </Button>
      </CardContent>
    </Card>
  );
}

