require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Neo4j Connection
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// Initialize database
async function initDB() {
  const session = driver.session();
  try {
    await session.run(`
      CREATE CONSTRAINT user_id IF NOT EXISTS
      FOR (u:User)
      REQUIRE u.id IS UNIQUE
    `);
    await session.run(`
      CREATE CONSTRAINT message_id IF NOT EXISTS
      FOR (m:Message)
      REQUIRE m.id IS UNIQUE
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    await session.close();
  }
}

initDB();

// OpenAI API call
async function getAIResponse(prompt, context) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Answer questions based on the provided context.' +
              (context ? `\n\nContext:\n${context}` : '')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    return "I'm sorry, I couldn't process your request.";
  }
}

// Get conversation context from Neo4j
async function getConversationContext(userId) {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:SENT]->(m:Message)
      RETURN m.text AS text
      ORDER BY m.timestamp DESC
      LIMIT 5
    `, { userId });

    return result.records.map(record => record.get('text')).join('\n');
  } catch (error) {
    console.error('Neo4j query error:', error);
    return '';
  } finally {
    await session.close();
  }
}

// API Endpoints
app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;
  
  if (!userId || !message) {
    return res.status(400).json({ error: 'Missing userId or message' });
  }

  const session = driver.session();
  try {
    // Store user message in Neo4j
    await session.run(`
      MERGE (u:User {id: $userId})
      CREATE (u)-[:SENT]->(m:Message {
        id: randomUUID(),
        text: $message,
        timestamp: datetime(),
        isUser: true
      })
    `, { userId, message });

    // Get conversation context
    const context = await getConversationContext(userId);

    // Get AI response
    const aiResponse = await getAIResponse(message, context);

    // Store AI response in Neo4j
    await session.run(`
      MATCH (u:User {id: $userId})
      CREATE (u)-[:RECEIVED]->(m:Message {
        id: randomUUID(),
        text: $response,
        timestamp: datetime(),
        isUser: false
      })
    `, { userId, response: aiResponse });

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await session.close();
  }
});

app.get('/api/history/:userId', async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:SENT|:RECEIVED]->(m:Message)
      RETURN m.text AS text, m.isUser AS isUser, m.timestamp AS timestamp
      ORDER BY m.timestamp
    `, { userId });

    const history = result.records.map(record => ({
      text: record.get('text'),
      isUser: record.get('isUser'),
      timestamp: record.get('timestamp')
    }));

    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await session.close();
  }
});

// Get conversation graph data
app.get('/api/graph/:userId', async (req, res) => {
  const { userId } = req.params;
  const session = driver.session();
  
  try {
    const result = await session.run(`
      MATCH (u:User {id: $userId})-[:SENT|:RECEIVED]->(m:Message)
      OPTIONAL MATCH (m)-[r:RELATED_TO]->(t:Topic)
      RETURN u, m, r, t
    `, { userId });

    const nodes = [];
    const links = [];

    result.records.forEach(record => {
      // Add user node
      const user = record.get('u');
      if (!nodes.find(n => n.id === user.identity.low)) {
        nodes.push({
          id: user.identity.low,
          label: 'User',
          name: user.properties.id,
          type: 'user'
        });
      }

      // Add message node
      const message = record.get('m');
      if (!nodes.find(n => n.id === message.identity.low)) {
        nodes.push({
          id: message.identity.low,
          label: message.properties.text.substring(0, 15) + '...',
          name: message.properties.text,
          type: message.properties.isUser ? 'userMessage' : 'aiMessage',
          timestamp: message.properties.timestamp
        });
      }

      // Add relationship between user and message
      links.push({
        source: user.identity.low,
        target: message.identity.low,
        type: 'sent'
      });

      // Add topic if exists
      const topic = record.get('t');
      if (topic) {
        if (!nodes.find(n => n.id === topic.identity.low)) {
          nodes.push({
            id: topic.identity.low,
            label: topic.properties.name,
            type: 'topic'
          });
        }
        
        // Add relationship between message and topic
        const relation = record.get('r');
        links.push({
          source: message.identity.low,
          target: topic.identity.low,
          type: 'about'
        });
      }
    });

    res.json({ nodes, links });
  } catch (error) {
    console.error('Graph error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await session.close();
  }
});

// Topic extraction endpoint
app.post('/api/extract-topics', async (req, res) => {
  const { messageId, text } = req.body;
  
  try {
    // Use OpenAI to extract topics
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: 'Extract important topics/entities from this text. Return as comma-separated values.'
        }, {
          role: 'user',
          content: text
        }],
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const topics = response.data.choices[0].message.content
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Store topics in Neo4j
    const session = driver.session();
    try {
      for (const topic of topics) {
        await session.run(`
          MATCH (m:Message {id: $messageId})
          MERGE (t:Topic {name: $topic})
          MERGE (m)-[:RELATED_TO]->(t)
        `, { messageId, topic });
      }
    } finally {
      await session.close();
    }

    res.json({ topics });
  } catch (error) {
    console.error('Topic extraction error:', error);
    res.status(500).json({ error: 'Failed to extract topics' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});