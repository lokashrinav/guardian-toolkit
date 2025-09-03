# Baseline Hackathon - Usage Examples

This document shows real-world examples of how the Week 3-4 AI Completions & Rewrite system works.

## 🎯 VS Code Extension in Action

### Inline Warnings

When you type unsafe features, the extension shows warnings:

```javascript
// This will show a red squiggle under "replaceAll"
const result = text.replaceAll("old", "new"); // ❌ String.replaceAll() has limited support

// Hover shows: "Consider using str.replace(new RegExp('old', 'g'), 'new') for broader compatibility"
```

### Hover Information

Hover over web features to see Baseline data:

```css
.container {
  container-type: inline-size; /* 💡 Hover shows: "✅ Container queries are Baseline high since 2025-08-14" */
}
```

### Auto-Rewrite Suggestions

Right-click on unsafe features → "Rewrite Unsafe Features":

**Before:**
```javascript
async function fetchUserData() {
  const response = await fetch("/api/users");
  const users = await response.json();
  return users.map(u => u.name.replaceAll(" ", "_"));
}
```

**After:**
```javascript
async function fetchUserData() {
  // Feature availability check added
  if (typeof fetch === "undefined") {
    throw new Error("fetch not supported - use polyfill");
  }
  
  const response = await fetch("/api/users");
  const users = await response.json();
  // Global regex replacement for broader compatibility
  return users.map(u => u.name.replace(new RegExp(" ", "g"), "_"));
}
```

## 🔧 Codemod Tool Examples

### Analyzing a Project

```bash
$ baseline-codemod analyze "src/**/*.{js,jsx,ts,tsx,css}"

⚠️  src/components/UserProfile.jsx:
   ❌ Line 15: string-replaceall (unsafe)
      String.replaceAll() has limited support - not baseline safe
   ⚠️ Line 23: fetch (caution)
      Fetch API should include availability check for older browsers

⚠️  src/styles/layout.css:
   ⚠️ Line 8: has-selector (caution)
      :has() selector has low baseline support - consider JavaScript alternative

📊 Analysis Summary:
   Files analyzed: 45
   Files with issues: 3
   Total issues: 5
   Unsafe features: 2
   Features needing caution: 3
```

### Transforming Code

```bash
$ baseline-codemod transform "src/**/*.js" --dry-run

🔍 Found 15 files to analyze
✅ src/api/client.js: 2 transformations
   → fetch: Added fetch availability check
   → string-replaceall: Replaced replaceAll with global regex replace
✅ src/utils/helpers.js: 1 transformations
   → promise-allsettled: Added Promise.allSettled polyfill

📊 Summary:
   Files processed: 15
   Files modified: 2
   Total transformations: 3
   (Dry run - no files were actually modified)

$ baseline-codemod transform "src/**/*.js"
# Applies the transformations
```

### Generated Transformations

**Input File (src/api/client.js):**
```javascript
export async function fetchUsers() {
  const response = await fetch("/api/users");
  return response.json();
}

export function sanitizeName(name) {
  return name.replaceAll(" ", "-").toLowerCase();
}

export async function batchRequest(urls) {
  const promises = urls.map(url => fetch(url));
  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === 'fulfilled');
}
```

**Output File (after transformation):**
```javascript
export async function fetchUsers() {
  // Baseline safety: Added fetch availability check
  if (typeof fetch === "undefined") {
    throw new Error("fetch not supported - consider using a polyfill");
  }
  const response = await fetch("/api/users");
  return response.json();
}

export function sanitizeName(name) {
  // Baseline safety: Use global regex instead of replaceAll
  return name.replace(new RegExp(" ", "g"), "-").toLowerCase();
}

export async function batchRequest(urls) {
  const promises = urls.map(url => fetch(url));
  // Baseline safety: Added Promise.allSettled polyfill
  const results = await (Promise.allSettled || ((promises) => Promise.all(
    promises.map(p => p.then(value => ({status: 'fulfilled', value}), reason => ({status: 'rejected', reason})))
  )))(promises);
  return results.filter(r => r.status === 'fulfilled');
}
```

## 🤖 PR Review Bot Examples

### PR Review Comment

When a developer opens a PR with unsafe features:

**PR Changes:**
```diff
+ async function loadData() {
+   const response = await fetch("/api/data");
+   return response.json();
+ }
+ 
+ function updateText(element, oldText, newText) {
+   element.innerHTML = element.innerHTML.replaceAll(oldText, newText);
+ }
```

**AI-Generated Review:**

