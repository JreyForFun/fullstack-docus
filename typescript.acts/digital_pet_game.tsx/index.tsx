const { useState, useRef } = React;

export const PetGame = () => {
  enum PetAction {
    Eat = 'eat-action',
    Play = 'play-action',
    Sleep = 'sleep-action'
  }

  enum PetMood {
    HAPPY,
    EXCITED,
    CONTENT,
    SAD,
    TIRED,
    SICK,
    HUNGRY,
  }

  const catMoodMap: Record<PetMood, string> = {
  [PetMood.HAPPY]: "😺",
  [PetMood.EXCITED]: "😻",
  [PetMood.CONTENT]: "🐱",
  [PetMood.SAD]: "😿",
  [PetMood.TIRED]: "😴",
  [PetMood.SICK]: "🤒",
  [PetMood.HUNGRY]: "😿",
  };

  const [name, setName] = useState<string>('')
  const [shownDiv, setShownDiv] = useState<boolean>(true);

  const [hunger, setHunger] = useState<number>(0);
  const [energy, setEnergy] = useState<number>(100);
  const [happiness, setHappiness] = useState<number>(100);

  const [mood, setMood] = useState<PetMood>(PetMood.CONTENT);
  const nameInputRef = useRef<HTMLInputElement>(null);



  const handleMood = () => {
  if (hunger > 70) return setMood(PetMood.HUNGRY);
  else if (energy < 30) return setMood(PetMood.TIRED);
  else if (happiness < 30) return setMood(PetMood.SAD);
  else if (happiness > 80 && energy > 70) return setMood(PetMood.EXCITED);
  else if (happiness > 60) return setMood(PetMood.HAPPY);
  else return setMood(PetMood.CONTENT);
};


  React.useEffect(() => {
  const hungerInterval = setInterval(() => {
    setHunger(prev => {
      if (prev >= 100) {
        clearInterval(hungerInterval);
        return 100;
      }
      return prev + 10;
    });
  }, 1000);

  const happinessInterval = setInterval(() => {
    setHappiness(prev => {
      if (prev <= 0) {
        clearInterval(happinessInterval);
        return 0;
      }
      return prev - 10;
    });
  }, 1000);

  return () => {
    clearInterval(hungerInterval);
    clearInterval(happinessInterval);
  };
}, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const petName = nameInputRef.current?.value ?? '';
    setName(petName);
    setShownDiv(false);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }
  const handleAction = (action: PetAction) => {
  switch(action) {
    case PetAction.Eat:
      if(hunger === 100 && energy === 0) break;
      setHunger((prev) => Math.max(prev - 10, 0));
      setEnergy((prev) => Math.min(prev + 10, 100));
      break;

    case PetAction.Play:
  
      setEnergy((prev) => {
        if (prev === 0) return 0;
        return Math.max(prev - 10, 0);
      });

      setHappiness((prev) => {
        if (prev === 100) return 100;
        return Math.min(prev + 10, 100);
      });
      break;


    case PetAction.Sleep:
      if(hunger === 100 && energy === 100) break;
      setHunger((prev) => Math.min(prev + 10, 100));
      setEnergy((prev) => Math.min(prev + 10, 100));
      break;
  }
  handleMood(); 
};

  return (
    <>
      <header>
        <h1>Digital Pet Game</h1>
        <p>Take care of your virtual companion!</p>
      </header>
      {shownDiv ?
        (<section className="base-container info-panel">
          <form className="start-questions" onSubmit={handleSubmit}>
            <label htmlFor="pet-name">What is your pet name?</label>
            <input id="pet-name" type="text" ref={nameInputRef} value={name} onChange={handleChange} required />
            <button id="set-name-btn" type="submit">Start Game</button>
          </form>
        </section>)
        :
        <>
          <section className="base-container info-panel">
              <div className="pet-screen">
                <div className="pet-sprite">{catMoodMap[mood]}</div>
                <h2 className="pet-name" id="pet-name">{name}</h2>
              </div>
              <div className="pet-buttons">
                <button className="pet-button pet-buttons-left" id="eat-action" onClick={() => handleAction(PetAction.Eat)}>EAT</button>
                <button className="pet-button pet-buttons-center" id="play-action" onClick={() => handleAction(PetAction.Play)}>PLAY</button>
                <button className="pet-button pet-buttons-right" id="sleep-action" onClick={() => handleAction(PetAction.Sleep)}>SLEEP</button>
              </div>
            </section>
            <section className="stats-grid">
  
  <div className="stat-bar stat">
    <div className="stat-header">
      <div className="stat-label">
        <span className="stat-icon">🍽️</span>
        <span className="stat-name">Hunger</span>
      </div>
      <span className="stat-value">{hunger}%</span>
    </div>
    <div className="stat-progress">
      <div className="stat-fill high" style={{width: `${hunger}%`}}></div>
    </div>
  </div>
  <div></div>
  <div className="stat-bar stat">
    <div className="stat-header">
      <div className="stat-label">
        <span className="stat-icon">😊</span>
        <span className="stat-name">Happiness</span>
      </div>
      <span className="stat-value">{happiness}%</span>
    </div>
    <div className="stat-progress">
      <div className="stat-fill high" style={{width: `${happiness}%`}}></div>
    </div>
  </div>

  <div className="stat-bar stat">
    <div className="stat-header">
      <div className="stat-label">
        <span className="stat-icon">⚡</span>
        <span className="stat-name">Energy</span>
      </div>
      <span className="stat-value">{energy}%</span>
    </div>
    <div className="stat-progress">
      <div className="stat-fill high" style={{width: `${energy}%`}}></div>
    </div>
  </div>
</section>

            <section className="base-container info-panel">
              <div id="hud">
                <p id="pet-species">Species: Cat</p>
                <p id="pet-fact"><b>Pet Fact:</b> Maine Coons are the most massive breed of house cats. They can weigh up to around 24 pounds</p></div></section></>
      }
    </>
  )
};