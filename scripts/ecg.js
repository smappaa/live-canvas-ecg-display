/**
 * LIVE CANVAS ECG DISPLAY
 * Live ECG data visualised with HTML Canvas and Javascript
 * 
 * Author: Samuli Puolakka / @smappaa on GitHub
 * Example data JSON provided by Kauã Landi / @kaualandi on GitHub
 * Date: March 31st to May 5th 2024
 * License: MIT
 */

class Ecg {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.graphMargin = 20;
        this.x = -2;
        this.view = "ecg_i";
        this.prevYpos = null;
        this.dataPoints = {};
        this.dataPointsCount = 1280;
        this.dataDuration = 5000;
        this.normalizeData = true;
        this.fetchedData = {};
        this.fetchingData = false;
        this.dataPointsDrawingStartTime = null;
        this.previousDrawTime = null;
    }

    setView(view) {
        this.view = view;
    }

    update() {
        this.draw();
        this.clear();
    }

    objEmpty(obj) {
        if (Object.keys(obj).length > 0) return true;
        else return false;
    }

    draw() {
        let drawTime = Date.now();
        let view = this.view;
        if (this.x >= this.canvasWidth) {
            this.x = -2;
        } else {
            this.x += 2;
        }
        if (!this.objEmpty(this.dataPoints) && this.objEmpty(this.fetchedData)) {
            this.processFetchedData();
        }
        let dataPoints = this.dataPoints[view];
        if (dataPoints && dataPoints.length > 0) {
            if (this.dataPointsDrawingStartTime === null) {
                this.dataPointsDrawingStartTime = drawTime;
            }
            let nowMinusStart = drawTime - this.dataPointsDrawingStartTime;
            if (nowMinusStart >= this.dataDuration) {
                this.dataPointsDrawingStartTime += this.dataDuration;
                nowMinusStart -= this.dataDuration;
                this.processFetchedData();
            }
            let dataPoint = dataPoints[Math.floor(nowMinusStart / this.dataDuration * this.dataPointsCount)];
            let y = dataPoint;
            c.beginPath();
            c.moveTo(this.x - 1, this.prevYpos || dataPoint);
            c.lineTo(this.x + 1, y);
            c.strokeStyle = "#0f0";
            c.lineWidth = 2;
            c.stroke();
            this.prevYpos = y;
        }
        this.previousDrawTime = drawTime;
    }

    processFetchedData() {
        this.dataPoints = {};
        let fetchedViews = this.fetchedData.waves || null;
        for (var view in fetchedViews) {
            if (fetchedViews.hasOwnProperty(view)) {
                this.dataPoints[view] = fetchedViews[view];
            }
        }
        // Apply sorcery
        if (this.normalizeData) {
            // Vertically center data
            for (var view in this.dataPoints) {
                if (this.dataPoints.hasOwnProperty(view)) {
                    let sortedDataPoints = [];
                    sortedDataPoints = this.dataPoints[view].slice();
                    sortedDataPoints.sort((a, b) => { return a - b; });
                    let meanValue = sortedDataPoints[Math.floor(sortedDataPoints.length / 2)];
                    let addend = (this.canvasHeight / 2) - meanValue;
                    for (var i = 0; i < this.dataPoints[view].length; i++) {
                        this.dataPoints[view][i] += addend;
                    }
                }
            }
            // Determine how much the data has to be squeezed to fit within margins
            let meanValues = {};
            let valueMultiplier = 1;
            for (var view in this.dataPoints) {
                if (this.dataPoints.hasOwnProperty(view)) {
                    let sortedDataPoints = [];
                    let minValue, maxValue, newValueMultiplier;

                    sortedDataPoints = this.dataPoints[view].slice();
                    sortedDataPoints.sort((a, b) => { return a - b; });
                    minValue = Math.min(...sortedDataPoints);
                    maxValue = Math.max(...sortedDataPoints);
                    meanValues[view] = sortedDataPoints[Math.floor(sortedDataPoints.length / 2)];

                    let minValueMultiplier = (this.graphMargin - meanValues[view]) /
                        (minValue - meanValues[view]);
                    let maxValueMultiplier = ((this.canvasHeight - this.graphMargin) -
                        meanValues[view]) / (maxValue - meanValues[view]);
                    newValueMultiplier = Math.min(minValueMultiplier, maxValueMultiplier);
                    valueMultiplier = Math.min(valueMultiplier, newValueMultiplier);
                }
            }
            // Vertically squeeze towards middle
            if (valueMultiplier < 1) {
                for (var view in this.dataPoints) {
                    if (this.dataPoints.hasOwnProperty(view)) {
                        for (var i = 0; i < this.dataPoints[view].length; i++) {
                            this.dataPoints[view][i] = Math.floor(((this.dataPoints[view][i] - meanValues[view]) * valueMultiplier) + meanValues[view]);
                        }
                    }
                }
            }
        }
        this.fetchedData = {};
    }

    clear() {
        c.fillStyle = "#000";
        c.fillRect(this.x + 2, 0, 20, this.canvasHeight);
        c.fill();
    }
}

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");


canvas.width = window.innerWidth > 1000 ? 1000 : window.innerWidth;
canvas.height = 200;

c.fillStyle = "#000"; c.fillRect(0, 0, canvas.width, canvas.height);
c.fill();

const ecg = new Ecg(canvas.width, canvas.height);

this.fetchingData = true;
const socket = new WebSocket('ws://54.207.148.13/wave-bed/4');
socket.onopen = function (event) {
    console.log('Connected');

    animate = () => {
        ecg.update();
        requestAnimationFrame(animate);
    }

    animate();
};

socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    console.log('Message received:', Object.keys(data.waves));
    ecg.fetchedData = data;
    ecg.update();
    this.fetchingData = false;
}