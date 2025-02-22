class QuizAnalytics {
    constructor() {
        this.analyticsData = JSON.parse(localStorage.getItem('quizAnalytics')) || {
            totalQuestions: 0,
            correctAnswers: 0,
            categoryPerformance: {},
            difficultyPerformance: {},
            timeSpent: 0
        };
    }

    recordAnswer(question, isCorrect, timeTaken) {
        // Update analytics data
        this.analyticsData.totalQuestions++;
        if (isCorrect) {
            this.analyticsData.correctAnswers++;
        }
        
        // Update category performance
        this.analyticsData.categoryPerformance[question.category] = 
            (this.analyticsData.categoryPerformance[question.category] || 0) + (isCorrect ? 1 : -1);
        
        // Update difficulty performance
        this.analyticsData.difficultyPerformance[question.difficulty] =
            (this.analyticsData.difficultyPerformance[question.difficulty] || 0) + (isCorrect ? 1 : -1);
        
        // Update time spent
        this.analyticsData.timeSpent += timeTaken;
        
        // Save to localStorage
        localStorage.setItem('quizAnalytics', JSON.stringify(this.analyticsData));
    }

    getPerformanceReport() {
        return {
            accuracy: (this.analyticsData.correctAnswers / this.analyticsData.totalQuestions) * 100,
            categories: this.analyticsData.categoryPerformance,
            difficulties: this.analyticsData.difficultyPerformance,
            timeSpent: this.analyticsData.timeSpent
        };
    }

    displayCategoryPerformance() {
        const container = document.getElementById('category-performance');
        if (!container) return;

        const categories = Object.entries(this.analyticsData.categoryPerformance);
        
        container.innerHTML = `
            <div class="card mt-4">
                <div class="card-header">Category Performance</div>
                <div class="card-body">
                    ${categories.map(([category, score]) => {
                        const total = Math.abs(score) + (score > 0 ? score : 0);
                        const correct = score > 0 ? score : 0;
                        const incorrect = total - correct;
                        
                        return `
                            <div class="mb-3">
                                <h6>${category}</h6>
                                <div class="progress">
                                    <div class="progress-bar bg-success" 
                                         style="width: ${(correct/total)*100}%">
                                        Correct: ${correct}
                                    </div>
                                    <div class="progress-bar bg-danger" 
                                         style="width: ${(incorrect/total)*100}%">
                                        Incorrect: ${incorrect}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

}