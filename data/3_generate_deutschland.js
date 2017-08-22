"use strict"

const tsv = require('../lib/tsv.js');
const PointLookup = require('../lib/point_lookup.js');
const RegionLookup = require('../lib/region_lookup.js');
const async = require('async');

var pointLookup = new PointLookup();
var isInBerlin;
var lonelyGridPoints = [];

async.series([
	loadBerlinLookup,
	loadBerlinPoints,
	loadGermanyPoints,
	loadCensusGrid,
	saveData
]);

function loadBerlinLookup(cb) {
	console.log('load berlin lookup');
	var regionLookup = new RegionLookup('sources/bundeslaender.geojson.gz');
	isInBerlin = regionLookup.getInsideChecker(['Berlin'], 'GEN');
	cb();
}

function loadGermanyPoints(cb) {
	console.log('\nload deutschland_points.tsv');
	tsv.load(
		'sources/deutschland_points.tsv.gz',
		['float', 'float'],
		point => {
			if (!isInBerlin(point[0], point[1])) pointLookup.add(point[0], point[1], 0)
		},
		cb
	)
}

function loadBerlinPoints(cb) {
	console.log('\nload berlin_adr.tsv');
	tsv.load(
		'sources/berlin_adr.tsv.gz',
		['integer', 'float', 'float'],
		point => {
			if (isInBerlin(point[1], point[2])) pointLookup.add(point[1], point[2], 0)
		},
		cb
	)
}

function loadCensusGrid(cb) {
	console.log('\nload zensus_grid.tsv');

	tsv.load(
		'sources/zensus_grid.tsv.gz',
		['float', 'float', 'integer'],
		gridPoint => {
			var points = pointLookup.findNearby(gridPoint[0], gridPoint[1], 300);

			var sum = 0;

			points.forEach(p => {
				if (p.distance > 300) return p.weight = 0;
				p.weight = Math.cos(p.distance/300*Math.PI)*0.5+0.5;
				sum += p.weight;
			})

			if (sum === 0) return lonelyGridPoints.push(gridPoint);

			points.forEach(p => {
				p.inc(gridPoint[2]*p.weight/sum);
			})
		},
		cb
	)
}

function saveData() {
	console.log('save data');

	lonelyGridPoints.forEach(point => pointLookup.add(point[0], point[1], point[2]));

	pointLookup.save('deutschland.bin.gz');

	console.log('finished');
}
