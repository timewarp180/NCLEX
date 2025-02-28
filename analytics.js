class QuizAnalytics {
    constructor() {
        this.analyticsData = JSON.parse(localStorage.getItem('quizAnalytics')) || {
            totalQuestions: 0,
            correctAnswers: 0,
            categoryPerformance: {}, // Ensure this is initialized as an object
            difficultyPerformance: {},
            timeSpent: 0,
            questionTypePerformance: {}
        };
        this.chartInstance = null;
    }

    recordAnswer(question, isCorrect, timeTaken) {
        if (!question || !question.category) {
            console.error('Invalid question object:', question);
            return;
        }
    
        // Update total questions and correct answers
        this.analyticsData.totalQuestions++;
        if (isCorrect) {
            this.analyticsData.correctAnswers++;
        }
    
        // Update category performance
        if (!this.analyticsData.categoryPerformance[question.category]) {
            this.analyticsData.categoryPerformance[question.category] = { correct: 0, incorrect: 0 };
        }
        
        if (isCorrect) {
            this.analyticsData.categoryPerformance[question.category].correct++;
        } else {
            this.analyticsData.categoryPerformance[question.category].incorrect++;
        }
    
        // Update difficulty performance
        if (!this.analyticsData.difficultyPerformance[question.difficulty]) {
            this.analyticsData.difficultyPerformance[question.difficulty] = { correct: 0, incorrect: 0 };
        }
        if (isCorrect) {
            this.analyticsData.difficultyPerformance[question.difficulty].correct++;
        } else {
            this.analyticsData.difficultyPerformance[question.difficulty].incorrect++;
        }
    
        // Update question type performance
        if (!this.analyticsData.questionTypePerformance[question.type]) {
            this.analyticsData.questionTypePerformance[question.type] = { correct: 0, total: 0 };
        }
        this.analyticsData.questionTypePerformance[question.type].total++;
        if (isCorrect) {
            this.analyticsData.questionTypePerformance[question.type].correct++;
        }
    
        // Update time spent
        this.analyticsData.timeSpent += timeTaken;
    
        // Save to localStorage
        localStorage.setItem('quizAnalytics', JSON.stringify(this.analyticsData));
    }

    getPerformanceReport() {
        const accuracy = this.analyticsData.totalQuestions > 0
            ? (this.analyticsData.correctAnswers / this.analyticsData.totalQuestions) * 100
            : 0;

        return {
            accuracy: accuracy,
            categories: this.analyticsData.categoryPerformance,
            difficulties: this.analyticsData.difficultyPerformance,
            timeSpent: this.analyticsData.timeSpent,
            questionTypes: this.analyticsData.questionTypePerformance
        };
    }

displayOverallPerformanceChart(filteredData = null) {
    const chartContainer = document.querySelector('.chart-container');
    const ctx = document.getElementById('overallPerformanceChart');
    const noDataMessage = chartContainer.querySelector('.no-data-message');

    if (!ctx) {
        console.error('Chart canvas not found!');
        return;
    }

    const performanceReport = this.getPerformanceReport();
    const data = filteredData || performanceReport.categories;

    if (!data || Object.keys(data).length === 0) {
        ctx.style.display = 'none';
        if (!noDataMessage) {
            const message = document.createElement('p');
            message.className = 'text-muted no-data-message';
            message.textContent = 'No data available for the selected filter.';
            chartContainer.appendChild(message);
        } else {
            noDataMessage.style.display = 'block';
        }
        return;
    }

    if (noDataMessage) {
        noDataMessage.style.display = 'none';
    }
    ctx.style.display = 'block';

    const labels = Object.keys(data);
    const correctData = labels.map(category => data[category].correct || 0);
    const incorrectData = labels.map(category => data[category].incorrect || 0);

    // Destroy existing chart instance if it exists
    if (this.chartInstance) {
        console.log('Destroying existing chart instance');
        this.chartInstance.destroy();
        this.chartInstance = null; // Clear the reference to the old chart
    }

    // Remove the existing canvas element
    const parent = ctx.parentElement;
    parent.removeChild(ctx);

    // Create a new canvas element
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'overallPerformanceChart';
    parent.appendChild(newCanvas);

    // Get the new context
    const newCtx = newCanvas.getContext('2d');

    // Create new chart instance
    console.log('Creating new chart instance');
    this.chartInstance = new Chart(newCtx, {
        type: 'bar',
        data: {
            labels: labels,
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

    filterByCategory(category) {
        const performanceReport = this.getPerformanceReport();

        if (category === 'all') {
            return performanceReport.categories;
        }

        if (!performanceReport.categories[category]) {
            console.warn(`Category "${category}" not found in performance data.`);
            return {};
        }

        return { [category]: performanceReport.categories[category] };
    }

}

document.addEventListener('DOMContentLoaded', () => {
    const quizAnalytics = new QuizAnalytics();
    quizAnalytics.displayOverallPerformanceChart();

    document.getElementById('category-filter').addEventListener('change', (e) => {
        const filteredData = quizAnalytics.filterByCategory(e.target.value);
        quizAnalytics.displayOverallPerformanceChart(filteredData);
    });
});