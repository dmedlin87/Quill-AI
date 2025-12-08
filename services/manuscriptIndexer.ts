import { GoogleGenAI, Type } from "@google/genai";
import { getApiKey } from "@/config/api";
import { ManuscriptIndex, Contradiction, CharacterIndex } from "../types/schema";

// Support both constructible and factory-style mocks in tests
const createClient = (Ctor: any, options: { apiKey: string }) => {
  try {
    return new Ctor(options);
  } catch {
    return Ctor(options);
  }
};

const apiKey = getApiKey();

const ai = createClient(GoogleGenAI as any, { apiKey });

interface ExtractionResult {
  characters: Array<{
    name: string;
    attributes: Record<string, string>; // { "eye_color": "blue", "hair": "black" }
    position: number; // approximate character index
  }>;
}

// Lightweight extraction for a single paragraph/section
export async function extractEntities(
  text: string, 
  chapterId: string,
  signal?: AbortSignal
): Promise<ExtractionResult> {
  if (!text || text.length < 50) return { characters: [] };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Fast model for incremental work
    contents: `Extract main characters and their physical/biographical attributes from this text. 
    Be precise about physical attributes (eyes, hair, age, height) if mentioned.
    Ignore minor temporary states (e.g. "dirty face").
    
    Text snippet: "${text.slice(0, 30000)}..."`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                attributes: { 
                    type: Type.OBJECT,
                    description: "Key-value pairs of permanent attributes e.g. 'eye_color': 'blue'",
                    nullable: true
                }, 
                position: { type: Type.NUMBER, description: "Approximate character index in text where this is mentioned" }
              },
              required: ["name", "position"]
            }
          }
        }
      }
    }
  });
  
  try {
    const result = JSON.parse(response.text || "{}");
    return {
      characters: result.characters || []
    };
  } catch (error) {
    console.error('[ManuscriptIndexer] Failed to parse extraction result', error);
    return { characters: [] };
  }
}

// Merge extraction into existing index, detecting contradictions
export function mergeIntoIndex(
  existing: ManuscriptIndex,
  extraction: ExtractionResult,
  chapterId: string
): { updatedIndex: ManuscriptIndex; contradictions: Contradiction[] } {
  const contradictions: Contradiction[] = [];
  const updated = structuredClone(existing) as ManuscriptIndex;
  
  // Ensure structure exists
  if (!updated.characters) updated.characters = {};
  if (!updated.lastUpdated) updated.lastUpdated = {};

  for (const char of extraction.characters) {
    // Normalize name key
    const charKey = char.name.trim();
    let entry = updated.characters[charKey];
    
    if (!entry) {
      // New character
      updated.characters[charKey] = {
        name: char.name,
        attributes: {},
        firstMention: { chapterId, position: char.position },
        mentions: [{ chapterId, position: char.position }]
      };
      entry = updated.characters[charKey];
    } else {
       // Existing character
       entry.mentions.push({ chapterId, position: char.position });
    }

    // Process attributes
    if (char.attributes) {
        for (const [attr, newValue] of Object.entries(char.attributes)) {
            // Initialize array if needed
            if (!entry.attributes[attr]) {
                entry.attributes[attr] = [];
            }
            
            const existingValues = entry.attributes[attr];
            
            // Check for contradictions against OTHER chapters (or distinct values in general)
            // We want to avoid flagging "blue" vs "blue" or "blue" vs "Blue"
            const conflict = existingValues.find(
              ev => ev.value.toLowerCase().trim() !== newValue.toLowerCase().trim()
            );
            
            if (conflict) {
              contradictions.push({
                type: 'character_attribute',
                characterName: char.name,
                attribute: attr,
                originalValue: conflict.value,
                originalChapterId: conflict.chapterId,
                newValue: newValue,
                newChapterId: chapterId,
                position: char.position
              });
            }
            
            // Always record the new mention
            entry.attributes[attr].push({ 
                value: newValue, 
                chapterId, 
                position: char.position 
            });
        }
    }
  }
  
  updated.lastUpdated[chapterId] = Date.now();
  return { updatedIndex: updated, contradictions };
}

export function createEmptyIndex(): ManuscriptIndex {
  return {
    characters: {},
    lastUpdated: {}
  };
}