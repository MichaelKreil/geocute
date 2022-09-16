#!/usr/bin/env node

"use strict"

const fs = require('fs');
const ffd = require('ffd');
const path = require('path');
const colors = require('colrz');
const ProgressBar = require('progress');
const PointList = require('../lib/point_list.js');
const RegionLookup = require('../lib/region_lookup.js');

const print = require('../lib/print')("[geocute]".magenta);

const minResidents = 10;

const args = process.argv.slice(2);

if ((args.length < 5) || (args.length > 6) || args.indexOf("-h")>= 0 || args.indexOf("--help")>= 0) {
	print('Wrong number of arguments! I need 5-6'.red);
	print('Usage:');
	print('  geocute geo1 key1 geo2 key2 [pointlist] output');
	print('    - geo1: filename of source GeoJSON');
	print('    - key1: property name of the key in source GeoJSON');
	print('    - geo2: filename of target GeoJSON');
	print('    - key2: property name of the key in target GeoJSON');
	print('    - pointlist: (optional) name of list of points to through at the data. Can be:');
	print('      - "../data/deutschland.bin.br": (default) based on telephone book entries');
	print('      - "../data/berlin_blk.bin.br": Berlin only, based on "statistische Blöcke"');
	print('      - "../data/berlin_adr_ew.bin.br": Berlin only, based on "Sonderauswertung RBS-Adressen"');
	print('    - output: filename of resulting TSV file');
	print('Examples:');
	print('  If you want to calculate a matrix for converting from "gemeinden" to "wahlkreise", type:');
	print('     node geocute gemeinden.geojson AGS wahlkreise.geojson wkr_nr matrix.tsv');
	print('  If you want to convert from "wahlbezirk" to "plz" using "Sonderauswertung RBS-Adressen", type:');
	print('     node geocute wahlbezirk.geojson WBZ plz.geojson plz ../data/berlin_adr.bin.br matrix.tsv');
	process.exit(1);
};

const filename1   = args.shift();
const key1        = args.shift();
const filename2   = args.shift();
const key2        = args.shift();

const pointListFilenameArg = (args.length > 1) ? args.shift() : '../data/deutschland.bin.br'
const filenameOut = args.shift();

