const sql = require('../config/db.config');

exports.getAllLevels = async (req, res) => {
    try {
      const result = await sql`
        SELECT l.id AS "Id", l.phrase_symbol_list AS "PhraseSymbolList",
          l.full_phrase AS "FullPhrase", l.category_id AS "CategoryId", l.copyright AS "Copyright"
        FROM levels l
        LEFT JOIN categories c ON l.category_id = c.id;
      `;
  
      const wordsResult = await sql`
        SELECT lw.level_id, lw.word_symbol_list, lw.description
        FROM level_words lw
        JOIN levels l ON lw.level_id = l.id;
      `;
  
      result.forEach(level => {
        level.Words = [];
      });
  
      wordsResult.forEach(word => {
        const level = result.find(l => l.Id === word.level_id);
        if (level) {
          level.Words.push({
            WordSymbolList: word.word_symbol_list,
            Description: word.description
          });
        }
      });
  
      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching levels:', error);
      res.status(500).json({ message: 'Error fetching levels', error: error.message });
    }
  };
  

exports.createLevel = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    const { Id, PhraseSymbolList, FullPhrase, CategoryId, Copyright, Words } = req.body;

    const levelResult = await sql`
      INSERT INTO levels (id, phrase_symbol_list, full_phrase, category_id, copyright)
      VALUES (${Id}, ${PhraseSymbolList}, ${FullPhrase}, ${CategoryId}, ${Copyright})
      RETURNING *;
    `;
    const level = levelResult[0];

    for (const word of Words) {
        console.log('Inserting word:', word);
      await sql`
        INSERT INTO level_words (level_id, word_symbol_list, description)
        VALUES (${Id}, ${word.WordSymbolList}, ${word.Description})
        ON CONFLICT (level_id, word_symbol_list) DO NOTHING; -- Tránh trùng lặp
      `;
    }

    await sql`
      INSERT INTO levelorder (levelid) values (${Id})`;
    res.status(201).json(level);
  } catch (error) {
    console.error('Error creating level:', error);
    res.status(500).json({ message: 'Error creating level', error: error.message });
  }
};

exports.getLevelById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sql`
      SELECT l.*, c.name AS category_name, array_agg(json_build_object(
        'word_symbol_list', lw.word_symbol_list,
        'description', lw.description
      )) AS words
      FROM levels l
      LEFT JOIN categories c ON l.category_id = c.id
      LEFT JOIN level_words lw ON l.id = lw.level_id
      WHERE l.id = ${id}
      GROUP BY l.id, c.name;
    `;
    if (result.length === 0) {
      return res.status(404).json({ message: 'Level not found' });
    }
    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching level:', error);
    res.status(500).json({ message: 'Error fetching level', error: error.message });
  }
};

exports.getMaxLevelId = async (req, res) => {
  try {
    const result = await sql`SELECT MAX(id::INTEGER) AS max_id FROM levels`;
    const maxId = result[0].max_id || 0;
    res.status(200).json({ maxId: maxId + 1 });
  } catch (error) {
    console.error('Error fetching max level ID:', error);
    res.status(500).json({ message: 'Error fetching max level ID', error: error.message });
  }
};

exports.getLevelsOrder = async (req, res) => {
    try{
        const result = await sql `select levelid from levelorder order by id asc`;
        res.status(200).json(result);
    }
    catch (error) {
        console.error('Error fetching levels order:', error);
        res.status(500).json({ message: 'Error fetching levels order', error: error.message });
    }
};