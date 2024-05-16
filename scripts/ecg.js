/**
 * LIVE CANVAS ECG DISPLAY
 * Live ECG data visualised with HTML Canvas and Javascript
 * 
 * Authors: Samuli Puolakka / @smappaa & Kauã Landi / @kaualandi on GitHub
 * Date: March 31st to May 16th 2024
 * License: MIT
 */

class Ecg {
    constructor(canvas, c) {
        this.canvas = canvas
        this.c = c;
        this.viewWidth = null;
        this.viewHeight = 140;
        this.viewMargin = 6;
        this.numbersPanelWidth = 0; // 200?
        this.numbersPanelHeight = null;
        this.drawing = false;
        this.x = -2;
        this.view = null;
        this.prevYpos = {};
        this.fetchedData = null;
        this.data = {};
        this.normalizeData = true;
        //debug
        this.messageCount = 0;
        this.dataId = 0;
    }

    canvasDimensions(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.viewWidth = this.canvas.width - this.numbersPanelWidth;
        this.numbersPanelHeight = this.canvas.height;
        this.c.fillStyle = "#000";
        this.c.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.c.fill();
    }

    setDrawing(drawing) {
        this.drawing = drawing;
    }

    getViewHeight() {
        return this.viewHeight;
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

        if (this.x >= this.viewWidth) {
            this.x = -2;
        } else {
            this.x += 2;
        }

        // First swap
        if (!this.objPopulated(this.data) && this.objPopulated(this.fetchedData)) {
            this.swapData();
            const availableViews = this.getAvailableViews();
            this.canvasDimensions(this.canvas.width, availableViews.length * this.viewHeight);
        }

        if (this.objPopulated(this.data) && this.objPopulated(this.data.dataPoints)) {
            if (this.data.drawingStartTime === null) {
                this.data.drawingStartTime = drawTime;
            }
            let nowMinusStart = drawTime - this.data.drawingStartTime;
            if (nowMinusStart >= this.data.dataDuration) {
                if (this.objPopulated(this.fetchedData)) {
                    this.swapData();
                    if (this.objPopulated(this.data) && this.objPopulated(this.data.dataPoints)) {
                        this.data.drawingStartTime = drawTime;
                        nowMinusStart = drawTime - this.data.drawingStartTime;
                    }
                }
            }

            let yAddend = 0;

            for (var view in this.data.dataPoints) {
                if (this.data.dataPoints.hasOwnProperty(view)) {
                    // Choose color according to the view
                    let color = null;
                    switch(view) {
                        case "resp" : color = "#ddd"; break;
                        default: color = "#0f0";
                    }

                    // Data point
                    const dataPoint = this.data.dataPoints[view][Math.floor(nowMinusStart / this.data.dataDuration * this.data.dataPointsCount)];
                    let y = this.viewHeight - dataPoint; // Mirror dataPoint horizontally to display it correctly
                    this.c.beginPath();
                    this.c.moveTo(this.x - 1, this.prevYpos[view] + yAddend);
                    this.c.lineTo(this.x + 1, y + yAddend);
                    this.c.strokeStyle = color;
                    this.c.lineWidth = 2;
                    this.c.stroke();
                    this.c.closePath();
                    this.prevYpos[view] = y;

                    // View title background
                    this.c.fillStyle = "#000";
                    this.c.fillRect(6, 6 + yAddend, 40, 16);
                    this.c.fill();

                    // View title
                    this.c.fillStyle = color;
                    this.c.font = "12px Arial";
                    this.c.fillText(view, 8, 18 + yAddend);

                    yAddend += this.viewHeight;
                }
            }
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
        this.c.fillStyle = "#000";
        this.c.fillRect(this.x + 2, 0, 20, this.canvas.height);
        this.c.fill();
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
                    let addend = (this.viewHeight / 2) - meanValue;
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

                    let minValueMultiplier = (this.viewMargin - meanValues[view]) /
                        (minValue - meanValues[view]);
                    let maxValueMultiplier = ((this.viewHeight - this.viewMargin) -
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
const context = canvas.getContext("2d");

const ecg = new Ecg(canvas, context);
ecg.canvasDimensions(window.innerWidth, window.innerHeight);

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