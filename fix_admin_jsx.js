// Script to help fix the JSX structure in AdminPage.tsx
// This will help identify the exact structural issues

const fs = require('fs');

const content = fs.readFileSync('client/src/pages/AdminPage.tsx', 'utf8');
const lines = content.split('\n');

console.log('Analyzing JSX structure...');

let tabsOpening = 0;
let tabsClosing = 0;
let tabsContentOpening = 0;
let tabsContentClosing = 0;

lines.forEach((line, index) => {
  if (line.includes('<Tabs ') || line.includes('<Tabs>')) {
    tabsOpening++;
    console.log(`Line ${index + 1}: Opening <Tabs>`);
  }
  if (line.includes('</Tabs>')) {
    tabsClosing++;
    console.log(`Line ${index + 1}: Closing </Tabs>`);
  }
  if (line.includes('<TabsContent')) {
    tabsContentOpening++;
    console.log(`Line ${index + 1}: Opening <TabsContent>`);
  }
  if (line.includes('</TabsContent>')) {
    tabsContentClosing++;
    console.log(`Line ${index + 1}: Closing </TabsContent>`);
  }
});

console.log('\nSummary:');
console.log(`<Tabs> opening: ${tabsOpening}`);
console.log(`</Tabs> closing: ${tabsClosing}`);
console.log(`<TabsContent> opening: ${tabsContentOpening}`);
console.log(`</TabsContent> closing: ${tabsContentClosing}`);

if (tabsOpening !== tabsClosing) {
  console.log('ERROR: Mismatched <Tabs> tags!');
}
if (tabsContentOpening !== tabsContentClosing) {
  console.log('ERROR: Mismatched <TabsContent> tags!');
}