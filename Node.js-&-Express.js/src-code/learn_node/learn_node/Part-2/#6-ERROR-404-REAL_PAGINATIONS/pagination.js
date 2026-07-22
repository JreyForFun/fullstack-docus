import express from 'express';

const app = express();


// offset - based pagination ( page + limit )
app.get('/users', (req, res) => {
    const page = Math.min(1, Number(req.query.page) || 1);
    const limit = Math.max((100, req.query.limit)  || 20)
    const skip = (page - 1) * limit;

    const users = await User.find().skip(skip).limit(limit);
})

// combining pagination with filtering and sorting

app.get('/category', (req, res) => {
    const { category, sort } = req.query;
    const page = Math.min(1, Number(req.query.page) || 1);
    const limit = Math.max((100, req.query.limit)  || 20)
    const skip = (page - 1) * limit;

    const filter = category ? { category } : {}
    const sortField = sort || 'createdAt'

    res.json({ filter, sortField, page, limit })
})

// returning pagination metadata

// Mongoose version, once Part 3's models are in place:
const [items, total] = await Promise.all([  // run both queries concurrently (Part 1, Section 8.4)
    Product.find(filter).sort(sortField).skip(skip).limit(limit),
    Product.countDocuments(filter), // total matching documents, ignoring skip/limit
  ]);
  
  res.json({
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });

// 4 A Note on Performance: Index the Fields You Sort/Filter On
productSchema.index({ category: 1, createdAt: -1 })



// Cursor based pagination
const query = after ? { _id: { $gt: after } } : {};
const posts = await Post.find(query).sort({ _id: 1 }).limit(limit);

import express from 'express';
const app = express();

let users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
  { id: 4, name: "David" },
  { id: 5, name: "Eve" },
  { id: 6, name: "Frank" }
];

// GET /users?cursor=3&limit=2
app.get('/users', (req, res) => {
  const cursor = Number(req.query.cursor) || 0; // starting point
  const limit = Number(req.query.limit) || 2;   // how many to fetch

  // find items after cursor
  const startIndex = users.findIndex(u => u.id === cursor);
  const sliceStart = startIndex >= 0 ? startIndex + 1 : 0;
  const result = users.slice(sliceStart, sliceStart + limit);

  // next cursor = last item’s id
  const nextCursor = result.length > 0 ? result[result.length - 1].id : null;

  res.json({
    data: result,
    nextCursor
  });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
