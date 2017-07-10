"use strict"

const tsv = require('../lib/tsv.js');
const async = require('async');

var pointList = new require('../lib/point_list.js')();
var blocks = new Map();

async.series([
	loadBLKData,
	loadADRPoints,
	saveData
]);

function loadBLKData(cb) {
	console.log('load "statistische Blöcke"');
	tsv.load(
		'sources/berlin_blk.tsv.gz',
		['integer', 'float'],
		entry => blocks.set(entry[0], {addr:[], population:entry[1]}),
		cb
	)
}

function loadADRPoints(cb) {
	console.log('load "Adressen"');
	tsv.load(
		'sources/berlin_adr.tsv.gz',
		['integer', 'float', 'float'],
		entry => {
			if (blocks.has(entry[0])) blocks.get(entry[0]).addr.push(entry)
		},
		cb
	)
}

function saveData() {
	console.log('calc population per addresse');

	var addresses = [];
	blocks = Array.from(blocks.values());
	blocks.forEach(block => {
		if (block.addr.length === 0) return;
		var count = block.population/block.addr.length;
		if (count === 0) return;
		block.addr.forEach(p => {
			pointList.add(p[1],p[2],count);
		})
	})

	console.log('save "berlin.bin.gz"');

	pointList.save('berlin.bin.gz');
}