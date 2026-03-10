import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generarConRetry = async (model, prompt, intentos = 3) => {
  for (let i = 0; i < intentos; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      const esRateLimit = error.status === 429 || error.message?.includes("429");
      if (esRateLimit && i < intentos - 1) {
        const espera = Math.pow(2, i) * 1000;
        console.warn(`Rate limit, reintentando en ${espera}ms...`);
        await new Promise((res) => setTimeout(res, espera));
      } else {
        throw error;
      }
    }
  }
};

export const getModel = (modelName = "gemini-2.5-flash") =>
  genAI.getGenerativeModel({ model: modelName });