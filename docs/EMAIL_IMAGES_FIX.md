# Email Images Not Displaying - Fix Guide

## The Problem

When you add images to campaigns using the email editor, recipients don't see them - they see broken image placeholders or gray boxes.

## Why This Happens

Email clients require images to use **absolute URLs** (full URLs starting with `http://` or `https://`). They cannot load:
- ❌ Relative URLs (`/images/logo.png`)
- ❌ Localhost URLs (`http://localhost:3000/image.png`)
- ❌ File paths (`./images/logo.png`)

## How Images Work in Email Editor

The Unlayer email editor (react-email-editor) handles images in several ways:

1. **Stock Images**: Uses Unlayer's CDN - these should work automatically
2. **Uploaded Images**: Can be uploaded to Unlayer's CDN or your own
3. **External URLs**: If you paste an image URL, it uses that URL directly

## The Solution

We've added automatic image URL processing that:
- ✅ Converts relative URLs to absolute URLs
- ✅ Processes both `<img>` tags and CSS `background-image` properties
- ✅ Preserves data URIs (base64 images)
- ✅ Uses your production domain for relative paths

## How It Works

When emails are sent, the system:
1. Scans the HTML for image URLs
2. Converts relative URLs to absolute URLs using your base domain
3. Leaves absolute URLs unchanged (already correct)
4. Preserves data URIs (base64 encoded images)

## Setting Up Image URLs

### Option 1: Use Unlayer Stock Images (Recommended)

1. In the email editor, click the image icon
2. Select "Stock Images" tab
3. Choose an image from Unlayer's library
4. ✅ These images use absolute URLs automatically

### Option 2: Use External Image URLs

1. Find an image online (or upload to an image hosting service)
2. Get the direct image URL (e.g., `https://example.com/image.jpg`)
3. In the email editor, click image icon → "By URL"
4. Paste the full URL
5. ✅ Absolute URLs work automatically

### Option 3: Host Images Yourself

1. Upload images to a public hosting service:
   - **Supabase Storage** (recommended - free tier available)
   - **Cloudinary** (free tier available)
   - **Imgur** (free, simple)
   - **GitHub** (free, use raw.githubusercontent.com URLs)
   - **Vercel** (if you add a public folder)

2. Get the public URL of your image
3. Use that URL in the email editor

## Example: Using Supabase Storage

1. **Upload image to Supabase Storage**:
   ```sql
   -- Create a storage bucket (one-time setup)
   -- In Supabase Dashboard → Storage → Create bucket "email-images"
   -- Set to public
   ```

2. **Upload via API or Dashboard**:
   - Go to Supabase Dashboard → Storage → email-images
   - Upload your image
   - Copy the public URL (e.g., `https://your-project.supabase.co/storage/v1/object/public/email-images/logo.png`)

3. **Use in email editor**:
   - Click image icon → "By URL"
   - Paste the Supabase Storage URL
   - ✅ Image will display in emails

## Testing Images

### Method 1: Test Send

1. Create a campaign with images
2. Click "Test Send"
3. Open the test email
4. Check if images load
5. If not, check the email source (Gmail → "Show original")
6. Look for image URLs - they should all start with `https://`

### Method 2: Check Email Source

1. Send a test email
2. In Gmail, click three dots → "Show original"
3. Search for `<img` tags
4. Check the `src` attribute - should be absolute URL
5. Try opening the URL in a browser - should show the image

## Common Issues

### Issue 1: Images Still Not Showing

**Possible causes**:
- Images are blocked by email client (Gmail default behavior)
- Image URLs are still relative (check email source)
- Image hosting service blocks hotlinking
- Image URL is incorrect

**Fix**:
1. Check email source for image URLs
2. Verify URLs are absolute (start with `https://`)
3. Test URLs in browser - should load directly
4. Ensure image hosting allows hotlinking

### Issue 2: Unlayer Stock Images Not Working

**Possible causes**:
- Unlayer CDN might be blocked
- Network/firewall issues
- Unlayer API key issues

**Fix**:
- Try using external image URLs instead
- Or host images yourself

### Issue 3: Relative URLs Still in Email

**Possible causes**:
- Image processing didn't run
- Base URL not set correctly
- Image added after processing

**Fix**:
1. Set `TRACKING_BASE_URL` environment variable in Vercel
2. Ensure it's your production domain
3. Redeploy

## Environment Variable

Set this in Vercel Dashboard → Settings → Environment Variables:

```
TRACKING_BASE_URL=https://your-production-domain.com
```

This is used for:
- Converting relative image URLs to absolute
- Tracking pixel URLs
- Any other relative URL processing

## Best Practices

1. **Use absolute URLs**: Always use full `https://` URLs for images
2. **Host images publicly**: Use a CDN or public storage
3. **Optimize images**: Compress images before uploading (smaller = faster)
4. **Test before sending**: Always test send to verify images work
5. **Have fallbacks**: Consider alt text for images that don't load

## Quick Checklist

- [ ] Images use absolute URLs (check email source)
- [ ] Image URLs work when opened in browser
- [ ] `TRACKING_BASE_URL` is set in Vercel
- [ ] Test email shows images correctly
- [ ] Recipients have images enabled in their email client

## Future Improvements

Potential enhancements:
- Image upload API endpoint (upload to Supabase Storage)
- Automatic image optimization
- Image CDN integration
- Image library management
- Automatic fallback images

