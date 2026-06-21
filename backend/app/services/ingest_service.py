import tempfile
import os
from datetime import datetime, timezone
from pathlib import Path
from pymongo.database import Database
import gridfs
import voyageai
from llama_index.core import SimpleDirectoryReader
from llama_index.core.node_parser import SentenceSplitter
from config import VOYAGE_API_KEY

voyage_client = voyageai.Client(api_key=VOYAGE_API_KEY)  # type: ignore[attr-defined]

CHUNK_SIZE = 512
CHUNK_OVERLAP = 50
EMBED_MODEL = "voyage-4-large"
EMBED_BATCH_SIZE = 128


def ingest_file(db: Database, file_bytes: bytes, filename: str) -> dict:
    db.documents.create_index("filename", unique=True)

    fs = gridfs.GridFS(db)
    gridfs_id = fs.put(file_bytes, filename=filename)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = os.path.join(tmpdir, filename)
        with open(tmp_path, "wb") as f:
            f.write(file_bytes)
        nodes_raw = SimpleDirectoryReader(tmpdir).load_data()

    splitter = SentenceSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    nodes = splitter.get_nodes_from_documents(nodes_raw)
    texts = [node.get_content() for node in nodes]

    embeddings = _embed_in_batches(texts)

    doc_result = db.documents.insert_one({
        "filename": filename,
        "size_bytes": len(file_bytes),
        "chunk_count": len(texts),
        "gridfs_id": gridfs_id,
        "created_at": datetime.now(timezone.utc),
    })
    document_id = doc_result.inserted_id

    chunk_docs = [
        {
            "document_id": document_id,
            "chunk_index": i,
            "text": texts[i],
            "embedding": embeddings[i],
            "metadata": nodes[i].metadata,
        }
        for i in range(len(texts))
    ]

    if chunk_docs:
        db.chunks.insert_many(chunk_docs)

    db.chunks.create_index([("document_id", 1)])

    return {
        "document_id": str(document_id),
        "filename": filename,
        "chunks_stored": len(chunk_docs),
    }


def _embed_in_batches(texts: list[str]) -> list[list[float]]:
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        result = voyage_client.embed(batch, model=EMBED_MODEL, input_type="document")
        all_embeddings.extend(result.embeddings)  # type: ignore[attr-defined]
    return all_embeddings
