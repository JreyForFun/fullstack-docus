// ---- DOM Elements (IDs must match HTML exactly) ----
// Centralized references to all required DOM elements.
// Using `as` type assertions ensures TypeScript knows the exact element type.
const htmlElements = {
  btnDelete: document.getElementById('delete-btn') as HTMLButtonElement,
  frontText: document.getElementById('front-text') as HTMLTextAreaElement,
  backText: document.getElementById('back-text') as HTMLTextAreaElement,
  btnSave: document.getElementById('save-button') as HTMLButtonElement,
  flashcard: document.getElementById('flashcard') as HTMLDivElement,
  selectedCont: document.getElementById('select-container') as HTMLDivElement,
  errorSpan: document.getElementById('error-span') as HTMLDivElement
};

// ---- Types ----
// Defines the shape of a flashcard object.
// Each card has a question (front) and an answer (back).
interface FlashCard {
  questionText: string;
  questionAnswer: string;
}

// ---- Main Collection ----
// Holds all flashcards currently in memory.
// Starts with one default card for initialization.
let currentCards: FlashCard[] = [
  { questionText: "What is 2 + 2?", questionAnswer: "4" }
];

// Tracks which card is currently selected/displayed.
let selectedIndex = 0;

// ---- Custom Error Class ----
// Specialized error type for invalid user input.
// Makes it easier to distinguish input errors from other runtime errors.
class InvalidUserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserInputError"; // Ensures error.name matches requirement
  }
}

// ---- Core Functions ----

// Adds a new flashcard to the collection and updates localStorage.
function addFlashCard(questionText: string, questionAnswer: string): void {
  const trimmedFront = questionText.trim();
  const trimmedBack = questionAnswer.trim();

  // Requirement 12 – throw error if either field is empty or whitespace-only.
  if (!trimmedFront || !trimmedBack) {
    throw new InvalidUserInputError("Both fields are required!");
  }

  // Create and store the new card.
  const newCard: FlashCard = { questionText: trimmedFront, questionAnswer: trimmedBack };
  currentCards.push(newCard);
  localStorage.setItem("items", JSON.stringify(currentCards));

  // Automatically select the newly added card.
  selectedIndex = currentCards.length - 1;

  // Reset flip state so the card shows its front.
  htmlElements.flashcard.classList.remove("flipped");

  renderCard();
}

// Handles switching between flashcards when a selection button is clicked.
function chooseCard(e: MouseEvent): void {
  const button = (e.target as HTMLElement).closest('button');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (isNaN(index) || index < 0 || index >= currentCards.length) return;

  selectedIndex = index;
  htmlElements.flashcard.classList.remove("flipped");

  // Render the chosen card’s content.
  const chosenCard = currentCards[selectedIndex];
  htmlElements.flashcard.innerHTML = `
      <div class="front-text">${chosenCard.questionText}</div>
      <div class="back-text">${chosenCard.questionAnswer}</div>
  `;
}

// Deletes the currently selected card from the collection.
function deleteCard(): void {
  if (currentCards.length === 0) return;

  // Requirement 8 – remove the flashcard from currentCards.
  currentCards.splice(selectedIndex, 1);
  localStorage.setItem("items", JSON.stringify(currentCards));

  // Requirement 9 – after deletion, show the *previous* card if possible.
  if (currentCards.length > 0) {
    selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
  } else {
    selectedIndex = -1; // No cards left
  }

  renderCard();
}

// Renders the currently selected card and updates the selection buttons.
function renderCard(): void {
  // Clear old content.
  htmlElements.flashcard.innerHTML = "";
  htmlElements.selectedCont.innerHTML = "";

  // Create a button for each card in the collection.
  currentCards.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.className = "change-flashcard-btn";
    btn.textContent = card.questionText;
    btn.dataset.index = String(index);
    btn.addEventListener("click", chooseCard);
    htmlElements.selectedCont.appendChild(btn);
  });

  // Ensure selectedIndex is valid.
  if (selectedIndex === -1 && currentCards.length > 0) {
    selectedIndex = 0;
  }

  // Render the selected card if it exists.
  const chosenCard = currentCards[selectedIndex];
  if (chosenCard) {
    htmlElements.flashcard.innerHTML = `
        <div class="front-text">${chosenCard.questionText}</div>
        <div class="back-text">${chosenCard.questionAnswer}</div>
    `;
  }
}

// ---- Initialization ----
// Runs once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
  // Load saved cards from localStorage if available.
  const stored = localStorage.getItem("items");
  if (stored) {
    currentCards = JSON.parse(stored) as FlashCard[];
  } else {
    localStorage.setItem("items", JSON.stringify(currentCards));
  }

  // Ensure selectedIndex is valid at startup.
  if (currentCards.length === 0) {
    selectedIndex = -1;
  } else if (selectedIndex < 0 || selectedIndex >= currentCards.length) {
    selectedIndex = 0;
  }

  // Save button – adds a new card.
  // Note: we deliberately do NOT catch errors here so tests can detect them.
  htmlElements.btnSave.addEventListener('click', () => {
    addFlashCard(htmlElements.frontText.value, htmlElements.backText.value);
    // Clear any old error message on success.
    htmlElements.errorSpan.textContent = '';
  });

  // Global error handler – catches InvalidUserInputError for UI feedback.
  // This allows the error to still be thrown (for tests) while showing a message.
  window.addEventListener('error', (e) => {
    if (e.error instanceof InvalidUserInputError) {
      htmlElements.errorSpan.textContent = e.error.message;
      htmlElements.errorSpan.style.color = "red";
    }
  });

  // Delete button – removes the currently selected card.
  htmlElements.btnDelete.addEventListener('click', deleteCard);

  // Flashcard click – toggles flip state.
  htmlElements.flashcard.addEventListener('click', () => {
    htmlElements.flashcard.classList.toggle('flipped');
  });

  // Render initial card(s).
  renderCard();
});
