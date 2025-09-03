# Baseline Feature-Gate CDN Worker

A Cloudflare Worker that provides runtime feature gating based on browser baseline compatibility.

## Features

- **Runtime Feature Detection**: Check if web features are supported in the user's browser
- **Automatic Polyfill Loading**: Dynamically load polyfills for unsupported features
- **Edge Computing**: Fast responses from Cloudflare's global edge network
- **User Agent Parsing**: Accurate browser detection and version comparison
- **Caching**: Intelligent caching for better performance

## API Endpoints

### `GET /gate.js?features=feature1,feature2`

Returns a JavaScript file that:
- Checks feature support for the user's browser
- Loads necessary polyfills automatically
- Provides helper functions for feature detection

**Example:**
```html
<script src="https://your-worker.domain.com/gate.js?features=Array.prototype.at,ResizeObserver"></script>
<script>
  // Use the feature gate
  if (window.isFeatureSupported('Array.prototype.at')) {
    console.log(myArray.at(-1));
  }
  
  // Or require a feature with callback
  window.requireFeature('ResizeObserver', () => {
    const observer = new ResizeObserver(entries => {
      console.log('Element resized');
    });
  });
</script>
```

### `GET /check?feature=featureName`

Check if a single feature is supported in the current browser.

**Example:**
```javascript
fetch('/check?feature=Array.prototype.at')
  .then(r => r.json())
  .then(result => {
    console.log('Supported:', result.supported);
    console.log('Reason:', result.reason);
    if (result.polyfill) {
      console.log('Polyfill available:', result.polyfill);
    }
  });
```

### `POST /batch`

Check multiple features at once.

**Request:**
```json
{
  "features": ["Array.prototype.at", "String.prototype.replaceAll", "ResizeObserver"]
}
```

**Response:**
```json
{
  "userAgent": "Mozilla/5.0...",
  "results": {
    "Array.prototype.at": {
      "supported": false,
      "reason": "chrome 88 requires version 92 or higher",
      "polyfill": "https://polyfill.io/v3/polyfill.min.js?features=Array.prototype.at"
    },
    "ResizeObserver": {
      "supported": true,
      "reason": "chrome 88 supports this feature"
    }
  }
}
```

### `GET /polyfills?features=feature1,feature2`

Get polyfill URLs for unsupported features.

### `GET /` or `GET /health`

Health check and API documentation.

## Supported Features

- `Array.prototype.at`
- `String.prototype.replaceAll` 
- `Promise.allSettled`
- `ResizeObserver`
- `IntersectionObserver`
- `AbortController`
- `CSS.has` (CSS :has() selector)
- `navigator.clipboard.writeText`

## Deployment

### Cloudflare Workers

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler auth login
```

3. Deploy the worker:
```bash
wrangler publish
```

### Vercel Edge Functions

The worker can also be deployed to Vercel Edge Functions with minor modifications.

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
wrangler dev
```

3. Test endpoints:
```bash
curl "http://localhost:8787/check?feature=Array.prototype.at"
```

## Configuration

Update `FEATURE_COMPATIBILITY` in `worker.js` to add or modify feature support data:

```javascript
const FEATURE_COMPATIBILITY = {
  'new-feature': {
    chrome: '100',
    firefox: '95',
    safari: '15',
    edge: '100'
  }
};
```

Add polyfill URLs to `POLYFILLS`:

```javascript
const POLYFILLS = {
  'new-feature': 'https://cdn.jsdelivr.net/npm/new-feature-polyfill'
};
```

## Usage Examples

### Basic Feature Gate

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://your-worker.domain.com/gate.js?features=Array.prototype.at"></script>
</head>
<body>
  <script>
    // Feature gate will automatically load polyfill if needed
    const lastItem = myArray.at(-1);
  </script>
</body>
</html>
```

### Progressive Enhancement

```javascript
// Check feature support and enhance accordingly  
fetch('/check?feature=ResizeObserver')
  .then(r => r.json())
  .then(result => {
    if (result.supported) {
      // Use ResizeObserver
      setupResizeObserver();
    } else {
      // Fallback to window.resize
      setupWindowResize();
    }
  });
```

### Framework Integration

```javascript
// React hook example
function useFeatureSupport(feature) {
  const [isSupported, setIsSupported] = useState(null);
  
  useEffect(() => {
    fetch(`/check?feature=${feature}`)
      .then(r => r.json())
      .then(result => setIsSupported(result.supported));
  }, [feature]);
  
  return isSupported;
}
```

## Performance

- **Edge caching**: Responses cached at edge for 5 minutes to 1 hour
- **Minimal overhead**: User agent parsing is optimized for speed
- **Global distribution**: Runs on Cloudflare's global network

## License

MIT License