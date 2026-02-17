const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Blue background
  ctx.fillStyle = '#0052cc';
  ctx.fillRect(0, 0, size, size);
  
  // White chevron
  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(2, size / 8);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const centerX = size / 2;
  const centerY = size / 2;
  const width = size * 0.3;
  const height = size * 0.2;
  
  ctx.beginPath();
  ctx.moveTo(centerX - width, centerY - height);
  ctx.lineTo(centerX, centerY + height);
  ctx.lineTo(centerX + width, centerY - height);
  ctx.stroke();
  
  return canvas;
}

// Create icons directory
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

const sizes = [16, 48, 128, 256];
sizes.forEach(size => {
  const canvas = createIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icons/icon-${size}.png`, buffer);
  console.log(`✓ Created icon-${size}.png`);
});

console.log('\\nAll icons created successfully!');