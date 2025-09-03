// Test file for ESLint plugin

// Array.at() - should be flagged
const thirdItem = myArray.at(2);

// String.replaceAll() - should be flagged  
const clean = text.replaceAll("foo", "bar");

// Promise.allSettled() - should be flagged
Promise.allSettled([taskOne(), taskTwo()])
  .then(results => console.log(results));

// AbortController - should be flagged
const ctrl = new AbortController();

// ResizeObserver - should be flagged
const ro = new ResizeObserver(entries => {
  console.log(entries);
});

// navigator.clipboard - should be flagged
navigator.clipboard.writeText("Copied text");

// CSS :has() selector - should be flagged
const css = `
  .card:has(img) {
    border: 2px solid red;  
  }
`;

// Safe alternatives - should NOT be flagged
const item = array[array.length - 1]; // instead of at(-1)
const replaced = text.replace(/foo/g, "bar"); // instead of replaceAll
const promises = Promise.all([taskOne(), taskTwo()]); // instead of allSettled