> ## 🛡️ Baseline Compatibility Review
> 
> ⚠️ **2 features needing caution** - consider adding fallbacks
> 
> ### Summary by Feature:
> - ⚠️ **fetch**: 1 occurrence
> - ❌ **string-replaceall**: 1 occurrence
> 
> **Comments:**
> 
> ---
> 
> **📄 src/api/client.js:15**
> 
> ⚠️ **Fetch API Usage Detected**
> 
> The Fetch API has excellent modern browser support but may need a polyfill or fallback for older environments. Consider adding a feature detection check:
> 
> ```javascript
> async function loadData() {
>   if (typeof fetch === "undefined") {
>     // Fallback to XMLHttpRequest or use a fetch polyfill
>     throw new Error("fetch not supported");
>   }
>   const response = await fetch("/api/data");
>   return response.json();
> }
> ```
> 
> **Browser Support:**
> - Chrome: 42+ ✅
> - Firefox: 39+ ✅  
> - Safari: 10.1+ ✅
> - Edge: 14+ ✅
> 
> *🤖 Generated by Baseline PR Review Bot*
> 
> ---
> 
> **📄 src/utils/dom.js:23**
> 
> ❌ **String.replaceAll() Compatibility Issue**
> 
> String.replaceAll() has limited browser support and is not yet Baseline. This could cause runtime errors in older browsers.
> 
> **Suggested Fix:**
> ```javascript
> function updateText(element, oldText, newText) {
>   // Use global regex replacement for universal support
>   element.innerHTML = element.innerHTML.replace(new RegExp(oldText, 'g'), newText);
> }
> ```
> 
> **Why:** Global regex replacement works in all JavaScript environments while maintaining the same functionality.
> 
> *🤖 Generated by Baseline PR Review Bot*
> 
> ---
> 
> 💡 **Tips:**
> - Features marked as "unsafe" lack Baseline support and may break in older browsers
> - Features marked as "caution" have limited Baseline support - consider progressive enhancement
> - Check [web.dev/baseline](https://web.dev/baseline) for the latest compatibility information
> 
> *🤖 Review generated by Baseline PR Review Bot powered by AI and real Baseline data*

### Manual Review Trigger

```bash
# Trigger manual review
curl -X POST "https://your-bot.com/review/owner/repo/123"

{
  "success": true,
  "message": "Review completed", 
  "result": {
    "reviewsPosted": 1,
    "issuesFound": 3,
    "suggestions": 2
  }
}
```

## 📊 Analytics Dashboard (Mock)

Future dashboard showing organization-wide Baseline compliance:

```
📈 Baseline Compliance Dashboard

Project Health:
┌─────────────────┬─────────────┬─────────────┬──────────────┐
│ Project         │ Safety Score│ Issues Found│ Last Scanned │
├─────────────────┼─────────────┼─────────────┼──────────────┤
│ frontend-app    │     85%     │     12      │  2 hrs ago   │
│ api-server      │     92%     │      5      │  1 day ago   │
│ mobile-web      │     78%     │     18      │  4 hrs ago   │
└─────────────────┴─────────────┴─────────────┴──────────────┘

Top Unsafe Features:
1. string-replaceall: 23 occurrences across 8 files
2. has-selector: 15 occurrences across 5 files  
3. subgrid: 8 occurrences across 3 files

Trending Safer:
- fetch usage: +15% (with proper checks)
- css-grid adoption: +25% (with flexbox fallbacks)
- container-queries: +40% (recently became Baseline!)
```

## 🔄 Complete Workflow Example

### Day in the Life: React Developer

1. **Morning: Writing new component**
   ```jsx
   // VS Code shows inline warning as you type
   function UserCard({ user }) {
     const initials = user.name.replaceAll(" ", ""); // ❌ Red squiggle appears
     // Hover shows: "Use .replace(new RegExp(' ', 'g'), '') instead"
     
     return <div>{initials}</div>;
   }
   ```

2. **Auto-fix with right-click**
   ```jsx
   // After "Rewrite Unsafe Features"
   function UserCard({ user }) {
     const initials = user.name.replace(new RegExp(" ", "g"), "");
     return <div>{initials}</div>;
   }
   ```

3. **Before PR: Run codemod on whole project**
   ```bash
   $ baseline-codemod analyze "src/**/*"
   # Finds 5 more issues in other files
   
   $ baseline-codemod transform "src/**/*" --dry-run
   # Shows what would be changed
   
   $ baseline-codemod transform "src/**/*"
   # Fixes all remaining issues
   ```

4. **Create PR: Bot automatically reviews**
   - Bot detects the fixed issues ✅
   - Comments on any remaining concerns 
   - Approves PR if all features are Baseline-safe
   - Provides educational context for team

5. **Team learns**: Other developers see the review comments and learn about Baseline compatibility

## 🎓 Educational Impact

The system teaches developers about:

- **Modern web standards** through real-world feedback
- **Progressive enhancement** patterns  
- **Browser compatibility** without memorizing support tables
- **Performance implications** of polyfills vs. native features
- **When to use new features** based on actual Baseline data

**Result**: Teams naturally adopt safer, more compatible coding practices while staying up-to-date with web platform evolution.

---

These examples show how the AI Completions & Rewrite system creates a seamless, educational developer experience that makes Baseline compatibility a natural part of the coding workflow.