/**
 * LIVE CANVAS ECG DISPLAY
 * Live ECG data visualised with HTML Canvas and Javascript
 * 
 * Authors: Samuli Puolakka / @smappaa & Kauã Landi / @kaualandi on GitHub
 * Date: March 31st to May 28th 2024
 * License: MIT
 */

class Ecg {
    constructor(canvas, c) {
        this.canvas = canvas
        this.c = c;
        this.viewDimensions = { w: null, h: null, m: 6 };
        this.parametersPanelDimensions = { w: 320, h: null };
        this.parameters = {
            HR: { val: 0, min: 0, max: 0, col: "#3ede0d" },
            TEMP: { val: 0, min: 0, max: 0, col: "#ddd" },
            SpO2: { val: 0, min: 0, max: 0, col: "#f0e040" },
            RR: { val: 0, min: 0, max: 0, col: "#ddd" },
            NIBP: { val: [0, 0, 0], min: 0, max: 0, col: "#f05030" }
        }
        this.drawing = false;
        this.x = -2;
        this.views = [];
        this.viewsLimit = 3;
        this.prevYpos = {};
        this.fetchedData = null;
        this.data = {};
        this.normalizeData = true;
        this.resetToPoint = null; // 50
        this.lastRespValue = null;
        this.respAddend = null;
        //debug
        this.messageCount = 0;
        this.dataId = 0;
    }

    setDrawing(drawing) {
        this.drawing = drawing;
    }

    getAvailableViews() {
        return this.data.availableViews?.filter((v) => !this.views.includes(v)) || [];
    }

    getViewAtPosition(x, y) {
        if(x <= this.viewDimensions.w) {
            return this.views[Math.floor(y / this.viewDimensions.h)] || null;
        } else return null;
    }

    canvasDimensions(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.viewDimensions.w = this.canvas.width - this.parametersPanelDimensions.w;
        this.viewDimensions.h = Math.floor(this.canvas.height / 3);
        this.parametersPanelDimensions.h = this.canvas.height;

        this.c.fillStyle = "#000";
        this.c.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.c.fill();
        this.drawParameters();
    }

    drawParameters() {
        let p = this.parameters;
        let xAddend = 0;
        let yAddend = 0;

        for (var i in p) {
            // NIBP is 2x the width of normal parameter "tile"
            const tileWidth = i === "NIBP" ? this.parametersPanelDimensions.w : this.parametersPanelDimensions.w / 2;

            // Clear
            this.c.fillStyle = "#000";
            this.c.fillRect(this.viewDimensions.w + xAddend, yAddend, tileWidth, this.viewDimensions.h);
            this.c.fill();

            // Title
            this.c.fillStyle = p[i].col;
            this.c.font = "bold 14px Arial"
            this.c.fontStretch = "normal";
            this.c.textAlign = "left";
            this.c.fillText(i, this.viewDimensions.w + 10 + xAddend, 18 + yAddend);

            // Min & max
            this.c.font = "bold 14px Arial"
            this.c.fillText(p[i].min, this.viewDimensions.w + 10 + xAddend, this.viewDimensions.h - 12 + yAddend);
            this.c.fillText(p[i].max, this.viewDimensions.w + 10 + xAddend, this.viewDimensions.h - 28 + yAddend);

            // Value
            this.c.font = "bold 80px Arial";
            this.c.fontStretch = "condensed";
            this.c.textAlign = "center";
            if(i === "NIBP") {
                let value = p[i].val[0] + "/" + p[i].val[1];
                this.c.font = "bold 60px Arial";
                this.c.fillText(value, this.viewDimensions.w + (tileWidth / 2), this.viewDimensions.h / 2.25 + yAddend);
                value = "(" + p[i].val[2] + ")";
                this.c.font = "bold 46px Arial";
                this.c.fillText(value, this.viewDimensions.w + (tileWidth / 2), this.viewDimensions.h / 1.25 + yAddend);
            } else {
                this.c.fillText(p[i].val, this.viewDimensions.w + (tileWidth / 1.75) + xAddend, this.viewDimensions.h / 1.5 + yAddend);
            }

            // Starting position for drawing of the next parameter
            if(tileWidth === this.parametersPanelDimensions.w || xAddend > 0) {
                xAddend = 0;
                yAddend += this.viewDimensions.h;
            } else {
                xAddend = tileWidth;
            }
        }
    }

