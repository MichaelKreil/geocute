"use strict"

const fs = require('fs');
const zlib = require('zlib');
const ProgressBar = require('progress');
const ProgressStream = require('progress-stream');

function load(filename, fields, cbLine, cbFinished) {
	fields = fields.map(f => {
		switch (f) {
			case 'float': return parseFloat;
			case 'integer': return (s => parseInt(s,10));
			default: throw Error('Unknown type "'+f+'"');
		}
	})

	const inStream = fs.createReadStream(filename);
	const stream = inStream
		.pipe(initProgress(filename))
		.pipe(zlib.createGunzip());

	var chunk = '';

	stream.on('data', data => parseInput(data.toString('ascii')));
	stream.on('close', () => {
		parseInput('', true);
		cbFinished();
	})

	function parseInput(input, last) {
		var lines = (chunk + input).split('\n');
		if (!last) chunk = lines.pop();
		lines.forEach(line => {
			if (line.length === 0) return;
			var values = line.split('\t');
			values = values.map((s,i) => fields[i](s));
			cbLine(values);
		});
	}
}

module.exports = {
	load:load
}

function initProgress(filename) {
	var stat = fs.statSync(filename);

	var bar = new ProgressBar(':bar :percent (ETA :etas)', { total: 100 });
	var stream = ProgressStream({
		length: stat.size,
		time: 1000 /* ms */
	});

	stream.on('progress', progress => {
		bar.update(progress.percentage/100);
	})

	stream.on('close', progress => {
		bar.complete();
	})

	return stream;
}