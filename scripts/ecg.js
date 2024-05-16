/**
 * LIVE CANVAS ECG DISPLAY
 * Live ECG data visualised with HTML Canvas and Javascript
 * 
 * Authors: Samuli Puolakka / @smappaa & Kauã Landi / @kaualandi on GitHub
 * Date: March 31st to May 16th 2024
 * License: MIT
 */

class Ecg {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.graphMargin = 20;
        this.drawing = false;
        this.x = -2;
        this.view = null;
        this.prevYpos = null;
        this.fetchedData = null;
        this.data = {};
        this.normalizeData = true;
        this.fixBreak = 0;
        //debug
        this.messageCount = 0;
        this.dataId = 0;
    }

    setDrawing(drawing) {
        this.drawing = drawing;
    }

    setView(view) {
        this.view = view;
    }

    getView() {
        return this.view;
    }

    getAvailableViews() {
        return this.data.availableViews || [];
    }

    update() {
        if(this.drawing) {
            this.draw();
            this.clear();
        } 
    }

    draw() {
        const drawTime = Date.now();
        const view = this.view;
        let dataPoints = null;

        if (this.x >= this.canvasWidth) {
            this.x = -2;
        } else {
            this.x += 2;
        }
        if (!this.objPopulated(this.data) && this.objPopulated(this.fetchedData)) {
            this.swapData();
        }
        if (this.objPopulated(this.data) && this.data.hasOwnProperty("dataPoints")) {
            for (var v in this.data.dataPoints) {
                if (this.data.dataPoints.hasOwnProperty(v) && v === view) {
                    dataPoints = this.data.dataPoints[view].concat();
                }
            }
        }
        if (dataPoints && dataPoints.length > 0) {
            if (this.data.drawingStartTime === null) {
                this.data.drawingStartTime = drawTime;
            }
            let nowMinusStart = drawTime - this.data.drawingStartTime;
            if (nowMinusStart >= this.data.dataDuration) {
                if (this.objPopulated(this.fetchedData)) {
                    this.swapData();
                    if (this.objPopulated(this.data) && this.data.hasOwnProperty("dataPoints")) {
                        dataPoints = this.data.dataPoints[view].concat();
                        nowMinusStart = drawTime - this.data.drawingStartTime;
                    }
                }
            }
            const dataPoint = dataPoints[Math.floor(nowMinusStart / this.data.dataDuration * this.data.dataPointsCount)];
            let y = this.canvasHeight - dataPoint; // Mirror dataPoint horizontally to display it correctly
            c.beginPath();
            c.moveTo(this.x - (this.fixBreak === 2 ? 3 : 1), this.prevYpos || y);
            c.lineTo(this.x + 1, y);
            c.strokeStyle = "#0f0";
            c.lineWidth = 2;
            c.stroke();
            this.fixBreak = y ? 0 : this.fixBreak += 2; // Aesthetic fix to compensate delay of populating this.data when swapData()
            this.prevYpos = this.fixBreak === 2 ? this.prevYpos : y;
        }
    }

    objPopulated(obj) {
        if (obj !== null && Object.keys(obj) !== undefined && Object.keys(obj).length > 0) return true;
        else return false;
    }

    swapData() {
        console.log("swapped:", this.fetchedData.id, "dataPointsCount:", this.fetchedData.dataPointsCount,
            "dataDuration:", this.fetchedData.dataDuration
        );
        this.data = this.fetchedData;
        this.fetchedData = null;
    }

    clear() {
        c.fillStyle = "#000";
        c.fillRect(this.x + 2, 0, 20, this.canvasHeight);
        c.fill();
    }

    processFetchedData(fetchedData) {
        let availableViews = [];
        let dataPoints = {};
        let dataPointsCount = 0;
        let fetchedViews = fetchedData.waves || null;

        //debug
        this.dataId++;

        for (var view in fetchedViews) {
            if (fetchedViews.hasOwnProperty(view)) {
                dataPoints[view] = fetchedViews[view];
                dataPointsCount = dataPointsCount ? dataPointsCount : fetchedViews[view].length;
                availableViews.push(view);
            }
        }

        if (this.view === null && availableViews[0]) {
            this.view = availableViews[0];
        }

        // Apply sorcery
        if (this.normalizeData) {
            // Vertically center data
            for (var view in dataPoints) {
                if (dataPoints.hasOwnProperty(view)) {
                    let sortedDataPoints = [];
                    sortedDataPoints = dataPoints[view].slice();
                    sortedDataPoints.sort((a, b) => { return a - b; });
                    let meanValue = sortedDataPoints[Math.floor(sortedDataPoints.length / 2)];
                    let addend = (this.canvasHeight / 2) - meanValue;
                    for (var i = 0; i < dataPoints[view].length; i++) {
                        dataPoints[view][i] += addend;
                    }
                }
            }
            // Determine how much the data has to be squeezed to fit within margins
            let meanValues = {};
            let valueMultiplier = 1;
            for (var view in dataPoints) {
                if (dataPoints.hasOwnProperty(view)) {
                    let sortedDataPoints = [];
                    let minValue, maxValue, newValueMultiplier;

                    sortedDataPoints = dataPoints[view].slice();
                    sortedDataPoints.sort((a, b) => { return a - b; });
                    minValue = Math.min(...sortedDataPoints);
                    maxValue = Math.max(...sortedDataPoints);
                    meanValues[view] = sortedDataPoints[Math.floor(sortedDataPoints.length / 2)];

                    let minValueMultiplier = (this.graphMargin - meanValues[view]) /
                        (minValue - meanValues[view]);
                    let maxValueMultiplier = ((this.canvasHeight - this.graphMargin) -
                        meanValues[view]) / (maxValue - meanValues[view]);
                    if (isNaN(minValueMultiplier) || !isFinite(minValueMultiplier)) minValueMultiplier = 1;
                    if (isNaN(maxValueMultiplier) || !isFinite(maxValueMultiplier)) maxValueMultiplier = 1;
                    newValueMultiplier = Math.min(minValueMultiplier, maxValueMultiplier);
                    valueMultiplier = Math.min(valueMultiplier, newValueMultiplier);
                }
            }
            // Vertically squeeze towards middle
            if (valueMultiplier < 1) {
                for (var view in dataPoints) {
                    if (dataPoints.hasOwnProperty(view)) {
                        for (var i = 0; i < dataPoints[view].length; i++) {
                            dataPoints[view][i] = Math.floor(((dataPoints[view][i] - meanValues[view]) * valueMultiplier) + meanValues[view]);
                        }
                    }
                }
            }
        }

        // This will break if availableViews changes during stream
        // If fetchedData has accumulated too much data, empty
        if(this.fetchedData === null || this.fetchedData.dataDuration >= 10000) {
            this.fetchedData = {};
            this.fetchedData.availableViews = availableViews;
            this.fetchedData.dataPoints = dataPoints;
            this.fetchedData.dataPointsCount = dataPointsCount;
            this.fetchedData.dataDuration = (dataPointsCount / 256) * 1000;
            this.fetchedData.drawingStartTime = null;
            this.fetchedData.id = [this.dataId];
        } else {
            for (var view in dataPoints) {
                if (dataPoints.hasOwnProperty(view)) {
                    this.fetchedData.dataPoints[view] = this.fetchedData.dataPoints[view].concat(dataPoints[view]);
                }
            }
            this.fetchedData.dataPointsCount += dataPointsCount;
            this.fetchedData.dataDuration += (dataPointsCount / 256) * 1000;
            this.fetchedData.id.push(this.dataId);
        }

        //debug
        console.log("Processed:", this.dataId);
    }
}

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");
canvas.width = window.innerWidth > 1000 ? 1000 : window.innerWidth;
canvas.height = 200;
c.fillStyle = "#000"; c.fillRect(0, 0, canvas.width, canvas.height);
c.fill();

const ecg = new Ecg(canvas.width, canvas.height);

animate = () => {
    ecg.update();
    requestAnimationFrame(animate);
}

animate();

const socket = new WebSocket('ws://54.207.148.13/wave-bed/4');

socket.onopen = function (event) {
    console.log('Connected');
}

//debug
let lastMessageTime = null;
let firstTime = null;

let firstTimeDelay = true;

socket.onmessage = function (event) {
    //debug
    ecg.messageCount++;
    let now = Date.now();
    if (firstTime == null) firstTime = now;
    let nowMinusLast = now - lastMessageTime;
    let averageDelay = Math.floor((now - firstTime) / (ecg.messageCount - 1));
    lastMessageTime = now;
    console.log("Message received:", ecg.messageCount, 
    "delay between "+(ecg.messageCount - 1)+" & "+ecg.messageCount+":", nowMinusLast, 
    "average delay:", averageDelay);

    const data = JSON.parse(event.data);
    ecg.processFetchedData(data);

    if(firstTimeDelay) {
        firstTimeDelay = false;
        setTimeout(() => {
            ecg.setDrawing(true);
        }, 3000);
    }
}