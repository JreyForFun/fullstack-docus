const htmlElements = {
  btnDelete: document.getElementById('delete-btn') as HTMLButtonElement,
  btnCards: document.getElementById('change-flashcard-btn') as HTMLButtonElement,
  frontText: document.getElementById('front-text') as HTMLTextAreaElement,
  backText: document.getElementById('back-text') as HTMLTextAreaElement, 
  btnSave: document.getElementById('save-button') as HTMLButtonElement
}


interface FlashCard {
  questionText: string;
  questionAnswer: string;
}

function InvalidUserInputError(message: string): never {
  throw new Error(`InvalidUserInputError: ${message}`);
}


const currentCards: FlashCard[] = [
  { questionText: "What is 2 + 2?", questionAnswer: "4" },
];
localStorage.setItem('items', JSON.stringify(currentCards))

const flashcard = document.getElementById('flashcard') as HTMLDivElement;

function addFlashCard(questionText: string, questionAnswer: string){
  if(!questionText || !questionAnswer){
    InvalidUserInputError('Both question and answer are required.')
  }
  
  
  const newCard: FlashCard = { questionText, questionAnswer }

  currentCards.push(newCard);
  localStorage.setItem('items', JSON.stringify(currentCards))
}

function renderCard() {
  const storedCardString = localStorage.getItem("items");
  const storedCard = storedCardString ? JSON.parse(storedCardString) as FlashCard[] : [];

   flashcard.innerHTML = "";

  storedCard.forEach((card) => {
    flashcard.innerHTML += `    
        <div class="front-text">${card.questionText}</div>
        <div class="back-text">${card.questionAnswer}</div>
    `;
  });
}



document.addEventListener('DOMContentLoaded',()=> {renderCard()
htmlElements.btnSave.addEventListener('click', ()=> { addFlashCard(htmlElements.frontText.value, htmlElements.backText.value);
renderCard();
})
flashcard.addEventListener('click', () => {
  flashcard.classList.toggle('flipped');
}) })