const baseSolvers = new Map([
    ["Forward Euler", "new ForwardEuler()"],
    ["Backward Euler", "new BackwardEuler()"],
    ["Trapezoidal", "new Trapezoidal()"],
    ["Heun's method", "new PredictorCorrector('forward-euler', 'trapezoidal', 1)"],
    ["Runge-Kutta 4", "new RungeKutta4()"],
]);

const colors = [
    'rgb(255, 50, 50)',
    'rgb(50, 255, 50)',
    'rgb(50, 50, 255)',
];

const pauseButtonText = "<u>P</u>ause";
const continueButtonText = "<u>C</u>ontinue";

let scene, camera, renderer;
let massObject, spring, plane;
let trackballControls;

let solverStr;
let timeMax = 20;
let dt = 0.01;
let kSpring = 200;
let mass = 10;
let x0 = 5;
let warp = 1;

let iterator;

let txLinePlot, xvLinePlot;

let lastTime = -1;
let goalTime = 0;

let isRunning = false;
let isPaused = false;
