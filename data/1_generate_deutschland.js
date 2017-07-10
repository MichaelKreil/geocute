"use strict"

const tsv = require('../../lib/tsv.js');
const async = require('async');

var pointLookup = new require('../../lib/point_lookup.js')();
var lonelyGridPoints = [];

async.series([
	loadGermanyPoints,
	loadCensusPoints,
	saveData
]);

function loadGermanyPoints(cb) {
	console.log('load deutschland_points');
	tsv.load(
		'deutschland_points.tsv.gz',
		['float', 'float'],
		point => {
			pointLookup.add(point[0], point[1], 0);
		},
		cb
	)
}

function loadCensusPoints(cb) {
	console.log('load zensus_grid');

	tsv.load(
		'zensus_grid.tsv.gz',
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