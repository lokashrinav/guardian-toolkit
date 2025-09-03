// Sample code to test codemod transformations
const data = fetch('/api/data');
const text = 'hello world';
const result = text.replaceAll('o', '0');

// CSS Grid usage
const styles = `
  .container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
`;

console.log('Testing codemod transforms');