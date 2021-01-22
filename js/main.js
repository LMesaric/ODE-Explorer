'use strict';

import { TrackballControls } from 'https://unpkg.com/three@0.124.0/examples/jsm/controls/TrackballControls.js';

window.onload = () => {
    const selectList = document.getElementById("SelectSolver");
    for (const [name, solverStr] of baseSolvers) {
        const option = document.createElement("option");
        option.text = name;
        option.value = solverStr;
        selectList.appendChild(option);
    }

    txLinePlot = new Chart(document.getElementById('txChart').getContext('2d'), createConfigTX());
    xvLinePlot = new Chart(document.getElementById('xvChart').getContext('2d'), createConfigXV());

    document.getElementById("timeMaxInput").value = timeMax;
    document.getElementById("dtInput").value = dt;
    document.getElementById("kInput").value = kSpring;
    document.getElementById("mInput").value = mass;
    document.getElementById("x0Input").value = x0;
    document.getElementById("warpInput").value = warp;

    document.addEventListener('keypress', e => {
        if (e.code === "Enter" || e.code === "KeyR")
            onClickRunButton();
        if (e.code === "KeyP" || e.code === "KeyC")
            onClickPauseToggleButton();
    });

    document.getElementById("runButton").addEventListener('click', onClickRunButton);
    document.getElementById("pauseToggleButton").addEventListener('click', onClickPauseToggleButton);

    document.getElementById("x0Input").addEventListener('input', e => {
        x0 = parseFloat(e.target.value);
    });

    initThree();
    window.addEventListener('resize', onWindowResize);
};

function initThree() {
    const holder = document.getElementById("threeHolder");
    const holderBoundingRect = holder.getBoundingClientRect();
    const w = holderBoundingRect.width;
    const h = holderBoundingRect.height;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    camera.position.y = 14;
    camera.rotation.x = -40 * Math.PI / 180;
    camera.position.z = 15;
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    holder.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x464646));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.position.set(100, 100, 100);

    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;

    const shadowDist = 30;
    directionalLight.shadow.camera.left = -shadowDist;
    directionalLight.shadow.camera.right = shadowDist;
    directionalLight.shadow.camera.top = shadowDist;
    directionalLight.shadow.camera.bottom = -shadowDist;

    scene.add(directionalLight);

    const massObjectGeometry = new THREE.SphereBufferGeometry(1, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    massObject = new THREE.Mesh(massObjectGeometry, material);
    massObject.castShadow = true
    scene.add(massObject);

    const springGeometry = new THREE.BoxBufferGeometry(1, 0.5, 0.5);
    const springMaterial = new THREE.MeshPhongMaterial({ color: 0x1e1f1d });
    spring = new THREE.Mesh(springGeometry, springMaterial);
    spring.castShadow = true
    scene.add(spring);

    const planeGeometry = new THREE.PlaneBufferGeometry(200, 200);
    const planeMaterial = new THREE.MeshPhongMaterial({ color: 0xc7e8ed, side: THREE.DoubleSide });
    plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = - Math.PI / 2;
    plane.position.y = -1;
    plane.receiveShadow = true;
    scene.add(plane);

    createControls();

    render();
    animate();
}

function onWindowResize() {
    const holderBoundingRect = document.getElementById("threeHolder").getBoundingClientRect();
    const w = holderBoundingRect.width;
    const h = holderBoundingRect.height;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);

    trackballControls.handleResize();
}

function createControls() {
    trackballControls = new TrackballControls(camera, renderer.domElement);

    trackballControls.rotateSpeed = 6.0;
    trackballControls.zoomSpeed = 1.15;
    trackballControls.panSpeed = 0.6;

    trackballControls.keys = [65, 83, 68];
}

function getUserParams() {
    solverStr = document.getElementById("SelectSolver").value;
    timeMax = parseFloat(document.getElementById("timeMaxInput").value);
    dt = parseFloat(document.getElementById("dtInput").value);
    kSpring = parseFloat(document.getElementById("kInput").value);
    mass = parseFloat(document.getElementById("mInput").value);
    x0 = parseFloat(document.getElementById("x0Input").value);
    warp = parseFloat(document.getElementById("warpInput").value);

    if (timeMax <= 0 || dt <= 0 || kSpring <= 0 || mass <= 0 || warp <= 0) {
        console.error("Illegal input values, might result in an infinite loop, skipping execution!");
        return false;
    }

    return true;
}

function onClickRunButton() {
    const userParams = getUserParams();
    if (!userParams)
        return;

    const config = {
        A: math.matrix([[0, 1], [-kSpring / mass, 0]]),
        B: null,
        r: null,
        dt: dt,
        timeMax: timeMax,
        x0: math.matrix([x0, 0]),
        t0: 0,
    };

    isRunning = true;
    isPaused = false;
    document.getElementById("pauseToggleButton").innerHTML = pauseButtonText;
    goalTime = 0;

    iterator = peekable(eval(solverStr)
        .from(config.A, config.B, config.r, config.dt, config.timeMax)
        .makeIterator(config.x0, config.t0));

    plottingCallbacks.initialize();
}

