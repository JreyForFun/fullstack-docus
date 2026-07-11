
interface FlashCard {
  questionText: string;
  questionAnswer: string;
}

class InvalidUserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserInputError';
    Object.setPrototypeOf(this, InvalidUserInputError.prototype);
  }
}

const currentCards: FlashCard[] = [];
let currentIndex: number = 0;

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


function renderCard(): void {
  const total = currentCards.length;

  // Update counter
  currentIndexDisplay.textContent = total === 0 ? '0' : String(currentIndex + 1);
  totalCardsDisplay.textContent = String(total);
  cardCountBadge.textContent = String(total);

  // Enable / disable delete
  deleteBtn.disabled = total === 0;

  // Remove flipped state when switching cards
  flashcardEl.classList.remove('flipped');

  if (total === 0) {
    frontContent.textContent = 'No cards yet';
    backContent.textContent = 'Add a card to start';
    return;
  }

  // Clamp index
  if (currentIndex >= total) {
    currentIndex = total - 1;
  }
  if (currentIndex < 0) {
    currentIndex = 0;
  }

  const card = currentCards[currentIndex];
  frontContent.textContent = card.questionText;
  backContent.textContent = card.questionAnswer;
}


function showError(msg: string): void {
  errorMessage.textContent = msg;
  errorToast.classList.add('show');
}

function hideError(): void {
  errorToast.classList.remove('show');
}

errorCloseBtn.addEventListener('click', hideError);


flashcardEl.addEventListener('click', () => {
  if (currentCards.length === 0) return;
  flashcardEl.classList.toggle('flipped');
});


deleteBtn.addEventListener('click', () => {
  if (currentCards.length === 0) return;
currentCards.splice(currentIndex, 1);

  if (currentIndex >= currentCards.length) {
    currentIndex = currentCards.length - 1;
  }
  if (currentIndex < 0) {
    currentIndex = 0;
  }

  renderCard();
  hideError();
});

entryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideError();

  const question = frontText.value.trim();
  const answer = backText.value.trim();

  // ── Validate ──
  if (!question || !answer) {
    const err = new InvalidUserInputError(
      'Both question and answer are required.'
    );
    showError(err.message);
    // Re-throw so the test can catch it
    throw err;
  }

  // ── Add card ──
  const newCard: FlashCard = {
    questionText: question,
    questionAnswer: answer,
  };

  currentCards.push(newCard);
  currentIndex = currentCards.length - 1;

  // Clear form
  frontText.value = '';
  backText.value = '';
  frontText.focus();

  renderCard();
});

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


(window as any).InvalidUserInputError = InvalidUserInputError;

console.log('✅ Flashcard app ready.');
console.log(`📚 ${currentCards.length} cards loaded.`);
