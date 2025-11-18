# Deployment Strategy: Development vs Production

## Quick Answer

**No, don't fork to a separate repository.** Instead, use a **branching strategy**:

- `main` branch → Production (deployed to your custom domain)
- `develop` branch → Development (your working branch)

## Why This Approach?

### ✅ Advantages

1. **Single Source of Truth**: One repository, easier to maintain
2. **Easy Sync**: Changes flow naturally from dev → prod
3. **Vercel Integration**: Auto-deploy from `main` branch
4. **Standard Practice**: Industry-standard Git workflow
5. **Preview Deployments**: Test on preview URLs before production

### ❌ Why Not Fork?

1. **Two Codebases**: Harder to keep in sync
2. **Complex Merges**: Changes need to be manually copied
3. **Deployment Complexity**: Need to configure two separate deployments
4. **Risk of Divergence**: Codebases can drift apart

---

## Recommended Setup

### Branch Structure

```
main (production)
  ↑
develop (development)
  ↑
feature/* (feature branches)
```

### Workflow

1. **Develop** on `develop` branch
2. **Test** thoroughly
3. **Merge** `develop` → `main` when ready
4. **Vercel** auto-deploys from `main` to production

---

## Step-by-Step Setup

### 1. Create Develop Branch

```bash
# Make sure you're on main
git checkout main
git pull origin main

# Create and switch to develop
git checkout -b develop
git push -u origin develop
```

### 2. Configure Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Set **Production Branch** to `main`
3. (Optional) Enable **Preview Deployments** for other branches

### 3. Set Environment Variables

**Production (main branch):**
```
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
VITE_GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

**Development (local .env):**
```
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

### 4. Daily Workflow

```bash
# Work on develop branch
git checkout develop
# ... make changes ...
git add .
git commit -m "feat: new feature"
git push origin develop

# When ready for production
git checkout main
git merge develop
git push origin main
# Vercel automatically deploys!
```

---

## Environment Configuration

### Same Code, Different Environments

The beauty of this approach: **same codebase, different configurations**

**Local Development:**
- Uses `.env` file
- `localhost:3000` for redirects
- Local Supabase (or same Supabase with dev data)

**Production (Vercel):**
- Environment variables in Vercel dashboard
- Custom domain for redirects
- Production Supabase

**No code changes needed** - just different environment variables!

---

## Deployment Flow

```
┌─────────────────────────────────┐
│  You work on 'develop' branch   │
│  - Make changes                 │
│  - Test locally                 │
│  - Commit & push                │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Merge 'develop' → 'main'       │
│  - Review changes               │
│  - Run tests                    │
│  - Merge when ready             │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Vercel detects 'main' update  │
│  - Builds project               │
│  - Deploys to production        │
│  - Your custom domain            │
└─────────────────────────────────┘
```

---

## Best Practices

### 1. Keep Main Stable

- ✅ Only merge tested code to `main`
- ✅ Use `develop` for experimentation
- ✅ Test before merging

### 2. Use Feature Branches

For major features:
```bash
git checkout develop
git checkout -b feature/big-feature
# ... work ...
git checkout develop
git merge feature/big-feature
```

### 3. Tag Releases

```bash
git checkout main
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

### 4. Preview Deployments

Vercel can create preview URLs for:
- `develop` branch
- Feature branches
- Pull requests

Great for testing before production!

---

## Migration Plan

If you're currently on `main` and want to set this up:

```bash
# 1. Create develop branch
git checkout -b develop
git push -u origin develop

# 2. Configure Vercel (via dashboard)
#    - Production branch: main
#    - Preview deployments: enabled

# 3. Continue development on develop
git checkout develop
# ... work normally ...

# 4. Deploy to production
git checkout main
git merge develop
git push origin main
```

---

## Common Questions

### Q: What if I need to hotfix production?

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug
# ... fix ...
git checkout main
git merge hotfix/critical-bug
git push origin main

# Also merge to develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop
```

### Q: Can I test before deploying to production?

Yes! Use Vercel preview deployments:
- Each branch gets a preview URL
- Test on preview before merging to `main`

### Q: What about database changes?

- Run migrations on production Supabase
- Keep migration files in `supabase/migrations/`
- Document migration order in README

### Q: How do I rollback if something breaks?

```bash
# Revert last commit on main
git checkout main
git revert HEAD
git push origin main
# Vercel redeploys automatically
```

---

## Summary

**Do:**
- ✅ Use `main` for production
- ✅ Use `develop` for development
- ✅ Use environment variables for configuration
- ✅ Merge `develop` → `main` when ready

**Don't:**
- ❌ Fork to separate repository
- ❌ Hardcode environment-specific values
- ❌ Deploy untested code to `main`

This gives you a clean, professional workflow that scales as your project grows!

