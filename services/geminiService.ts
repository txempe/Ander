import { GoogleGenAI, Type } from "@google/genai";
import { ParsingResult } from '../types';

export const parseEmailWithGemini = async (emailText: string): Promise<ParsingResult> => {
  if (!process.env.API_KEY) {
    console.error("API Key not found");
    throw new Error("API Key faltante. Por favor configura tu entorno.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza el siguiente texto de un correo electrónico de confirmación de compra y extrae los datos. 
      Genera un TÍTULO corto y descriptivo (máximo 3-5 palabras).
      Extrae TODOS los productos individuales en una lista (array).
      Busca el NÚMERO DE PEDIDO o REFERENCIA.
      Busca información de contacto.
      
      Texto del email:
      "${emailText}"
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Un título breve para identificar la compra." },
            date: { type: Type.STRING, description: "La fecha de compra ISO 8601 (YYYY-MM-DD)" },
            products: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Lista de nombres exactos de los productos comprados." 
            },
            storeName: { type: Type.STRING, description: "El nombre de la tienda" },
            orderReference: { type: Type.STRING, description: "ID del pedido" },
            amount: { type: Type.NUMBER, description: "Importe total" },
            currency: { type: Type.STRING, description: "Moneda (EUR, USD)" },
            contactInfo: { type: Type.STRING, description: "Email o URL de soporte" }
          },
          required: ["products", "amount", "title"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      
      // Formatear para legacy productName (texto plano)
      let formattedProductName = "";
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
         formattedProductName = data.products.map((p: string) => `• ${p}`).join('\n');
      }

      return {
        title: data.title,
        date: data.date,
        productName: formattedProductName,
        items: data.products || [], // Retornamos el array crudo para el OrderModal
        storeName: data.storeName,
        orderReference: data.orderReference,
        amount: data.amount,
        currency: data.currency,
        contactInfo: data.contactInfo
      } as ParsingResult;
    }
    throw new Error("No se pudo obtener respuesta del modelo.");

  } catch (error) {
    console.error("Error parsing email with Gemini:", error);
    throw error;
  }
};