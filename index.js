const path = require('path');
const { CanvasRenderService } = require('chartjs-node-canvas');
const chartDataLabels = require('chartjs-plugin-datalabels');
const chartRadialGauge = require('chartjs-chart-radial-gauge');
const express = require('express');
const expressNunjucks = require('express-nunjucks');
const qrcode = require('qrcode');
const text2png = require('text2png');
const winston = require('winston');
const { NodeVM } = require('vm2');
const request = require('request');

const { addBackgroundColors } = require('./charts');

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ timestamp: true, colorize: true }),
    ],
});

const app = express();

const isDev = false;

app.set('views', `${__dirname}/templates`);
app.use(express.static('public'));

expressNunjucks(app, {
    watch: isDev,
    noCache: isDev,
});

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, './templates/robots.txt'));
});

function failPng(res, msg) {
    res.writeHead(500, {
        'Content-Type': 'image/png',
    });
    res.end(text2png(`Chart Error: ${msg}`, {
        padding: 10,
        backgroundColor: '#fff',
    }));
}

function createLabelsFromData(data, type){
    var today = new Date(data.time * 1000);
	var labels = [];
	switch(type){
		case '24hours':
			for(i = 0; i < 24; i++){
				var hour = i;
				var ampm = 'am';
				if(hour >= 12){
					ampm = 'pm';
					hour = hour - 12;
				}
				if(hour === 0){
					hour = 12;
				}
				labels.push(hour + ampm);
			}
		break;
		case '7days':
			for(i = -8; i < -1; i++){
				var day = new Date(today.getTime() + (1000 * 60 * 60 * 24 * i));
				var month = day.getMonth() + 1;
				if(month < 10){
					month = '0' + month;
				}
				var date = day.getDate() + 1;
				if(date < 10){
					date = '0' + date;
				}
				day = day.getFullYear() + '-' + month + '-' + date;
				labels.push(day);
			}
		break;
		case '9weeks':
			for(i = -9; i < 0; i++){				
				var day2 = new Date(today.getTime() - (1000 * 60 * 60 * 24 * 2) + (1000 * 60 * 60 * 24 * 7 * (i + 1)));
				var day = new Date(day2.getTime() - (1000 * 60 * 60 * 24 * 6));
				var month = day.getMonth() + 1;
				if(month < 10){
					month = '0' + month;
				}
				var date = day.getDate() + 1;
				if(date < 10){
					date = '0' + date;
				}
				var month2 = day2.getMonth() + 1;
				if(month2 < 10){
					month2 = '0' + month2;
				}
				var date2 = day2.getDate() + 1;
				if(date2 < 10){
					date2 = '0' + date2;
				}
				
				day = month + '/' + date + ' - ' + month2 + '/' + date2 + '        ';
				labels.push(day);
			}
		break;
		default:
			data.values.forEach(function(v){
				labels.push('');
			});
		break;
	}
	return labels;
}

function constructChart(data){
    var arrAllowedTypes = [
        'pie',
        'doughnut',
        'line',
        'bar'
    ];
    if(arrAllowedTypes.indexOf(data.template) >= 0){	
		var colorIndex = 0;
		var getColor = function(){
			var arrColor = [
				[244,196,149,0,1,2],
				[193,168,239,2,0,1],
				[235,166,183,0,2,1],
				[255,205,86,0,1,2],
				[231,219,160,1,0,2],
				[154,194,212,2,1,0]
			];
			
			var loopCount = 0;
			var rowIndex = 0;
			if(colorIndex > 0){
				loopCount = Math.floor(colorIndex / arrColor.length);
				rowIndex = colorIndex - (loopCount * arrColor.length);
			}
			var baseColor = arrColor[rowIndex];
			
			baseColor[baseColor[3]] = baseColor[baseColor[3]] - (loopCount * 43);
			baseColor[baseColor[4]] = baseColor[baseColor[4]] - (loopCount * 31);
			baseColor[baseColor[5]] = baseColor[baseColor[5]] - (loopCount * 17);
			
			if(baseColor[0] < 50){
				baseColor[0] = baseColor[0] + 205;
			}
			if(baseColor[1] < 50){
				baseColor[1] = baseColor[1] + 205;
			}
			if(baseColor[2] < 50){
				baseColor[2] = baseColor[2] + 205;
			}
			
			if(baseColor[0] > 235){
				baseColor[0] = baseColor[0] - 15;
			}
			if(baseColor[1] > 235){
				baseColor[1] = baseColor[1] - 15;
			}
			if(baseColor[2] > 235){
				baseColor[2] = baseColor[2] - 15;
			}
			
			colorIndex = colorIndex + 1;
			
			return '#' + toHex(baseColor[0]) + toHex(baseColor[1]) + toHex(baseColor[2]);
		}
	
		data.colors = [];
		data.values.forEach(function(){
			data.colors.push(getColor());
		});
		
		switch(data.template){
			case 'line':
				return constructLineChart(data);
			break;
			case 'bar':
				return constructBarChart(data);
			break;
			case 'pie':
				return constructPieChart(data);
			break;
			case 'doughnut':
				return constructDoughnutChart(data);
			break;
		}
    }
    return false;
}

