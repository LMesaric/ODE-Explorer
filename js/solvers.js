'use strict';

class LinearDifferentialSolver {
    constructor() {
        this.A = this.B = this.r = this.T = this.timeMax = null;
    }

    from(A, B, r, T, timeMax) {
        this.A = A;
        this.B = B;
        this.r = r;
        this.T = T;
        this.timeMax = timeMax;
        return this;
    }

    static evalLinearRaw(x, t, A, B, r) {
        let res = math.multiply(A, x);
        if (r !== null)
            res = math.add(res, math.multiply(B, r(t)));
        return res;
    }

    evalLinear(x, t) {
        return LinearDifferentialSolver.evalLinearRaw(x, t, this.A, this.B, this.r);
    }

    nextStep(xk, tk) {
        if (tk >= this.timeMax)
            return [xk, true];
        return [this.nextStepInternal(xk, tk), false];
    }

    nextStepInternal(xk, tk) {
        throw new Error("Not implemented");
    }

    *makeIterator(x0, t0) {
        let i = 0, xk = x0, isDone = false;
        do {
            const tk = t0 + i * this.T;  // Avoid (most) numerical errors caused by += this.T
            yield [tk, xk, i++];
            [xk, isDone] = this.nextStep(xk, tk);
        } while (!isDone);
    }
}

class ForwardEuler extends LinearDifferentialSolver {
    from(A, B, r, T, timeMax) {
        return super.from(A, B, r, T, timeMax);
    }

    nextStepInternal(xk, tk) {
        const derX = this.evalLinear(xk, tk);
        const deltaX = math.multiply(this.T, derX);
        return math.add(xk, deltaX);
    }
}

class BackwardEuler extends LinearDifferentialSolver {
    from(A, B, r, T, timeMax) {
        super.from(A, B, r, T, timeMax);

        this.P = math.inv(math.subtract(math.identity(math.size(this.A)), math.multiply(this.A, this.T)));
        if (this.B !== null)
            this.Q = math.multiply(this.P, this.T, this.B);

        return this;
    }

    evalLinear(x, t) {
        return BackwardEuler.evalLinearRaw(x, t, this.P, this.Q, this.r);
    }

    nextStepInternal(xk, tk) {
        return this.evalLinear(xk, tk + this.T);
    }
}

class SymplecticEuler extends LinearDifferentialSolver {
    from(A, B, r, T, timeMax) {
        // Hacky ignore of B and r, extracting k/m from matrix - works only for this spring model.
        const omegaSq = -math.subset(A, math.index(1, 0));
        A = math.matrix([[1 - omegaSq * T * T, T], [-omegaSq * T, 1]]);
        super.from(A, null, null, T, timeMax);
        return this;
    }

    nextStepInternal(xk, tk) {
        return this.evalLinear(xk, tk);
    }
}

class Trapezoidal extends LinearDifferentialSolver {
    from(A, B, r, T, timeMax) {
        super.from(A, B, r, T, timeMax);

        const AT2 = math.multiply(this.A, this.T / 2);
        const E = math.identity(math.size(this.A));
        const m1 = math.inv(math.subtract(E, AT2));
        this.R = math.multiply(m1, math.add(E, AT2));

        if (this.B !== null)
            this.S = math.multiply(m1, this.T / 2, this.B);

        return this;
    }

    nextStepInternal(xk, tk) {
        let res = math.multiply(this.R, xk);
        if (this.r !== null)
            res = math.add(res, math.multiply(this.S, math.add(this.r(tk), this.r(tk + this.T))));
        return res;
    }
}

class RungeKutta4 extends LinearDifferentialSolver {
    from(A, B, r, T, timeMax) {
        return super.from(A, B, r, T, timeMax);
    }

    nextStepInternal(xk, tk) {
        const T2 = this.T / 2;
        const m1 = this.evalLinear(xk, tk);
        const m2 = this.evalLinear(math.add(xk, math.multiply(T2, m1)), tk + T2);
        const m3 = this.evalLinear(math.add(xk, math.multiply(T2, m2)), tk + T2);
        const m4 = this.evalLinear(math.add(xk, math.multiply(this.T, m3)), tk + this.T);
        const deltaX = math.multiply(this.T / 6, math.add(m1, math.multiply(2, m2), math.multiply(2, m3), m4));

        return math.add(xk, deltaX);
    }
}

class PredictorCorrector extends LinearDifferentialSolver {
    constructor(predictor, corrector, loopCnt) {
        super();
        this.predictor = predictor;
        this.corrector = corrector;
        this.loopCnt = loopCnt;

        this.predictorFunc = null;
        this.correctorFunc = null;
    }

    from(A, B, r, T, timeMax) {
        super.from(A, B, r, T, timeMax);

        const fe = new ForwardEuler().from(this.A, this.B, this.r, this.T, this.timeMax);
        const rk = new RungeKutta4().from(this.A, this.B, this.r, this.T, this.timeMax);
        const mapping = new Map([
            ['forward-euler', (xk, tk) => fe.nextStepInternal(xk, tk)],
            ['runge-kutta-4', (xk, tk) => rk.nextStepInternal(xk, tk)],
            ['backward-euler', (xk, xk1, tk) => math.add(xk, math.multiply(this.T, this.evalLinear(xk1, tk + this.T)))],
            ['trapezoidal', (xk, xk1, tk) => math.add(xk, math.multiply(this.T / 2, math.add(this.evalLinear(xk, tk), this.evalLinear(xk1, tk + this.T))))],
        ]);

        this.predictorFunc = mapping.get(this.predictor);
        this.correctorFunc = mapping.get(this.corrector);
        if (!this.predictorFunc || !this.correctorFunc)
            throw new Error(`Invalid parameter: ${this.predictor} or ${this.corrector}`);
        return this;
    }

    nextStepInternal(xk, tk) {
        let xk1Predicted = this.predictorFunc(xk, tk);
        for (let i = 0; i < this.loopCnt; i++) {
            xk1Predicted = this.correctorFunc(xk, xk1Predicted, tk);
        }
        return xk1Predicted;
    }
}
