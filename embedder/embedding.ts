import { InferenceClient } from '@huggingface/inference';
import { config } from 'dotenv';
config({ path: '.env.local' });

export const connectInference=async()=>{
    const HF_TOKEN =process.env.HUGGINGFACE_API_KEY; // Replace with your actual token
const inference = new InferenceClient(HF_TOKEN);
return inference;
}