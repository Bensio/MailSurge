/**
 * Process email HTML to ensure all images use absolute URLs
 * This is required for email clients to display images
 */

/**
 * Convert relative or localhost image URLs to absolute URLs
 * @param html - Email HTML content
 * @param baseUrl - Base URL for the application
 * @returns HTML with all image URLs converted to absolute
 */
export function processEmailImages(html: string, baseUrl: string): string {
  // Ensure baseUrl doesn't have trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  // Process img tags with src attributes
  html = html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi,
    (match, before, src, after) => {
      // Skip if already absolute URL (starts with http:// or https://)
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return match; // Already absolute, no change needed
      }

      // Skip data URIs (base64 encoded images)
      if (src.startsWith('data:')) {
        return match; // Data URI, keep as is
      }

      // Convert relative URLs to absolute
      let absoluteUrl = src;

      // If it's a relative path (starts with /), prepend baseUrl
      if (src.startsWith('/')) {
        absoluteUrl = `${baseUrl}${src}`;
      }
      // If it's a relative path without leading slash, it might be a local file
      // For now, we'll assume it needs to be hosted - log a warning
      else if (!src.includes('://')) {
        // This is a relative path - might need to be uploaded to a CDN
        // For now, try to make it absolute relative to baseUrl
        absoluteUrl = `${baseUrl}/${src}`;
        console.warn(`[Image Processing] Relative image URL found: ${src}. Converted to: ${absoluteUrl}`);
      }

      return `<img${before} src="${absoluteUrl}"${after}>`;
    }
  );

  // Process background-image in style attributes
  html = html.replace(
    /style=["']([^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)[^"']*)["']/gi,
    (match, styleContent, imageUrl) => {
      // Skip if already absolute URL
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return match;
      }

      // Skip data URIs
      if (imageUrl.startsWith('data:')) {
        return match;
      }

      // Convert to absolute URL
      let absoluteUrl = imageUrl;
      if (imageUrl.startsWith('/')) {
        absoluteUrl = `${baseUrl}${imageUrl}`;
      } else if (!imageUrl.includes('://')) {
        absoluteUrl = `${baseUrl}/${imageUrl}`;
        console.warn(`[Image Processing] Relative background-image URL found: ${imageUrl}`);
      }

      // Reconstruct the style attribute
      const newStyle = styleContent.replace(
        imageUrl,
        absoluteUrl
      );
      return `style="${newStyle}"`;
    }
  );

  return html;
}

/**
 * Extract all image URLs from HTML
 * Useful for validation or preloading
 */
export function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  
  // Extract from img src
  const imgMatches = html.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi);
  for (const match of imgMatches) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.push(match[1]);
    }
  }

  // Extract from background-image
  const bgMatches = html.matchAll(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi);
  for (const match of bgMatches) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.push(match[1]);
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Validate that all images use absolute URLs
 * Returns array of relative URLs that need to be fixed
 */
export function validateImageUrls(html: string): string[] {
  const relativeUrls: string[] = [];
  const imageUrls = extractImageUrls(html);

  for (const url of imageUrls) {
    // Check if it's a relative URL (not absolute, not data URI)
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      relativeUrls.push(url);
    }
  }

  return relativeUrls;
}