function constructBarChart(data){
		
    return {
        'type' : 'bar',
        'data' : {
            'labels' : data.labels,            
            'datasets' : [
				{
                    'label' : '',
                    'data' : data.values,
                    'backgroundColor' : data.colors
                }
			]
        },
        'options' : {
            'legend' : {
                'display' : false
            },
            'scales' : {
                'xAxes' : [
					{
                        'ticks' : {
                            'fontSize' : 8,
                        },
                        'gridLines' : {
                            'display' : false
                        }
                    }
				],
                'yAxes' : [
					{
                        'ticks' : {
                            'fontSize' : 8
                        },
                        'gridLines' : {
                            'display' : false
                        }
                    }
                ]
			}
        }
    };
}

function constructLineChart(data){
    var retObj = {
        'type' : 'line',
        'data' : {
            'labels' : data.labels,            
            'datasets' : [
				{
                    'data' : data.values,
                }
			]
        },
		'options' : {
			'legend' : {
				'display' : false
			}
		}
	};
	if(data.labeltype && data.labeltype === '9weeks'){
		retObj.options.scales = {};
		retObj.options.scales.xAxes = [];
		retObj.options.scales.xAxes.push({
			'scaleLabel' : {
				'labelString' : 'Time Period',
				'display' : true
			}
		});
		retObj.options.scales.yAxes = [];
		retObj.options.scales.yAxes.push({
			'scaleLabel' : {
				'labelString' : 'Visits',
				'display' : true
			}
		});
	}
	return retObj;
}

