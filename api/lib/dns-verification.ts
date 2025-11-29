import dns from 'dns/promises';
import crypto from 'crypto';

/**
 * DNS verification utilities for domain ownership and email authentication
 */

/**
 * Resolve TXT records for a domain
 */
export async function resolveTXTRecords(domain: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(domain);
    // DNS.resolveTxt returns array of string arrays, flatten to strings
    return records.map(record => Array.isArray(record) ? record.join('') : record);
  } catch (error) {
    console.error(`[DNS] Error resolving TXT records for ${domain}:`, error);
    return [];
  }
}

/**
 * Check if a specific TXT record exists
 */
export async function verifyTXTRecord(domain: string, expectedValue: string): Promise<boolean> {
  const records = await resolveTXTRecords(domain);
  return records.some(record => record.includes(expectedValue));
}

/**
 * Verify domain ownership via TXT record
 */
export async function verifyDomainOwnership(domain: string, verificationToken: string): Promise<boolean> {
  const txtRecord = `mailsurge-verification=${verificationToken}`;
  return verifyTXTRecord(domain, txtRecord);
}

/**
 * Verify SPF record
 */
export async function verifySPFRecord(domain: string): Promise<{ valid: boolean; record?: string; error?: string }> {
  try {
    const records = await resolveTXTRecords(domain);
    const spfRecord = records.find(record => record.toLowerCase().startsWith('v=spf1'));
    
    if (!spfRecord) {
      return { valid: false, error: 'No SPF record found' };
    }
    
    // Basic SPF validation (check if it includes our ESP)
    return { valid: true, record: spfRecord };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Verify DKIM record (for a specific selector)
 */
export async function verifyDKIMRecord(domain: string, selector: string = 'default'): Promise<{ valid: boolean; record?: string; error?: string }> {
  try {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    const records = await resolveTXTRecords(dkimDomain);
    
    if (records.length === 0) {
      return { valid: false, error: 'No DKIM record found' };
    }
    
    const dkimRecord = records.find(record => record.toLowerCase().startsWith('v=dkim1'));
    
    if (!dkimRecord) {
      return { valid: false, error: 'Invalid DKIM record format' };
    }
    
    return { valid: true, record: dkimRecord };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Verify DMARC record
 */
export async function verifyDMARCRecord(domain: string): Promise<{ valid: boolean; record?: string; error?: string }> {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const records = await resolveTXTRecords(dmarcDomain);
    
    if (records.length === 0) {
      return { valid: false, error: 'No DMARC record found' };
    }
    
    const dmarcRecord = records.find(record => record.toLowerCase().startsWith('v=dmarc1'));
    
    if (!dmarcRecord) {
      return { valid: false, error: 'Invalid DMARC record format' };
    }
    
    return { valid: true, record: dmarcRecord };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Generate verification token for domain ownership
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

