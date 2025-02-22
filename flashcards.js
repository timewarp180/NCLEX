class FlashcardSystem {
    constructor() {
        this.cards = [];
        this.currentCardIndex = 0;
        this.loadCards();
    }

    loadCards() {
        this.cards = questions
            .filter(q => q.answers && q.answers.length > 0) // Filter out questions without answers
            .map(q => {
                const correctAnswer = q.answers.find(a => a.correct);
                return {
                    question: q.question,
                    answer: correctAnswer ? correctAnswer.text : 'No correct answer provided', // Handle missing correct answer
                    category: q.category,
                    difficulty: q.difficulty,
                    interval: 1, // Initial interval (in days)
                    nextReview: Date.now(), // Timestamp for next review
                    efactor: 2.5 // Easiness factor for spaced repetition
                };
            });

        console.log('Loaded flashcards:', this.cards);
    }

    showNextCard() {
        if (this.currentCardIndex >= this.cards.length) {
            console.log('All flashcards reviewed!');
            return;
        }

        const card = this.cards[this.currentCardIndex];
        if (Date.now() >= card.nextReview) {
            this.displayCard(card);
        } else {
            this.currentCardIndex++;
            this.showNextCard(); // Skip cards not due for review
        }
    }

    displayCard(card) {
        // Update the UI to show the flashcard
        const flashcardContainer = document.getElementById('flashcard-container');
        if (!flashcardContainer) {
            console.error('Flashcard container not found!');
            return;
        }

        flashcardContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span class="badge bg-secondary">${card.category}</span>
                    <span class="badge ${this.getDifficultyClass(card.difficulty)}">
                        ${card.difficulty}
                    </span>
                </div>
                <div class="card-body">
                    <h5 class="card-title">Question</h5>
                    <p class="card-text">${card.question}</p>
                    <button class="btn btn-primary" onclick="flashcardSystem.showAnswer()">Show Answer</button>
                    <div id="flashcard-answer" class="mt-3 d-none">
                        <h5>Answer</h5>
                        <p>${card.answer}</p>
                        <div class="btn-group">
                            <button class="btn btn-success" onclick="flashcardSystem.rateCard(5)">Easy</button>
                            <button class="btn btn-warning" onclick="flashcardSystem.rateCard(3)">Medium</button>
                            <button class="btn btn-danger" onclick="flashcardSystem.rateCard(1)">Hard</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showAnswer() {
        const answerElement = document.getElementById('flashcard-answer');
        if (answerElement) {
            answerElement.classList.remove('d-none');
        }
    }

    rateCard(quality) {
        if (quality < 1 || quality > 5) {
            console.error('Invalid quality rating. Must be between 1 and 5.');
            return;
        }

        const card = this.cards[this.currentCardIndex];
        if (!card) {
            console.error('No card to rate!');
            return;
        }

        // Update card's spaced repetition parameters
        if (quality < 3) {
            card.interval = 1; // Reset interval if the card was hard
        } else {
            card.interval *= card.efactor; // Increase interval if the card was easy/medium
        }

        // Update easiness factor
        card.efactor = Math.max(1.3, card.efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

        // Schedule next review
        card.nextReview = Date.now() + card.interval * 86400000; // Convert days to milliseconds

        console.log(`Card rated: ${quality}. Next review in ${card.interval} days.`);

        // Move to the next card
        this.currentCardIndex++;
        this.showNextCard();
    }

    getDifficultyClass(difficulty) {
        switch (difficulty) {
            case 'easy': return 'bg-success';
            case 'medium': return 'bg-warning';
            case 'hard': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }
}

// Initialize the flashcard system
const flashcardSystem = new FlashcardSystem();