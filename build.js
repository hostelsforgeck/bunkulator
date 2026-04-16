const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Main build function
async function build() {
  // Create dist directory
  const distDir = './dist';
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log('🔨 Building Bunkulator...\n');

  // Step 1: Obfuscate bunku-mascot.js
  console.log('🔐 Obfuscating JavaScript...');
  const mascotJs = fs.readFileSync('./bunku-mascot.js', 'utf8');
  const obfuscatedMascot = JavaScriptObfuscator.obfuscate(mascotJs, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false, // Set to true for extra protection (can cause issues)
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true, // Protects against code beautification
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  });

  fs.writeFileSync(path.join(distDir, 'bunku-mascot.js'), obfuscatedMascot.getObfuscatedCode());
  console.log('✅ JavaScript obfuscated\n');

  // Step 2: Read and process HTML
  console.log('📄 Processing HTML...');
  const html = fs.readFileSync('./index.html', 'utf8');

  // Extract inline JavaScript from HTML
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  let processedHtml = html;
  let match;
  let scriptCounter = 0;

  while ((match = scriptRegex.exec(html)) !== null) {
    const inlineJs = match[1];
    
    // Obfuscate inline JavaScript
    const obfuscatedInline = JavaScriptObfuscator.obfuscate(inlineJs, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: false, // Less aggressive for inline scripts
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      renameGlobals: false,
      selfDefending: false, // Can cause issues with inline scripts
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 10,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      transformObjectKeys: true
    });
    
    processedHtml = processedHtml.replace(match[0], `<script>${obfuscatedInline.getObfuscatedCode()}</script>`);
    scriptCounter++;
  }

  console.log(`✅ Obfuscated ${scriptCounter} inline script(s)\n`);

  // Step 3: Minify HTML
  console.log('🗜️  Minifying HTML...');
  const minifiedHtml = await minify(processedHtml, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: false, // Already obfuscated
    removeAttributeQuotes: true,
    removeRedundantAttributes: true
  });

  fs.writeFileSync(path.join(distDir, 'index.html'), minifiedHtml);
  console.log('✅ HTML minified\n');

  // Step 4: Copy static assets
  console.log('📦 Copying assets...');
  const assetsToCopy = [
    'og-image.png',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'googleb39cc6ccea63aaf9.html'
  ];

  // Copy assets folder if it exists
  if (fs.existsSync('./assets')) {
    const assetsDistDir = path.join(distDir, 'assets');
    if (!fs.existsSync(assetsDistDir)) {
      fs.mkdirSync(assetsDistDir, { recursive: true });
    }
    
    const assetFiles = fs.readdirSync('./assets');
    assetFiles.forEach(file => {
      fs.copyFileSync(
        path.join('./assets', file),
        path.join(assetsDistDir, file)
      );
    });
    console.log(`✅ Copied assets folder (${assetFiles.length} files)`);
  }

  assetsToCopy.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(distDir, file));
    }
  });

  console.log(`✅ Copied ${assetsToCopy.length} static files\n`);

  // Add copyright notice
  const copyrightNotice = `
<!--
  Bunkulator - KTU Attendance Calculator
  Copyright © 2024 malik-l0l
  https://bunkulator.vercel.app/
  
  This code is obfuscated and protected.
  Unauthorized copying or redistribution is prohibited.
-->
`;

  const finalHtml = copyrightNotice + fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(distDir, 'index.html'), finalHtml);

  console.log('✨ Build complete! Output in ./dist/\n');
  console.log('📊 Build Summary:');
  console.log('   - JavaScript: Obfuscated with high protection');
  console.log('   - HTML: Minified');
  console.log('   - CSS: Minified (inline)');
  console.log('   - Assets: Copied');
  console.log('\n🚀 Ready to deploy!\n');
}

// Run the build
build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
