# Git Workflow for Development vs Production

## Recommended Approach: Branching Strategy (Not Forking)

**TL;DR**: Use separate branches (`main` for production, `develop` for development) in the same repository. Don't fork to a separate repo.

## Why Branching Instead of Forking?

✅ **Advantages of Branching:**
- Single source of truth
- Easy to merge changes between dev and prod
- Simpler deployment (Vercel can auto-deploy from specific branch)
- Easier to maintain and sync
- Standard industry practice

❌ **Disadvantages of Forking:**
- Two separate codebases to maintain
- Harder to sync changes
- More complex deployment setup
- Risk of codebases diverging

---

## Recommended Git Workflow

### Option 1: Simple Two-Branch Strategy (Recommended for Small Teams)

```
main (production) ← Deploy to Vercel
  ↑
develop (development) ← Your working branch
```

**Workflow:**
1. **Development**: Work on `develop` branch
2. **Testing**: Test thoroughly on `develop`
3. **Production**: Merge `develop` → `main` when ready
4. **Deployment**: Vercel auto-deploys from `main` branch

**Setup:**
```bash
# Create develop branch from current main
git checkout -b develop
git push -u origin develop

# Set up Vercel to deploy from 'main' branch
# (Configure in Vercel dashboard → Settings → Git)
```

**Daily Workflow:**
```bash
# Start working on a feature
git checkout develop
git pull origin develop

# Make changes, commit
git add .
git commit -m "feat: add new feature"
git push origin develop

# When ready for production
git checkout main
git merge develop
git push origin main
# Vercel automatically deploys
```

---

### Option 2: Git Flow (For More Complex Projects)

```
main (production)
  ↑
release/v1.0.1 (release candidate)
  ↑
develop (integration)
  ↑
feature/new-feature (feature branches)
```

**Branches:**
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `release/*`: Release preparation branches
- `hotfix/*`: Emergency production fixes

**Workflow:**
```bash
# Feature development
git checkout develop
git checkout -b feature/new-campaign-type
# ... make changes ...
git commit -m "feat: add new campaign type"
git checkout develop
git merge feature/new-campaign-type

# Release preparation
git checkout -b release/v0.2.0
# ... final testing, version bumps ...
git checkout main
git merge release/v0.2.0
git tag v0.2.0

# Hotfix (emergency production fix)
git checkout main
git checkout -b hotfix/critical-bug
# ... fix bug ...
git checkout main
git merge hotfix/critical-bug
git checkout develop
git merge hotfix/critical-bug
```

---

## Setting Up Your Workflow

### Step 1: Create Develop Branch

```bash
# Make sure you're on main and it's up to date
git checkout main
git pull origin main

# Create develop branch
git checkout -b develop

# Push develop branch
git push -u origin develop
```

### Step 2: Configure Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Git
2. Set **Production Branch** to `main`
3. (Optional) Set up preview deployments for `develop` branch

### Step 3: Set Up Environment Variables

**In Vercel:**
- **Production** (main branch): Use production environment variables
- **Preview** (develop branch): Can use same or different variables for testing

**Production Variables:**
```
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
VITE_GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

**Development Variables (optional preview):**
```
GOOGLE_REDIRECT_URI=https://your-preview-url.vercel.app/api/auth/callback
VITE_GOOGLE_REDIRECT_URI=https://your-preview-url.vercel.app/api/auth/callback
```

---

## Environment-Specific Configuration

### Using Environment Variables (Recommended)

**Same codebase, different environments:**

```env
# .env.development (local)
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Vercel Production (main branch)
VITE_GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/callback

# Vercel Preview (develop branch) - optional
VITE_GOOGLE_REDIRECT_URI=https://your-preview.vercel.app/api/auth/callback
```

**No code changes needed** - just different environment variables!

---

## Deployment Strategy

### Current Setup (Recommended)

```
┌─────────────────┐
│  GitHub Repo    │
│                 │
│  main (prod)    │───┐
│  develop (dev)  │   │
└─────────────────┘   │
                      │
                      ▼
              ┌──────────────┐
              │   Vercel      │
              │               │
              │ Auto-deploy   │
              │ from 'main'   │
              └──────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Production   │
              │ your-domain  │
              │    .com      │
              └──────────────┘
```

### With Preview Deployments

```
main branch    → Production (your-domain.com)
develop branch → Preview (develop-your-app.vercel.app)
feature/*      → Preview (feature-name-your-app.vercel.app)
```

---

## Best Practices

### 1. Keep Main Branch Stable

- ✅ Only merge tested, working code to `main`
- ✅ Use `develop` for experimentation
- ✅ Test thoroughly before merging to `main`

### 2. Use Feature Branches for Big Changes

```bash
# For major features
git checkout develop
git checkout -b feature/major-refactor
# ... work on feature ...
git checkout develop
git merge feature/major-refactor
# Test on develop
# Then merge to main when ready
```

### 3. Tag Releases

```bash
# After merging to main
git checkout main
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

### 4. Use Pull Requests (If Using GitHub)

- Create PR from `develop` → `main`
- Review changes before merging
- Add tests/checklist to PR template

---

## Quick Reference Commands

### Daily Development
```bash
# Start working
git checkout develop
git pull origin develop

# Make changes and commit
git add .
git commit -m "feat: description"
git push origin develop
```

### Deploy to Production
```bash
# Merge develop to main
git checkout main
git pull origin main
git merge develop
git push origin main

# Vercel auto-deploys
```

### Create Feature Branch
```bash
git checkout develop
git checkout -b feature/feature-name
# ... work ...
git push -u origin feature/feature-name
```

### Emergency Hotfix
```bash
git checkout main
git checkout -b hotfix/critical-fix
# ... fix ...
git checkout main
git merge hotfix/critical-fix
git push origin main
git checkout develop
git merge hotfix/critical-fix
```

---

## Migration from Single Branch

If you're currently on `main` and want to set up this workflow:

```bash
# 1. Create develop branch from current main
git checkout -b develop
git push -u origin develop

# 2. Configure Vercel to deploy from 'main'

# 3. Continue development on 'develop'
git checkout develop
# ... make changes ...

# 4. When ready, merge to main
git checkout main
git merge develop
git push origin main
```

---

## Alternative: Single Branch with Feature Flags

If you prefer to stay on a single branch:

- Use feature flags to enable/disable features
- Use environment variables to control behavior
- Deploy everything, but toggle features via config

**Not recommended** for your use case, as branching is cleaner.

---

## Summary

**Recommended Setup:**
1. ✅ Keep single repository
2. ✅ Use `main` branch for production
3. ✅ Use `develop` branch for development
4. ✅ Configure Vercel to auto-deploy from `main`
5. ✅ Use environment variables for dev/prod differences
6. ✅ Merge `develop` → `main` when ready to deploy

**Don't:**
- ❌ Fork to separate repository
- ❌ Use separate codebases
- ❌ Hardcode environment-specific values

This approach gives you:
- Clean separation of dev/prod
- Easy deployment workflow
- Ability to test before production
- Standard industry practice

