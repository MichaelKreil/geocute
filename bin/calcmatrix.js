"use strict"

const fs = require('fs');
const ProgressBar = require('progress');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

var filename1 = 'kreise.geojson';
var filename2 = 'wahlkreise_btw17.geojson';
var key1 = 'RS';
var key2 = 'WKR_NR';

var filenameOut = 'matrix.tsv';

console.log('load points');

var points = PointList.load('../data/deutschland.bin.gz');

console.log('load regions');

var geo1 = new RegionLookup(filename1);
var geo2 = new RegionLookup(filename2);

var minResidents = 100;

console.log('generate lookups');

var lookup1 = geo1.getLookup();
var lookup2 = geo2.getLookup();

var missSum1 = 0, missSum2 = 0, sum = 0, ignoredSum = 0;
var hits = new Map();

console.log('fire points');

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

	console.log('calc results');

	hits = Array.from(hits.values());
	hits = hits.filter(hit => {
		if (hit.v < minResidents) {
			ignoredSum += hit.v;
			return false;
		}
		hit.r1.count = (hit.r1.count || 0) + hit.v;
		return true;
	})

	console.log('misses in geo 1: '+(100*missSum1/sum).toFixed(3)+'%');
	console.log('misses in geo 2: '+(100*missSum2/sum).toFixed(3)+'%');
	console.log('ignored residents: '+(100*missSum2/sum).toFixed(3)+'%');

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