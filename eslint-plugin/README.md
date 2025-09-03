# eslint-plugin-baseline

ESLint plugin to detect non-baseline web features that may not be supported across browsers.

## Installation

```bash
npm install eslint-plugin-baseline --save-dev
```

## Usage

Add `baseline` to your ESLint plugins list and configure the rule:

```json
{
  "plugins": ["baseline"],
  "rules": {
    "baseline/no-nonbaseline": "warn"
  }
}
```

Or use the recommended config:

```json
{
  "extends": ["plugin:baseline/recommended"]
}
```

## Rule: no-nonbaseline

Detects usage of web features that are not baseline-safe.

### Options

```json
{
  "baseline/no-nonbaseline": ["warn", {
    "apiEndpoint": "http://localhost:3000",
    "severity": "unsafe"
  }]
}
```

- `apiEndpoint`: API endpoint to check feature safety (default: "http://localhost:3000")
- `severity`: Which features to report ("unsafe", "caution", "all") (default: "unsafe")

### Detected Features

- `Array.prototype.at()`
- `String.prototype.replaceAll()`
- `Promise.allSettled()`
- `AbortController`
- `ResizeObserver`
- `navigator.clipboard.writeText()`
- CSS `:has()` selector in strings

## Examples

### ❌ Incorrect

```javascript
// Array.at() - not baseline safe
const item = array.at(-1);

// String.replaceAll() - not baseline safe  
const clean = text.replaceAll("old", "new");

// Promise.allSettled() - not baseline safe
Promise.allSettled([task1(), task2()]);

// AbortController - not baseline safe
const controller = new AbortController();

// ResizeObserver - not baseline safe
const observer = new ResizeObserver(() => {});

// navigator.clipboard - not baseline safe
navigator.clipboard.writeText("text");

// CSS :has() selector - not baseline safe
const css = `.card:has(img) { border: 1px solid red; }`;
```

### ✅ Correct

Use baseline-safe alternatives or polyfills:

```javascript
// Instead of array.at(-1)
const item = array[array.length - 1];

// Instead of replaceAll()
const clean = text.replace(/old/g, "new");

// Instead of Promise.allSettled()
// Use a polyfill or Promise.all() with proper error handling
```

## Configuration

The plugin requires a running Baseline API server to check feature safety. Start your API server:

```bash
node server.js
```

The ESLint rule will query the API to determine if detected features are baseline-safe.