import fs from "fs";
import { embeddingProvider } from "../embedder/embedding"; // Gemini or BGE
import { AtlasCellModel } from "../models/workbook";
import mongoose from "mongoose";

// ------------------ Metrics ------------------
function precisionAtK(retrieved: string[], expected: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  const relevant = topK.filter(r => expected.includes(r)).length;
  return relevant / k;
}

function recallAtK(retrieved: string[], expected: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  const relevant = topK.filter(r => expected.includes(r)).length;
  return relevant / expected.length;
}

function mrr(retrieved: string[], expected: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (expected.includes(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function ndcg(retrieved: string[], expected: string[], k: number): number {
  let dcg = 0;
  let idcg = 0;
  for (let i = 0; i < k; i++) {
    if (expected.includes(retrieved[i])) {
      dcg += 1 / Math.log2(i + 2);
    }
    if (i < expected.length) {
      idcg += 1 / Math.log2(i + 2);
    }
  }
  return idcg > 0 ? dcg / idcg : 0;
}

// ------------------ Evaluator ------------------
async function evaluate() {
  await mongoose.connect(process.env.MONGO_DB_URL||'mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS');

  const tests = JSON.parse(fs.readFileSync("./utils/embeddings_test.json", "utf-8"));
  const model = await embeddingProvider();

  let results: any[] = [];

  for (const test of tests) {
    console.log(`🔎 Query: ${test.query}`);

    // Embed the query
    const qEmbedding = await model.embedContent(test.query);
    const queryVector = qEmbedding.embedding.values;

    console.log("queryVector", ...queryVector);
    // Retrieve candidates from DB (top 20)
    const docs = await AtlasCellModel.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector,
          numCandidates: 100,
          limit: 20
        }
      },
      { $project: { semanticString: 1 } }
    ]);

    const retrieved = docs.map(d => d.semanticString);
    const expected = test.expected;

    // Metrics
    const prec = precisionAtK(retrieved, expected, 5);
    const rec = recallAtK(retrieved, expected, 5);
    const scoreMRR = mrr(retrieved, expected);
    const scoreNDCG = ndcg(retrieved, expected, 10);

    results.push({
      query: test.query,
      "precision@5": prec.toFixed(2),
      "recall@5": rec.toFixed(2),
      mrr: scoreMRR.toFixed(2),
      "ndcg@10": scoreNDCG.toFixed(2)
    });

    console.log(`   ✅ Precision@5: ${prec.toFixed(2)}, Recall@5: ${rec.toFixed(2)}, MRR: ${scoreMRR.toFixed(2)}, NDCG@10: ${scoreNDCG.toFixed(2)}`);
  }

  console.table(results);

  await mongoose.disconnect();
}

export function cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error("Vectors must have same length");
  
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
  
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  

evaluate().catch(err => console.error(err));
