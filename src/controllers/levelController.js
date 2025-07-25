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

        const existingLevel = await sql`SELECT id FROM levels WHERE id = ${Id}`;
        if (existingLevel.length > 0) {
            return res.status(400).json({ 
                message: 'Level ID already exists', 
                suggestion: 'Please fetch a new ID using /max-level-id endpoint' 
            });
        }

        const levelResult = await sql`
            INSERT INTO levels (id, phrase_symbol_list, full_phrase, category_id, copyright)
            VALUES (${Id}, ${PhraseSymbolList}, ${FullPhrase}, ${CategoryId}, ${Copyright})
            RETURNING *;
        `;
        const level = levelResult[0];        for (const word of Words) {
            console.log('Inserting word:', word);
            await sql`
                INSERT INTO level_words (level_id, word_symbol_list, description)
                VALUES (${Id}, ${word.WordSymbolList}, ${word.Description})
                ON CONFLICT (level_id, word_symbol_list) DO NOTHING;
            `;
        }

        // Thêm level mới vào cuối bảng levelsorder
        await sql`INSERT INTO levelsorder (level_id) VALUES (${Id})`;

        res.status(201).json(level);
    } catch (error) {
        console.error('Error creating level:', error);
        if (error.code === '23505') {
            try {
                await sql`DELETE FROM level_words WHERE level_id = ${req.body.Id}`;
                await sql`DELETE FROM levels WHERE id = ${req.body.Id}`;
            } catch (cleanupError) {
                console.error('Error cleaning up partial level:', cleanupError);
            }
            
            res.status(400).json({ 
                message: 'Level ID already exists', 
                suggestion: 'Please fetch a new ID using /max-level-id endpoint'
            });
        } else {
            res.status(500).json({ message: 'Error creating level', error: error.message });
        }
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
    const result = await sql`
      SELECT COALESCE(MAX(id), 0) + 1 AS max_id FROM levels;
    `;
    
    res.status(200).json({ maxId: result[0].max_id });
    
  } catch (error) {
    console.error('Error fetching max level ID:', error);
    res.status(500).json({ message: 'Error fetching max level ID', error: error.message });
  }
};


exports.getLevelsOrder = async (req, res) => {
    try{
        const result = await sql `select level_id from levelsorder order by id asc`;
        res.status(200).json(result);
    }
    catch (error) {
        console.error('Error fetching levels order:', error);
        res.status(500).json({ message: 'Error fetching levels order', error: error.message });
    }
};



exports.updateLevelOrder = async (req, res) => {
    try {
        const levelsPerGroup = 4;

        const sortedLevels = await sql`
            WITH word_weights AS (
                SELECT word_symbol_list, weight
                FROM words
            ),
            letter_counts AS (
                SELECT 
                    l.id,
                    COUNT(DISTINCT letter) as unique_letters
                FROM levels l,
                LATERAL unnest(string_to_array(l.phrase_symbol_list, '')) as letter
                GROUP BY l.id
            ),
            level_stats AS (
                SELECT 
                    l.id,
                    l.category_id,
                    c.id as category_order,
                    lc.unique_letters AS unique_letter_count,
                    COALESCE(SUM(w.weight), 0) AS total_weight
                FROM levels l
                JOIN categories c ON l.category_id = c.id
                LEFT JOIN level_words lw ON l.id = lw.level_id
                LEFT JOIN word_weights w ON lw.word_symbol_list = w.word_symbol_list
                LEFT JOIN letter_counts lc ON l.id = lc.id
                GROUP BY l.id, l.category_id, c.id, lc.unique_letters
            ),
            sorted_levels AS (
                SELECT 
                    ls.*,
                    ROW_NUMBER() OVER (
                        ORDER BY 
                            ls.unique_letter_count DESC,
                            ls.total_weight ASC
                    ) as difficulty_rank
                FROM level_stats ls
            ),
            grouped_levels AS (
                SELECT 
                    sl.*,
                    CEIL(difficulty_rank::float / ${levelsPerGroup})::integer as group_number
                FROM sorted_levels sl
            ),
            categorized_groups AS (
                SELECT 
                    gl.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY gl.group_number
                        ORDER BY gl.category_order, gl.difficulty_rank
                    ) as position_in_group
                FROM grouped_levels gl
            )
            SELECT id
            FROM categorized_groups
            ORDER BY 
                group_number,
                position_in_group;
        `;


        await sql`TRUNCATE levelsorder`;
        
        for (let i = 0; i < sortedLevels.length; i++) {
            await sql`INSERT INTO levelsorder (level_id) VALUES (${sortedLevels[i].id})`;
        }

        res.status(200).json({
            message: 'Level order updated successfully',
            levelOrder: sortedLevels
        });
    } catch (error) {
        console.error('Error updating level order:', error);
        res.status(500).json({ 
            message: 'Error updating level order', 
            error: error.message 
        });
    }
};

exports.getLevelsByOrder = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const countResult = await sql`
            SELECT COUNT(*) as total FROM levelsorder;
        `;
        const totalItems = parseInt(countResult[0].total);
        const totalPages = Math.ceil(totalItems / pageSize);

        const result = await sql`
            WITH ordered_levels AS (
                SELECT level_id, ROW_NUMBER() OVER (ORDER BY id) as display_order
                FROM levelsorder
            )            SELECT 
                l.id AS "Id",
                l.phrase_symbol_list AS "PhraseSymbolList",
                l.full_phrase AS "FullPhrase",
                l.copyright AS "Copyright",
                l.category_id AS "CategoryId",
                c.name AS "CategoryName",
                c.background_color AS "CategoryBackgroundColor",
                c.keys_background_color AS "CategoryKeysBackgroundColor",
                c.keys_color AS "CategoryKeysColor",
                ol.display_order AS "DisplayOrder",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'WordSymbolList', lw.word_symbol_list,
                            'Description', lw.description
                        )
                    ) FILTER (WHERE lw.word_symbol_list IS NOT NULL),
                    '[]'
                ) AS "Words"
            FROM ordered_levels ol
            JOIN levels l ON l.id = ol.level_id
            LEFT JOIN categories c ON l.category_id = c.id
            LEFT JOIN level_words lw ON l.id = lw.level_id
            WHERE ol.display_order > ${offset} AND ol.display_order <= ${offset + pageSize}            GROUP BY l.id, l.phrase_symbol_list, l.full_phrase, 
                     l.copyright, l.category_id, c.name, c.keys_background_color, 
                     c.keys_color, c.background_color, ol.display_order
            ORDER BY ol.display_order;
        `; 
        
        res.status(200).json({
            items: result,
            pagination: {
                currentPage: page,
                pageSize: pageSize,
                totalItems: totalItems,
                totalPages: totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching ordered levels:', error);
        res.status(500).json({ 
            message: 'Error fetching ordered levels', 
            error: error.message 
        });
    }
};