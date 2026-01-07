📍 Phase 3: AI & RAG Integration
Goal: Add "Omni-Intelligence" using local RAG (Retrieval-Augmented Generation) to talk to your notes and PDFs.

Key Deliverables:
Local AI Engine: * Integrate a sidecar like llama.cpp or connect to an OpenAI/Groq API via the AI-Gateway.

Vector Search (sqlite-vec):

Convert your text blocks and PDF chunks into Vector Embeddings.

Store them in the chunks table you created in Phase 1.

RAG Workflow: * Summarize PDF: AI reads the specific PDF chunks and gives a summary.

Omni-Chat: Ask questions like "What did I write about Biology last month?" and the AI retrieves the exact blocks.

AI Writing Assistant:

Inside the editor, use /ai to expand text, fix grammar, or brainstorm ideas based on your existing notes.