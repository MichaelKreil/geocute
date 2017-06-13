#! /usr/bin/env node

"use strict"

const fs = require('fs');
const Path = require('path');
const ProgressBar = require('progress');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

const minResidents = 100;



var args = process.argv.slice(2);

if (args.length !== 5) {
	console.error('Wrong number of arguments! I need exactly 5');
	console.error('Usage:');
	console.error('  cutematrix geo1 key1 geo2 key2 output');
	console.error('    - geo1: filename of source GeoJSON');
	console.error('    - key1: property name of the key in source GeoJSON');
	console.error('    - geo2: filename of target GeoJSON');
	console.error('    - key2: property name of the key in target GeoJSON');
	console.error('    - output: filename of resulting TSV file');
	console.error('Example:');
	console.error('  If you want to calculate a matrix for converting from "gemeinden" to "wahlkreise", use:');
	console.error('     cutematrix gemeinden.geojson AGS wahlkreise.geojson wkr_nr matrix.tsv');
	process.exit();
}

var filename1   = args[0];
var key1        = args[1];
var filename2   = args[2];
var key2        = args[3];
var filenameOut = args[4];



console.log('load points');
var points = PointList.load(Path.resolve(__dirname, '../data/deutschland.bin.gz'));



console.log('load regions "'+filename1+'"');
var geo1 = new RegionLookup(filename1);

console.log('load regions "'+filename2+'"');
var geo2 = new RegionLookup(filename2);



console.log('generate lookups "'+filename1+'"');
var lookup1 = geo1.getLookup();

console.log('generate lookups "'+filename2+'"');
var lookup2 = geo2.getLookup();



console.log('fire points');

var missSum1 = 0, missSum2 = 0, sum = 0, ignoredSum = 0;
var hits = new Map();
var count = points.getLength();
var bar = new ProgressBar(':bar :percent (ETA :etas)', { total:100 });

points.forEach((p,i) => {
	if (i % 100000 === 0) bar.update(i/count);

	var region1 = lookup1(p.x, p.y);
	var region2 = lookup2(p.x, p.y);

	sum += p.v;
	if (!region1) missSum1 += p.v;
	if (!region2) missSum2 += p.v;
	if (!region1 || !region2) return;

	var key = region1.index+'_'+region2.index;
	if (!hits.has(key)) hits.set(key, {r1:region1, r2:region2, v:0});
	hits.get(key).v += p.v;
}, () => {
	console.log('\n');

	console.log('save results');

	hits = Array.from(hits.values());
	hits = hits.filter(hit => {
		if (hit.v < minResidents) {
			ignoredSum += hit.v;
			return false;
		}
		hit.r1.count = (hit.r1.count || 0) + hit.v;
		return true;
	})

	console.log('- misses in geo 1: '+(100*missSum1/sum).toFixed(3)+'%');
	console.log('- misses in geo 2: '+(100*missSum2/sum).toFixed(3)+'%');
	console.log('- ignored residents: '+(100*missSum2/sum).toFixed(3)+'%');

	hits = hits.map(hit =>
		[
			hit.r1.properties[key1],
			hit.r2.properties[key2],
			(hit.v/hit.r1.count).toFixed(6),
			hit.v.toFixed(1)
		].join('\t')
	)
	hits.unshift('key1_'+key1+'\tkey2_'+key2+'\tfraction\tresidents');

	fs.writeFileSync(filenameOut, hits.join('\n'), 'utf8')
});