function onClickPauseToggleButton() {
    if (!isRunning) return;
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById("pauseToggleButton").innerHTML = continueButtonText;
    }
    else {
        document.getElementById("pauseToggleButton").innerHTML = pauseButtonText;
    }
}

const plottingCallbacks = {
    initialize: () => {
        txLinePlot.config.options.scales.xAxes[0].ticks.suggestedMax = timeMax;

        txLinePlot.config.data.datasets = [];
        txLinePlot.config.data.datasets.push(createEmptyDataset('x (m)', colors[0]));
        txLinePlot.config.data.datasets.push(createEmptyDataset('v (m/s)', colors[1]));

        xvLinePlot.config.data.datasets = [];
        xvLinePlot.config.data.datasets.push(createEmptyDataset('', colors[0]));
    },

    looping: (tk, xk) => {
        const x = math.subset(xk, math.index(0));
        const v = math.subset(xk, math.index(1));

        txLinePlot.config.data.datasets[0].data.push({ x: tk, y: x });
        txLinePlot.config.data.datasets[1].data.push({ x: tk, y: v });

        xvLinePlot.config.data.datasets[0].data.push({ x: x, y: v });

        document.getElementById("energy").innerHTML = calculateEnergy(x, v);
    },

    update: () => {
        txLinePlot.update();
        xvLinePlot.update();
    },
};

function calculateEnergy(x, v) {
    return 1 / 2 * kSpring * x * x + 1 / 2 * mass * v * v;
}

function render() {
    renderer.render(scene, camera);
}

function animate() {
    if (lastTime < 0) lastTime = performance.now();
    const t1 = performance.now();

    const deltaTime = (t1 - lastTime) / 1000;
    lastTime = t1;

    requestAnimationFrame(animate);

    trackballControls.update();

    if (isPaused) {
        render();
        return;
    }

    if (!isRunning) {
        updateModelPosition(x0);
        render();
        return;
    }

    goalTime += deltaTime;
    const scaledGoalTime = goalTime * warp;

    let tk, xk;
    let loopExecuted = false;

    while (true) {
        const state = iterator.peek();
        if (state.done) {
            isRunning = false;
            isPaused = false;
            plottingCallbacks.update();
            break;
        }

        if (state.value[0] > scaledGoalTime) {
            break;
        }

        loopExecuted = true;
        iterator.next();  // consume

        [tk, xk] = state.value;
        plottingCallbacks.looping(tk, xk);
    }

    if (loopExecuted) {
        const currentX = math.subset(xk, math.index(0));
        updateModelPosition(currentX);

        plottingCallbacks.update();
    }

    render();
};

function updateModelPosition(currentX) {
    massObject.position.x = currentX;
    spring.position.x = currentX / 2;

    const absX = Math.abs(currentX);
    spring.scale.x = absX;

    const squishFactor = absX / kSpring + 0.03;
    const squish = Math.exp(-squishFactor * 8);
    spring.scale.y = squish;
    spring.scale.z = squish;
}

function peekable(iterator) {
    let state = iterator.next();

    const _i = (function* () {
        while (!state.done) {
            const current = state.value;
            state = iterator.next();
            yield current;
        }
        return state.value;
    })()

    _i.peek = () => state;
    return _i;
}

function createEmptyDataset(label, color) {
    return {
        label: label,
        lineTension: 0,
        backgroundColor: color,
        borderColor: color,
        data: [],
        fill: false,
    };
}

function createConfigTX() {
    return createConfigRaw(0, timeMax, -10, 10, 'time (s)', 'value', true, 'index');
}

function createConfigXV() {
    return createConfigRaw(-10, 10, -10, 10, 'x (m)', 'v (m/s)', false, 'nearest');
}

function createConfigRaw(xMin, xMax, yMin, yMax, xLabel, yLabel, showLegend, tooltipsMode) {
    return {
        type: 'line',
        data: {
            datasets: [],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: {
                display: showLegend
            },
            tooltips: {
                mode: tooltipsMode,
                intersect: true,
            },
            scales: {
                xAxes: [{
                    type: 'linear',
                    display: true,
                    ticks: {
                        suggestedMax: xMax,
                        suggestedMin: xMin,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: xLabel,
                    },
                }],
                yAxes: [{
                    type: 'linear',
                    display: true,
                    ticks: {
                        suggestedMax: yMax,
                        suggestedMin: yMin,
                    },
                    scaleLabel: {
                        display: true,
                        labelString: yLabel,
                    },
                }],
            },
            elements: {
                point: {
                    radius: 0,
                    hitRadius: 15,
                    hoverRadius: 0,
                    pointHitRadius: 0,
                },
            },
            animation: {
                duration: 0,
            },
        },
    };
}
