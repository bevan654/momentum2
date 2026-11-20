#!/usr/bin/env node
/**
 * Writes the widget extension's asset catalog: the two colours apple-targets expects ($accent,
 * $widgetBackground) and the body silhouettes the home screen Recovery widget shows when everything is recovered
 * (targets/workout-activity/Assets.xcassets/BodyMale, BodyFemale) from the front-view outline of
 * the pinned momentum-muscle-map. Vector, template-rendered: the widget tints them green.
 * Re-run after updating momentum-muscle-map:  node scripts/widget-body-outlines.js
 * The artwork is MIT (see node_modules/momentum-muscle-map/NOTICE), credited in the SVG.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lib = path.join(root, 'node_modules/momentum-muscle-map/lib/module/data');
const out = path.join(root, 'targets/workout-activity/Assets.xcassets');

function svgFor(file) {
  // The compiled data files are plain JS objects assigned to `data`.
  const src = fs.readFileSync(path.join(lib, file), 'utf8');
  const json = src.slice(src.indexOf('{', src.indexOf('const data')), src.lastIndexOf('};') + 1);
  const data = JSON.parse(json);
  const [x0, y0, x1, y1] = data.bounds;
  const pad = 8;
  const box = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2].map((n) => Math.round(n * 10) / 10);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${Math.round(box[2] / 10)}" height="${Math.round(box[3] / 10)}">`,
    '<!-- Body outline from momentum-muscle-map, derived from @musclemap/assets (MIT, Copyright (c) 2026 Jsplice / MuscleMap contributors). -->',
    `<path fill="#000" d="${data.outline}"/>`,
    '</svg>',
    '',
  ].join('\n');
}

function writeImageSet(name, file) {
  const dir = path.join(out, `${name}.imageset`);
  fs.mkdirSync(dir, { recursive: true });
  const svg = `${name}.svg`;
  fs.writeFileSync(path.join(dir, svg), svgFor(file));
  fs.writeFileSync(
    path.join(dir, 'Contents.json'),
    `${JSON.stringify({
      images: [{ filename: svg, idiom: 'universal' }],
      info: { author: 'xcode', version: 1 },
      properties: { 'preserves-vector-representation': true, 'template-rendering-intent': 'template' },
    }, null, 2)}\n`,
  );
}

function writeColorSet(name, light, dark) {
  const dir = path.join(out, `${name}.colorset`);
  fs.mkdirSync(dir, { recursive: true });
  const color = (c) => ({ 'color-space': 'srgb', components: { ...c, alpha: '1.000' } });
  const colors = [{ idiom: 'universal', color: color(light) }];
  if (dark) colors.push({ idiom: 'universal', appearances: [{ appearance: 'luminosity', value: 'dark' }], color: color(dark) });
  fs.writeFileSync(path.join(dir, 'Contents.json'), `${JSON.stringify({ colors, info: { author: 'xcode', version: 1 } }, null, 2)}
`);
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'Contents.json'), `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`);
// apple-targets names these two colours in the widget's build settings: the app's default accent
// and the widget background the widgets also draw themselves (HomeWidgetBackground).
writeColorSet('$accent', { red: '0xFF', green: '0x32', blue: '0x32' });
writeColorSet('$widgetBackground', { red: '0xFF', green: '0xFF', blue: '0xFF' }, { red: '0x12', green: '0x12', blue: '0x13' });
writeImageSet('BodyMale', 'male-front.js');
writeImageSet('BodyFemale', 'female-front.js');
console.log(`Wrote BodyMale and BodyFemale to ${path.relative(root, out)}`);
