
import { GoogleGenAI, Type } from "@google/genai";
import { GameStats, AICommentary } from "../types";

export const getGameReview = async (stats: GameStats): Promise<AICommentary> => {
  // Directly using process.env.API_KEY as per core requirements
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The player just finished a game of Snake. 
      Score: ${stats.score}
      Food eaten: ${stats.foodEaten}
      Level reached: ${stats.level}
      High Score: ${stats.highScore}
      Provide a witty, short (1-2 sentences) "Snake Sensei" review of their performance and a creative rank name.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comment: { type: Type.STRING },
            rank: { type: Type.STRING }
          },
          required: ["comment", "rank"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"comment": "Better luck next time, hatchling.", "rank": "Worm"}');
    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      comment: "Your slithering was... adequate. Try not to eat your own tail next time.",
      rank: "Persistent Reptile"
    };
  }
};
