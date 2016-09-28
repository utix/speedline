'use strict';

const fs = require('fs');
const jpeg = require('jpeg-js');

function getPixel(x, y, channel, width, buff) {
	return buff[(x + y * width) * 4 + channel];
}

function convertPixelsToHistogram(img) {
	const createHistogramArray = function () {
		const ret = new Array(256);
		for (let i = 0; i < ret.length; i++) {
			ret[i] = 0;
		}
		return ret;
	};

	const width = img.width;
	const height = img.height;

	const histograms = [
		createHistogramArray(),
		createHistogramArray(),
		createHistogramArray()
	];

	for (let channel = 0; channel < histograms.length; channel++) {
		for (let i = 0; i < width; i++) {
			for (let j = 0; j < height; j++) {
				const pixelValue = getPixel(i, j, channel, width, img.data);

				// Erase pixels considered as white
				if (getPixel(i, j, 0, width, img.data) < 249 &&
						getPixel(i, j, 1, width, img.data) < 249 &&
						getPixel(i, j, 2, width, img.data) < 249) {
					histograms[channel][pixelValue]++;
				}
			}
		}
	}

	return histograms;
}

const screenshotTraceCategory = 'disabled-by-default-devtools.screenshot';
function extractFramesFromTimeline(timeline) {
	let trace;
	trace = typeof timeline === 'string' ? fs.readFileSync(timeline, 'utf-8') : timeline;
	try {
		trace = typeof trace === 'string' ? JSON.parse(trace) : trace;
	} catch (e) {
		throw new Error('Speedline: Invalid JSON' + e.message);
	}
	let events = trace.traceEvents || trace;
	events = events.sort((a, b) => a.ts - b.ts).filter(e => e.ts !== 0);

	const startTs = events[0].ts / 1000;
	const endTs = events[events.length - 1].ts / 1000;

	const rawScreenshots = events.filter(e => e.cat.includes(screenshotTraceCategory));
	const frames = rawScreenshots.map(function (evt) {
		const base64img = evt.args && evt.args.snapshot;
		const timestamp = evt.ts / 1000;

		const imgBuff = new Buffer(base64img, 'base64');
		return frame(imgBuff, timestamp);
	});
	const framesObj = {
		startTs,
		endTs,
		firstFrame: frames[0],
		lastFrame: frames[frames.length - 1],
		middleFrames: frames.slice(1, frames.length - 1),
		allFrames: frames
	};
	return Promise.resolve(framesObj);
}

function frame(imgBuff, ts) {
	let _histogram = null;
	let _progress = null;
	let _perceptualProgress = null;

	return {
		getHistogram: function () {
			if (_histogram) {
				return _histogram;
			}

			const pixels = jpeg.decode(imgBuff);
			_histogram = convertPixelsToHistogram(pixels);
			return _histogram;
		},

		getTimeStamp: function () {
			return ts;
		},

		setProgress: function (progress) {
			_progress = progress;
		},

		setPerceptualProgress: function (progress) {
			_perceptualProgress = progress;
		},

		getImage: function () {
			return imgBuff;
		},

		getParsedImage: function () {
			return jpeg.decode(imgBuff);
		},

		getProgress: function () {
			return _progress;
		},

		getPerceptualProgress: function () {
			return _perceptualProgress;
		}
	};
}

module.exports = {
	extractFramesFromTimeline,
	create: frame
};
