const QUESTION_CONTAINER = document.getElementById('question-container');
const ANSWER_BUTTONS = document.getElementById('answer-buttons');
const NEXT_BTN = document.getElementById('next-btn');
const drugCalculator = new DrugCalculator();

class NCLEXQuiz {
    constructor() {
        this.questions = questions;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.quizMode = 'untimed';
        this.quizDifficulty = 'all';
        this.selectedCategories = [];
        this.userAnswers = [];
        this.weakAreas = JSON.parse(localStorage.getItem('weakAreas')) || {};
        this.analytics = JSON.parse(localStorage.getItem('quizAnalytics')) || {
            totalQuestions: 0,
            correctAnswers: 0,
            timeSpent: 0,
            categories: {},
            difficulties: {}
        };
        this.quizAnalytics = {
            totalQuestions: 0,
            correctAnswers: 0,
            categories: {},
            difficulties: {}
        };
        this.chart = null; // Initialize chart variable
        this.draggedItem = null;
        this.medicationMatches = new Map();
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.displayCategories();
        this.hideAllSections();
        this.showElement('category-selection');
        this.setupTimer();
        this.initializeChart();
    }

    setupEventListeners() {
        document.getElementById('start-quiz-btn').addEventListener('click', () => this.startQuiz());
        document.getElementById('prev-btn').addEventListener('click', () => this.showPreviousQuestion());
        document.getElementById('next-btn').addEventListener('click', () => this.showNextQuestion());
        document.getElementById('submit-btn').addEventListener('click', () => this.showResults());
        document.getElementById('quiz-mode').addEventListener('change', (e) => this.setQuizMode(e.target.value));
        document.getElementById('quiz-difficulty').addEventListener('change', (e) => this.setQuizDifficulty(e.target.value));
        document.getElementById('review-incorrect-btn').addEventListener('click', () => this.reviewIncorrectAnswers());
        document.getElementById('new-quiz-btn').addEventListener('click', () => location.reload());
        document.getElementById('review-weak-btn').addEventListener('click', () => this.reviewWeakAreas());
    }

    setQuizMode(mode) {
        this.quizMode = mode;
        if (mode === 'timed') {
            this.startTimer();
        } else {
            this.stopTimer();
        }
    }
    setQuizDifficulty(difficulty) {
        this.quizDifficulty = difficulty;
    }

    setupTimer() {
        this.timerInterval = null;
        this.timeElapsed = 0;
        document.getElementById('timer').textContent = '00:00';
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeElapsed++;
            const minutes = Math.floor(this.timeElapsed / 60);
            const seconds = this.timeElapsed % 60;
            document.getElementById('timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timerInterval);
    }
    initializeChart() {
        if (this.chart) this.chart.destroy();
    
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;
    
        // Prepare data
        const categories = Object.keys(this.analytics.categories);
        const correctData = categories.map(c => Math.max(this.analytics.categories[c], 0));
        const incorrectData = categories.map(c => Math.abs(Math.min(this.analytics.categories[c], 0)));
    
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [
                    {
                        label: 'Correct Answers',
                        data: correctData,
                        backgroundColor: '#28a745',
                        borderColor: '#218838',
                        borderWidth: 1
                    },
                    {
                        label: 'Incorrect Answers',
                        data: incorrectData,
                        backgroundColor: '#dc3545',
                        borderColor: '#c82333',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;
        
        // Get category performance data
        const categories = Object.keys(this.analytics.categories);
        const scores = Object.values(this.analytics.categories);
        
        // Update chart data
        this.chart.data.labels = categories;
        this.chart.data.datasets[0].data = scores;
        
        // Add animation when updating
        this.chart.update({
            duration: 800,
            easing: 'easeOutQuart'
        });
    }

    
    displayCategories() {
        const categories = [...new Set(this.questions.map(q => q.category))];
        const container = document.getElementById('category-buttons');
        container.innerHTML = '';
        
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-primary category-btn';
            button.textContent = category;
            button.addEventListener('click', () => this.toggleCategory(category, button));
            container.appendChild(button);
        });
    }

    toggleCategory(category, button) {
        button.classList.toggle('btn-primary');
        button.classList.toggle('btn-outline-primary');
        
        if (this.selectedCategories.includes(category)) {
            this.selectedCategories = this.selectedCategories.filter(c => c !== category);
        } else {
            this.selectedCategories.push(category);
        }
    }

    startQuiz() {
        if (this.selectedCategories.length === 0) {
            alert('Please select at least one category');
            return;
        }

        // Filter questions based on selected categories and difficulty
        this.filteredQuestions = this.questions.filter(q => {
            const categoryMatch = this.selectedCategories.includes(q.category);
            const difficultyMatch = this.quizDifficulty === 'all' || q.difficulty === this.quizDifficulty;
            return categoryMatch && difficultyMatch;
        });
        
        if (this.filteredQuestions.length === 0) {
            alert('No questions found with the selected criteria');
            return;
        }

        this.hideAllSections();
        this.showElement('question-container');
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = new Array(this.filteredQuestions.length).fill(null);
        this.showQuestion();
        this.updateProgress();
        this.updateAnalytics('startQuiz');
    }

    showQuestion() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const questionText = document.getElementById('question-text');
        const answerButtons = document.getElementById('answer-buttons');

        // Clear previous content
        answerButtons.innerHTML = '';

        // Display question header
        questionText.innerHTML = `
            <div class="question-header mb-3">
                <span class="badge bg-secondary">${question.category}</span>
                <span class="badge ${this.getDifficultyClass(question.difficulty)}">
                    ${question.difficulty}
                </span>
            </div>
            <div class="question-body">${question.question}</div>
        `;

        // Render question based on type
        switch (question.type) {
            case 'multiple-choice':
                this.renderMultipleChoice(question);
                break;
            case 'fill-blank':
                this.renderFillBlank(question);
                break;
            case 'select-all':
                this.renderSelectAll(question);
                break;
            case 'priority':
                this.renderPriority(question);
                break;
            case 'medication-matching':
                this.renderMedicationMatching(question);
                break;
            case 'scenario-dropdown':
                this.renderScenarioDropdown(question);
                break;
            default:
                console.error('Unknown question type:', question.type);
        }

        this.updateNavigation();
        this.updateQuestionStatus();
    }

