const sql = require('../config/db.config');
const fs = require('fs').promises;
const path = require('path');
exports.getAllWords = async (req, res) => {
  try {
    const result = await sql`SELECT w.word_symbol_list as "WordSymbolList", w.definitions as "Definitions", w.weight as "Weight" FROM words as w`;
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching words:', error);
    res.status(500).json({ message: 'Error fetching words', error: error.message });
  }
};

exports.createWord = async (req, res) => {
  try {
    const { word_symbol_list, definitions, weight } = req.body;
    const result = await sql`
      INSERT INTO words (word_symbol_list, definitions, weight)
      VALUES (${word_symbol_list}, ${JSON.stringify(definitions)}, ${weight})
      RETURNING *;
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating word:', error);
    res.status(500).json({ message: 'Error creating word', error: error.message });
  }
};

exports.migrateWordsFromJson = async (req, res) => {
    try {
      const filePath = path.join(__dirname, '../../data/words.json');
  
      const data = await fs.readFile(filePath, 'utf8');
      const words = JSON.parse(data);
  
      for (const word of words) {
        const { WordSymbolList, Definitions, Weight } = word;
        await sql`
          INSERT INTO words (word_symbol_list, definitions, weight)
          VALUES (${WordSymbolList}, ${JSON.stringify(Definitions)}, ${Weight})
          ON CONFLICT (word_symbol_list) DO NOTHING; -- Bỏ qua nếu word_symbol_list đã tồn tại
        `;
      }
  
      res.status(200).json({ message: 'Words migrated successfully', count: words.length });
    } catch (error) {
      console.error('Error migrating words:', error);
      res.status(500).json({ message: 'Error migrating words', error: error.message });
    }
};
