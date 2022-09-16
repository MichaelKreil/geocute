"use strict"

console.log("missing source data.");
process.exit();

const tsv = require('../lib/tsv.js');
const async = require('async');

const pointList = new require('../lib/point_list.js')();

async.series([
	loadADRPoints,
	saveData
]);

function loadADRPoints(cb) {
	console.log('load "Adressen" berlin_adr_ew.tsv.br');
	tsv.load(
		__dirname+'/sources/berlin_adr_ew.tsv.br',
		['float', 'float', 'integer'],
		e => pointList.add(e[0],e[1],e[2]),
		cb
	);
};

function saveData() {
	console.log('\nsave "berlin_adr_ew.bin.br"');
	pointList.save(__dirname+'/berlin_adr_ew.bin.br');
}