    update() {
        if (this.drawing) {
            this.draw();
            this.clear();
        }
    }

    draw() {
        const drawTime = Date.now();

        if (this.x >= this.viewDimensions.w - 2) {
            this.x = -2;
        } else {
            this.x += 2;
        }

        // First swap
        if (!this.objPopulated(this.data) && this.objPopulated(this.fetchedData)) {
            this.swapData();
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

            this.views.forEach(view => {
                if (this.data.dataPoints.hasOwnProperty(view)) {
                    // Choose color according to the view
                    let color = null;
                    switch (view) {
                        case "pleth": color = "#f0e040"; break;
                        case "plenth": color = "#f0e040"; break;
                        case "resp": color = "#ddd"; break;
                        default: color = "#3ede0d";
                    }

                    // Data point
                    const dataPoint = this.data.dataPoints[view][Math.floor(nowMinusStart / this.data.dataDuration * this.data.dataPointsCount)] || this.resetToPoint;
                    let y = this.viewDimensions.h - dataPoint;
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
                    this.c.fillRect(6, 6 + yAddend, 44, 16);
                    this.c.fill();

                    // View title
                    this.c.fillStyle = color;
                    this.c.font = "bold 12px Arial";
                    this.c.textAlign = "left";
                    this.c.fontStretch = "normal";
                    let text = view.includes("ecg_") ? view.replace("ecg_", "").toUpperCase() : view;
                    this.c.fillText(text, 8, 18 + yAddend);

                    yAddend += this.viewDimensions.h;
                }
            });
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

    clear(index) {
        this.c.fillStyle = "#000";
        if(index) {
            this.c.fillRect(0, index * this.viewDimensions.h, this.viewDimensions.w, this.viewDimensions.h);
        } else if(this.x < this.viewDimensions.w - 20) {
            this.c.fillRect(this.x + 2, 0, 20, this.canvas.height);
        }
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

                // Normalize the amount of resp dataPoints by doubling them
                if (view == "resp") {
                    let newDataPoints = [];
                    for (var i = 0; i < dataPoints[view].length; i++) {
                        newDataPoints.push(dataPoints[view][i]);
                        newDataPoints.push(dataPoints[view][i]);
                    }
                    dataPoints[view] = newDataPoints;
                }

                dataPointsCount = dataPointsCount ? dataPointsCount : fetchedViews[view].length;
                availableViews.push(view);
            }
        }

        if (this.views.length === 0 && availableViews.length > 0) {
            let hasECG = false;
            for(var i = 0; i < availableViews.length; i++) {
                if(this.views.length < this.viewsLimit) {
                    if(availableViews[i].includes("ecg_")) {
                        if(hasECG === false) {
                            this.views.push(availableViews[i]);
                            hasECG = true;
                        }
                    } else {
                        this.views.push(availableViews[i]);
                    }
                }
            }
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
                    let addend = (this.viewDimensions.h / 2) - meanValue;
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

                    let minValueMultiplier = (this.viewDimensions.m - meanValues[view]) /
                        (minValue - meanValues[view]);
                    let maxValueMultiplier = ((this.viewDimensions.h - this.viewDimensions.m) -
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
        if (this.fetchedData === null || this.fetchedData.dataDuration >= 10000) {
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

    updateParameters(params) {
        let p = this.parameters;
        params.forEach(obj => {
            if(obj.channel === "ECG" && obj.unit === "bpm") {
                p.HR.val = obj.value;
                p.HR.min = obj.alarm.min;
                p.HR.max = obj.alarm.max;
            }
            if(obj.channel === "SPO2") {
                p.SpO2.val = obj.value;
                p.SpO2.min = obj.alarm.min;
                p.SpO2.max = obj.alarm.max;
            }
            if(obj.channel === "RESP") {
                p.RR.val = obj.value;
                p.RR.min = obj.alarm.min;
                p.RR.max = obj.alarm.max;
            }
            if(obj.channel === "PNI" && obj.name === "PNI_SIST") {
                p.NIBP.val[0] = obj.value;
                p.NIBP.min = obj.alarm.min;
                p.NIBP.max = obj.alarm.max;
            }
            if(obj.channel === "PNI" && obj.name === "PNI_DIAS") {
                p.NIBP.val[1] = obj.value;
            }
            if(obj.channel === "PNI" && obj.name === "PNI_MED") {
                p.NIBP.val[2] = obj.value;
            }
            if(obj.channel === "TEMP") {
                p.TEMP.val = obj.value;
                p.TEMP.min = obj.alarm.min;
                p.TEMP.max = obj.alarm.max;
            }
        });
        this.drawParameters();
    }

    switchView(prev, next) {
        const index = this.views.indexOf(prev);
        this.clear(index);
        this.views[index] = next;
    }
}

// Canvas initialization
const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");

const ecg = new Ecg(canvas, context);
ecg.canvasDimensions(window.innerWidth, window.innerHeight);

animate = () => {
    ecg.update();
    requestAnimationFrame(animate);
}
animate();


// Function to handle view switching menu item click events
menuItemClick = (e) => {
    ecg.switchView(switchingView, e.getAttribute("data-view"));
    switchingView = null;
    menu.innerHTML = "";
    menu.classList.remove("open");
}

const menu = document.querySelector("menu");
let switchingView = null;


// Function to handle view clicks to toggle view switching menu
canvas.addEventListener("click", event => {
    if(switchingView) {
        switchingView = null;
        menu.innerHTML = "";
        menu.classList.remove("open");
    } else {
        let x = event.clientX;
        let y = event.clientY;
        switchingView = ecg.getViewAtPosition(x, y);
        let availableViews = ecg.getAvailableViews();
        if(switchingView && availableViews.length) {
            let html = "";
            availableViews.forEach(v => {
                html += `
                <li data-view="${v}" onclick="menuItemClick(this)">${v.replace("ecg_", "").toUpperCase()}</li>`;
            });
            menu.innerHTML = html;
            menu.classList.add("open");
            menu.style.left = x + "px";
            if(y + menu.offsetHeight > window.innerHeight) {
                menu.style.top = "";
                menu.style.bottom = "0px";
            } else {
                menu.style.top = y + "px";
                menu.style.bottom = "";
                
            }
        }
    }
});


// Connections
const socketWaves = new WebSocket('ws://54.207.148.13/wave-bed/4');

socketWaves.onopen = function (event) {
    console.log('Waves connected');
}

//debug
let lastMessageTime = null;
let firstTime = null;

let firstTimeDelay = true;

socketWaves.onmessage = function (event) {
    //debug
    ecg.messageCount++;
    let now = Date.now();
    if (firstTime == null) firstTime = now;
    let nowMinusLast = now - lastMessageTime;
    let averageDelay = Math.floor((now - firstTime) / (ecg.messageCount - 1));
    lastMessageTime = now;
    console.log("Message received:", ecg.messageCount,
        "delay between " + (ecg.messageCount - 1) + " & " + ecg.messageCount + ":", nowMinusLast,
        "average delay:", averageDelay);

    const data = JSON.parse(event.data);
    ecg.processFetchedData(data);

    if (firstTimeDelay) {
        firstTimeDelay = false;
        setTimeout(() => {
            ecg.setDrawing(true);
        }, 3000);
    }
}

const socketParameters = new WebSocket('ws://54.207.148.13/monitor_param/');
socketParameters.onopen = function (event) {
    console.log('Parameters connected');
}

socketParameters.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.id !== 4) return; // Filter selected monitor
    // Numerical parameters received
    console.log("data:", data.params);
    ecg.updateParameters(data.params);
    // * param.channel is the channel name
    // * param.value is the value of the parameter
    // ? Some of the fields have minimum and maximum values, which must be specified in the bottom left-hand corner, as in the printout below.
    // ? These values are located at:
    // * Min: param.alarm.min
    // * Max: param.alarm.max
    // ? Some fields do not have the “alarm” object, so this must be dealt with.
}