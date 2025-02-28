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
       // this.userAnswers = [];
       this.userAnswers = new Array(questions.length).fill(null); // Initialize with null
       this.weakAreas = JSON.parse(localStorage.getItem('weakAreas')) || {};
        this.quizAnalytics = new QuizAnalytics();
        this.timeElapsed = 0;
        this.timerInterval = null;
        // this.quizAnalytics = {
        //     totalQuestions: 0,
        //     correctAnswers: 0,
        //     categories: {},
        //     difficulties: {}
        // };
        this.chartInstances = {}; // Store chart instances here

        this.quizAnalytics = new QuizAnalytics(); // Initialize quizAnalytics

     //   this.chart = null; // Initialize chart variable
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
        document.getElementById('submit-btn').addEventListener('click', () => this.submitAnswer()); // Ensure this line is present
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

    updateOverallScoreDisplay() {
        const totalQuestions = this.filteredQuestions.length;
        const percentage = totalQuestions > 0 ? (this.score / totalQuestions) * 100 : 0;
    
        // Debugging: Log the values of score, totalQuestions, and percentage
        console.log('Debugging - Overall Score:');
        console.log('Score:', this.score);
        console.log('Total Questions:', totalQuestions);
        console.log('Percentage:', percentage);
    
        // Update the overall score display
        const scoreDisplay = document.getElementById('score-display');
        const progressCircle = document.querySelector('.progress-circle span');
        const progressCircleBg = document.querySelector('.progress-circle');
    
        if (scoreDisplay && progressCircle && progressCircleBg) {
            scoreDisplay.textContent = `${this.score}/${totalQuestions}`;
            progressCircle.textContent = `${percentage.toFixed(1)}%`;
            progressCircleBg.style.background = `conic-gradient(#28a745 ${percentage}%, #e9ecef ${percentage}% 100%)`;
        } else {
            console.error('Score display elements not found in the DOM!');
        }
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
        // this.filteredQuestions = this.questions.filter(q => {
        //     const categoryMatch = this.selectedCategories.includes(q.category);
        //     const difficultyMatch = this.quizDifficulty === 'all' || q.difficulty === this.quizDifficulty;
        //     return categoryMatch && difficultyMatch;
        // });

        this.filteredQuestions = this.questions.filter(q => {
            const categoryMatch = this.selectedCategories.includes(q.category);
            const difficultyMatch = this.quizDifficulty === 'all' || q.difficulty === this.quizDifficulty;
            return categoryMatch && difficultyMatch;
        });
            // Debugging: Log the filtered questions
        console.log('Debugging - Filtered Questions:', this.filteredQuestions);

        if (this.filteredQuestions.length === 0) {
            alert('No questions found with the selected criteria');
            return;
        }



        this.score = 0;
        this.userAnswers = new Array(this.filteredQuestions.length).fill(null);
            // Debugging: Log the reset score and user answers
        console.log('Debugging - Reset Score:', this.score);
        console.log('Debugging - User Answers:', this.userAnswers);
        this.hideAllSections();
        this.showElement('question-container');
        this.currentQuestionIndex = 0;
        this.showQuestion();
        this.updateProgress();

        // Start the timer
        this.startTimer();
        // Pass the first question to updateAnalytics
        if (this.filteredQuestions.length > 0) {
            this.updateAnalytics('startQuiz', this.filteredQuestions[0]);
        }
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
    
        // Display the user's previous answer (if any)
        this.displayPreviousAnswer();
        this.updateNavigation();
        this.updateQuestionStatus();
        

       // Update the overall score display
        this.updateOverallScoreDisplay();

        // Update analytics display only if not a scenario-dropdown question
        // if (question.type !== 'scenario-dropdown') {
        //     this.updateAnalyticsDisplay();
        // }

    }

    displayPreviousAnswer() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];

        if (userAnswer !== null && userAnswer !== undefined) {
            switch (question.type) {
                case 'multiple-choice':
                    const buttons = document.querySelectorAll('.answer-btn');
                    buttons[userAnswer].classList.add('selected');
                    break;

                case 'fill-blank':
                    document.getElementById('fill-blank-input').value = userAnswer;
                    break;

                case 'select-all':
                    const checkboxes = document.querySelectorAll('.form-check-input');
                    checkboxes.forEach((checkbox, index) => {
                        if (userAnswer.includes(question.answers[index].text)) {
                            checkbox.checked = true;
                        }
                    });
                    break;

                case 'priority':
                    const priorityList = document.getElementById('priority-list');
                    if (priorityList) {
                        priorityList.innerHTML = ''; // Clear the list
                        userAnswer.forEach(answerText => {
                            const item = document.createElement('div');
                            item.className = 'priority-item btn btn-light mb-2';
                            item.textContent = answerText;
                            priorityList.appendChild(item);
                        });
                        new Sortable(priorityList, { animation: 150 }); // Reinitialize Sortable
                    }
                    break;

                case 'medication-matching':
                    const medicationMatches = this.medicationMatches;
                    const antiItems = document.querySelectorAll('.anti-item');
                    antiItems.forEach(antiItem => {
                        const antidote = antiItem.textContent;
                        const medication = medicationMatches.get(antidote);
                        if (medication) {
                            antiItem.style.backgroundColor = '#d4edda'; // Green for correct match
                            const medItem = document.querySelector(`.med-item[data-medication='${medication}']`);
                            if (medItem) {
                                medItem.style.display = 'none'; // Hide matched medication
                            }
                        }
                    });
                    break;

                case 'scenario-dropdown':
                    const dropdowns = document.querySelectorAll('.scenario-dropdown');
                    dropdowns.forEach(dropdown => {
                        const dropdownNumber = dropdown.dataset.dropdownNumber;
                        const selectedValue = userAnswer[dropdownNumber];
                        if (selectedValue) {
                            dropdown.value = selectedValue;
                        }
                    });
                    break;
            }
        }
    }

    renderMultipleChoice(question) {
        console.log('Rendering question:', question); // Debugging line
        question.answers.forEach((answer, index) => {
            const button = document.createElement('button');
            button.className = `btn btn-light answer-btn text-start`;
            button.innerHTML = answer.text;
            button.onclick = () => this.selectAnswer(index, answer.correct); // Use arrow function
            ANSWER_BUTTONS.appendChild(button);
        });
    }

      // ======== FOR FILL-BLANK QUESTIONS ========
      renderFillBlank(question) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control mb-3';
        input.id = 'fill-blank-input';
        
        // Save answer on input change (no need to wait for Next)
        input.addEventListener('input', (e) => {
            this.userAnswers[this.currentQuestionIndex] = e.target.value.trim();
        });
        
        ANSWER_BUTTONS.appendChild(input);
    }


    checkFillBlank() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        if (!question) {
            console.error('Question object is undefined in checkFillBlank');
            return;
        }
    
        const input = document.getElementById('fill-blank-input');
        if (!input) {
            console.error('Fill-blank input element not found in the DOM!');
            return;
        }
    
        const userAnswer = input.value.trim().toLowerCase();
        const correctAnswers = question.answers.map(a => a.text.toLowerCase());
        const isCorrect = correctAnswers.includes(userAnswer);
           // Debugging: Log the user's answer
        console.log('Debugging - Fill Blank Answer:', userAnswer);

       // Store user answer
       this.userAnswers[this.currentQuestionIndex] = userAnswer;
    
         // Debugging: Log the userAnswers array
       console.log('Debugging - userAnswers:', this.userAnswers);

        // Update score
        if (isCorrect) this.score++;
   
        this.processAnswer(isCorrect, question); // Pass the question object
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

            // Save answer immediately on checkbox change
            input.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.form-check-input');
                const userAnswers = [];
                checkboxes.forEach((checkbox, idx) => {
                    if (checkbox.checked) {
                        userAnswers.push(question.answers[idx].text);
                    }
                });
                this.userAnswers[this.currentQuestionIndex] = userAnswers;
            });
    
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
        if (!question) {
            console.error('Question object is undefined in checkSelectAll');
            return;
        }
    
        const checkboxes = document.querySelectorAll('.form-check-input');
        if (!checkboxes || checkboxes.length === 0) {
            console.error('Checkbox elements not found in the DOM!');
            return;
        }
    
        const userAnswers = [];
        let correctCount = 0;
    
        checkboxes.forEach((checkbox, index) => {
            if (checkbox.checked) {
                userAnswers.push(question.answers[index].text);
                if (question.answers[index].correct) correctCount++;
            }
        });
        // Debugging: Log the user's answer
        console.log('Debugging - Select All Answer:', userAnswers);
        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userAnswers;
         // Debugging: Log the userAnswers array
         console.log('Debugging - userAnswers:', this.userAnswers);

        // Calculate score (1 point per correct answer)
        const totalCorrect = question.answers.filter(a => a.correct).length;
        const score = correctCount / totalCorrect;
        this.score += score;
    
        this.processAnswer(score === 1, question); // Pass the question object
        this.updateAnalytics(score === 1 ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    renderPriority(question) {
        const list = document.createElement('div');
        list.id = 'priority-list';
        list.className = 'priority-list';

         // Initialize Sortable and save order on change
         new Sortable(list, {
            animation: 150,
            onUpdate: () => {
                const items = [...list.querySelectorAll('.priority-item')];
                this.userAnswers[this.currentQuestionIndex] = items.map(item => item.textContent);
            }
        });

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
        if (!question) {
            console.error('Question object is undefined in checkPriority');
            return;
        }
    
        const items = [...document.querySelectorAll('.priority-item')];
        const userOrder = items.map(item => item.textContent);
        const correctOrder = question.answers.sort((a, b) => a.correctPosition - b.correctPosition).map(a => a.text);
    

        // Debugging: Log the user's answer
        console.log('Debugging - Priority Answer:', userOrder);

        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userOrder;

        // Debugging: Log the userAnswers array
        console.log('Debugging - userAnswers:', this.userAnswers);
    
        // Calculate score (1 point per correct position)
        const correctPositions = userOrder.filter((text, index) => text === correctOrder[index]).length;
        const score = correctPositions / correctOrder.length;
        this.score += score;
    
        this.processAnswer(score === 1, question); // Pass the question object
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

        // Make medications draggable
        document.querySelectorAll('.med-item').forEach(item => {
            item.draggable = true;
            
            item.addEventListener('dragstart', () => {
                draggedItem = item;
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', () => {
                draggedItem = null;
                item.style.opacity = '1';
            });
        });

        // Handle antidote drops
        document.querySelectorAll('.anti-item').forEach(target => {
            target.addEventListener('dragover', e => e.preventDefault());
            
            target.addEventListener('drop', e => {
                e.preventDefault();
                if (!draggedItem) return;

                const medication = draggedItem.textContent;
                const antidote = target.textContent;
                const question = this.filteredQuestions[this.currentQuestionIndex];
                
                // Check if match is correct
                const isCorrect = question.pairs.some(p => 
                    p.medication === medication && p.antidote === antidote
                );

                // Visual feedback
                target.style.backgroundColor = isCorrect ? '#d4edda' : '#f8d7da';
                draggedItem.style.display = 'none';

                // Store the match
                this.medicationMatches.set(medication, antidote);
                
                // Immediately save to userAnswers
                this.userAnswers[this.currentQuestionIndex] = 
                    Array.from(this.medicationMatches.entries())
                         .map(([med, anti]) => ({ medication: med, antidote: anti }));
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
            case 'scenario-dropdown':
                this.checkScenarioDropdown();
                break;
            default:
                console.error('Unknown question type:', question.type);
             //   break;
        }
    }
    
    // submitAnswer() {
    //     const question = this.filteredQuestions[this.currentQuestionIndex];

    //     console.log('Debugging - Current Question:', question);
    //     console.log('Debugging - User Answer:', this.userAnswers[this.currentQuestionIndex]);
    //     // Check the answer for the current question based on its type
    //     switch (question.type) {
    //         case 'multiple-choice':
    //             // Multiple-choice is handled by selectAnswer()
    //             break;
    //         case 'fill-blank':
    //             this.checkFillBlank();
    //             break;
    //         case 'select-all':
    //             this.checkSelectAll();
    //             break;
    //         case 'priority':
    //             this.checkPriority();
    //             break;
    //         case 'medication-matching':
    //             this.checkMedicationMatching();
    //             break;
    //         case 'scenario-dropdown':
    //             this.checkScenarioDropdown();
    //             break;
    //         default:
    //             console.error('Unknown question type:', question.type);
    //             break;
    //     }
    
    //     // Debugging: Log the userAnswers array after checking the answer
    //     console.log('Debugging - userAnswers after check:', this.userAnswers);

    //     // Update navigation to enable/disable buttons
    //     this.updateNavigation();
    
    //     // If this is the last question, show results
    //     if (this.currentQuestionIndex === this.filteredQuestions.length - 1) {
    //         this.showResults();
    //     }
    // }

    submitAnswer() {
        // Force-save answers for the current question before checking
        const currentQuestion = this.filteredQuestions[this.currentQuestionIndex];
        
        switch(currentQuestion.type) {
            case 'fill-blank':
                const fillInput = document.getElementById('fill-blank-input');
                this.userAnswers[this.currentQuestionIndex] = fillInput.value.trim();
                break;
                
            case 'select-all':
                const checkboxes = document.querySelectorAll('.form-check-input');
                const selected = [];
                checkboxes.forEach((checkbox, index) => {
                    if (checkbox.checked) {
                        selected.push(currentQuestion.answers[index].text);
                    }
                });
                this.userAnswers[this.currentQuestionIndex] = selected;
                break;
                
            case 'priority':
                const priorityItems = document.querySelectorAll('.priority-item');
                this.userAnswers[this.currentQuestionIndex] = 
                    Array.from(priorityItems).map(item => item.textContent);
                break;
                
            case 'medication-matching':
                // Already handled by setupDragAndDrop's immediate save
                break;
                
            case 'scenario-dropdown':
                const dropdowns = document.querySelectorAll('.scenario-dropdown');
                const dropdownAnswers = {};
                dropdowns.forEach(dropdown => {
                    const number = dropdown.dataset.dropdownNumber;
                    dropdownAnswers[number] = dropdown.value;
                });
                this.userAnswers[this.currentQuestionIndex] = dropdownAnswers;
                break;
        }

        this.showPreSubmissionModal();
    }


    // Add this method to check medication matching answers
    checkMedicationMatching() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        if (!question) {
            console.error('Question object is undefined in checkMedicationMatching');
            return;
        }
    
        const userAnswers = Array.from(this.medicationMatches.entries()).map(([med, anti]) => ({ medication: med, antidote: anti }));
        const correctPairs = question.pairs;

        // Debugging: Log the user's answer
        console.log('Debugging - Medication Matching Answer:', userAnswers);

        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userAnswers;

        // Debugging: Log the userAnswers array
        console.log('Debugging - userAnswers:', this.userAnswers);
    
        // Calculate score (1 point per correct match)
        const correctMatches = userAnswers.filter(pair => 
            correctPairs.some(cp => cp.medication === pair.medication && cp.antidote === pair.antidote)
        ).length;
    
        const score = correctMatches / correctPairs.length;
        this.score += score;
    
        this.processAnswer(score === 1, question); // Pass the question object
        this.updateAnalytics(score === 1 ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    processAnswer(isCorrect) {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        this.quizAnalytics.recordAnswer(question, isCorrect, 0); // Time taken can be adjusted if needed
    
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
        const question = this.filteredQuestions[this.currentQuestionIndex]; // Get the current question
        // Debugging: Log the selected answer
        console.log('Debugging - Selected Answer Index:', answerIndex);
        console.log('Debugging - Selected Answer Text:', question.answers[answerIndex]?.text);

        this.userAnswers[this.currentQuestionIndex] = answerIndex; // Store the user's answer
        // Debugging: Log the userAnswers array
        console.log('Debugging - userAnswers:', this.userAnswers);
    
        const buttons = document.querySelectorAll('.answer-btn');
        buttons.forEach((button, index) => {
            button.disabled = true;
            if (index === answerIndex) {
                button.classList.add(isCorrect ? 'correct-answer' : 'incorrect-answer');
            }
            if (question.answers[index].correct) {
                button.classList.add('correct-answer');
            }
        });

        if (isCorrect) {
            this.score++;
            this.quizAnalytics.recordAnswer(question, true, 0); // Pass the question object
        } else {
            this.recordWeakArea(this.currentQuestionIndex);
            this.quizAnalytics.recordAnswer(question, false, 0); // Pass the question object
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
        if (!question || !question.category) {
            console.error('Invalid question object:', question);
            return;
        }
    
        if (!this.quizAnalytics.categories) {
            this.quizAnalytics.categories = {};
        }
    
        if (!this.quizAnalytics.categories[question.category]) {
            this.quizAnalytics.categories[question.category] = { correct: 0, total: 0 };
        }
    
        switch (event) {
            case 'startQuiz':
                this.quizAnalytics.totalQuestions += this.filteredQuestions.length;
                break;
            case 'correctAnswer':
                this.quizAnalytics.correctAnswers++;
                this.quizAnalytics.categories[question.category].correct++;
                this.quizAnalytics.categories[question.category].total++;
                break;
            case 'incorrectAnswer':
                this.quizAnalytics.categories[question.category].total++;
                break;
        }
            // Avoid circular references when saving to localStorage
            const analyticsData = {
                totalQuestions: this.quizAnalytics.totalQuestions,
                correctAnswers: this.quizAnalytics.correctAnswers,
                categories: this.quizAnalytics.categories,
                difficulties: this.quizAnalytics.difficulties,
                timeSpent: this.quizAnalytics.timeSpent,
                questionTypePerformance: this.quizAnalytics.questionTypePerformance
            };

            localStorage.setItem('quizAnalytics', JSON.stringify(analyticsData));
        //localStorage.setItem('quizAnalytics', JSON.stringify(this.quizAnalytics));
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
        try {
            const question = this.filteredQuestions[this.currentQuestionIndex];
            if (question.type === 'scenario-dropdown') {
                this.checkScenarioDropdown();
            } else {
                this.checkAnswer();
            }
    
            // Update analytics display
            this.updateAnalyticsDisplay();
    
            if (this.currentQuestionIndex < this.filteredQuestions.length - 1) {
                this.currentQuestionIndex++;
                this.updateProgress();
                this.showQuestion();
            } else {
              //  this.showResults(); // Handle the end of the quiz
              this.showPreSubmissionModal(); // Show modal if trying to go beyond the last question
            }
        } catch (error) {
            console.error('Error in showNextQuestion:', error);
            alert('An error occurred. Please try again.');
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

//     showResults() {
//         this.stopTimer();
//         this.hideAllSections();
//         this.showElement('results');

//         const question = this.filteredQuestions[this.currentQuestionIndex];


//         const percentage = Math.round((this.score / this.filteredQuestions.length) * 100);
//         const resultsContent = document.getElementById('results-content');
    

//             // const quizCategoryPerformance = {};
//             // this.filteredQuestions.forEach((q, index) => {
//             //     const isCorrect = this.isAnswerCorrect(q, this.userAnswers[index]);
//             //     if (!quizCategoryPerformance[q.category]) {
//             //         quizCategoryPerformance[q.category] = { correct: 0, total: 0 };
//             //     }
//             //     quizCategoryPerformance[q.category].total++;
//             //     if (isCorrect) quizCategoryPerformance[q.category].correct++;
//             // });

//                 // Calculate quiz-specific category performance
//             const quizCategoryPerformance = {};
//             this.filteredQuestions.forEach((q, index) => {
//                 const isCorrect = this.isAnswerCorrect(q, this.userAnswers[index]);
//                 if (!quizCategoryPerformance[q.category]) {
//                     quizCategoryPerformance[q.category] = { correct: 0, total: 0 };
//                 }
//                 quizCategoryPerformance[q.category].total++;
//                 if (isCorrect) quizCategoryPerformance[q.category].correct++;
//             });

//             // Calculate time taken
//             const minutes = Math.floor(this.timeElapsed / 60);
//             const seconds = this.timeElapsed % 60;
//             const timeTaken = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

//     resultsContent.innerHTML = `
//     <div class="results-container">
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

//             <div class="mt-4">
//                 <h5>Category Performance (This Quiz)</h5>
//                 ${Object.entries(quizCategoryPerformance).map(([category, stats]) => `
//                     <div class="mb-3">
//                         <strong>${category}:</strong>
//                         <div class="progress">
//                             <div class="progress-bar" style="width: ${(stats.correct / stats.total) * 100}%">
//                                 ${stats.correct}/${stats.total} (${Math.round((stats.correct / stats.total) * 100)}%)
//                             </div>
//                         </div>
//                     </div>
//                 `).join('')}
//             </div>
//         </div>

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
//                                 ${q.type === 'scenario-dropdown' ? `
//                                     <div class="scenario-review">
//                                         <p>${this.reconstructScenarioQuestion(q, userAnswer)}</p>
//                                     </div>
//                                 ` : `
//                                     <p class="card-text">${q.question}</p>
//                                 `}
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

//         // this.initializeChart();
//         // this.updateChart();

//         // Update the overall performance chart AFTER the results are displayed

//         // setTimeout(() => {
//         //     const chartCanvas = document.getElementById('overallPerformanceChart');
//         //     if (chartCanvas) {
//         //         this.quizAnalytics.displayOverallPerformanceChart();
//         //     } else {
//         //         console.error('Chart canvas not found in the DOM!');
//         //     }
//         // }, 0);

//         this.quizAnalytics.displayOverallPerformanceChart();


//         // Update the overall performance chart AFTER the results are displayed
//         // setTimeout(() => {
//         //     this.quizAnalytics.displayOverallPerformanceChart();
//         // }, 0);
//         // this.quizAnalytics.displayOverallPerformanceChart();

   
// }

showResults() {
    this.stopTimer();
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

    // Update the overall performance chart
    this.quizAnalytics.displayOverallPerformanceChart();
}
        reconstructScenarioQuestion(question, userAnswers) {
            return question.question.replace(/{(\d)}/g, (match, number) => {
                const correctAnswer = question.dropdowns[number].correct;
                const userAnswer = userAnswers && userAnswers[number] ? userAnswers[number] : 'Unanswered';
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
        // Ensure filteredQuestions and userAnswers are defined
        if (!this.filteredQuestions || !this.userAnswers) {
            console.error('filteredQuestions or userAnswers is undefined');
            alert('No data available for review.');
            return;
        }
    
        // Filter out incorrect answers
        const incorrectQuestions = this.filteredQuestions.filter((q, index) => {
            const userAnswer = this.userAnswers[index];
            if (userAnswer === null || userAnswer === undefined) {
                return false; // Skip unanswered questions
            }
    
            // Handle different question types
            switch (q.type) {
                case 'multiple-choice':
                    return !q.answers[userAnswer]?.correct;
                case 'fill-blank':
                    const correctAnswers = q.answers.map(a => a.text.toLowerCase());
                    return !correctAnswers.includes(userAnswer.toLowerCase());
                case 'select-all':
                    const correctSelections = q.answers.filter(a => a.correct).map(a => a.text);
                    return !this.arraysEqual(userAnswer, correctSelections);
                case 'priority':
                    const correctOrder = q.answers.sort((a, b) => a.correctPosition - b.correctPosition).map(a => a.text);
                    return !this.arraysEqual(userAnswer, correctOrder);
                case 'medication-matching':
                    const correctPairs = q.pairs.map(p => `${p.medication}|${p.antidote}`);
                    const userPairs = userAnswer.map(p => `${p.medication}|${p.antidote}`);
                    return !this.arraysEqual(userPairs, correctPairs);
                case 'scenario-dropdown':
                    return Object.keys(q.dropdowns).some(num => userAnswer[num] !== q.dropdowns[num].correct);
                default:
                    console.error('Unknown question type:', q.type);
                    return false;
            }
        });
    
        if (incorrectQuestions.length === 0) {
            alert('No incorrect answers to review!');
            return;
        }
    
        // Set up the quiz for reviewing incorrect answers
        this.filteredQuestions = incorrectQuestions;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.userAnswers = new Array(incorrectQuestions.length).fill(null);
        this.showQuestion();
        this.hideAllSections();
        this.showElement('question-container');
    }
    
    // Helper function to compare arrays
      arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    reviewWeakAreas() {
        // Ensure weakAreas and questions are defined
        if (!this.weakAreas || !this.questions) {
            console.error('weakAreas or questions is undefined');
            alert('No weak areas to review.');
            return;
        }
    
        // Get weak question IDs
        const weakQuestionIds = Object.keys(this.weakAreas);
        if (weakQuestionIds.length === 0) {
            alert('No weak areas to review!');
            return;
        }
    
        // Filter questions based on weak areas
        this.filteredQuestions = this.questions.filter(q => weakQuestionIds.includes(q.id.toString()));
    
        if (this.filteredQuestions.length === 0) {
            alert('No weak areas to review!');
            return;
        }
    
        // Set up the quiz for reviewing weak areas
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

           // Save answer immediately on change
           dropdown.addEventListener('change', (e) => {
            const currentAnswers = this.userAnswers[this.currentQuestionIndex] || {};
            currentAnswers[number] = e.target.value;
            this.userAnswers[this.currentQuestionIndex] = currentAnswers;
        });
    
        return dropdown;
    }

    checkScenarioDropdown() {
        const question = this.filteredQuestions[this.currentQuestionIndex];
        if (!question) {
            console.error('Question object is undefined in checkScenarioDropdown');
            return;
        }
    
        const dropdowns = document.querySelectorAll('.scenario-dropdown');
        const userAnswers = {};
        let correctCount = 0;
    
        dropdowns.forEach(dropdown => {
            const number = dropdown.dataset.dropdownNumber;
            const selectedValue = dropdown.value;
            userAnswers[number] = selectedValue;
    
            if (selectedValue === question.dropdowns[number].correct) {
                correctCount++;
            }
        });
    
        // Debugging: Log the user's answer
        console.log('Debugging - Scenario Dropdown Answer:', userAnswers);

        // Store user answers
        this.userAnswers[this.currentQuestionIndex] = userAnswers;

        // Debugging: Log the userAnswers array
        console.log('Debugging - userAnswers:', this.userAnswers);
    
        // Calculate score (1 point per correct answer)
        const totalDropdowns = Object.keys(question.dropdowns).length;
        const score = correctCount / totalDropdowns;
        this.score += score;
    
        this.processAnswer(score === 1, question); // Pass the question object
        this.updateAnalytics(score === 1 ? 'correctAnswer' : 'incorrectAnswer', question);
    }

    updateScoreDisplay() {
        const totalQuestions = this.filteredQuestions.length;
        const percentage = totalQuestions > 0 ? (this.score / totalQuestions) * 100 : 0;
    
        // Update the overall score display
        const scoreDisplay = document.getElementById('score-display');
        const progressCircle = document.querySelector('.progress-circle span');
        const progressCircleBg = document.querySelector('.progress-circle');
    
        if (scoreDisplay && progressCircle && progressCircleBg) {
            scoreDisplay.textContent = `${this.score}/${totalQuestions}`;
            progressCircle.textContent = `${percentage.toFixed(1)}%`;
            progressCircleBg.style.background = `conic-gradient(#28a745 ${percentage}%, #e9ecef ${percentage}% 100%)`;
        } else {
            console.error('Score display elements not found in the DOM!');
        }
    }

    processAnswer(isCorrect, question) {
        if (!question) {
            console.error('Question object is undefined in processAnswer');
            return;
        }    
    
        // Increment score if the answer is correct
        if (isCorrect) {
            this.score++;
        }
        // Debugging: Log the updated score
        console.log('Debugging - Updated Score:', this.score);
        // Record the answer in analytics
        this.quizAnalytics.recordAnswer(question, isCorrect, 0); // Time taken can be adjusted if needed
        // Record weak area if the answer is incorrect
        if (!isCorrect) {
            this.recordWeakArea(this.currentQuestionIndex);
        }
 
        // Enable the "Next" button and disable answer buttons
        NEXT_BTN.classList.remove('hide');
        ANSWER_BUTTONS.querySelectorAll('input, button').forEach(el => el.disabled = true);

        // Update the overall score display
        this.updateOverallScoreDisplay();
       }

    initializeCharts() {
        // Category Performance Chart
        this.categoryChart = new Chart(document.getElementById('categoryChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(this.analytics.categories),
                datasets: [{
                    data: Object.values(this.analytics.categories),
                    backgroundColor: [
                        '#27ae60', '#2980b9', '#f1c40f', '#e74c3c', '#9b59b6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 20
                        }
                    }
                }
            }
        });
    
        // Question Type Chart
        this.typeChart = new Chart(document.getElementById('typeChart'), {
            type: 'bar',
            data: {
                labels: ['Multiple', 'Fill', 'Select', 'Priority', 'Matching', 'Scenario'],
                datasets: [{
                    label: 'Correct',
                    data: [12, 5, 8, 3, 7, 4],
                    backgroundColor: '#27ae60'
                }, {
                    label: 'Incorrect',
                    data: [2, 3, 1, 2, 1, 1],
                    backgroundColor: '#e74c3c'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    updateAnalyticsDisplay() {
        const performanceReport = this.quizAnalytics.getPerformanceReport();
    
        // Ensure categories is not undefined or null
        const categories = performanceReport.categories || {};
    
        // Destroy existing charts if they exist
        if (this.chartInstances.categoryChart) {
            console.log('Destroying existing categoryChart instance');
            this.chartInstances.categoryChart.destroy();
            this.chartInstances.categoryChart = null; // Clear the reference
        }
        if (this.chartInstances.typeChart) {
            console.log('Destroying existing typeChart instance');
            this.chartInstances.typeChart.destroy();
            this.chartInstances.typeChart = null; // Clear the reference
        }
        if (this.chartInstances.difficultyChart) {
            console.log('Destroying existing difficultyChart instance');
            this.chartInstances.difficultyChart.destroy();
            this.chartInstances.difficultyChart = null; // Clear the reference
        }
    
        // Recreate the canvases
        const recreateCanvas = (id) => {
            const oldCanvas = document.getElementById(id);
            if (oldCanvas) {
                const parent = oldCanvas.parentElement;
                parent.removeChild(oldCanvas);
    
                const newCanvas = document.createElement('canvas');
                newCanvas.id = id;
                parent.appendChild(newCanvas);
    
                return newCanvas.getContext('2d');
            }
            return null;
        };
    
        const categoryChartCtx = recreateCanvas('categoryChart');
        const typeChartCtx = recreateCanvas('typeChart');
        const difficultyChartCtx = recreateCanvas('difficultyChart');
    
        // Update Overall Score
        const totalQuestions = performanceReport.totalQuestions;
        const correctAnswers = performanceReport.correctAnswers;
        const overallScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
        document.getElementById('score-display').textContent = `${correctAnswers}/${totalQuestions}`;
        document.querySelector('.progress-circle span').textContent = `${overallScore.toFixed(1)}%`;
        document.querySelector('.progress-circle').style.background = `conic-gradient(#28a745 ${overallScore}%, #e9ecef ${overallScore}% 100%)`;
    
        // Update Total Time
        const minutes = Math.floor(this.timeElapsed / 60);
        const seconds = this.timeElapsed % 60;
        document.getElementById('analytics-timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
        // Update Avg/Question
        const avgTimePerQuestion = totalQuestions > 0 ? (this.timeElapsed / totalQuestions).toFixed(1) : 0;
        document.getElementById('avg-time').textContent = `${avgTimePerQuestion}s`;
    
        // Update Category Mastery Chart
        console.log('Creating new categoryChart instance');
        this.chartInstances.categoryChart = new Chart(categoryChartCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories).map(cat => cat.correct || 0),
                    backgroundColor: [
                        '#27ae60', '#2980b9', '#f1c40f', '#e74c3c', '#9b59b6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 20
                        }
                    }
                }
            }
        });
    
        // Update Question Type Analysis Chart
        console.log('Creating new typeChart instance');
        this.chartInstances.typeChart = new Chart(typeChartCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(performanceReport.questionTypes || {}),
                datasets: [{
                    label: 'Correct',
                    data: Object.values(performanceReport.questionTypes || {}).map(type => type.correct || 0),
                    backgroundColor: '#27ae60'
                }, {
                    label: 'Incorrect',
                    data: Object.values(performanceReport.questionTypes || {}).map(type => (type.total || 0) - (type.correct || 0)),
                    backgroundColor: '#e74c3c'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    
        // Update Difficulty Breakdown Chart
        console.log('Creating new difficultyChart instance');
        this.chartInstances.difficultyChart = new Chart(difficultyChartCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(performanceReport.difficulties || {}),
                datasets: [{
                    label: 'Correct',
                    data: Object.values(performanceReport.difficulties || {}).map(diff => diff.correct || 0),
                    backgroundColor: '#27ae60'
                }, {
                    label: 'Incorrect',
                    data: Object.values(performanceReport.difficulties || {}).map(diff => diff.incorrect || 0),
                    backgroundColor: '#e74c3c'
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    showPreSubmissionModal() {
        const unansweredQuestions = this.checkForUnansweredQuestions();
        const modalBody = document.getElementById('preSubmissionModalBody');
        const confirmSubmitButton = document.getElementById('confirmSubmitButton');

        if (unansweredQuestions.length > 0) {
            modalBody.innerHTML = `
                <p>The following questions are unanswered:</p>
                <ul>
                    ${unansweredQuestions.map(q => `<li>Question ${q}</li>`).join('')}
                </ul>
                <p>Please answer all questions before submitting the quiz.</p>
            `;
            confirmSubmitButton.style.display = 'none';
        } else {
            modalBody.innerHTML = `
                <p>You have answered all questions. Are you sure you want to submit the quiz?</p>
            `;
            confirmSubmitButton.style.display = 'block';
        }

        const preSubmissionModal = new bootstrap.Modal(document.getElementById('preSubmissionModal'));
        preSubmissionModal.show();
    }

    
//    checkForUnansweredQuestions() {
//         const unansweredQuestions = [];

//         this.filteredQuestions.forEach((question, index) => {
//             const userAnswer = this.userAnswers[index];
//             if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
//                 unansweredQuestions.push(index + 1); // Add question number (1-based index)
//             }
//         });

//         console.log('Unanswered questions:', unansweredQuestions); // Debugging line
//         return unansweredQuestions;
//     }

// checkForUnansweredQuestions() {
//     const unansweredQuestions = [];

//     this.filteredQuestions.forEach((question, index) => {
//         const userAnswer = this.userAnswers[index];
//         let isAnswered = false;

//         switch (question.type) {
//             case 'multiple-choice':
//                 isAnswered = userAnswer !== null && userAnswer !== undefined;
//                 break;
//             case 'fill-blank':
//                 isAnswered = userAnswer !== null && userAnswer !== undefined && userAnswer.trim() !== '';
//                 break;
//             case 'select-all':
//                 isAnswered = userAnswer !== null && userAnswer !== undefined && userAnswer.length > 0;
//                 break;
//             case 'priority':
//                 isAnswered = userAnswer !== null && userAnswer !== undefined && userAnswer.length > 0;
//                 break;
//             case 'medication-matching':
//                 isAnswered = userAnswer !== null && userAnswer !== undefined && userAnswer.length > 0;
//                 break;
//             case 'scenario-dropdown':
//                 isAnswered = userAnswer !== null && userAnswer !== undefined && Object.keys(userAnswer).length > 0;
//                 break;
//         }

//         if (!isAnswered) {
//             unansweredQuestions.push(index + 1); // Add question number (1-based index)
//         }
//     });

//     return unansweredQuestions;
// }

checkForUnansweredQuestions() {
    const unansweredQuestions = [];

    this.filteredQuestions.forEach((question, index) => {
        const userAnswer = this.userAnswers[index];
        let isAnswered = false;

        switch (question.type) {
            case 'multiple-choice':
                isAnswered = userAnswer !== null && userAnswer !== undefined;
                break;
            case 'fill-blank':
                isAnswered = userAnswer?.trim() !== '';
                break;
            case 'select-all':
                isAnswered = userAnswer?.length > 0;
                break;
            case 'priority':
                isAnswered = userAnswer?.length === question.answers.length;
                break;
            case 'medication-matching':
                isAnswered = userAnswer?.length === question.pairs.length;
                break;
            case 'scenario-dropdown':
                // Check if all dropdowns have values
                isAnswered = userAnswer && 
                    Object.keys(userAnswer).length === Object.keys(question.dropdowns).length &&
                    Object.values(userAnswer).every(val => val !== '');
                break;
        }

        if (!isAnswered) {
            unansweredQuestions.push(index + 1);
        }
    });

    return unansweredQuestions;
}
    
}

document.getElementById('confirmSubmitButton').addEventListener('click', () => {
    const preSubmissionModal = bootstrap.Modal.getInstance(document.getElementById('preSubmissionModal'));
    preSubmissionModal.hide();

    // Show the quiz results
    quiz.showResults(); // Use the global `quiz` instance
});

// document.getElementById('confirmSubmitButton').addEventListener('click', () => {
//     // Hide the modal
//     const preSubmissionModal = bootstrap.Modal.getInstance(document.getElementById('preSubmissionModal'));
//     preSubmissionModal.hide();

//     // Show the quiz results
//     this.showResults();
// });
// Initialize the quiz
// document.addEventListener('DOMContentLoaded', () => {
//     window.quiz = new NCLEXQuiz();
//     window.quizAnalytics = new QuizAnalytics();
// });

// Initialize the quiz
document.addEventListener('DOMContentLoaded', () => {
    window.quiz = new NCLEXQuiz();
});