function toHex(a){
	var hex = a.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

function constructPieChart(data){
    return {
        'type' : 'doughnut',
        'data' : {
            'labels' : data.labels,            
            'datasets' : [
				{
                    'data' : data.values,
                    'backgroundColor' : data.colors
                }
			]
        },
        'options' : {
            'legend' : {
                'display' : false,
				'labels' : {
					'fontSize' : 6,
					'boxWidth' : 10,
					'padding' : 8
				}
            },
			'plugins' : {
				'datalabels' : {
					'display' : false
				}
			}
        }
    };
}

function constructDoughnutChart(data){
		
    return {
        'type' : 'doughnut',
        'data' : {
            'labels' : data.labels,            
            'datasets' : [
				{
                    'data' : data.values,
                    'backgroundColor' : data.colors
                }
			]
        },
        'options' : {
            'legend' : {
                'display' : false,
				'labels' : {
					'fontSize' : 6,
					'boxWidth' : 10,
					'padding' : 8
				}
            },
			'plugins' : {
				'datalabels' : {
					'display' : false
				}
			}
        }
    };
}

app.get('/chart', (req, res) => {
    if (!req.query.c && !req.query.url && !req.query.t && !req.query.z) {
        failPng(res, 'Invalid request');
        return;
    }

    let height = 300;
    let width = 500;
    if (req.query.h || req.query.height) {
        const heightNum = parseInt(req.query.h || req.query.height, 10);
        if (!Number.isNaN(heightNum)) {
            height = heightNum;
        }
    }
    if (req.query.w || req.query.width) {
        const widthNum = parseInt(req.query.w || req.query.width, 10);
        if (!Number.isNaN(widthNum)) {
            width = widthNum;
        }
    }

    let chart;
    let url;
    let untrustedInput;

    try {
        if (req.query.c) {
            untrustedInput = decodeURIComponent(req.query.c);
        } else if(req.query.t) {
            untrustedInput = {
                template : decodeURIComponent(req.query.t),
                labels : JSON.parse(decodeURIComponent(req.query.k)),
                values : JSON.parse(decodeURIComponent(req.query.v)),
                colors : JSON.parse(decodeURIComponent(req.query.z))
            }
        } else if(req.query.z) {
            untrustedInput = {
                template : decodeURIComponent(req.query.z),
                values : req.query.x.split(',')
			};
			if(req.query.w){
				untrustedInput.time = parseInt(req.query.v);
				untrustedInput.labeltype = decodeURIComponent(req.query.y);
				untrustedInput.labels = createLabelsFromData(untrustedInput, untrustedInput.labeltype);
			} else {
				untrustedInput.labeltype = decodeURIComponent(req.query.y);
				untrustedInput.labels = createLabelsFromData(untrustedInput, 'default');
			}
        } else {
            untrustedInput = decodeURIComponent(req.query.url);
        }
    } catch (err) {
        logger.error('URI malformed', err);
        failPng(res, 'URI malformed');
        return;
    }


    try {
        if (req.query.c) {
            if (untrustedInput.match(/(for|while)\(/gi)) {
                failPng(res, 'Input is not allowed');
                return;
            }
            const vm = new NodeVM();
            chart = vm.run(`module.exports = ${untrustedInput}`);
            processChart(chart);
        } else if(req.query.z) {
            chart = constructChart(untrustedInput);
            processChart(chart);
        } else {
            request({rejectUnauthorized: false, url: untrustedInput, timeout: 10000}, function (error, response, body) {
                if (error) {
                    failPng(res, error);
                    return;
                }
                try {
                    chart = JSON.parse(body);
                } catch (err) {
                  logger.error('Input Error', err);
                  logger.error('Input Url', untrustedInput);
                  logger.error('Input Body', body);
                  failPng(res, `Error`);
                  return;
                }
                processChart(chart);
            });
        }
    } catch (err) {
        logger.error('Input Error', err);
        failPng(res, `Invalid input\n${err}`);
        return;
    }

    function processChart(chart) {

        if (typeof chart !== 'object') {
            failPng(res, 'Failed to retrieve data');
            return;
        }

        if (chart.type === 'donut') {
            // Fix spelling...
            chart.type = 'doughnut';
        }

        // Implement default options
        chart.options = chart.options || {};
        chart.options.devicePixelRatio = 1.0;
        if (chart.type === 'bar' || chart.type === 'line' || chart.type === 'scatter' || chart.type === 'bubble') {
            if (!chart.options.scales) {
                // TODO(ian): Merge default options with provided options
                chart.options.scales = {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                        },
                    }],
                };
            }
            addBackgroundColors(chart);
        } else if (chart.type === 'radar') {
            addBackgroundColors(chart);
        } else if (chart.type === 'pie' || chart.type === 'doughnut') {
            addBackgroundColors(chart);
        } else if (chart.type === 'scatter') {
            addBackgroundColors(chart);
        } else if (chart.type === 'bubble') {
            addBackgroundColors(chart);
        }

        if (chart.type === 'line') {
            chart.data.datasets.forEach((dataset) => {
                const data = dataset;
                // Make line charts straight lines by default.
                data.lineTension = data.lineTension || 0;
            });
        }

        chart.options.plugins = chart.options.plugins || {};
        if (!chart.options.plugins.datalabels) {
            chart.options.plugins.datalabels = {};
            if (chart.type === 'pie' || chart.type === 'doughnut') {
                chart.options.plugins.datalabels = {
                    display: true,
                };
            } else {
                chart.options.plugins.datalabels = {
                    display: false,
                };
            }
        }

        logger.info('Chart:', JSON.stringify(chart));
        chart.plugins = [chartDataLabels];
        if (chart.type === 'radialGauge') {
            chart.plugins.push(chartRadialGauge);
        }

        const canvasRenderService = new CanvasRenderService(width, height, (ChartJS) => {
            const backgroundColor = req.query.backgroundColor || req.query.bkg;
            if (backgroundColor && backgroundColor !== 'transparent') {
                ChartJS.pluginService.register({
                    beforeDraw: (chartInstance) => {
                        const { ctx } = chartInstance.chart;
                        ctx.fillStyle = backgroundColor;
                        ctx.fillRect(0, 0, chartInstance.chart.width, chartInstance.chart.height);
                    },
                });
            }
        });

        try {
            canvasRenderService.renderToBuffer(chart).then((buf) => {
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': buf.length,

                    // 1 week cache
                    'Cache-Control': 'public, max-age=604800',
                });
                res.end(buf);
            }).catch((err) => {
                logger.error('Chart error', err);
                failPng(res, 'Invalid chart options');
            });
        } catch (err) {
            // canvasRenderService doesn't seem to be throwing errors correctly for
            // certain chart errors.
            logger.error('Render error', err);
            failPng(res, 'Invalid chart options');
        } finally {
            canvasRenderService.destroy();
        }
    }
});

