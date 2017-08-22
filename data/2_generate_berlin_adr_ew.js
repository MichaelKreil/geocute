"use strict"

const tsv = require('../lib/tsv.js');
const async = require('async');

var pointList = new require('../lib/point_list.js')();

async.series([
	loadADRPoints,
	saveData
]);

function loadADRPoints(cb) {
	console.log('load "Adressen" berlin_adr_ew.tsv.gz');
	tsv.load(
		'sources/berlin_adr_ew.tsv.gz',
		['float', 'float', 'integer'],
		e => pointList.add(e[0],e[1],e[2]),
		cb
	)
}

function saveData() {
	console.log('\nsave "berlin_adr_ew.bin.gz"');

	pointList.save('berlin_adr_ew.bin.gz');
}
