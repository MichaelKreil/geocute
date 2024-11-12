"use strict"

const tsv = require('../lib/tsv.js');
const PointLookup = require('../lib/point_lookup.js');
const RegionLookup = require('../lib/region_lookup.js');
const async = require('async');

const pointLookup = new PointLookup();
let isInBerlin;
const lonelyGridPoints = [];

async.series([
	loadBerlinLookup,
	loadBerlinPoints,
	loadGermanyPoints,
	loadCensusGrid,
	saveData
]);

function loadBerlinLookup(cb) {
	console.log('load berlin lookup');
	const regionLookup = new RegionLookup(__dirname+'/sources/bundeslaender.geojson.br');
	isInBerlin = regionLookup.getInsideChecker(['Berlin'], 'GEN');
	cb();
};

function loadGermanyPoints(cb) {
	console.log('\nload deutschland_points.tsv');
	tsv.load(
		__dirname+'/sources/deutschland_points.tsv.br',
		['float', 'float'],
		point => {
			if (!isInBerlin(point[0], point[1])) pointLookup.add(point[0], point[1], 0);
		},
		cb
	);
};

function loadBerlinPoints(cb) {
	console.log('\nload berlin_adr.tsv');
	tsv.load(
		__dirname+'/sources/berlin_adr.tsv.br',
		['float', 'float', 'float'],
		point => {
			if (isInBerlin(point[1], point[2])) pointLookup.add(point[1], point[2], 0);
		},
		cb
	);
};

function loadCensusGrid(cb) {
	console.log('\nload zensus_grid_2011.tsv');

	tsv.load(
		__dirname+'/sources/zensus_grid_2011.tsv.br',
		['float', 'float', 'integer'],
		gridPoint => {
			const points = pointLookup.findNearby(gridPoint[0], gridPoint[1], 300);
			let sum = 0;

			points.forEach(p => {
				if (p.distance > 300) return p.weight = 0;
				p.weight = Math.cos(p.distance/300*Math.PI)*0.5+0.5;
				sum += p.weight;
			});

			if (sum === 0) return lonelyGridPoints.push(gridPoint);

			points.forEach(p => {
				p.inc(gridPoint[2]*p.weight/sum);
			});
		},
		cb
	);
};

function saveData() {
	console.log('save data');

	lonelyGridPoints.forEach(point => pointLookup.add(point[0], point[1], point[2]));

	pointLookup.save(__dirname+'/deutschland.bin.br');

	console.log('finished');
};