app.get('/qr', (req, res) => {
    if (!req.query.text) {
        failPng(res, 'You are missing variable `text`');
        return;
    }

    let format = 'png';
    if (req.query.format === 'svg') {
        format = 'svg';
    }

    const margin = parseInt(req.query.margin, 10) || 4;
    const ecLevel = req.query.ecLevel || undefined;
    const size = Math.min(3000, parseInt(req.query.size, 10)) || 150;
    const darkColor = req.query.dark || '000';
    const lightColor = req.query.light || 'fff';

    let qrData;
    try {
        qrData = decodeURIComponent(req.query.text);
    } catch (err) {
        logger.error('URI malformed', err);
        failPng(res, 'URI malformed');
        return;
    }
    const qrOpts = {
        margin,
        width: size,
        errorCorrectionLevel: ecLevel,
        color: {
            dark: darkColor,
            light: lightColor,
        },
    };
    logger.info('QR code', format, qrOpts);

    const respFn = (sendBuf) => {
        res.writeHead(200, {
            'Content-Type': `image/${format}`,
            'Content-Length': sendBuf.length,

            // 1 week cache
            'Cache-Control': 'public, max-age=604800',
        });
        res.end(sendBuf);
    };

    if (format === 'svg') {
        qrcode.toString(qrData, qrOpts).then((str) => {
            respFn(Buffer.from(str, 'utf8'));
        }).catch((err) => {
            logger.error('QR render error (PNG)', err);
            failPng(res, `Error generating QR code\n${err}`);
        });
    } else {
        qrcode.toDataURL(qrData, qrOpts).then((dataUrl) => {
            respFn(Buffer.from(dataUrl.split(',')[1], 'base64'));
        }).catch((err) => {
            logger.error('QR render error (PNG)', err);
            failPng(res, `Error generating QR code\n${err}`);
        });
    }
});

const port = process.env.PORT || 3400;
const server = app.listen(port);
logger.info('NODE_ENV:', process.env.NODE_ENV);
logger.info('Running on port', port);

if (!isDev) {
    const gracefulShutdown = function gracefulShutdown() {
        logger.info('Received kill signal, shutting down gracefully.');
        server.close(() => {
            logger.info('Closed out remaining connections.');
            process.exit();
        });

        setTimeout(() => {
            logger.error('Could not close connections in time, forcefully shutting down');
            process.exit();
        }, 10 * 1000);
    };

    // listen for TERM signal .e.g. kill
    process.on('SIGTERM', gracefulShutdown);

    // listen for INT signal e.g. Ctrl-C
    process.on('SIGINT', gracefulShutdown);
}

module.exports = app;
