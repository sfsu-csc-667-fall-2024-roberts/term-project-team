import MonopolyBoard from './board';

// Create board when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Creating test board...');
    new MonopolyBoard('monopoly-board');
    console.log('Test board created successfully');
  } catch (error) {
    console.error('Error creating test board:', error);
  }
}); 