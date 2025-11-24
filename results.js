const RESULTS_API_URL = '/api/results';



// ---------- Main loader ----------
async function loadResults() {

    const errorEl = document.getElementById('results-error');

    try {
        
        const response = await fetch(RESULTS_API_URL);

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();

    
    
    //Draw charts
    renderAccuracyChart(data);
    renderResponseTimeChart(data);

    //fill summary cards/ dashboard
    renderSummaryDashboard(data);

    if (errorEl){
        errorEl.textContent = '';
        errorEl.style.display ='none';
    }

    

} catch (err) {
        console.error('Failed to load /api/results:', err);
        if (errorEl) {
            errorEl.textContent = 
            'Unable to load evaluation results. lease try again later.';
            errorEl.style.display = 'block';
        }
    }

}
// ---------- Helpers ----------

// Normalize accuracy array: supports both [0.8, 0.9] and [80, 90]
function normalizeAccuracyToPercent(accuracyArray) {
  if (!Array.isArray(accuracyArray) || accuracyArray.length === 0) {
    return [];
  }

  // If it looks like 0–1 range, convert to %
  const maxVal = Math.max(...accuracyArray);
  if (maxVal <= 1) {
    return accuracyArray.map((v) => v * 100);
  }
  return accuracyArray;
}

function average(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sum = arr.reduce((total, v) => total + v, 0);
  return sum / arr.length;
}

// ---------- Charts ----------

function renderAccuracyChart(data) {
    const canvas = document.getElementById('accuracyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const domains = data.domains || [];
    const accuracyPercent = normalizeAccuracyToPercent(data.accuracy || []);

    new Chart(ctx, {
        type : 'bar',
        data : {
            labels: domains,
            datasets: [
                {
                label: 'Accuracy (%)',
                data: accuracyPercent,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderWidth : 1

            }
        ]
        },
          options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Accuracy (%)'
          }
        }
      },
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw.toFixed(1)}%`
          }
        }
      }
    }

    });
}

function renderResponseTimeChart(data){
    const canvas = document.getElementById('responseTimeChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const domains = data.domains || [];
    const responseTimes = data.avgResponseTimeMs || [];

    new Chart(ctx, {
        type : 'line',
        data: {
            labels: domains,
            datasets: [
                {
                label: 'Avg Response Time (ms)',
                data: data.avgResponseTimeMs,
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                fill: false,
                tension: 0.2

            }
        ]
        },

         options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Time (ms)'
          }
        }
      },
      plugins: {
        legend: {
          display: true
        }
      }
    }

    });
}

// ---------- Summary dashboard ----------

function renderSummaryDashboard(data) {
  const domains = data.domains || [];
  const accuracyPercent = normalizeAccuracyToPercent(data.accuracy || []);
  const responseTimes = data.avgResponseTimeMs || [];
  const questionsPerDomain = data.totalQuestionsPerDomain || [];

  // Overall accuracy = simple average of domain accuracies
  const overallAccuracy = average(accuracyPercent);

  // Overall response time = simple average of per-domain averages
  const overallResponseTime = average(responseTimes);

  // Total questions (if provided)
  const totalQuestions = Array.isArray(questionsPerDomain)
    ? questionsPerDomain.reduce((sum, n) => sum + n, 0)
    : null;

  // Fill summary elements if they exist in HTML
  const overallAccEl = document.getElementById('summary-overall-accuracy');
  const overallTimeEl = document.getElementById('summary-overall-response-time');
  const totalQuestionsEl = document.getElementById('summary-total-questions');

  if (overallAccEl) {
    overallAccEl.textContent = `${overallAccuracy.toFixed(1)}%`;
  }

  if (overallTimeEl) {
    overallTimeEl.textContent = `${overallResponseTime.toFixed(0)} ms`;
  }

  if (totalQuestionsEl) {
    if (totalQuestions !== null) {
      totalQuestionsEl.textContent = `${totalQuestions}`;
    } else {
      totalQuestionsEl.textContent = 'N/A';
    }
  }
}


// Expose an init function so router.js can call it
window.initResultsPage = function () {
  loadResults();
};
loadResults();