interface Item {
  type: 'book' | 'electronics' | 'clothing';
  id: string;
  price: number;
}

interface Book extends Item {
  type: 'book';
  title: string;
  author: string;
}

interface Electronics extends Item {
  type: 'electronics';
  item: string;
  model: string;
  warranty?: number;
}

interface Clothing extends Item {
  type: 'clothing';
  item: string;
  brand: string;
  size?: 'S' | 'M' | 'L';
}

type Product = Book | Electronics | Clothing;

class Collection<T> {
  items: T[];

  constructor(items: T[]) {
    this.items = items;
  }

  getAll(): T[]{
    return this.items
  }

  filter(callback: (item: T) => boolean): T[] {
    return this.items.filter(callback);
  } 
}

function renderProduct(render: Product): string {
  if (render.type === 'book') {
    return `
      <div class="item" id="${render.id}">
        <p class="price">${render.price}</p>
        <p>Book: ${render.title} by ${render.author}</p>
      </div>
    `;
  }

  if (render.type === 'electronics') {
    return `
      <div class="item" id="${render.id}">
        <p class="price">${render.price}</p>
        <p>Electronics: ${render.item} - ${render.model}${render.warranty !== undefined ? ` - Warranty: ${render.warranty} year(s)` : ''}</p>
      </div>
    `;
  }

  if (render.type === 'clothing') {
    return `
      <div class="item" id="${render.id}">
        <p class="price">${render.price}</p>
        <p>Clothing: ${render.item} by ${render.brand}${render.size !== undefined ? ` - Size ${render.size}` : ''}</p>
      </div>
    `;
  }
  throw new Error(`Unknown product type: ${JSON.stringify(render)}`);
}


const products = new Collection<Product>([
  {
    type: 'book',
    id: '1',
    price: 10,
    title: '1984',
    author: 'George Orwell'
  },
  {
    type: 'electronics',
    id: '2',
    price: 200,
    item: 'Smartphone',
    model: 'X100',
    warranty: 12
  },
  {
    type: 'clothing',
    id: '3',
    price: 50,
    item: 'T-Shirt',
    brand: 'Nike',
    size: 'M'
  }
]);

console.log(products.getAll());

function showProducts(filter?: 'book' | 'electronics' | 'clothing') {
  const output = document.getElementById('output');
  if(!output) return;

  const items = filter ? products.filter(p => p.type === filter) : products.getAll();

  const result = items.map(renderProduct).join('');

  output.innerHTML = result;
}



(document.getElementById('all') as HTMLButtonElement).addEventListener('click', () => showProducts());
(document.getElementById('books') as HTMLButtonElement).addEventListener('click', () => showProducts('book'));
(document.getElementById('electronics') as HTMLButtonElement).addEventListener('click', () => showProducts('electronics'));
(document.getElementById('clothing') as HTMLButtonElement).addEventListener('click', () => showProducts('clothing'));

document.addEventListener('DOMContentLoaded', () => {
  showProducts();
});