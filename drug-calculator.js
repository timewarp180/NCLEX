class DrugCalculator {
    constructor() {
        this.currentProblem = null;
        this.initialize();
    }

    initialize() {
        this.generateProblem();
    }

    generateProblem() {
        this.currentProblem = {
            drug: 'Heparin',
            concentration: Math.floor(Math.random() * 10000) + 5000, // 5000-15000 units
            volume: Math.floor(Math.random() * 250) + 250, // 250-500 ml
            dose: Math.floor(Math.random() * 15) + 10, // 10-25 units/kg/hr
            weight: Math.floor(Math.random() * 90) + 40 // 40-130 kg
        };

        return `A patient (${this.currentProblem.weight}kg) requires ${this.currentProblem.dose} units/kg/hr of ${this.currentProblem.drug}. 
                The IV bag contains ${this.currentProblem.concentration} units in ${this.currentProblem.volume}ml. 
                Calculate the infusion rate in ml/hr.`;
    }

    checkAnswer(userAnswer) {
        const correctAnswer = (this.currentProblem.dose * this.currentProblem.weight * this.currentProblem.volume) / 
                            this.currentProblem.concentration;
        return Math.abs(userAnswer - correctAnswer) < 0.1;
    }
}