const fs = require('fs');
const sharp = require('sharp');

// Exact 1:1 Vector Replica of the user's uploaded 0.png
// Top: "센트릭" (Bold White Block Font)
// Bottom: "AI" (Two distinct massive rounded characters: 'A' and 'I')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Dark Blue to Cyan/Indigo Gradient matching 0.png -->
    <linearGradient id="bgLinear" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050e38" />
      <stop offset="35%" stop-color="#08226e" />
      <stop offset="70%" stop-color="#1236a8" />
      <stop offset="100%" stop-color="#241fc2" />
    </linearGradient>

    <!-- Bottom Left Cyan Radiant Glow -->
    <radialGradient id="cyanBottomLeft" cx="0%" cy="100%" r="90%">
      <stop offset="0%" stop-color="#3ef2ff" stop-opacity="1" />
      <stop offset="25%" stop-color="#14cbf0" stop-opacity="0.95" />
      <stop offset="55%" stop-color="#0488db" stop-opacity="0.6" />
      <stop offset="80%" stop-color="#044bb0" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#08226e" stop-opacity="0" />
    </radialGradient>

    <!-- Mid Left Ambient Glow -->
    <radialGradient id="cyanMidLeft" cx="0%" cy="65%" r="60%">
      <stop offset="0%" stop-color="#3ef2ff" stop-opacity="0.75" />
      <stop offset="50%" stop-color="#029be6" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#044bb0" stop-opacity="0" />
    </radialGradient>

    <!-- Bottom Right Violet Glow -->
    <radialGradient id="violetBottomRight" cx="100%" cy="100%" r="75%">
      <stop offset="0%" stop-color="#3c22e4" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#201ab8" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#08226e" stop-opacity="0" />
    </radialGradient>

    <!-- AI Gradient: Pure bright white on top shading to subtle luminous ice-cyan at bottom -->
    <linearGradient id="aiGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="65%" stop-color="#f2fcfe" />
      <stop offset="100%" stop-color="#d4f6fc" />
    </linearGradient>
  </defs>

  <!-- Squircle Base (96px corner radius) -->
  <rect width="512" height="512" rx="96" ry="96" fill="url(#bgLinear)" />
  <rect width="512" height="512" rx="96" ry="96" fill="url(#violetBottomRight)" />
  <rect width="512" height="512" rx="96" ry="96" fill="url(#cyanBottomLeft)" />
  <rect width="512" height="512" rx="96" ry="96" fill="url(#cyanMidLeft)" />

  <!-- TOP KOREAN: 센트릭 -->
  <g fill="#ffffff">
    <!-- 센 -->
    <path d="M 124 116 L 158 116 L 158 132 L 124 132 Z" />
    <path d="M 130 132 L 118 168 L 134 168 L 142 143 L 144 143 L 152 168 L 168 168 L 156 132 Z" />
    <path d="M 172 116 L 185 116 L 185 168 L 172 168 Z" />
    <path d="M 185 137 L 196 137 L 196 149 L 185 149 Z" />
    <path d="M 196 116 L 209 116 L 209 168 L 196 168 Z" />
    <path d="M 124 176 L 138 176 L 138 201 L 209 201 L 209 216 L 124 216 Z" />

    <!-- 트 -->
    <path d="M 222 116 L 294 116 L 294 131 L 236 131 L 236 140 L 288 140 L 288 152 L 236 152 L 236 161 L 294 161 L 294 174 L 222 174 Z" />
    <path d="M 220 195 L 296 195 L 296 215 L 220 215 Z" />

    <!-- 릭 -->
    <path d="M 312 116 L 364 116 L 364 139 L 327 139 L 327 147 L 364 147 L 364 168 L 312 168 L 312 146 L 349 146 L 349 130 L 312 130 Z" />
    <path d="M 378 116 L 392 116 L 392 168 L 378 168 Z" />
    <path d="M 324 178 L 388 178 L 388 215 L 374 215 L 374 192 L 324 192 Z" />
  </g>

  <!-- BOTTOM: CLEAR AND SOLID 'A' AND 'I' FILLED PATHS -->
  <g fill="url(#aiGradient)">
    <!-- 'A' Letter (Solid Geometry with rounded contours) -->
    <!-- Left Leg Pill -->
    <rect x="0" y="0" width="46" height="160" rx="23" ry="23" transform="translate(196, 246) rotate(22)" />
    <!-- Right Leg Pill -->
    <rect x="0" y="0" width="46" height="160" rx="23" ry="23" transform="translate(254, 263) rotate(-22)" />
    <!-- A Top Join Cap -->
    <circle cx="225" cy="265" r="23" />
    <!-- A Crossbar Pill -->
    <rect x="180" y="336" width="90" height="34" rx="17" ry="17" />

    <!-- 'I' Letter (Distinct, Thick Rounded Pill Column) -->
    <rect x="320" y="242" width="48" height="170" rx="24" ry="24" />
  </g>
</svg>`;

fs.writeFileSync('public/icon.svg', svg);

sharp(Buffer.from(svg))
  .resize(512, 512)
  .png()
  .toFile('public/icon.png')
  .then(() => {
    console.log('Successfully written icon.svg and icon.png with clear A and I!');
  });
