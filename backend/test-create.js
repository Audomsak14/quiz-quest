// Quick test to POST a QuestionSet to the running backend
(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/questionsets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Quick Test Set',
        description: 'Created from test-create.js',
        questions: [
          {
            question: '2+2=?',
            type: 'multiple-choice',
            options: ['3', '4', '5', '6'],
            correctAnswer: '4',
            points: 1,
          },
        ],
        timeLimit: 30,
        createdBy: 'anonymous',
      }),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (e) {
    console.error('Request failed:', e);
  }
})();
