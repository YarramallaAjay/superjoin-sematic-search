import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config({ path: '.env.local' });

let modelLoaded=false;
let model:any;

async function embeddingProvider() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  model=genAI.getGenerativeModel({ model: 'embedding-001' });
  if(model) modelLoaded=true;
  return model;
}


async function makeEmbeddings(semanticStrings:string[]):Promise<number[][]> {
    if(!modelLoaded){
        await embeddingProvider();
    }
    const embeddings: number[][] = [];
    
    for (const string of semanticStrings) {
        try {
            const result = await model.embedContent(string);
            embeddings.push(result.embedding.values);
        } catch (error) {
            console.error('Error embedding text:', error);
            embeddings.push([]);
        }
    }
    
    return embeddings;

}

export { embeddingProvider, makeEmbeddings };
