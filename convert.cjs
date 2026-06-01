const fs = require('fs')
const path = require('path')

const p = path.resolve(__dirname, 'node_modules', 'world-atlas', 'countries-110m.json')
console.log('Reading:', p)

const d = JSON.parse(fs.readFileSync(p, 'utf8'))
console.log('Top-level keys:', Object.keys(d))
console.log('Objects keys:', Object.keys(d.objects))

const obj = d.objects.countries
console.log('Type:', obj.type)
console.log('Has geometries:', Array.isArray(obj.geometries))

const features = (obj.geometries || []).map(g => ({
  type: 'Feature',
  id: g.id,
  properties: g.properties || {},
  geometry: g
}))

const out = { type: 'FeatureCollection', features }
const outPath = path.resolve(__dirname, 'public', 'maps', 'world.json')
fs.writeFileSync(outPath, JSON.stringify(out))

console.log('Written:', outPath)
console.log('Size:', fs.statSync(outPath).size, 'bytes')
console.log('Features:', features.length)