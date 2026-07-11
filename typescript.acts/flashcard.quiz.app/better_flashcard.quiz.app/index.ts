// ---- Data Types ----
// Defines the structure of a flashcard.
// Each card has a question (front) and an answer (back).
interface FlashCard {
  questionText: string;
  questionAnswer: string;
}

// ---- Custom Error Class ----
// Specialized error for invalid user input.
// Helps distinguish input validation errors from other runtime issues.
class InvalidUserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserInputError';
    // Ensures prototype chain is correct for instanceof checks.
    Object.setPrototypeOf(this, InvalidUserInputError.prototype);
  }
}

// ---- Application State ----
// Holds all flashcards currently in memory.
const currentCards: FlashCard[] = [];
// Tracks which card is currently selected/displayed.
let currentIndex: number = 0;

// ---- DOM References ----
// Centralized references to all required DOM elements.
// Type assertions ensure TypeScript knows the exact element type.
const flashcardEl = document.getElementById('flashcard') as HTMLDivElement;
const frontContent = document.getElementById('front-content') as HTMLDivElement;
const backContent = document.getElementById('back-content') as HTMLDivElement;
const deleteBtn = document.getElementById('delete-btn') as HTMLButtonElement;
const entryForm = document.getElementById('entry-form') as HTMLFormElement;
const frontText = document.getElementById('front-text') as HTMLTextAreaElement;
const backText = document.getElementById('back-text') as HTMLTextAreaElement;
const cardCounter = document.getElementById('card-counter') as HTMLDivElement;
const currentIndexDisplay = document.getElementById('current-index-display') as HTMLSpanElement;
const totalCardsDisplay = document.getElementById('total-cards-display') as HTMLSpanElement;
const cardCountBadge = document.getElementById('card-count-badge') as HTMLSpanElement;
const errorToast = document.getElementById('error-toast') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLSpanElement;
const errorCloseBtn = document.getElementById('error-close-btn') as HTMLButtonElement;

// ---- Rendering Logic ----
// Updates the UI to show the current card and counters.
function renderCard(): void {
  const total = currentCards.length;

  // Update counters (current index, total cards, badge).
  currentIndexDisplay.textContent = total === 0 ? '0' : String(currentIndex + 1);
  totalCardsDisplay.textContent = String(total);
  cardCountBadge.textContent = String(total);

  // Disable delete button if no cards exist.
  deleteBtn.disabled = total === 0;

  // Always reset flip state when switching cards.
  flashcardEl.classList.remove('flipped');

  // Show placeholder text if no cards exist.
  if (total === 0) {
    frontContent.textContent = 'No cards yet';
    backContent.textContent = 'Add a card to start';
    return;
  }

  // Clamp index to valid range.
  if (currentIndex >= total) currentIndex = total - 1;
  if (currentIndex < 0) currentIndex = 0;

  // Render the selected card.
  const card = currentCards[currentIndex];
  frontContent.textContent = card.questionText;
  backContent.textContent = card.questionAnswer;
}

// ---- Error Handling ----
// Shows an error toast with a message.
function showError(msg: string): void {
  errorMessage.textContent = msg;
  errorToast.classList.add('show');
}

// Hides the error toast.
function hideError(): void {
  errorToast.classList.remove('show');
}

// Close button for error toast.
errorCloseBtn.addEventListener('click', hideError);

// ---- Event Listeners ----

// Flip card on click (only if cards exist).
flashcardEl.addEventListener('click', () => {
  if (currentCards.length === 0) return;
  flashcardEl.classList.toggle('flipped');
});

// Delete the current card.
deleteBtn.addEventListener('click', () => {
  if (currentCards.length === 0) return;
  currentCards.splice(currentIndex, 1);

  // Adjust index after deletion.
  if (currentIndex >= currentCards.length) currentIndex = currentCards.length - 1;
  if (currentIndex < 0) currentIndex = 0;

  renderCard();
  hideError();
});

// Handle form submission for adding new cards.
entryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideError();

  const question = frontText.value.trim();
  const answer = backText.value.trim();

  // Validate input – both fields required.
  if (!question || !answer) {
    const err = new InvalidUserInputError('Both question and answer are required.');
    showError(err.message);
    // Re-throw so automated tests can catch it.
    throw err;
  }

  // Add new card to collection.
  const newCard: FlashCard = { questionText: question, questionAnswer: answer };
  currentCards.push(newCard);
  currentIndex = currentCards.length - 1;

  // Clear form and refocus.
  frontText.value = '';
  backText.value = '';
  frontText.focus();

  renderCard();
});

// ---- Seed Data ----
// Adds sample cards for demonstration.
function seedCards(): void {
  const samples: FlashCard[] = [
    { questionText: 'What is the capital of France?', questionAnswer: 'Paris' },
    { questionText: 'What is 2 + 2?', questionAnswer: '4' },
    { questionText: 'What is the chemical symbol for water?', questionAnswer: 'H₂O' },
  ];
  currentCards.push(...samples);
  currentIndex = 0;
  renderCard();
}

seedCards();

// Expose error class globally for testing.
(window as any).InvalidUserInputError = InvalidUserInputError;

// ---- Debug Logs ----
console.log('✅ Flashcard app ready.');
console.log(`📚 ${currentCards.length} cards loaded.`);
