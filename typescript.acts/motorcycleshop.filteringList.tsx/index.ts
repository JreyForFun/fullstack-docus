  type Category = 'Sport' | 'Cruiser' | 'Touring' | 'Dirt' | 'Adventure' | 'Naked' | 'Electric';

  interface Motorcycle {
    id: string;
    name: string; 
    manufacturer: string; 
    category: Category; 
    price: number;
    image_url: string;
    created_at: Date;
    description: string;
    year: number;
    engine?: number;
  }

  async function fetchMotorcycles(): Promise<Motorcycle[]> {
    try {
      const response = await fetch("https://cdn.freecodecamp.org/curriculum/labs/data/motorcycles.json");
      const motoData = response.ok ? await response.json() : [];
      return motoData as Motorcycle[];
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  function renderMotorcycleCard(motorcycle: Motorcycle): string {
    return `
      <div class="motorcycle-card">
        <img src="${motorcycle.image_url}" class="motorcycle-card-image-container" />
        <div class="motorcycle-card-year-badge">${motorcycle.year}</div>
        <h2 class="motorcycle-card-title">${motorcycle.name}</h2>
        <div class="motorcycle-card-manufacturer">${motorcycle.manufacturer}</div>
        <div class="motorcycle-card-category">${motorcycle.category}</div>
        <p class="motorcycle-card-description">${motorcycle.description}</p>
        <div class="motorcycle-card-price">${motorcycle.price}</div>
        <div class="motorcycle-card-engine">${motorcycle.engine ?? ''} HP</div>
      </div>
    `;
  }

class MotorcycleGalleryApp {
  private allMotorcycles: Motorcycle[] = [];

  constructor(allMotorcycles: Motorcycle[]) {
    
    if (allMotorcycles) {
      this.allMotorcycles = allMotorcycles;
    }
  }

  public renderMotorcycles(): void {
    
    if (!this.allMotorcycles || this.allMotorcycles.length === 0) return;

    const grid = document.getElementById('motorcycle-grid');
    if (!grid) return;

    grid.innerHTML = "";

    this.allMotorcycles.forEach((motorcycle) => {
      grid.innerHTML += renderMotorcycleCard(motorcycle);
    });
  }

  public display(): void {
    const result = document.getElementById('results-number');
    if (!result) return;
    
    result.textContent = this.allMotorcycles.length.toString();
  }

  public filter(query: string): void {
    const lowerCase = query.toLowerCase().trim();
    const filtered = this.allMotorcycles.filter(m =>
      m.name.toLowerCase().includes(lowerCase) ||
      m.manufacturer.toLowerCase().includes(lowerCase) ||
      m.category.toLowerCase().includes(lowerCase)
    );

    const grid = document.getElementById('motorcycle-grid');
    if (!grid) return;

    grid.innerHTML = "";
    
    filtered.forEach((m) => {
      grid.innerHTML += renderMotorcycleCard(m);
    });

    const result = document.getElementById('results-number');
    if (result) {
      result.textContent = filtered.length.toString();
    }
  }
}

  document.addEventListener('DOMContentLoaded', async () => {
    const motorcycles = await fetchMotorcycles();
    const app = new MotorcycleGalleryApp(motorcycles);

    app.renderMotorcycles();
    app.display();

    const input = document.getElementById("name-filter-input") as HTMLInputElement;

    input.addEventListener("input", (e) => {
      app.filter((e.target as HTMLInputElement).value);
    });
  });