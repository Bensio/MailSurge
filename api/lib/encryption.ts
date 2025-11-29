import crypto from 'crypto';

/**
 * Encryption utility for sensitive data (ESP API keys, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * Falls back to a default key if not set (for development only)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('[Encryption] ENCRYPTION_KEY not set, using default key (NOT SECURE FOR PRODUCTION)');
    // Use a default key for development - MUST be changed in production
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH);
  }
  
  // If key is provided, use it directly (should be 32 bytes/256 bits)
  // If it's a string, derive a key from it
  if (key.length === 64) {
    // Hex-encoded 32-byte key
    return Buffer.from(key, 'hex');
  } else {
    // Derive key from string using scrypt
    return crypto.scryptSync(key, 'mailsurge-encryption-salt', KEY_LENGTH);
  }
}

/**
 * Encrypt sensitive data (e.g., ESP API keys)
 */
export function encrypt(text: string): string {
  if (!text) {
    return text;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Combine iv + tag + encrypted data
    // Format: iv(hex):tag(hex):encrypted(hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption] Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, tagHex, encrypted] = parts;
    
    if (!ivHex || !tagHex || !encrypted) {
      throw new Error('Invalid encrypted data format - missing parts');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted1 = decipher.update(encrypted, 'hex', 'utf8');
    const decrypted2 = decipher.final('utf8');

    return decrypted1 + decrypted2;
  } catch (error) {
    console.error('[Encryption] Error decrypting data:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string is encrypted (has the expected format)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3 && 
         parts[0]?.length === IV_LENGTH * 2 && 
         parts[1]?.length === TAG_LENGTH * 2;
}

