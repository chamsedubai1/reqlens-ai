# Coach corpus

The PDFs in this folder are the ReqLens Coach knowledge base. `npm run rag:ingest`
extracts their text page by page, chunks it, embeds it, and stores it in `rag_chunks`.

- Only add documents you are allowed to publish (your own, public domain, or openly
  licensed). Passages are shown verbatim to anyone on `/coach`.
- Text-based PDFs only. A scanned PDF has no text layer; the ingest script warns
  about it, and it needs OCR first.
- Optional `titles.json` sets display titles instead of PDF metadata or file names:

  ```json
  { "my-guide.pdf": "My Guide (2024 edition)" }
  ```

After changing files here, re-run `npm run rag:ingest`, then update `CORPUS` in
`lib/rag/config.ts` if the topic or the suggested questions changed.
