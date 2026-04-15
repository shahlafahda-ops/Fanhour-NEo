// Run once with: node generate-icons.js
// Generates placeholder PNG icons for PWA
const { createCanvas } = require('canvas');
const fs = require('fs');

[192, 512].forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, size, size);
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.fillStyle = '#00E676';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FH', size/2, size/2);
  fs.writeFileSync(`icon-${size}.png`, canvas.toBuffer('image/png'));
  console.log(`icon-${size}.png created`);
});
