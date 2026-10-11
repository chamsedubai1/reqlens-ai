import path from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Embeddings for the Coach corpus, computed locally (no API key, no per-call
// cost). BGE-small is a strong small retrieval model: 384-dim vectors, 512-token
// input (our ~300-token chunks fit). The quantized (q8) weights are ~35 MB and
// are downloaded once from Hugging Face on first use, then cached on disk.
export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5"; // 384 dims, see RAG_EMBEDDING_DIMENSIONS

// BGE v1.5 recommends this instruction on short queries (not on passages).
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

env.cacheDir = process.env.RAG_MODEL_CACHE ?? path.join(process.cwd(), ".cache", "models");

let extractor: Promise<FeatureExtractionPipeline> | undefined;

function model(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" }).catch((err) => {
    extractor = undefined; // allow a retry after a failed download
    throw err;
  });
  return extractor;
}

async function embed(texts: string[]): Promise<number[][]> {
  const output = await (await model())(texts, { pooling: "cls", normalize: true });
  return output.tolist() as number[][];
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([QUERY_PREFIX + text]);
  return vector;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) vectors.push(...(await embed(texts.slice(i, i + 16))));
  return vectors;
}