    renderMultipleChoice(question) {
        question.answers.forEach((answer, index) => {
            const button = document.createElement('button');
            button.className = `btn btn-light answer-btn text-start`;
            button.innerHTML = answer.text;
            button.onclick = () => this.selectAnswer(index, answer.correct);
            ANSWER_BUTTONS.appendChild(button);
        });
    }

    renderFillBlank(question) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control mb-3';
        input.id = 'fill-blank-input';
        ANSWER_BUTTONS.appendChild(input);
    }


    checkFillBlank() {
        const userAnswer = document.getElementById('fill-blank-input').value.trim().toLowerCase();
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const correctAnswers = question.answers.map(a => a.text.toLowerCase());
        const isCorrect = correctAnswers.includes(userAnswer);

        // Store user answer
        this.userAnswers[this.currentQuestionIndex] = userAnswer;
        
        // Update score
        if (isCorrect) this.score++;
        
        this.processAnswer(isCorrect);
        this.showAnswerFeedback(isCorrect, correctAnswers[0]);
        this.updateAnalytics(isCorrect ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    renderSelectAll(question) {
        question.answers.forEach((answer, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'form-check';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.id = `answer-${index}`;

            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `answer-${index}`;
            label.textContent = answer.text;

            wrapper.append(input, label);
            ANSWER_BUTTONS.appendChild(wrapper);
        });
    }
   
    checkSelectAll() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const checkboxes = document.querySelectorAll('.form-check-input');
        const userAnswers = [];
        let correctCount = 0;

        checkboxes.forEach((checkbox, index) => {
            if (checkbox.checked) {
                userAnswers.push(question.answers[index].text);
                if (question.answers[index].correct) correctCount++;
            }
        });

        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userAnswers;

        // Calculate score (1 point per correct answer)
        const totalCorrect = question.answers.filter(a => a.correct).length;
        const score = correctCount / totalCorrect;
        this.score += score;

        this.processAnswer(score === 1);
        this.updateAnalytics(score === 1 ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    renderPriority(question) {
        const list = document.createElement('div');
        list.id = 'priority-list';
        list.className = 'priority-list';

        question.answers.forEach(answer => {
            const item = document.createElement('div');
            item.className = 'priority-item btn btn-light mb-2';
            item.draggable = true;
            item.textContent = answer.text;
            list.appendChild(item);
        });

        ANSWER_BUTTONS.appendChild(list);
        new Sortable(list, { animation: 150 });
    }

    checkPriority() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const items = [...document.querySelectorAll('.priority-item')];
        const userOrder = items.map(item => item.textContent);
        const correctOrder = question.answers.sort((a, b) => a.correctPosition - b.correctPosition).map(a => a.text);

        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userOrder;

        // Calculate score (1 point per correct position)
        const correctPositions = userOrder.filter((text, index) => text === correctOrder[index]).length;
        const score = correctPositions / correctOrder.length;
        this.score += score;

        this.processAnswer(score === 1);
        this.updateAnalytics(score === 1 ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    // Add this method to render medication matching questions
    renderMedicationMatching(question) {
        const container = document.createElement('div');
        container.className = 'matching-container';

        // Medications Column
        const medCol = document.createElement('div');
        medCol.className = 'matching-column medications';
        question.pairs.forEach(pair => {
            const div = document.createElement('div');
            div.className = 'med-item';
            div.draggable = true;
            div.textContent = pair.medication;
            medCol.appendChild(div);
        });

        // Antidotes Column
        const antiCol = document.createElement('div');
        antiCol.className = 'matching-column antidotes';
        question.pairs.forEach(pair => {
            const div = document.createElement('div');
            div.className = 'anti-item';
            div.textContent = pair.antidote;
            antiCol.appendChild(div);
        });

        container.append(medCol, antiCol);
        ANSWER_BUTTONS.appendChild(container);
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        let draggedItem = null;

        document.querySelectorAll('.med-item').forEach(item => {
            item.addEventListener('dragstart', () => {
                draggedItem = item;
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', () => {
                draggedItem = null;
                item.style.opacity = '1';
            });
        });

        document.querySelectorAll('.anti-item').forEach(target => {
            target.addEventListener('dragover', e => e.preventDefault());

            target.addEventListener('drop', e => {
                e.preventDefault();
                if (!draggedItem) return;

                const medication = draggedItem.textContent;
                const antidote = target.textContent;
                const isCorrect = this.filteredQuestions[this.currentQuestionIndex].pairs.some(p => 
                    p.medication === medication && p.antidote === antidote
                );

                // Visual feedback
                target.style.backgroundColor = isCorrect ? '#d4edda' : '#f8d7da'; // Green for correct, red for incorrect
                draggedItem.style.display = 'none';

                // Store the match
                this.medicationMatches.set(medication, antidote);
            });
        });
    }

    
    checkAnswer() {
        const question = this.filteredQuestions[this.currentQuestionIndex];

        switch (question.type) {
            case 'multiple-choice':
                // Handled by selectAnswer()
                break;
            case 'fill-blank':
                this.checkFillBlank();
                break;
            case 'select-all':
                this.checkSelectAll();
                break;
            case 'priority':
                this.checkPriority();
                break;
            case 'medication-matching':
                this.checkMedicationMatching();
                break;
        }
    }
    
    submitAnswer() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
    
        switch (question.type) {
            case 'fill-blank':
                this.checkFillBlank();
                break;
            case 'select-all':
                this.checkSelectAll();
                break;
            case 'priority':
                this.checkPriority();
                break;
            case 'medication-matching':
                this.checkMedicationMatching();
                break;
            default:
                // Multiple-choice is handled by selectAnswer()
                break;
        }
    
        this.updateNavigation();
    }

    // Add this method to check medication matching answers
    checkMedicationMatching() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const userAnswers = Array.from(this.medicationMatches.entries()).map(([med, anti]) => ({ medication: med, antidote: anti }));
        const correctPairs = question.pairs;

        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userAnswers;

        // Calculate score (1 point per correct match)
        const correctMatches = userAnswers.filter(pair => 
            correctPairs.some(cp => cp.medication === pair.medication && cp.antidote === pair.antidote)
        ).length;

        const score = correctMatches / correctPairs.length;
        this.score += score;

        this.processAnswer(score === 1);
        this.updateAnalytics(score === 1 ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    processAnswer(isCorrect) {
        if (isCorrect) this.analytics.correctAnswers++;
        NEXT_BTN.classList.remove('hide');
        ANSWER_BUTTONS.querySelectorAll('input, button').forEach(el => el.disabled = true);
    }

    showAnswerFeedback(isCorrect, correctAnswer) {
        const feedback = document.createElement('div');
        feedback.className = `alert ${isCorrect ? 'alert-success' : 'alert-danger'} mt-3`;
        feedback.textContent = isCorrect ? 'Correct!' : `Correct answer: ${correctAnswer}`;
        ANSWER_BUTTONS.appendChild(feedback);
    }

    handleDragStart(e) {
        draggedItem = e.target;
        e.target.style.opacity = '0.5';
    }
    
     handleDragEnd(e) {
        e.target.style.opacity = '1';
        draggedItem = null;
    }
    
     handleDragOver(e) {
        e.preventDefault();
    }
    
     handleDrop(e) {
        e.preventDefault();
        const antidote = e.target.textContent;
        const medication = draggedItem.textContent;
        const correctPair = currentQuestion.pairs.find(p => p.medication === medication);
        
        if(correctPair.antidote === antidote) {
            e.target.style.backgroundColor = '#d4edda';
            draggedItem.style.display = 'none';
        } else {
            e.target.style.backgroundColor = '#f8d7da';
        }
    }

    calculateSataScore(question) {
        const selected = [...document.querySelectorAll('.sata-btn input:checked')];
        const totalPossible = question.answers.filter(a => a.correct).length;
        
        let correct = 0, incorrect = 0;
        selected.forEach(checkbox => {
            const answerIndex = parseInt(checkbox.dataset.index);
            question.answers[answerIndex].correct ? correct++ : incorrect++;
        });
        
        // Partial credit formula: (correct - incorrect)/totalPossible
        const rawScore = (correct - incorrect)/totalPossible;
        return Math.max(0, rawScore);
    }

    checkPriorityOrder() {
        const items = [...document.querySelectorAll('.priority-item')];
        const score = items.reduce((acc, item, index) => {
            const correctPos = currentQuestion.answers.find(a => a.text === item.textContent).correctPosition;
            return acc + (index + 1 === correctPos ? 1 : 0);
        }, 0);
        
        // Calculate percentage score
        const percentage = (score / currentQuestion.answers.length) * 100;
    }

    checkFillBlank() {
        const userAnswer = document.getElementById('fill-blank-input').value.trim().toLowerCase();
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const correctAnswers = question.answers.map(a => a.text.toLowerCase());
        const isCorrect = correctAnswers.includes(userAnswer);

        // Store user answer
        this.userAnswers[this.currentQuestionIndex] = userAnswer;

        // Update score
        if (isCorrect) this.score++;

        this.processAnswer(isCorrect);
        this.updateAnalytics(isCorrect ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    
     showCorrectAnswerFeedback() {
        const feedback = document.createElement('div');
        feedback.className = 'valid-feedback mt-2';
        feedback.textContent = 'Correct!';
        document.querySelector('.fill-blank-container').appendChild(feedback);
    }
    
     showIncorrectAnswerFeedback(correctAnswer) {
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback mt-2';
        feedback.innerHTML = `Incorrect. The correct answer is: <strong>${correctAnswer}</strong>`;
        document.querySelector('.fill-blank-container').appendChild(feedback);
        
        // Store incorrect answer for review
        currentQuestion.userAnswer = document.getElementById('fill-blank-input').value;
    }

    calculateSataScore(question) {
        const selected = [...document.querySelectorAll('.sata-btn input:checked')];
        const totalCorrect = question.answers.filter(a => a.correct).length;
        
        let score = 0;
        selected.forEach(checkbox => {
            const answerIndex = parseInt(checkbox.dataset.index);
            if (question.answers[answerIndex].correct) score++;
            else score--;
        });
        
        // Partial credit formula: max(0, (correct - incorrect)/totalCorrect)
        return Math.max(0, (score)/totalCorrect);
    }

    selectAnswer(answerIndex, isCorrect) {
        this.userAnswers[this.currentQuestionIndex] = answerIndex;
        
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach((button, index) => {
            button.disabled = true;
            if (index === answerIndex) {
                button.classList.add(isCorrect ? 'correct-answer' : 'incorrect-answer');
            }
            if (this.filteredQuestions[this.currentQuestionIndex].answers[index].correct) {
                button.classList.add('correct-answer');
            }
        });

        if (isCorrect) {
            this.score++;
            this.updateAnalytics('correctAnswer', this.filteredQuestions[this.currentQuestionIndex]);
        } else {
            this.recordWeakArea(this.currentQuestionIndex);
            this.updateAnalytics('incorrectAnswer', this.filteredQuestions[this.currentQuestionIndex]);
        }

        this.updateProgress();
        this.updateQuestionStatus();
        this.showElement('next-btn');
    }

    updateNavigation() {
        const prevButton = document.getElementById('prev-btn');
        const nextButton = document.getElementById('next-btn');
        const submitButton = document.getElementById('submit-btn');
        
        prevButton.disabled = this.currentQuestionIndex === 0;
        nextButton.classList.toggle('d-none', 
            this.currentQuestionIndex === this.filteredQuestions.length - 1
        );
        submitButton.classList.toggle('d-none', 
            this.currentQuestionIndex !== this.filteredQuestions.length - 1
        );
    }

    updateAnalytics(event, question) {
        switch (event) {
            case 'startQuiz':
                this.analytics.totalQuestions += this.filteredQuestions.length;
                break;
            case 'correctAnswer':
                this.analytics.correctAnswers++;
                this.analytics.categories[question.category] = 
                    (this.analytics.categories[question.category] || 0) + 1;
                break;
            case 'incorrectAnswer':
                this.analytics.categories[question.category] = 
                    (this.analytics.categories[question.category] || 0) - 1;
                break;
        }
        localStorage.setItem('quizAnalytics', JSON.stringify(this.analytics));

        // Update quiz-specific analytics
        if (!this.quizAnalytics.categories[question.category]) {
            this.quizAnalytics.categories[question.category] = { correct: 0, total: 0 };
        }
        this.quizAnalytics.categories[question.category].total++;
        if (event === 'correctAnswer') {
            this.quizAnalytics.categories[question.category].correct++;
        }
    }


    displayAnalytics() {
        const analyticsContainer = document.getElementById('analytics');
        analyticsContainer.innerHTML = `
            <div class="card">
                <div class="card-header">Your Performance</div>
                <div class="card-body">
                    <canvas id="performanceChart"></canvas>
                    <div class="mt-3">
                        <h6>Category Performance:</h6>
                        ${Object.entries(this.analytics.categories).map(([category, score]) => `
                            <div class="progress mb-2">
                                <div class="progress-bar" style="width: ${(score / this.analytics.totalQuestions) * 100}%">
                                    ${category}: ${score}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Initialize Chart.js
        const ctx = document.getElementById('performanceChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(this.analytics.difficulties),
                datasets: [{
                    label: 'Performance by Difficulty',
                    data: Object.values(this.analytics.difficulties),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updateNavigation() {
        document.getElementById('prev-btn').disabled = this.currentQuestionIndex === 0;
        document.getElementById('next-btn').classList.toggle('d-none', 
            this.currentQuestionIndex === this.filteredQuestions.length - 1
        );
        document.getElementById('submit-btn').classList.toggle('d-none', 
            this.currentQuestionIndex !== this.filteredQuestions.length - 1
        );
    }

    showNextQuestion() {
        // Check answer before moving to the next question
        const question = this.filteredQuestions[this.currentQuestionIndex];
        if (question.type === 'scenario-dropdown') {
            this.checkScenarioDropdown();
        } else {
            this.checkAnswer();
        }
    
        // Increment progress bar only if moving forward
        if (this.currentQuestionIndex < this.filteredQuestions.length - 1) {
            this.currentQuestionIndex++;
            this.updateProgress(); // Update progress bar
            this.showQuestion();
        }
    }


    showPreviousQuestion() {
        // Decrement progress bar only if moving backward
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.updateProgress(); // Update progress bar
            this.showQuestion();
        }
    }

    updateQuestionStatus() {
        const statusContainer = document.getElementById('question-status');
        statusContainer.innerHTML = '<div class="question-status">' +
            this.filteredQuestions.map((q, index) => `
                <button class="btn btn-sm status-btn ${
                    this.userAnswers[index] !== null ? 'answered' : ''
                } ${index === this.currentQuestionIndex ? 'current' : ''}"
                onclick="quiz.goToQuestion(${index})">
                    ${index + 1}
                </button>
            `).join('') + '</div>';
    }

    goToQuestion(index) {
        if (index >= 0 && index < this.filteredQuestions.length) {
            this.currentQuestionIndex = index;
            this.showQuestion();
        }
    }

    showResults() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        if (question.type === 'scenario-dropdown') {
            this.checkScenarioDropdown();
        } else {
            this.checkAnswer();
        }
    
        this.hideAllSections();
        this.showElement('results');
    
        const percentage = Math.round((this.score / this.filteredQuestions.length) * 100);
        const resultsContent = document.getElementById('results-content');
    
        // Calculate quiz-specific category performance
        const quizCategoryPerformance = {};
        this.filteredQuestions.forEach((q, index) => {
            const isCorrect = this.isAnswerCorrect(q, this.userAnswers[index]);
            if (!quizCategoryPerformance[q.category]) {
                quizCategoryPerformance[q.category] = { correct: 0, total: 0 };
            }
            quizCategoryPerformance[q.category].total++;
            if (isCorrect) quizCategoryPerformance[q.category].correct++;
        });
    
        // Calculate time taken
        const minutes = Math.floor(this.timeElapsed / 60);
        const seconds = this.timeElapsed % 60;
        const timeTaken = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // resultsContent.innerHTML = `
        // <div class="results-container">
        //     <div class="summary-card mb-4">
        //         <h4 class="mb-3">Quiz Summary</h4>
        //         <div class="row">
        //             <div class="col-md-4">
        //                 <div class="card text-white bg-primary mb-3">
        //                     <div class="card-body">
        //                         <h5 class="card-title">Score</h5>
        //                         <p class="card-text">${this.score}/${this.filteredQuestions.length}</p>
        //                     </div>
        //                 </div>
        //             </div>
        //             <div class="col-md-4">
        //                 <div class="card text-white bg-success mb-3">
        //                     <div class="card-body">
        //                         <h5 class="card-title">Percentage</h5>
        //                         <p class="card-text">${percentage}%</p>
        //                     </div>
        //                 </div>
        //             </div>
        //             <div class="col-md-4">
        //                 <div class="card text-white bg-info mb-3">
        //                     <div class="card-body">
        //                         <h5 class="card-title">Time Taken</h5>
        //                         <p class="card-text">${timeTaken}</p>
        //                     </div>
        //                 </div>
        //             </div>
        //         </div>

        //         <div class="mt-4">
        //             <h5>Category Performance (This Quiz)</h5>
        //             ${Object.entries(quizCategoryPerformance).map(([category, stats]) => `
        //                 <div class="mb-3">
        //                     <strong>${category}:</strong>
        //                     <div class="progress">
        //                         <div class="progress-bar" style="width: ${(stats.correct / stats.total) * 100}%">
        //                             ${stats.correct}/${stats.total} (${Math.round((stats.correct / stats.total) * 100)}%)
        //                         </div>
        //                     </div>
        //                 </div>
        //             `).join('')}
        //         </div>
        //     </div>

        //         <div class="incorrect-answers-section">
        //             <h4 class="mb-4">Question Review</h4>
        //             <div class="incorrect-answers-list">
        //                 ${this.filteredQuestions.map((q, index) => {
        //                     const userAnswer = this.userAnswers[index];
        //                     const isCorrect = this.isAnswerCorrect(q, userAnswer);

        //                     return `
        //                         <div class="card mb-4 ${isCorrect ? 'border-success' : 'border-danger'}">
        //                             <div class="card-body">
        //                                 <h5 class="card-title">Question ${index + 1}</h5>
        //                                 <div class="mb-2">
        //                                     <span class="badge bg-secondary">${q.category}</span>
        //                                     <span class="badge ${this.getDifficultyClass(q.difficulty)}">
        //                                         ${q.difficulty}
        //                                     </span>
        //                                 </div>
        //                                 <p class="card-text">${q.question}</p>
                                        
        //                                 <div class="alert ${isCorrect ? 'alert-success' : 'alert-danger'}">
        //                                     <strong>Your Answer:</strong><br>
        //                                     ${this.formatUserAnswer(q, userAnswer)}
        //                                 </div>
                                        
        //                                 ${!isCorrect ? `
        //                                 <div class="alert alert-success">
        //                                     <strong>Correct Answer:</strong><br>
        //                                     ${this.formatCorrectAnswer(q)}
        //                                 </div>` : ''}
                                        
        //                                 <div class="explanation alert alert-info">
        //                                     <strong>Explanation:</strong> ${q.explanation}
        //                                 </div>
        //                             </div>
        //                         </div>
        //                     `;
        //                 }).join('')}
        //             </div>
        //         </div>
        //     </div>
        // `;

    //     resultsContent.innerHTML = `
    //     <div class="results-container">
    //         <!-- ... existing summary cards ... -->
    //         <div class="incorrect-answers-section">
    //             ${this.filteredQuestions.map((q, index) => {
    //                 const userAnswer = this.userAnswers[index];
    //                 const isCorrect = this.isAnswerCorrect(q, userAnswer);

    //                 return `
    //                     <div class="card mb-4 ${isCorrect ? 'border-success' : 'border-danger'}">
    //                         <div class="card-body">
    //                             <h5 class="card-title">Question ${index + 1}</h5>
    //                             ${q.type === 'scenario-dropdown' ? `
    //                                 <div class="scenario-review">
    //                                     <p>${this.reconstructScenarioQuestion(q, userAnswer)}</p>
    //                                 </div>
    //                             ` : `
    //                                 <p class="card-text">${q.question}</p>
    //                             `}
    //                             <!-- ... existing answer displays ... -->
    //                         </div>
    //                     </div>
    //                 `;
    //             }).join('')}
    //         </div>
    //     </div>
    // `;

    resultsContent.innerHTML = `
    <div class="results-container">
            <div class="summary-card mb-4">
                <h4 class="mb-3">Quiz Summary</h4>
                <div class="row">
                    <div class="col-md-4">
                        <div class="card text-white bg-primary mb-3">
                            <div class="card-body">
                                <h5 class="card-title">Score</h5>
                                <p class="card-text">${this.score}/${this.filteredQuestions.length}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card text-white bg-success mb-3">
                            <div class="card-body">
                                <h5 class="card-title">Percentage</h5>
                                <p class="card-text">${percentage}%</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card text-white bg-info mb-3">
                            <div class="card-body">
                                <h5 class="card-title">Time Taken</h5>
                                <p class="card-text">${timeTaken}</p>
                            </div>
                        </div>
                    </div>
                </div>

            <div class="mt-4">
                <h5>Category Performance (This Quiz)</h5>
                ${Object.entries(quizCategoryPerformance).map(([category, stats]) => `
                    <div class="mb-3">
                        <strong>${category}:</strong>
                        <div class="progress">
                            <div class="progress-bar" style="width: ${(stats.correct / stats.total) * 100}%">
                                ${stats.correct}/${stats.total} (${Math.round((stats.correct / stats.total) * 100)}%)
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="incorrect-answers-section">
            <h4 class="mb-4">Question Review</h4>
            <div class="incorrect-answers-list">
                ${this.filteredQuestions.map((q, index) => {
                    const userAnswer = this.userAnswers[index];
                    const isCorrect = this.isAnswerCorrect(q, userAnswer);

                    return `
                        <div class="card mb-4 ${isCorrect ? 'border-success' : 'border-danger'}">
                            <div class="card-body">
                                <h5 class="card-title">Question ${index + 1}</h5>
                                ${q.type === 'scenario-dropdown' ? `
                                    <div class="scenario-review">
                                        <p>${this.reconstructScenarioQuestion(q, userAnswer)}</p>
                                    </div>
                                ` : `
                                    <p class="card-text">${q.question}</p>
                                `}
                                <div class="alert ${isCorrect ? 'alert-success' : 'alert-danger'}">
                                    <strong>Your Answer:</strong><br>
                                    ${this.formatUserAnswer(q, userAnswer)}
                                </div>
                                ${!isCorrect ? `
                                <div class="alert alert-success">
                                    <strong>Correct Answer:</strong><br>
                                    ${this.formatCorrectAnswer(q)}
                                </div>` : ''}
                                <div class="explanation alert alert-info">
                                    <strong>Explanation:</strong> ${q.explanation}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    </div>
`;

        this.initializeChart();
        this.updateChart();
    }

// showResults() {
//     const question = this.filteredQuestions[this.currentQuestionIndex];
//     if (question.type === 'scenario-dropdown') {
//         this.checkScenarioDropdown();
//     } else {
//         this.checkAnswer();
//     }

//     this.hideAllSections();
//     this.showElement('results');

//     const percentage = Math.round((this.score / this.filteredQuestions.length) * 100);
//     const resultsContent = document.getElementById('results-content');

//     // Calculate quiz-specific category performance
//     const quizCategoryPerformance = {};
//     this.filteredQuestions.forEach((q, index) => {
//         const isCorrect = this.isAnswerCorrect(q, this.userAnswers[index]);
//         if (!quizCategoryPerformance[q.category]) {
//             quizCategoryPerformance[q.category] = { correct: 0, total: 0 };
//         }
//         quizCategoryPerformance[q.category].total++;
//         if (isCorrect) quizCategoryPerformance[q.category].correct++;
//     });

//     // Calculate time taken
//     const minutes = Math.floor(this.timeElapsed / 60);
//     const seconds = this.timeElapsed % 60;
//     const timeTaken = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

//     resultsContent.innerHTML = `
//         <div class="results-container">
//             <div class="summary-card mb-4">
//                 <h4 class="mb-3">Quiz Summary</h4>
//                 <div class="row">
//                     <div class="col-md-4">
//                         <div class="card text-white bg-primary mb-3">
//                             <div class="card-body">
//                                 <h5 class="card-title">Score</h5>
//                                 <p class="card-text">${this.score}/${this.filteredQuestions.length}</p>
//                             </div>
//                         </div>
//                     </div>
//                     <div class="col-md-4">
//                         <div class="card text-white bg-success mb-3">
//                             <div class="card-body">
//                                 <h5 class="card-title">Percentage</h5>
//                                 <p class="card-text">${percentage}%</p>
//                             </div>
//                         </div>
//                     </div>
//                     <div class="col-md-4">
//                         <div class="card text-white bg-info mb-3">
//                             <div class="card-body">
//                                 <h5 class="card-title">Time Taken</h5>
//                                 <p class="card-text">${timeTaken}</p>
//                             </div>
//                         </div>
//                     </div>
//                 </div>

//                 <div class="mt-4">
//                     <h5>Category Performance (This Quiz)</h5>
//                     ${Object.entries(quizCategoryPerformance).map(([category, stats]) => `
//                         <div class="mb-3">
//                             <strong>${category}:</strong>
//                             <div class="progress">
//                                 <div class="progress-bar" style="width: ${(stats.correct / stats.total) * 100}%">
//                                     ${stats.correct}/${stats.total} (${Math.round((stats.correct / stats.total) * 100)}%)
//                                 </div>
//                             </div>
//                         </div>
//                     `).join('')}
//                 </div>
//             </div>

//             <div class="incorrect-answers-section">
//                 <h4 class="mb-4">Question Review</h4>
//                 <div class="incorrect-answers-list">
//                     ${this.filteredQuestions.map((q, index) => {
//                         const userAnswer = this.userAnswers[index];
//                         const isCorrect = this.isAnswerCorrect(q, userAnswer);

//                         return `
//                             <div class="card mb-4 ${isCorrect ? 'border-success' : 'border-danger'}">
//                                 <div class="card-body">
//                                     <h5 class="card-title">Question ${index + 1}</h5>
//                                     <div class="mb-2">
//                                         <span class="badge bg-secondary">${q.category}</span>
//                                         <span class="badge ${this.getDifficultyClass(q.difficulty)}">
//                                             ${q.difficulty}
//                                         </span>
//                                     </div>
//                                     <p class="card-text">${q.question}</p>
                                    
//                                     <div class="alert ${isCorrect ? 'alert-success' : 'alert-danger'}">
//                                         <strong>Your Answer:</strong><br>
//                                         ${this.formatUserAnswer(q, userAnswer)}
//                                     </div>
                                    
//                                     ${!isCorrect ? `
//                                     <div class="alert alert-success">
//                                         <strong>Correct Answer:</strong><br>
//                                         ${this.formatCorrectAnswer(q)}
//                                     </div>` : ''}
                                    
//                                     <div class="explanation alert alert-info">
//                                         <strong>Explanation:</strong> ${q.explanation}
//                                     </div>
//                                 </div>
//                             </div>
//                         `;
//                     }).join('')}
//                 </div>
//             </div>
//         </div>
//     `;

//     this.initializeChart();
//     this.updateChart();
// }

    reconstructScenarioQuestion(question, userAnswers) {
        return question.question.replace(/{(\d)}/g, (match, number) => {
            const correctAnswer = question.dropdowns[number].correct;
            const userAnswer = userAnswers[number] || 'Unanswered';
            const isCorrect = userAnswer === correctAnswer;
            
            return `<span class="dropdown-result ${isCorrect ? 'text-success' : 'text-danger'}">
                ${userAnswer} (Correct: ${correctAnswer})
            </span>`;
        });
    }

    isAnswerCorrect(question, userAnswer) {
        if (!userAnswer) return false;
        
        switch (question.type) {
            case 'multiple-choice':
                return question.answers[userAnswer]?.correct || false;
                
            case 'fill-blank':
                return question.answers.some(a => 
                    a.text.toLowerCase() === userAnswer.toLowerCase()
                );
                
            case 'select-all':
                const correctAnswers = new Set(
                    question.answers.filter(a => a.correct).map(a => a.text)
                );
                const userSelections = new Set(userAnswer);
                return (
                    userSelections.size === correctAnswers.size &&
                    [...userSelections].every(val => correctAnswers.has(val))
                );
                
            case 'priority':
                const correctOrder = question.answers
                    .sort((a, b) => a.correctPosition - b.correctPosition)
                    .map(a => a.text);
                return JSON.stringify(userAnswer) === JSON.stringify(correctOrder);
                
            case 'medication-matching':
                const correctPairs = new Set(
                    question.pairs.map(p => `${p.medication}|${p.antidote}`)
                );
                const userPairs = new Set(
                    userAnswer.map(p => `${p.medication}|${p.antidote}`)
                );
                return (
                    userPairs.size === correctPairs.size &&
                    [...userPairs].every(pair => correctPairs.has(pair))
                );
                
            case 'scenario-dropdown':
                return Object.keys(question.dropdowns).every(num => 
                    userAnswer[num] === question.dropdowns[num].correct
                );
                
            default:
                return false;
        }
    }

    formatUserAnswer(question, userAnswer) {
        if (!userAnswer) return 'No answer provided';
        
        switch (question.type) {
            case 'multiple-choice':
                return question.answers[userAnswer]?.text || 'Invalid answer';
                
            case 'fill-blank':
                return userAnswer || 'Empty answer';
                
            case 'select-all':
                return userAnswer.length > 0 
                    ? userAnswer.join(', ')
                    : 'No selections made';
                
            case 'priority':
                return userAnswer.join(' → ');
                
            case 'medication-matching':
                return userAnswer.map(p => `${p.medication} → ${p.antidote}`).join(', ');
                
            case 'scenario-dropdown':
                return Object.values(userAnswer).join(', ') || 'No answer provided';
                
            default:
                return 'Unknown answer format';
        }
    }
    
    
    formatCorrectAnswer(question) {
        if (question.type === 'scenario-dropdown') {
            return Object.keys(question.dropdowns).map(num => 
                question.dropdowns[num].correct
            ).join(', ');
        }
    
        switch (question.type) {
            case 'multiple-choice':
                return question.answers.find(a => a.correct).text;
                
            case 'fill-blank':
                return question.answers[0].text;
                
            case 'select-all':
                return question.answers.filter(a => a.correct).map(a => a.text).join(', ');
                
            case 'priority':
                return question.answers
                    .sort((a, b) => a.correctPosition - b.correctPosition)
                    .map(a => a.text)
                    .join(' → ');
                
            case 'medication-matching':
                return question.pairs.map(p => `${p.medication} → ${p.antidote}`).join(', ');
                
            default:
                return 'Unknown correct answer format';
        }
    }

    // updateProgress() {
    //     const progress = ((this.currentQuestionIndex + 1) / this.filteredQuestions.length) * 100;
    //     const progressBar = document.getElementById('progress-bar');
    //     progressBar.style.width = `${progress}%`;
    //     progressBar.textContent = `${Math.round(progress)}%`;
    // }
    updateProgress() {
        const progress = ((this.currentQuestionIndex + 1) / this.filteredQuestions.length) * 100;
        const progressBar = document.getElementById('progress-bar');
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
    
        // Optional: Change progress bar color based on progress
        if (progress < 33) {
            progressBar.classList.remove('bg-success', 'bg-warning');
            progressBar.classList.add('bg-danger');
        } else if (progress < 66) {
            progressBar.classList.remove('bg-danger', 'bg-success');
            progressBar.classList.add('bg-warning');
        } else {
            progressBar.classList.remove('bg-danger', 'bg-warning');
            progressBar.classList.add('bg-success');
        }
    }

    hideAllSections() {
        ['category-selection', 'question-container', 'results'].forEach(id => 
            document.getElementById(id).classList.add('d-none')
        );
    }

    showElement(id) {
        document.getElementById(id).classList.remove('d-none');
    }

    reviewIncorrectAnswers() {
        const incorrectQuestions = this.filteredQuestions.filter((q, index) => 
            !this.filteredQuestions[index].answers[this.userAnswers[index]]?.correct
        );
        
        if (incorrectQuestions.length === 0) {
            alert('No incorrect answers to review!');
            return;
        }

        this.filteredQuestions = incorrectQuestions;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = new Array(incorrectQuestions.length).fill(null);
        this.showQuestion();
        this.hideAllSections();
        this.showElement('question-container');
    }

     reviewWeakAreas() {
        const weakQuestionIds = Object.keys(this.weakAreas);
        this.filteredQuestions = this.questions.filter(q => 
            weakQuestionIds.includes(q.id.toString())
        );

        if (this.filteredQuestions.length === 0) {
            alert('No weak areas to review!');
            return;
        }

        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = new Array(this.filteredQuestions.length).fill(null);
        this.showQuestion();
        this.hideAllSections();
        this.showElement('question-container');
    }

    // REVISED recordWeakArea METHOD
    recordWeakArea(questionIndex) {
        const question = this.filteredQuestions[questionIndex];
        if (!this.weakAreas[question.id]) {
            this.weakAreas[question.id] = 0;
        }
        this.weakAreas[question.id]++;
        localStorage.setItem('weakAreas', JSON.stringify(this.weakAreas));
    }

    getDifficultyClass(difficulty) {
        switch(difficulty) {
            case 'easy': return 'bg-success';
            case 'medium': return 'bg-warning';
            case 'hard': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    renderScenarioDropdown(question) {
        const answerButtons = document.getElementById('answer-buttons');
        answerButtons.innerHTML = '';
    
        const container = document.createElement('div');
        container.className = 'scenario-container';
    
        // Split question text and replace placeholders
        const parts = question.question.split(/({\d})/g);
        
        parts.forEach(part => {
            if (part.match(/{\d}/)) {
                const dropdownNumber = part.replace(/{|}/g, '');
                const dropdown = this.createScenarioDropdown(question, dropdownNumber);
                container.appendChild(dropdown);
            } else {
                const textSpan = document.createElement('span');
                textSpan.textContent = part;
                container.appendChild(textSpan);
            }
        });
    
        answerButtons.appendChild(container);
    }

    createDropdown(dropdownData) {
        const select = document.createElement('select');
        select.className = 'form-select scenario-dropdown mb-2';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select...';
        select.appendChild(defaultOption);

        // Add options
        dropdownData.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });

        return select;
    }

    createScenarioDropdown(question, number) {
        const dropdown = document.createElement('select');
        dropdown.className = 'form-select scenario-dropdown';
        dropdown.dataset.dropdownNumber = number;
    
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select...';
        dropdown.appendChild(defaultOption);
    
        // Add options
        question.dropdowns[number].options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            dropdown.appendChild(optionElement);
        });
    
        return dropdown;
    }

    checkScenarioDropdown() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const dropdowns = document.querySelectorAll('.scenario-dropdown');
        const userAnswers = {};
        let correctCount = 0;
    
        dropdowns.forEach(dropdown => {
            const number = dropdown.dataset.dropdownNumber;
            const selectedValue = dropdown.value;
            userAnswers[number] = selectedValue;
    
            console.log(`Dropdown ${number}: Selected = ${selectedValue}, Correct = ${question.dropdowns[number].correct}`);
    
            if (selectedValue === question.dropdowns[number].correct) {
                correctCount++;
                dropdown.classList.add('is-valid');
                dropdown.classList.remove('is-invalid');
            } else {
                dropdown.classList.add('is-invalid');
                dropdown.classList.remove('is-valid');
            }
        });
    
        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userAnswers;
        console.log('User Answers:', this.userAnswers);
    
        // Calculate score (1 point per correct answer)
        const totalDropdowns = Object.keys(question.dropdowns).length;
        const score = correctCount; // 1 point per correct answer
        this.score += score;
    
        this.processAnswer(score === totalDropdowns); // Full marks if all answers are correct
        this.updateAnalytics(score === totalDropdowns ? 'correctAnswer' : 'incorrectAnswer', question);
    }


}
// Initialize the quiz
document.addEventListener('DOMContentLoaded', () => {
    window.quiz = new NCLEXQuiz();
});