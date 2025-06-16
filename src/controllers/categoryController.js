const sql = require('../config/db.config');
const fs = require('fs').promises;
const path = require('path');
exports.getAllCategories = async (req, res) => {
  try {
    const result = await sql`SELECT c.id as "Id", c.name as "Name", c.placeholder as "Placeholder", c.background_color as "BackgroundColor", c.keys_background_color as "KeysBackgroundColor", c.keys_color as "KeysColor" FROM categories as c`;
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const {Id, Name, Placeholder, BackgroundColor, KeysBackgroundColor, KeysColor } = req.body;
    const result = await sql`
      INSERT INTO categories (id, name, placeholder, background_color, keys_background_color, keys_color)
      VALUES  (${Id}, ${Name}, ${Placeholder}, ${BackgroundColor}, ${KeysBackgroundColor}, ${KeysColor})
      RETURNING *;
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`SELECT * FROM categories WHERE id = ${id}`;
    if (result.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category', error: error.message });
  }
};

exports.migrateCategoriesFromJson = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../data/categories.json');

    const data = await fs.readFile(filePath, 'utf8');
    const categories = JSON.parse(data);

    for (const category of categories) {
      const {Name, Placeholder, BackgroundColor, KeysBackgroundColor, KeysColor } = category;
      await sql`
        INSERT INTO categories (name, placeholder, background_color, keys_background_color, keys_color)
        VALUES (${Name}, ${Placeholder}, ${BackgroundColor}, ${KeysBackgroundColor}, ${KeysColor})
        ON CONFLICT (id) DO NOTHING; -- Bỏ qua nếu id đã tồn tại
      `;
    }

    res.status(200).json({ message: 'Categories migrated successfully', count: categories.length });
  } catch (error) {
    console.error('Error migrating categories:', error);
    res.status(500).json({ message: 'Error migrating categories', error: error.message });
  }
};