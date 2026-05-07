#!/bin/bash
# setup-semantic.sh — one-time setup for MiniLM semantic matching
# Run from project root: bash scripts/setup-semantic.sh
set -e

echo "=== Semantic setup ==="

mkdir -p semantic/model/Xenova/all-MiniLM-L6-v2/onnx

# Transformers.js v2 ESM bundle (~1.5MB)
echo "Downloading Transformers.js..."
curl -fL "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js" \
  -o "semantic/transformers.min.js"
echo "  → semantic/transformers.min.js ($(du -h semantic/transformers.min.js | cut -f1))"

# MiniLM model files from HuggingFace
BASE="https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main"
MODEL_DIR="semantic/model/Xenova/all-MiniLM-L6-v2"

echo "Downloading model config and tokenizer files..."
for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json; do
  curl -fL "$BASE/$f" -o "$MODEL_DIR/$f"
  echo "  → $MODEL_DIR/$f"
done

echo "Downloading quantized ONNX model (~23MB, this takes a moment)..."
curl -fL "$BASE/onnx/model_quantized.onnx" \
  -o "$MODEL_DIR/onnx/model_quantized.onnx"
echo "  → $MODEL_DIR/onnx/model_quantized.onnx ($(du -h $MODEL_DIR/onnx/model_quantized.onnx | cut -f1))"

# Generate benefit embeddings
echo ""
echo "Generating benefit embeddings..."
pip install sentence-transformers -q
python scripts/embed-benefits.py

echo ""
echo "=== Setup complete ==="
echo "Files ready for deploy:"
du -sh semantic/