ffd(pointListFilenameArg, [ process.cwd(), __dirname, path.resolve(__dirname,"../data") ], function(pointListFilename){
	if (pointListFilename === null) return print("Unable to find PointList '%s'", pointListFilename);

	print('load points from '+(path.basename(pointListFilename).gray));
	const points = PointList.load(pointListFilename);

	print('load regions from '+(filename1.gray)+'');
	const geo1 = new RegionLookup(filename1);

	print('load regions from '+(filename2.gray)+'');
	const geo2 = new RegionLookup(filename2);

	print('generate lookups from '+(filename1.gray)+'');
	const lookup1 = geo1.getLookup(true);

	print('generate lookups from '+(filename2.gray)+'');
	const lookup2 = geo2.getLookup(true);

	let sum = 0;
	let misses = [];
	let hits = new Map();
	const count = points.getLength();
	const bar = new ProgressBar(('[geocute]'.magenta)+' fire points :bar :percent (ETA :etas)', { 
		total: (process.env.COLUMNS || process.stdout.columns || 80),
		complete: '▬'.magenta.bold,
		incomplete: '▬'.black.bold,
	});

	points.forEach((p,i) => {
		if (i % 100000 === 0) bar.update(i/count);

		const region1 = lookup1(p.x, p.y);
		const region2 = lookup2(p.x, p.y);

		sum += p.v;
		if (!region1 || !region2) {
			p.region1 = region1;
			p.region2 = region2;
			misses.push(p);
			return;
		}

		const key = region1.properties._index+'_'+region2.properties._index;
		if (!hits.has(key)) hits.set(key, { r1: region1, r2: region2, v: 0 });
		hits.get(key).v += p.v;

	}, () => {
		bar.update(1);

		print('analyse results');
	
		hits = Array.from(hits.values());
		hits.forEach(hit => {
			hit.r1.properties._count = (hit.r1.properties._count || 0) + hit.v;
			hit.r2.properties._count = (hit.r2.properties._count || 0) + hit.v;
		});
		hits = hits.map(hit => {
			let fraction = hit.v/hit.r1.properties._count;
			let error = fraction*(1-fraction);
			error = error*hit.v/hit.r2.properties._count;
			return {
				key1: hit.r1.properties[key1],
				key2: hit.r2.properties[key2],
				fraction: fraction,
				residents: hit.v,
				error: error,
				method: 'point',
			};
		});

		let missSum1 = 0, missSum2 = 0, missSum12 = 0;
		misses = misses.map(p => {
			if (!p.region1) missSum1 += p.v;
			if (!p.region2) missSum2 += p.v;
			if (!p.region1 || !p.region2) missSum12 += p.v;
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [ p.x, p.y ] },
				properties: {
					residents: p.v,
					region1: p.region1 ? ''+p.region1.properties[key1] : 'false',
					region2: p.region2 ? ''+p.region2.properties[key2] : 'false',
				}
			};
		});

		if (misses.length === 0) {
			print('no misses ✓'.green);
		} else {
			print('misses:'.yellow);
			print('	in geo 1: '     +missSum1 +' ('+(100*missSum1 /sum).toFixed(3)+'%)');
			print('	in geo 2: '     +missSum2 +' ('+(100*missSum2 /sum).toFixed(3)+'%)');
			print('	in geo 1 or 2: '+missSum12+' ('+(100*missSum12/sum).toFixed(3)+'%)');

			print('   - saving all misses as "_misses.geojson"'.yellow);
			fs.writeFileSync('_misses.geojson', JSON.stringify({ type: 'FeatureCollection', features: misses }), 'utf8');
		};

		const features1 = geo1.features.filter(f => (!f.properties._count));
		const features2 = geo2.features.filter(f => (!f.properties._count));

		if (features1.length+features1.length === 0) {
			print('no regions without hits ✓'.green);
		} else {
			print('found regions without hits:'.yellow);
			
			
			if (features1.length) {
				print('%s regions without hits in %s: %s'.yellow, features1.length.toString().bold, "geo1".grey, features1.map(f => f.properties[key1]).join(', ').brightYellow);
				print('Solution: Estimate matrix entries based on overlapping areas.'.grey);

				const findOverlaps = geo2.getOverlapFinder();
				const noOverlaps = features1.filter(f1 => {
					const overlaps = findOverlaps(f1);
					if (overlaps.length === 0) {
						print('Error: Unable to find overlaps for %s in geo2'.red, f1.properties[key1]);
						return true;
					};
					overlaps.forEach(overlap => hits.push({
						key1: f1.properties[key1],
						key2: overlap.feature.properties[key2],
						fraction: overlap.fraction,
						residents: 0,
						error: 1,
						method: 'overlapping area',
					}));
				});
			
				if (noOverlaps.length > 0) {
					print('Saving non overlapping regions as %s'.red, '_nooverlaps.geojson'.grey);
					fs.writeFileSync('_nooverlaps.geojson', JSON.stringify({ type: 'FeatureCollection', features: noOverlaps }), 'utf8');
				};
			};

			if (features2.length) {
				print('%s regions without hits in %s'.yellow, features2.length.toString().bold, "geo2".grey);
				print('Solution: None'.red);
				print('Saving hitless regions as %s'.red, '_nohits.geojson'.grey);
				fs.writeFileSync('_nohits.geojson', JSON.stringify({ type: 'FeatureCollection', features: features2 }), 'utf8');
				
				print('failed'.red.bold);
				process.exit(1);
				
			};
			
		}

		print('save results'.green);
		hits = hits.map(hit => [
			hit.key1,
			hit.key2,
			hit.fraction.toFixed(6),
			hit.residents.toFixed(1),
			hit.error.toFixed(6),
			hit.method
		].join('\t'));
		hits.unshift('key1_'+key1+'\tkey2_'+key2+'\tfraction\tresidents\terror\tmethod');

		fs.writeFileSync(filenameOut, hits.join('\n'), 'utf8');

		print('done'.green.bold);

	});

});