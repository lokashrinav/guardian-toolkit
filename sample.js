// sample.js
// This file packs several new APIs that older browsers may not support

// 1. Array at
const thirdItem = myArray.at(2);

// 2. String replaceAll
const clean = text.replaceAll("foo", "bar");

// 3. Promise allSettled
Promise.allSettled([taskOne(), taskTwo()])
  .then(results => console.log(results));

// 4. Fetch without feature check
fetch("/api/data")
  .then(r => r.json())
  .then(console.log);

// 5. AbortController
const ctrl = new AbortController();
fetch("/slow", { signal: ctrl.signal });
setTimeout(() => ctrl.abort(), 3000);

// 6. Clipboard writeText
navigator.clipboard.writeText("Copied text");

// 7. ResizeObserver
const ro = new ResizeObserver(entries => {
  for (const entry of entries) {
    console.log(entry.contentRect.width);
  }
});
ro.observe(document.body);

// 8. CSS has selector inside JS template string
const css = `
  .card:has(img) {
    border: 2px solid red;
  }
`;
document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);